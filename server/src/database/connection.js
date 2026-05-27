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
  await autoBootstrapAdmin();
  await autoSeedMasters();
  return sql;
}

/**
 * Seed the single-row company_settings + master catalogs if empty. Idempotent:
 * any subsequent boot finds rows already present and exits.
 */
async function autoSeedMasters() {
  // company_settings: ensure the singleton row exists.
  await sql`INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

  const seedIfEmpty = async (table, rows) => {
    const [{ count }] = await sql.unsafe(`SELECT count(*)::int AS count FROM ${table}`);
    if (count > 0) return;
    for (const r of rows) {
      await sql.unsafe(
        `INSERT INTO ${table} (label, sort_order, extra) VALUES ($1, $2, $3)`,
        [r.label, r.sort_order ?? 100, JSON.stringify(r.extra || {})]
      );
    }
    console.log(`[JBOS] Seeded ${rows.length} rows into ${table}.`);
  };

  await seedIfEmpty('master_product_categories', [
    { label: 'Ring',     sort_order: 10 },
    { label: 'Necklace', sort_order: 20 },
    { label: 'Bangle',   sort_order: 30 },
    { label: 'Earring',  sort_order: 40 },
    { label: 'Pendant',  sort_order: 50 },
    { label: 'Bracelet', sort_order: 60 }
  ]);
  await seedIfEmpty('master_metal_types', [
    { label: 'Gold',     sort_order: 10 },
    { label: 'Platinum', sort_order: 20 },
    { label: 'Silver',   sort_order: 30 }
  ]);
  await seedIfEmpty('master_purities', [
    { label: '24Kt', sort_order: 10 },
    { label: '22Kt', sort_order: 20 },
    { label: '18Kt', sort_order: 30 },
    { label: '14Kt', sort_order: 40 }
  ]);
  await seedIfEmpty('master_diamond_types', [
    { label: 'None',      sort_order: 10 },
    { label: 'Natural',   sort_order: 20 },
    { label: 'Lab-Grown', sort_order: 30 }
  ]);
  await seedIfEmpty('master_cities', [
    { label: 'Mumbai',    sort_order: 10 },
    { label: 'Ahmedabad', sort_order: 20 },
    { label: 'Delhi',     sort_order: 30 },
    { label: 'Bengaluru', sort_order: 40 },
    { label: 'Chennai',   sort_order: 50 },
    { label: 'Kolkata',   sort_order: 60 },
    { label: 'Hyderabad', sort_order: 70 },
    { label: 'Jaipur',    sort_order: 80 }
  ]);
  await seedIfEmpty('master_making_presets', [
    { label: 'Ring · ₹1200/gm',     sort_order: 10, extra: { charge_type: 'per_gram', charge_value: 1200 } },
    { label: 'Necklace · ₹950/gm',  sort_order: 20, extra: { charge_type: 'per_gram', charge_value: 950 } },
    { label: 'Bangle · ₹850/gm',    sort_order: 30, extra: { charge_type: 'per_gram', charge_value: 850 } },
    { label: 'Earring · ₹1100/gm',  sort_order: 40, extra: { charge_type: 'per_gram', charge_value: 1100 } },
    { label: 'Pendant · ₹2500 flat',sort_order: 50, extra: { charge_type: 'fixed',    charge_value: 2500 } }
  ]);
}

/**
 * If the users table is empty and SEED_ADMIN_* env vars are set, create the
 * initial super_admin and clear any pre-existing demo quotations. Idempotent:
 * does nothing once any user exists.
 */
async function autoBootstrapAdmin() {
  const email    = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
  if (count > 0) return;

  if (password.length < 8) {
    console.warn('[JBOS] SEED_ADMIN_PASSWORD too short (<8 chars). Skipping auto-bootstrap.');
    return;
  }

  // Lazy import to avoid a circular dependency at module-load time.
  const { hashPassword } = await import('../services/auth.service.js');
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';
  const hash = await hashPassword(password);

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO users (full_name, email, password_hash, role, is_active)
      VALUES (${name}, ${email}, ${hash}, 'super_admin', true)
    `;
    const wiped = await tx`DELETE FROM quotations`;
    if (wiped.count > 0) {
      console.log(`[JBOS] Auto-bootstrap cleared ${wiped.count} demo quotation row(s).`);
    }
  });
  console.log(`[JBOS] Auto-bootstrap created super_admin "${email}".`);
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

  // M2 — RBAC ownership
  if (!qCols.includes('owner_user_id')) {
    await tx.unsafe(`ALTER TABLE quotations ADD COLUMN owner_user_id bigint REFERENCES users(id) ON DELETE SET NULL`);
    // Backfill: any pre-existing quotation rows get assigned to the first
    // super_admin so they remain visible to admins after the gate flips on.
    await tx.unsafe(`
      UPDATE quotations
      SET owner_user_id = (SELECT id FROM users WHERE role = 'super_admin' ORDER BY id ASC LIMIT 1)
      WHERE owner_user_id IS NULL
    `);
  }
  await tx.unsafe(`CREATE INDEX IF NOT EXISTS idx_quotations_owner ON quotations(owner_user_id)`);

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
