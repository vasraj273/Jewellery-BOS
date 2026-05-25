import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

export function getDatabase() {
  if (!db) initDatabase();
  return db;
}

export function initDatabase() {
  const dbPath = path.resolve(__dirname, '..', '..', process.env.DB_PATH || '../database/jbos.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }

  runMigrations(db);

  console.log(`[JBOS] SQLite ready at ${dbPath}`);
  return db;
}

/** Idempotent column additions for existing databases. */
function runMigrations(db) {
  const cols = (table) =>
    db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

  const goldCols = cols('gold_rates');
  if (!goldCols.includes('source'))      db.exec(`ALTER TABLE gold_rates ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
  if (!goldCols.includes('updated_at'))  db.exec(`ALTER TABLE gold_rates ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'`);
  if (!goldCols.includes('location'))    db.exec(`ALTER TABLE gold_rates ADD COLUMN location TEXT NOT NULL DEFAULT 'Mumbai'`);
  if (!goldCols.includes('is_override')) db.exec(`ALTER TABLE gold_rates ADD COLUMN is_override INTEGER NOT NULL DEFAULT 0`);

  const qCols = cols('quotations');
  if (!qCols.includes('pricing_location')) db.exec(`ALTER TABLE quotations ADD COLUMN pricing_location TEXT`);

  // Post-migration indexes (safe to run after ALTERs ensure columns exist).
  db.exec(`DROP INDEX IF EXISTS idx_gold_rates_purity`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gold_rates_loc_purity ON gold_rates(location, purity, updated_at DESC)`);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
