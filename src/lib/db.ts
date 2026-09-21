import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// buelela.db is in the root, so we go up twice from src/lib
const dbPath = path.join(__dirname, '..', '..', 'bulela.db');
export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      definition TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT,
      user_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT,
      user_id TEXT,
      score INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      mastery_level INTEGER DEFAULT 1, -- 1: Basic, 2: Intermediate, 3: Advanced
      average_response_time REAL DEFAULT 0,
      engagement_time INTEGER DEFAULT 0, -- Total seconds spent
      points INTEGER DEFAULT 0, -- Requirement 11: Gamification
      streak INTEGER DEFAULT 0, -- Requirement 11: Gamification
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(topic_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS performance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      topic_id TEXT,
      type TEXT, -- 'chat' or 'quiz'
      response_time REAL,
      success_flag INTEGER,
      metadata TEXT, -- JSON blob for extra details
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS textbooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL, -- 'grammar' or 'mathematics'
      page_number INTEGER
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      topic_id TEXT,
      assigned_by TEXT,
      due_date DATETIME,
      status TEXT DEFAULT 'active'
    );

    -- RAG System Tables
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

  // Migration: Ensure user_id exists in user_progress if table was created by an older version
  const tableInfo = db.prepare("PRAGMA table_info(user_progress)").all() as any[];
  const hasUserId = tableInfo.some(col => col.name === 'user_id');
  if (!hasUserId) {
    try {
      db.exec("ALTER TABLE user_progress ADD COLUMN user_id TEXT;");
      console.log("Migration: Added user_id to user_progress");
    } catch (e) {
      console.error("Migration failed for user_progress:", e);
    }
  }
  
  const hasPoints = tableInfo.some(col => col.name === 'points');
  if (!hasPoints) {
    try {
      db.exec("ALTER TABLE user_progress ADD COLUMN points INTEGER DEFAULT 0;");
      db.exec("ALTER TABLE user_progress ADD COLUMN streak INTEGER DEFAULT 0;");
      console.log("Migration: Added points and streak to user_progress");
    } catch (e) {
      console.error("Migration failed for gamification columns:", e);
    }
  }

  try {
    db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_fts USING fts5(
        term,
        definition,
        content='dictionary',
        content_rowid='id'
      )
    `).run();
  } catch (e) {
    console.warn("FTS5 might not be supported in this environment. Search will use 'LIKE'.");
  }

  // RAG System FTS5 Index
  try {
    db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS textbook_fts USING fts5(
        topic, chapter, section, content,
        content='textbook_content',
        content_rowid='id'
      )
    `).run();
  } catch (e) {
    console.warn("RAG FTS5 might not be supported. Search will use 'LIKE'.");
  }

  const topicsFromTextbook = extractTopicsFromTextbook();
  const insertStmt = db.prepare('INSERT OR IGNORE INTO topics (id, title, prompt) VALUES (?, ?, ?)');
  const seedTransaction = db.transaction((data) => {
    for (const topic of data) insertStmt.run(topic.id, topic.title, topic.prompt);
  });
  seedTransaction(topicsFromTextbook);

  // Seed dictionary from JSON
  seedDictionary();

  // Seed textbooks from JSON
  seedTextbooks();
}

function extractTopicsFromTextbook(): Array<{ id: string; title: string; prompt: string }> {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const metaPath = path.join(dataDir, 'Mathematics 2 Teaching Module for Term 2  2026 final Submission_meta.json');
  
  try {
    if (!fs.existsSync(metaPath)) {
      return getFallbackTopics();
    }

    const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const tableOfContents = metaData.table_of_contents || [];
    
    // Extract topics that match the pattern "TOPIC X: YYY"
    const extractedTopics = tableOfContents
      .filter((entry: any) => entry.title && /^TOPIC \d+:/i.test(entry.title))
      .map((entry: any, index: number) => {
        const title = entry.title.trim();
        const topicName = title.replace(/^TOPIC \d+:\s*/i, '').trim();
        const id = topicName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        return {
          id: id || `topic-${index}`,
          title: topicName,
          prompt: `Explain ${topicName} using Zambian cultural context and examples. Level: Grade 8/9.`
        };
      });

    // Merge with full syllabus topics to guarantee complete Grade 8/9 coverage
    const fallbackList = getFallbackTopics();
    const mergedMap = new Map<string, { id: string; title: string; prompt: string }>();
    
    for (const t of fallbackList) mergedMap.set(t.id, t);
    for (const t of extractedTopics) mergedMap.set(t.id, t);

    return Array.from(mergedMap.values());
  } catch (e) {
    console.error("Failed to extract topics from textbook:", e);
    return getFallbackTopics();
  }
}

function getFallbackTopics(): Array<{ id: string; title: string; prompt: string }> {
  return [
    { id: 'sets', title: "Sets & Set Operations", prompt: "Explain Sets, Venn diagrams, union, intersection, and complement using Zambian market analogies. Level: Grade 8/9." },
    { id: 'algebra', title: "Algebraic Expressions & Equations", prompt: "Explain simplifying expressions, expanding brackets, and solving algebraic equations. Level: Grade 8/9." },
    { id: 'matrices', title: "Matrices & Determinants", prompt: "Explain matrix addition, scalar multiplication, and finding determinants of 2x2 matrices. Level: Grade 8/9." },
    { id: 'linear-equations', title: "Linear Equations & Inequalities", prompt: "Explain solving linear equations and graphing inequalities on a number line. Level: Grade 8/9." },
    { id: 'relations-functions', title: "Relations, Mappings & Functions", prompt: "Explain domain, range, ordered pairs, and functional mappings. Level: Grade 8/9." },
    { id: 'coordinate-geometry', title: "Coordinate Geometry & Graphs", prompt: "Explain plotting Cartesian coordinates, gradients, and straight line equations. Level: Grade 8/9." },
    { id: 'mensuration', title: "Mensuration & Geometric Figures", prompt: "Explain perimeter, area, surface area, and volume of 2D and 3D shapes. Level: Grade 8/9." },
    { id: 'trigonometry', title: "Trigonometry & Right-Angled Triangles", prompt: "Explain Pythagoras' theorem and basic trigonometric ratios (sine, cosine, tangent). Level: Grade 8/9." },
    { id: 'statistics', title: "Statistics & Data Representation", prompt: "Explain mean, median, mode, frequency tables, and bar charts. Level: Grade 8/9." },
    { id: 'probability', title: "Probability & Experimental Outcomes", prompt: "Explain calculating theoretical and experimental probability. Level: Grade 8/9." },
    { id: 'commercial-arithmetic', title: "Commercial & Social Arithmetic", prompt: "Explain simple interest, profit and loss, discount, currency conversions, and budgets. Level: Grade 8/9." },
    { id: 'number-bases', title: "Number Bases & Binary Arithmetic", prompt: "Explain converting between Base 10, Base 2 (binary), and other bases. Level: Grade 8/9." },
    { id: 'ratio-proportion', title: "Ratio, Rate & Proportion", prompt: "Explain direct and inverse proportion and sharing quantities by ratios. Level: Grade 8/9." },
    { id: 'variation', title: "Variation (Direct & Inverse)", prompt: "Explain direct and inverse variation with real-world Zambian examples. Level: Grade 8/9." },
    { id: 'vectors', title: "Vectors in Two Dimensions", prompt: "Explain vector notation, column vectors, magnitude, and vector addition. Level: Grade 8/9." },
  ];
}

export function seedDictionary() {
  const dictionaryPath = path.join(__dirname, '..', '..', 'dictionary.json');
  const existing = db.prepare('SELECT COUNT(*) as count FROM dictionary').get() as { count: number };
  
  if (existing.count === 0) {
    try {
      if (fs.existsSync(dictionaryPath)) {
        const dictData = JSON.parse(fs.readFileSync(dictionaryPath, 'utf-8'));
        const insertStmt = db.prepare('INSERT OR IGNORE INTO dictionary (term, definition) VALUES (?, ?)');
        const seedTransaction = db.transaction((data) => {
          for (const entry of data) insertStmt.run(entry.term, entry.definition);
        });
        seedTransaction(dictData);
        console.log(`Seeded ${dictData.length} dictionary entries.`);
      } else {
        console.warn("dictionary.json not found, skipping seeding.");
      }
    } catch (e) {
      console.error("Failed to seed dictionary:", e);
    }
  }
}

export function seedTextbooks() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM textbooks').get() as { count: number };
  
  if (existing.count === 0) {
    try {
      // paths relative to root/src/lib
      const dataDir = path.join(__dirname, '..', '..', 'data');
      const cibembaPath = path.join(dataDir, 'cibemba-grammar.json');
      const mathPath = path.join(dataDir, 'math-grade9-textbook.json');
      
      let allSections: any[] = [];

      if (fs.existsSync(cibembaPath)) {
        const cibembaData = JSON.parse(fs.readFileSync(cibembaPath, 'utf-8'));
        allSections = [...allSections, ...processTextbookData(cibembaData, 'grammar')];
      }

      if (fs.existsSync(mathPath)) {
        const mathData = JSON.parse(fs.readFileSync(mathPath, 'utf-8'));
        allSections = [...allSections, ...processTextbookData(mathData, 'mathematics')];
      }

      if (allSections.length > 0) {
        const insertStmt = db.prepare('INSERT OR IGNORE INTO textbooks (id, title, content, type, page_number) VALUES (?, ?, ?, ?, ?)');
        const seedTransaction = db.transaction((data) => {
          for (const section of data) insertStmt.run(section.id, section.title, section.content, section.type, section.page_number);
        });
        seedTransaction(allSections);
        console.log(`Seeded ${allSections.length} textbook sections.`);
      } else {
        console.warn("No textbook data found to seed.");
      }
    } catch (e) {
      console.error("Failed to seed textbooks:", e);
    }
  }
}

function processTextbookData(rawData: any, type: 'grammar' | 'mathematics'): any[] {
  const sections: any[] = [];
  
  function processNode(node: any): void {
    if (node.text && node.text.trim() && node.text.length > 30) {
      const title = extractTitle(node.text);
      sections.push({
        id: node.id || `section-${sections.length}-${type}`,
        title,
        content: node.text,
        type,
        page_number: extractPageNumber(node.id)
      });
    }
    
    if (node.html) {
      const textContent = extractTextFromHtml(node.html);
      if (textContent.length > 50) {
        const title = extractTitle(textContent);
        sections.push({
          id: node.id || `section-${sections.length}-${type}`,
          title,
          content: textContent,
          type,
          page_number: extractPageNumber(node.id)
        });
      }
    }
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => processNode(child));
    }
  }
  
  processNode(rawData);
  return sections;
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(text: string): string {
  const firstSentence = text.split(/[.!?]/)[0];
  return firstSentence.length > 50 
    ? firstSentence.substring(0, 50) + '...'
    : firstSentence;
}

function extractPageNumber(id: string): number | undefined {
  if (!id) return undefined;
  const match = id.match(/\/page\/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}