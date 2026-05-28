import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '../../bulela.db'));

// --- IMPROVED CONFIGURATION ---
const CHUNK_SIZE = 800;
const OVERLAP = 200;
const DATA_DIR = path.join(__dirname, '../../data');

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

/**
 * IMPROVED: Smart chunking on sentence boundaries (not character counts)
 * This prevents mid-word/sentence breaks
 */
function smartChunkText(text: string, targetSize: number = 800): { chunk: string; metadata: { type: string } }[] {
  if (!text || text.length === 0) return [];

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

      chunks.push({
        chunk: currentChunk.trim(),
        metadata: { type }
      });

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

    chunks.push({
      chunk: currentChunk.trim(),
      metadata: { type }
    });
  }

  return chunks;
}

/**
 * IMPROVED: Ingest with chunk type metadata for better filtering
 */
function ingestMathTextbook() {
  console.log("\n📚 Ingesting Math Grade 9 Textbook (IMPROVED)...");
  
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

  const entries: TextbookEntry[] = Array.isArray(textbookData) 
    ? textbookData 
    : textbookData.content || textbookData.chapters || [];

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

      // IMPROVED: Use smart chunking instead of dumb character split
      const chunkedData = smartChunkText(entry.content, 800);
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
            item.metadata.type  // NEW: chunk type for filtering
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

  console.log(`✅ Ingested ${insertedCount} textbook chunks (with smart boundaries)`);
  return insertedCount;
}

/**
 * Ingest Teaching Module with improved metadata
 */
function ingestTeachingModule() {
  console.log("\n📖 Ingesting Teaching Module (IMPROVED)...");
  
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

  const entries: any[] = Array.isArray(moduleData)
    ? moduleData
    : moduleData.modules || moduleData.lessons || moduleData.topics || [];

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

  // IMPROVED: Also insert into textbook_content so it gets searched
  const textbookInsertStmt = db.prepare(`
    INSERT INTO textbook_content (
      source, topic, section, content, difficulty_level, chunk_type
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((batch: any[]) => {
    for (const entry of batch) {
      try {
        // Insert into teaching_module_index (for metadata)
        insertStmt.run(
          entry.module_name || 'Unknown Module',
          entry.topic || 'General',
          entry.learning_objective || '',
          entry.activities ? JSON.stringify(entry.activities) : null,
          entry.assessment_type || null,
          entry.duration_minutes || 45,
          entry.difficulty_level || 'Intermediate'
        );

        // NEW: Also insert into textbook_content so RAG searches find it!
        const moduleContent = `
Learning Objective: ${entry.learning_objective || 'N/A'}
Assessment Type: ${entry.assessment_type || 'N/A'}
Duration: ${entry.duration_minutes || 45} minutes
Topic: ${entry.topic || 'General'}
        `.trim();

        textbookInsertStmt.run(
          'teaching-module',
          entry.topic || 'General',
          `${entry.module_name}: Learning Objectives`,
          moduleContent,
          entry.difficulty_level || 'Intermediate',
          'learning-objective'  // NEW: mark as learning objective
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

  console.log(`✅ Ingested ${insertedCount} teaching module entries (NOW searchable!)`);
  return insertedCount;
}

/**
 * Ingest Cibemba Grammar
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

  const entries = Array.isArray(grammarData) ? grammarData : grammarData.entries || [];

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
      if (!entry.content && !entry.text && !entry.example) continue;

      const content = entry.content || entry.text || entry.example || '';
      try {
        insertStmt.run(
          'cibemba-grammar',
          entry.category || 'Cibemba',
          entry.topic || entry.type || 'Grammar',
          content,
          'Beginner',
          'language-support'  // NEW: chunk type
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
 * Ingest dictionary
 */
function ingestDictionary() {
  console.log("\n📕 Ingesting Dictionary...");
  
  const dictPath = path.join(__dirname, '../../dictionary.json');
  
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
  console.log("\n📊 RAG System Statistics (IMPROVED):");
  console.log("─".repeat(50));

  const textbookCount = db.prepare('SELECT COUNT(*) as count FROM textbook_content WHERE source != ?').get('teaching-module') as any;
  console.log(`📚 Textbook chunks: ${textbookCount.count}`);

  const teachingModuleCount = db.prepare('SELECT COUNT(*) as count FROM teaching_module_index').get() as any;
  console.log(`📖 Teaching modules: ${teachingModuleCount.count}`);

  const teachingModuleInTextbook = db.prepare('SELECT COUNT(*) as count FROM textbook_content WHERE source = ?').get('teaching-module') as any;
  console.log(`📖 Teaching module entries (searchable): ${teachingModuleInTextbook.count} ✅ NEW`);

  const dictCount = db.prepare('SELECT COUNT(*) as count FROM dictionary').get() as any;
  console.log(`📕 Dictionary terms: ${dictCount.count}`);

  const topics = db.prepare('SELECT COUNT(DISTINCT topic) as count FROM textbook_content').get() as any;
  console.log(`🎯 Unique topics: ${topics.count}`);

  const chunkTypes = db.prepare('SELECT DISTINCT chunk_type FROM textbook_content WHERE chunk_type IS NOT NULL').all() as any[];
  console.log(`🏷️ Chunk types (for filtering): ${chunkTypes.map((c: any) => c.chunk_type).join(', ')} ✅ NEW`);

  console.log("─".repeat(50));
  console.log("✅ RAG ingestion complete (IMPROVED)!");
}

/**
 * Main execution
 */
function main() {
  console.log("\n🚀 BULELA RAG System Initialization (IMPROVED VERSION)");
  console.log("═".repeat(50));
  console.log("🔧 Improvements: Smart chunking, teaching module searchable, metadata filtering\n");

  try {
    ingestDictionary();
    ingestMathTextbook();
    ingestTeachingModule();
    ingestCibembaGrammar();
    showStats();

    console.log("\n✨ All teaching materials indexed successfully!");
    console.log("🧠 Ba Yama is now connected to full curriculum knowledge");
    console.log("✅ IMPROVEMENTS: Teaching module now searchable, smart chunk boundaries\n");
  } catch (e) {
    console.error("❌ Ingestion failed:", e);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
