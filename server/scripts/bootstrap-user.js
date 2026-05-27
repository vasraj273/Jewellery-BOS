import 'dotenv/config';
import { initDatabase, getDb, closeDatabase } from '../src/database/connection.js';
import { hashPassword, findByEmail } from '../src/services/auth.service.js';

/**
 * Bootstrap script — idempotent.
 *
 *   First run on a fresh deployment:
 *     1. Creates a super_admin from SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD
 *     2. Wipes any demo quotation rows seeded earlier
 *
 *   Subsequent runs:
 *     - Skip if the seed admin already exists
 *     - Never wipe quotations again
 *
 * Required env:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD   (min 8 chars)
 *   SEED_ADMIN_NAME       (optional, default "Super Admin")
 *
 * Run: npm run user:bootstrap --prefix server
 */

(async () => {
  const email    = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name     = process.env.SEED_ADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('[bootstrap] SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars are required.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('[bootstrap] SEED_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await initDatabase();
  const sql = getDb();

  const existing = await findByEmail(email);
  if (existing) {
    console.log(`[bootstrap] User ${email} already exists (id=${existing.id}, role=${existing.role}). No-op.`);
    await closeDatabase();
    process.exit(0);
  }

  const hash = await hashPassword(password);

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO users (full_name, email, password_hash, role, is_active)
      VALUES (${name}, ${email}, ${hash}, 'super_admin', true)
    `;

    // First-time seed only: drop any Phase-1 demo quotations so we start clean.
    const result = await tx`DELETE FROM quotations`;
    if (result.count > 0) {
      console.log(`[bootstrap] Cleared ${result.count} demo quotation row(s).`);
    }
  });

  console.log(`[bootstrap] super_admin "${email}" created.`);
  await closeDatabase();
  process.exit(0);
})().catch((err) => {
  console.error('[bootstrap] failed:', err);
  process.exit(1);
});
