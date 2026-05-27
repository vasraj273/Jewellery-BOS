import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Single `postgres` client (porsager/postgres.js) shared across the process.
 *
 * Why this shape:
 *  - Tagged-template SQL keeps the hand-rolled style we already have.
 *  - `sql.begin()` gives us atomic transactions for the multi-row gold-rate
 *    refresh path.
 *  - `ssl: 'require'` lines up with Neon's default connection-string flags.
 */
let sql = null;

export function getDb() {
  if (!sql) {
    throw new Error('Database not initialised — call initDatabase() first');
  }
  return sql;
}

export async function initDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (e.g. Neon Postgres connection string)');
  }

  sql = postgres(url, {
    ssl: 'require',
    max: Number(process.env.PG_POOL_MAX) || 5,
    idle_timeout: 30,
    connect_timeout: 20,
    onnotice: () => {} // swallow NOTICE chatter
  });

  // Guard concurrent boot replicas (Render can scale) against racing schema apply.
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(74230198)`; // arbitrary stable key for JBOS
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await tx.unsafe(schema);
    }
    await runMigrations(tx);
  });

  console.log('[JBOS] Postgres ready');
  return sql;
}

/** Idempotent additions for already-deployed databases. */
async function runMigrations(tx) {
  const cols = async (table) => {
    const rows = await tx`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table}
    `;
    return rows.map((r) => r.column_name);
  };

  const goldCols = await cols('gold_rates');
  if (!goldCols.includes('source'))      await tx.unsafe(`ALTER TABLE gold_rates ADD COLUMN source text NOT NULL DEFAULT 'manual'`);
  if (!goldCols.includes('updated_at'))  await tx.unsafe(`ALTER TABLE gold_rates ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()`);
  if (!goldCols.includes('location'))    await tx.unsafe(`ALTER TABLE gold_rates ADD COLUMN location text NOT NULL DEFAULT 'Mumbai'`);
  if (!goldCols.includes('is_override')) await tx.unsafe(`ALTER TABLE gold_rates ADD COLUMN is_override boolean NOT NULL DEFAULT false`);

  const qCols = await cols('quotations');
  if (!qCols.includes('pricing_location'))    await tx.unsafe(`ALTER TABLE quotations ADD COLUMN pricing_location text`);
  if (!qCols.includes('whatsapp_status'))     await tx.unsafe(`ALTER TABLE quotations ADD COLUMN whatsapp_status text`);
  if (!qCols.includes('whatsapp_message_id')) await tx.unsafe(`ALTER TABLE quotations ADD COLUMN whatsapp_message_id text`);
  if (!qCols.includes('whatsapp_sent_at'))    await tx.unsafe(`ALTER TABLE quotations ADD COLUMN whatsapp_sent_at timestamptz`);
  if (!qCols.includes('whatsapp_error'))      await tx.unsafe(`ALTER TABLE quotations ADD COLUMN whatsapp_error text`);

  // Drop legacy SQLite-era index name if it still exists from a prior environment.
  await tx.unsafe(`DROP INDEX IF EXISTS idx_gold_rates_purity`);
  await tx.unsafe(`CREATE INDEX IF NOT EXISTS idx_gold_rates_loc_purity ON gold_rates(location, purity, updated_at DESC)`);
}

export async function closeDatabase() {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
  }
}
