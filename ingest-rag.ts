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

// --- CONFIGURATION ---
const CHUNK_SIZE = 800; // characters per chunk
const OVERLAP = 200; // overlap between chunks for context
const DATA_DIR = path.join(__dirname, 'data');

interface TextbookEntry {
  topic?: string;
  chapter?: string;
  section?: string;
  subsection?: string;
  content: string;
  page_number?: number;
  learning_objectives?: string;
  difficulty_level?: string;
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

/**
 * Chunk text while preserving context
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length === 0) return [];

  // Limit text length to prevent memory issues
  const maxLength = 100000; // 100k characters max
  if (text.length > maxLength) {
    text = text.substring(0, maxLength);
  }

  const chunks: string[] = [];
  let start = 0;
  let safetyCounter = 0;
  const maxIterations = 10000; // Prevent infinite loops

  while (start < text.length && safetyCounter < maxIterations) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end - overlap;
    if (start < 0) start = 0;
    safetyCounter++;
  }

  return chunks;
}

/**
 * Ingest Grade 9 Math Textbook
 */
function ingestMathTextbook() {
  console.log("\n📚 Ingesting Math Grade 9 Textbook...");

  const textbookPath = path.join(DATA_DIR, 'math-grade9-textbook.json');

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

  // Extract text from nested structure
  const entries: TextbookEntry[] = [];

  function extractFromNode(node: any, topic: string = '', chapter: string = '', section: string = ''): void {
    if (!node) return;

    // Extract text content
    let textContent = '';
    if (node.text) {
      textContent = node.text;
    } else if (node.html) {
      // Strip HTML tags
      textContent = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (textContent && textContent.length > 30) {
      entries.push({
        content: textContent,
        topic: topic || 'General',
        chapter: chapter || 'Unknown',
        section: section || extractSectionTitle(node),
        page_number: extractPageNumber(node.id)
      });
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const childTopic = topic || extractTopic(child);
        const childChapter = chapter || extractChapter(child);
        const childSection = section || extractSectionTitle(child);
        extractFromNode(child, childTopic, childChapter, childSection);
      }
    }
  }

  function extractTopic(node: any): string {
    if (node.html && node.html.includes('TOPIC')) {
      const match = node.html.match(/TOPIC\s*\d+:\s*([^<]+)/);
      return match ? match[1].trim() : '';
    }
    return '';
  }

  function extractChapter(node: any): string {
    if (node.html && node.html.includes('Chapter')) {
      const match = node.html.match(/Chapter\s*\d+[:\s]*([^<]+)/);
      return match ? match[1].trim() : '';
    }
    return '';
  }

  function extractSectionTitle(node: any): string {
    if (node.html) {
      // Extract first meaningful text from HTML
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

  // Start extraction from root
  extractFromNode(textbookData);

  if (entries.length === 0) {
    console.warn("⚠️ No entries found in textbook");
    return 0;
  }

  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT INTO textbook_content (
      source, topic, chapter, section, subsection, content,
      page_number, chunk_index, total_chunks, difficulty_level, learning_objectives
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((batch: TextbookEntry[]) => {
    for (const entry of batch) {
      if (!entry.content || entry.content.trim().length === 0) continue;

      const chunks = chunkText(entry.content, CHUNK_SIZE, OVERLAP);
      const totalChunks = chunks.length;

      chunks.forEach((chunk, idx) => {
        try {
          insertStmt.run(
            'math-grade9-textbook',
            entry.topic || 'General',
            entry.chapter || 'Unknown',
            entry.section || 'Unsectioned',
            entry.subsection || null,
            chunk,
            entry.page_number || null,
            idx,
            totalChunks,
            entry.difficulty_level || 'Intermediate',
            entry.learning_objectives || null
          );
          insertedCount++;
        } catch (e) {
          console.error("Insert error:", e);
        }
      });
    }
  });

  // Process in batches to avoid memory issues
  const batchSize = 500;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    transaction(batch);
  }

  console.log(`✅ Ingested ${insertedCount} textbook chunks`);
  return insertedCount;
}

/**
 * Ingest Teaching Module for Term 2 Grade 9
 */
function ingestTeachingModule() {
  console.log("\n📖 Ingesting Teaching Module...");

  const modulePath = path.join(DATA_DIR, 'Mathematics 2 Teaching Module for Term 2  2026 final Submission.json');

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

  // Extract text from nested structure
  const entries: TeachingModuleEntry[] = [];

  function extractFromNode(node: any, topic: string = ''): void {
    if (!node) return;

    // Extract text content
    let textContent = '';
    if (node.text) {
      textContent = node.text;
    } else if (node.html) {
      textContent = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (textContent && textContent.length > 20) {
      entries.push({
        module_name: 'Mathematics 2 Teaching Module Term 2',
        topic: topic || extractTopic(node),
        learning_objective: textContent.substring(0, 500),
        activities: undefined,
        assessment_type: undefined,
        duration_minutes: 45,
        difficulty_level: 'Intermediate'
      });
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const childTopic = topic || extractTopic(child);
        extractFromNode(child, childTopic);
      }
    }
  }

  function extractTopic(node: any): string {
    if (node.html && node.html.includes('TOPIC')) {
      const match = node.html.match(/TOPIC\s*\d+:\s*([^<]+)/);
      return match ? match[1].trim() : '';
    }
    return '';
  }

  // Start extraction from root
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

  console.log(`✅ Ingested ${insertedCount} teaching module entries`);
  return insertedCount;
}

/**
 * Ingest Cibemba Grammar (language support)
 */
function ingestCibembaGrammar() {
  console.log("\n🗣️ Ingesting Cibemba Grammar Resources...");

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

  // Extract text from nested structure
  const entries: any[] = [];

  function extractFromNode(node: any, category: string = 'Cibemba'): void {
    if (!node) return;

    // Extract text content
    let textContent = '';
    if (node.text) {
      textContent = node.text;
    } else if (node.html) {
      textContent = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (textContent && textContent.length > 20) {
      entries.push({
        content: textContent,
        category: category,
        topic: extractGrammarTopic(node)
      });
    }

    // Recursively process children
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

  // Start extraction from root
  extractFromNode(grammarData);

  if (entries.length === 0) {
    console.warn("⚠️ No entries in grammar file");
    return 0;
  }

  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT INTO textbook_content (
      source, topic, section, content, difficulty_level
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((batch: any[]) => {
    for (const entry of batch) {
      if (!entry.content && !entry.text && !entry.example) continue;

      const content = entry.content || entry.text || entry.example || '';
      try {
        insertStmt.run(
          'cibemba-grammar',
          entry.category || 'Cibemba',
          entry.topic || entry.type || 'Grammar',
          content,
          'Beginner'
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

  console.log(`✅ Ingested ${insertedCount} grammar entries`);
  return insertedCount;
}

/**
 * Ingest existing dictionary
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
  console.log("\n📊 RAG System Statistics:");
  console.log("─".repeat(50));

  const textbookCount = db.prepare('SELECT COUNT(*) as count FROM textbook_content').get() as any;
  console.log(`📚 Textbook chunks: ${textbookCount.count}`);

  const teachingModuleCount = db.prepare('SELECT COUNT(*) as count FROM teaching_module_index').get() as any;
  console.log(`📖 Teaching modules: ${teachingModuleCount.count}`);

  const dictCount = db.prepare('SELECT COUNT(*) as count FROM dictionary').get() as any;
  console.log(`📕 Dictionary terms: ${dictCount.count}`);

  const topics = db.prepare('SELECT COUNT(DISTINCT topic) as count FROM textbook_content').get() as any;
  console.log(`🎯 Unique topics: ${topics.count}`);

  console.log("─".repeat(50));
  console.log("✅ RAG ingestion complete!");
}

/**
 * Main execution
 */
function main() {
  console.log("\n🚀 BULELA RAG System Initialization");
  console.log("═".repeat(50));

  try {
    ingestDictionary();
    ingestMathTextbook();
    ingestTeachingModule();
    ingestCibembaGrammar();
    showStats();

    console.log("\n✨ All teaching materials indexed successfully!");
    console.log("🧠 Ba Yama is now connected to full curriculum knowledge\n");
  } catch (e) {
    console.error("❌ Ingestion failed:", e);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
