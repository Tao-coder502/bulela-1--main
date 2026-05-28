import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'bulela.db'));

function setup() {
  // Create dictionary table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      definition TEXT NOT NULL
    )
  `).run();

  // Create FTS5 virtual table for searching
  // Note: FTS5 might not be enabled in all environments, but it's common in modern better-sqlite3
  try {
    db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_fts USING fts5(
        term,
        definition,
        content='dictionary',
        content_rowid='id'
      )
    `).run();

    // Triggers to keep FTS index in sync
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS dictionary_ai AFTER INSERT ON dictionary BEGIN
        INSERT INTO dictionary_fts(rowid, term, definition) VALUES (new.id, new.term, new.definition);
      END;
    `).run();

    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS dictionary_ad AFTER DELETE ON dictionary BEGIN
        INSERT INTO dictionary_fts(dictionary_fts, rowid, term, definition) VALUES('delete', old.id, old.term, old.definition);
      END;
    `).run();

    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS dictionary_au AFTER UPDATE ON dictionary BEGIN
        INSERT INTO dictionary_fts(dictionary_fts, rowid, term, definition) VALUES('delete', old.id, old.term, old.definition);
        INSERT INTO dictionary_fts(rowid, term, definition) VALUES (new.id, new.term, new.definition);
      END;
    `).run();

    console.log("FTS5 tables and triggers initialized.");
  } catch (err) {
    console.error("FTS5 error (falling back to standard search):", err);
  }
}

function ingest() {
  const dictionaryData = JSON.parse(fs.readFileSync(path.join(__dirname, 'dictionary.json'), 'utf8'));

  const insert = db.prepare('INSERT OR IGNORE INTO dictionary (term, definition) VALUES (?, ?)');
  
  const transaction = db.transaction((data) => {
    for (const item of data) {
      insert.run(item.term, item.definition);
    }
  });

  transaction(dictionaryData);
  console.log(`Successfully ingested ${dictionaryData.length} terms into the dictionary.`);
}

setup();
ingest();
db.close();
