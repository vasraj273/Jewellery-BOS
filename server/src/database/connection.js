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
  await autoSeedEmployees();
  return sql;
}

/**
 * Ensure every user has a linked employee record (one profile per user).
 * Idempotent — only inserts for users that don't yet have an employee row.
 */
async function autoSeedEmployees() {
  const missing = await sql`
    SELECT u.id, u.full_name, u.email, u.role
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    WHERE e.id IS NULL
  `;
  if (missing.length === 0) return;

  const year = new Date().getFullYear();
  // Seed sequence from the current max EMP-<year> code.
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM employees WHERE employee_code LIKE ${`EMP-${year}-%`}`;
  let seq = n;
  for (const u of missing) {
    seq += 1;
    const code = `EMP-${year}-${String(seq).padStart(4, '0')}`;
    await sql`
      INSERT INTO employees (employee_code, user_id, full_name, email, role, employment_status)
      VALUES (${code}, ${u.id}, ${u.full_name}, ${u.email}, ${u.role}, 'active')
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
  console.log(`[JBOS] Auto-seeded ${missing.length} employee record(s) from users.`);
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

  // M4 — lead catalogs
  const seedSimple = async (table, rows) => {
    const [{ count }] = await sql.unsafe(`SELECT count(*)::int AS count FROM ${table}`);
    if (count > 0) return;
    for (const r of rows) {
      await sql.unsafe(`INSERT INTO ${table} (label, sort_order) VALUES ($1, $2)`, [r.label, r.sort_order]);
    }
    console.log(`[JBOS] Seeded ${rows.length} rows into ${table}.`);
  };
  await seedSimple('lead_sources', [
    { label: 'Instagram',  sort_order: 10 },
    { label: 'Referral',   sort_order: 20 },
    { label: 'Walk-in',    sort_order: 30 },
    { label: 'WhatsApp',   sort_order: 40 },
    { label: 'Website',    sort_order: 50 },
    { label: 'Exhibition', sort_order: 60 },
    { label: 'Call',       sort_order: 70 }
  ]);

  // lead_statuses carries is_terminal so dashboard/conversion logic can key
  // off semantics rather than label text.
  const [{ count: statusCount }] = await sql`SELECT count(*)::int AS count FROM lead_statuses`;
  if (statusCount === 0) {
    const statuses = [
      { label: 'New',             sort_order: 10, is_terminal: null },
      { label: 'Contacted',       sort_order: 20, is_terminal: null },
      { label: 'Interested',      sort_order: 30, is_terminal: null },
      { label: 'Visit Scheduled', sort_order: 40, is_terminal: null },
      { label: 'Follow-up',       sort_order: 50, is_terminal: null },
      { label: 'Quotation Sent',  sort_order: 60, is_terminal: null },
      { label: 'Negotiation',     sort_order: 70, is_terminal: null },
      { label: 'Converted',       sort_order: 80, is_terminal: 'converted' },
      { label: 'Lost',            sort_order: 90, is_terminal: 'lost' }
    ];
    for (const s of statuses) {
      await sql`INSERT INTO lead_statuses (label, sort_order, is_terminal) VALUES (${s.label}, ${s.sort_order}, ${s.is_terminal})`;
    }
    console.log(`[JBOS] Seeded ${statuses.length} lead statuses.`);
  }
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

  // M4 — CRM lead linkage on quotations
  if (!qCols.includes('source_lead_id')) {
    await tx.unsafe(`ALTER TABLE quotations ADD COLUMN source_lead_id bigint`);
  }
  await tx.unsafe(`CREATE INDEX IF NOT EXISTS idx_quotations_source_lead ON quotations(source_lead_id)`);

  // M8 — inventory linkage on quotations. ALTER-added column on an existing
  // table, so its index is created here AFTER the ALTER (never inline in
  // schema.sql, which is skipped on already-deployed DBs).
  if (!qCols.includes('inventory_item_id')) {
    await tx.unsafe(`ALTER TABLE quotations ADD COLUMN inventory_item_id bigint`);
  }
  await tx.unsafe(`CREATE INDEX IF NOT EXISTS idx_quotations_inventory_item ON quotations(inventory_item_id)`);

  // M5 fix — auto-conversion timestamp on leads
  const leadCols = await cols('leads');
  if (leadCols.length && !leadCols.includes('converted_at')) {
    await tx.unsafe(`ALTER TABLE leads ADD COLUMN converted_at timestamptz`);
  }

  // M7 — shift assignment on employees
  const empCols = await cols('employees');
  if (empCols.length && !empCols.includes('assigned_shift_id')) {
    await tx.unsafe(`ALTER TABLE employees ADD COLUMN assigned_shift_id bigint`);
  }
  // M7 fix pack — birthday (powers HR-calendar birthday events; its absence
  // previously made hrCalendar.month() throw and the calendar render empty).
  if (empCols.length && !empCols.includes('birthday')) {
    await tx.unsafe(`ALTER TABLE employees ADD COLUMN birthday date`);
  }

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
