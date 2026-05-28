import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'bulela.db'));

// Initialize RAG tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS textbook_content (
    id INTEGER PRIMARY KEY,
    source TEXT,
    topic TEXT,
    chapter TEXT,
    section TEXT,
    subsection TEXT,
    content TEXT,
    page_number INTEGER,
    chunk_index INTEGER,
    total_chunks INTEGER,
    difficulty_level TEXT,
    learning_objectives TEXT,
    chunk_type TEXT
  );

  CREATE TABLE IF NOT EXISTS teaching_module_index (
    id INTEGER PRIMARY KEY,
    module_name TEXT,
    topic TEXT,
    learning_objective TEXT,
    activities TEXT,
    assessment_type TEXT,
    duration_minutes INTEGER,
    difficulty_level TEXT
  );
`);

// Initialize FTS5 index
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS textbook_fts USING fts5(
      topic, chapter, section, content,
      content='textbook_content',
      content_rowid='id'
    )
  `);
} catch (e) {
  console.warn("FTS5 might not be supported. Search will use 'LIKE'.");
}

// Initialize dictionary table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL
  );
`);

// Initialize dictionary FTS5 index
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_fts USING fts5(
      term,
      definition,
      content='dictionary',
      content_rowid='id'
    )
  `);
} catch (e) {
  console.warn("Dictionary FTS5 might not be supported.");
}

// --- OPTIMIZED CONFIGURATION ---
const CHUNK_SIZE = 800;
const OVERLAP = 200;
const DATA_DIR = path.join(__dirname, 'data');
const MIN_CHUNK_LENGTH = 50; // Skip chunks shorter than this
const MAX_CHUNK_LENGTH = 5000; // Cap chunk length to prevent bloat

interface TextbookEntry {
  topic?: string;
  chapter?: string;
  section?: string;
  subsection?: string;
  content: string;
  page_number?: number;
  learning_objectives?: string;
  difficulty_level?: string;
  chunk_type?: string;
}

interface TeachingModuleEntry {
  module_name: string;
  topic: string;
  learning_objective: string;
  activities?: string;
  assessment_type?: string;
  duration_minutes?: number;
  difficulty_level?: string;
}

// Quality filters
function isNoise(text: string): boolean {
  // Skip if mostly numbers or special characters
  const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
  if (alphaRatio < 0.3) return true;

  // Skip if mostly HTML tags
  const htmlRatio = (text.match(/<[^>]*>/g) || []).length / (text.length / 10);
  if (htmlRatio > 0.5) return true;

  // Skip if just page numbers
  if (/^\d+(\s+\d+)*$/.test(text.trim())) return true;

  // Skip if very short
  if (text.length < MIN_CHUNK_LENGTH) return true;

  return false;
}

// Deduplication using Set
const seenChunks = new Set<string>();

function isDuplicate(content: string): boolean {
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
  if (seenChunks.has(normalized)) return true;
  seenChunks.add(normalized);
  return false;
}

/**
 * OPTIMIZED: Smart chunking on sentence boundaries
 */
function smartChunkText(text: string, targetSize: number = 800): { chunk: string; metadata: { type: string } }[] {
  if (!text || text.length === 0) return [];

  // Cap text length
  if (text.length > MAX_CHUNK_LENGTH) {
    text = text.substring(0, MAX_CHUNK_LENGTH);
  }

  // Split on sentence boundaries (., !, ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: { chunk: string; metadata: { type: string } }[] = [];
  let currentChunk = '';
  let hasExample = false;
  let hasDefinition = false;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    // Detect content type
    if (trimmedSentence.toLowerCase().includes('example') || trimmedSentence.toLowerCase().includes('e.g')) {
      hasExample = true;
    }
    if (trimmedSentence.toLowerCase().includes('is a') || trimmedSentence.toLowerCase().includes('defined as')) {
      hasDefinition = true;
    }

    // Add sentence if chunk won't exceed target size
    if ((currentChunk + trimmedSentence).length > targetSize && currentChunk.length > 0) {
      // Determine chunk type
      let type = 'explanation';
      if (hasDefinition) type = 'definition';
      if (hasExample) type = 'example';

      const chunkContent = currentChunk.trim();
      if (!isNoise(chunkContent) && !isDuplicate(chunkContent)) {
        chunks.push({
          chunk: chunkContent,
          metadata: { type }
        });
      }

      currentChunk = trimmedSentence;
      hasExample = false;
      hasDefinition = false;
    } else {
      currentChunk += ' ' + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    let type = 'explanation';
    if (hasDefinition) type = 'definition';
    if (hasExample) type = 'example';

    const chunkContent = currentChunk.trim();
    if (!isNoise(chunkContent) && !isDuplicate(chunkContent)) {
      chunks.push({
        chunk: chunkContent,
        metadata: { type }
      });
    }
  }

  return chunks;
}

/**
 * Load metadata from _meta.json files
 */
function loadMetadata(filename: string): any[] {
  const metaPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(metaPath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return data.table_of_contents || [];
  } catch (e) {
    console.warn(`Failed to load metadata from ${filename}:`, e);
    return [];
  }
}

/**
 * Find topic/chapter from metadata based on page number
 */
function findMetadata(metadata: any[], pageNumber: number | undefined): { topic: string; chapter: string } {
  if (!metadata || metadata.length === 0 || pageNumber === undefined) return { topic: 'General', chapter: 'Unknown' };

  // Find closest entry by page_id
  let closest = metadata[0];
  let minDiff = Infinity;

  for (const entry of metadata) {
    if (entry.page_id !== undefined) {
      const diff = Math.abs(entry.page_id - pageNumber);
      if (diff < minDiff) {
        minDiff = diff;
        closest = entry;
      }
    }
  }

  // Extract topic from title
  const title = closest.title || '';
  const topicMatch = title.match(/TOPIC\s*\d+:\s*([^\\n]+)/i);
  const topic = topicMatch ? topicMatch[1].trim() : title.substring(0, 50).trim() || 'General';

  // Extract chapter from title
  const chapterMatch = title.match(/Chapter\s*\d+[:\\s]*([^\\n]+)/i);
  const chapter = chapterMatch ? chapterMatch[1].trim() : title.substring(0, 30).trim() || 'Unknown';

  return { topic, chapter };
}

/**
 * OPTIMIZED: Ingest Math Textbook with metadata
 */
function ingestMathTextbook() {
  console.log("\n📚 Ingesting Math Grade 9 Textbook (OPTIMIZED)...");

  const textbookPath = path.join(DATA_DIR, 'math-grade9-textbook.json');
  const metadata = loadMetadata('math-grade9-textbook_meta.json');

  if (!fs.existsSync(textbookPath)) {
    console.warn(`⚠️ Textbook not found at ${textbookPath}`);
    return 0;
  }

  let textbookData: any;
  try {
    const rawData = fs.readFileSync(textbookPath, 'utf-8');
    textbookData = JSON.parse(rawData);
  } catch (e) {
    console.error("❌ Failed to parse textbook JSON:", e);
    return 0;
  }

  const entries: TextbookEntry[] = [];

  function extractFromNode(node: any, topic: string = '', chapter: string = '', section: string = ''): void {
    if (!node) return;

    // Extract text content
    let textContent = '';
    if (node.text) {
      textContent = node.text;
    } else if (node.html) {
      textContent = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const pageNumber = extractPageNumber(node.id);
    const meta = findMetadata(metadata, pageNumber);

    if (textContent && textContent.length > MIN_CHUNK_LENGTH) {
      entries.push({
        content: textContent,
        topic: topic || meta.topic,
        chapter: chapter || meta.chapter,
        section: section || extractSectionTitle(node),
        page_number: pageNumber,
        difficulty_level: 'Intermediate'
      });
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const childPageNumber = extractPageNumber(child.id);
        const childMeta = findMetadata(metadata, childPageNumber);
        extractFromNode(child, childMeta.topic, childMeta.chapter, extractSectionTitle(child));
      }
    }
  }

  function extractSectionTitle(node: any): string {
    if (node.html) {
      const text = node.html.replace(/<[^>]*>/g, ' ').trim();
      if (text.length > 0 && text.length < 200) {
        return text;
      }
    }
    return '';
  }

  function extractPageNumber(id: string): number | undefined {
    if (!id) return undefined;
    const match = id.match(/\/page\/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  extractFromNode(textbookData);

  if (entries.length === 0) {
    console.warn("⚠️ No entries found in textbook");
    return 0;
  }

  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT INTO textbook_content (
      source, topic, chapter, section, subsection, content,
      page_number, chunk_index, total_chunks, difficulty_level,
      learning_objectives, chunk_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((batch: TextbookEntry[]) => {
    for (const entry of batch) {
      if (!entry.content || entry.content.trim().length === 0) continue;

      const chunkedData = smartChunkText(entry.content, CHUNK_SIZE);
      const totalChunks = chunkedData.length;

      chunkedData.forEach((item, idx) => {
        try {
          insertStmt.run(
            'math-grade9-textbook',
            entry.topic || 'General',
            entry.chapter || 'Unknown',
            entry.section || 'Unsectioned',
            entry.subsection || null,
            item.chunk,
            entry.page_number || null,
            idx,
            totalChunks,
            entry.difficulty_level || 'Intermediate',
            entry.learning_objectives || null,
            item.metadata.type
          );
          insertedCount++;
        } catch (e) {
          console.error("Insert error:", e);
        }
      });
    }
  });

  const batchSize = 500;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    transaction(batch);
  }

  console.log(`✅ Ingested ${insertedCount} textbook chunks (optimized)`);
  return insertedCount;
}

/**
 * OPTIMIZED: Ingest Teaching Module
 */
function ingestTeachingModule() {
  console.log("\n📖 Ingesting Teaching Module (OPTIMIZED)...");

  const modulePath = path.join(DATA_DIR, 'Mathematics 2 Teaching Module for Term 2  2026 final Submission.json');
  const metadata = loadMetadata('Mathematics 2 Teaching Module for Term 2  2026 final Submission_meta.json');

  if (!fs.existsSync(modulePath)) {
    console.warn(`⚠️ Teaching module not found at ${modulePath}`);
    return 0;
  }

  let moduleData: any;
  try {
    const rawData = fs.readFileSync(modulePath, 'utf-8');
    moduleData = JSON.parse(rawData);
  } catch (e) {
    console.error("❌ Failed to parse teaching module JSON:", e);
    return 0;
  }

  const entries: TeachingModuleEntry[] = [];

  function extractFromNode(node: any, topic: string = ''): void {
    if (!node) return;

    let textContent = '';
    if (node.text) {
      textContent = node.text;
    } else if (node.html) {
      textContent = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const pageNumber = extractPageNumber(node.id);
    const meta = findMetadata(metadata, pageNumber);

    if (textContent && textContent.length > MIN_CHUNK_LENGTH && !isNoise(textContent)) {
      entries.push({
        module_name: 'Mathematics 2 Teaching Module Term 2',
        topic: topic || meta.topic,
        learning_objective: textContent.substring(0, 500),
        activities: undefined,
        assessment_type: undefined,
        duration_minutes: 45,
        difficulty_level: 'Intermediate'
      });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const childPageNumber = extractPageNumber(child.id);
        const childMeta = findMetadata(metadata, childPageNumber);
        extractFromNode(child, childMeta.topic);
      }
    }
  }

  function extractPageNumber(id: string): number | undefined {
    if (!id) return undefined;
    const match = id.match(/\/page\/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  extractFromNode(moduleData);

  if (entries.length === 0) {
    console.warn("⚠️ No entries found in teaching module");
    return 0;
  }

  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT INTO teaching_module_index (
      module_name, topic, learning_objective, activities,
      assessment_type, duration_minutes, difficulty_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((batch: TeachingModuleEntry[]) => {
    for (const entry of batch) {
      try {
        insertStmt.run(
          entry.module_name || 'Unknown Module',
          entry.topic || 'General',
          entry.learning_objective || '',
          entry.activities ? JSON.stringify(entry.activities) : null,
          entry.assessment_type || null,
          entry.duration_minutes || 45,
          entry.difficulty_level || 'Intermediate'
        );
        insertedCount++;
      } catch (e) {
        console.error("Insert error:", e);
      }
    }
  });

  const batchSize = 100;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    transaction(batch);
  }

  console.log(`✅ Ingested ${insertedCount} teaching module entries (optimized)`);
  return insertedCount;
}

/**
 * OPTIMIZED: Ingest Cibemba Grammar
 */
function ingestCibembaGrammar() {
  console.log("\n🗣️ Ingesting Cibemba Grammar Resources (OPTIMIZED)...");

  const grammarPath = path.join(DATA_DIR, 'cibemba-grammar.json');

  if (!fs.existsSync(grammarPath)) {
    console.warn(`⚠️ Cibemba grammar not found at ${grammarPath}`);
    return 0;
  }

  let grammarData: any;
  try {
    const rawData = fs.readFileSync(grammarPath, 'utf-8');
    grammarData = JSON.parse(rawData);
  } catch (e) {
    console.error("❌ Failed to parse grammar JSON:", e);
    return 0;
  }

  const entries: any[] = [];

  function extractFromNode(node: any, category: string = 'Cibemba'): void {
    if (!node) return;

    let textContent = '';
    if (node.text) {
      textContent = node.text;
    } else if (node.html) {
      textContent = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (textContent && textContent.length > MIN_CHUNK_LENGTH && !isNoise(textContent)) {
      entries.push({
        content: textContent,
        category: category,
        topic: extractGrammarTopic(node)
      });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        extractFromNode(child, category);
      }
    }
  }

  function extractGrammarTopic(node: any): string {
    if (node.html) {
      const text = node.html.replace(/<[^>]*>/g, ' ').trim();
      if (text.length > 0 && text.length < 100) {
        return text;
      }
    }
    return 'Grammar';
  }

  extractFromNode(grammarData);

  if (entries.length === 0) {
    console.warn("⚠️ No entries in grammar file");
    return 0;
  }

  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT INTO textbook_content (
      source, topic, section, content, difficulty_level, chunk_type
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((batch: any[]) => {
    for (const entry of batch) {
      try {
        insertStmt.run(
          'cibemba-grammar',
          entry.category || 'Cibemba',
          entry.topic || 'Grammar',
          entry.content,
          'Beginner',
          'language-support'
        );
        insertedCount++;
      } catch (e) {
        console.error("Insert error:", e);
      }
    }
  });

  const batchSize = 200;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    transaction(batch);
  }

  console.log(`✅ Ingested ${insertedCount} grammar entries (optimized)`);
  return insertedCount;
}

/**
 * Ingest Dictionary
 */
function ingestDictionary() {
  console.log("\n📕 Ingesting Dictionary...");

  const dictPath = path.join(__dirname, 'dictionary.json');

  if (!fs.existsSync(dictPath)) {
    console.warn(`⚠️ Dictionary not found at ${dictPath}`);
    return 0;
  }

  let dictData: any[];
  try {
    const rawData = fs.readFileSync(dictPath, 'utf-8');
    dictData = JSON.parse(rawData);
  } catch (e) {
    console.error("❌ Failed to parse dictionary JSON:", e);
    return 0;
  }

  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO dictionary (term, definition) VALUES (?, ?)
  `);

  const transaction = db.transaction((batch: any[]) => {
    for (const entry of batch) {
      try {
        insertStmt.run(entry.term, entry.definition);
        insertedCount++;
      } catch (e) {
        console.error("Insert error:", e);
      }
    }
  });

  const batchSize = 100;
  for (let i = 0; i < dictData.length; i += batchSize) {
    const batch = dictData.slice(i, i + batchSize);
    transaction(batch);
  }

  console.log(`✅ Ingested ${insertedCount} dictionary terms`);
  return insertedCount;
}

/**
 * Show statistics
 */
function showStats() {
  console.log("\n📊 RAG System Statistics (OPTIMIZED):");
  console.log("─".repeat(50));

  const textbookCount = db.prepare('SELECT COUNT(*) as count FROM textbook_content WHERE source != ?').get('teaching-module') as any;
  console.log(`📚 Textbook chunks: ${textbookCount.count}`);

  const teachingModuleCount = db.prepare('SELECT COUNT(*) as count FROM teaching_module_index').get() as any;
  console.log(`📖 Teaching modules: ${teachingModuleCount.count}`);

  const teachingModuleInTextbook = db.prepare('SELECT COUNT(*) as count FROM textbook_content WHERE source = ?').get('teaching-module') as any;
  console.log(`📖 Teaching module entries (searchable): ${teachingModuleInTextbook.count} ✅`);

  const dictCount = db.prepare('SELECT COUNT(*) as count FROM dictionary').get() as any;
  console.log(`📕 Dictionary terms: ${dictCount.count}`);

  const topics = db.prepare('SELECT COUNT(DISTINCT topic) as count FROM textbook_content').get() as any;
  console.log(`🎯 Unique topics: ${topics.count}`);

  const chunkTypes = db.prepare('SELECT DISTINCT chunk_type FROM textbook_content WHERE chunk_type IS NOT NULL').all() as any[];
  console.log(`🏷️ Chunk types: ${chunkTypes.map((c: any) => c.chunk_type).join(', ')}`);

  console.log("─".repeat(50));
  console.log("✅ RAG ingestion complete (OPTIMIZED)!");
}

/**
 * Main execution
 */
function main() {
  console.log("\n🚀 BULELA RAG System Initialization (OPTIMIZED VERSION)");
  console.log("═".repeat(50));
  console.log("🔧 Optimizations: Smart chunking, metadata-driven topics, deduplication, quality filters\n");

  try {
    ingestDictionary();
    ingestMathTextbook();
    ingestTeachingModule();
    ingestCibembaGrammar();
    showStats();

    console.log("\n✨ All teaching materials indexed successfully!");
    console.log("🧠 Ba Yama is now connected to full curriculum knowledge");
    console.log("✅ OPTIMIZATIONS: Sentence-based chunking, accurate topics, no duplicates\n");
  } catch (e) {
    console.error("❌ Ingestion failed:", e);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
