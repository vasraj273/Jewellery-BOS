import 'dotenv/config';
import { initDatabase, closeDatabase } from '../src/database/connection.js';
import * as users from '../src/services/users.service.js';
import { findByEmail } from '../src/services/auth.service.js';

/**
 * Permanently delete users by email, reusing the same audited hardDelete() the
 * UI uses. By default it PURGES (also deletes their quotations / leads /
 * customers) — this script exists for demo-data cleanup. Use --keep-records to
 * remove only the accounts and keep their business records (unassigned).
 *
 * DRY RUN by default — prints what it would do. Pass --confirm to execute.
 *
 *   node scripts/purge-users.js sales1@jbos.com admin1@jbos.com
 *   node scripts/purge-users.js --confirm sales1@jbos.com admin1@jbos.com
 *   node scripts/purge-users.js --confirm --keep-records old.staff@example.com
 *
 * Guards (inherited from hardDelete): never removes the last active
 * super_admin. Always back up / snapshot the DB before running with --confirm.
 */
(async () => {
  const args   = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const purge   = !args.includes('--keep-records');
  const emails  = args.filter((a) => !a.startsWith('--'));

  if (emails.length === 0) {
    console.error('[purge] Provide at least one email. Nothing to do.');
    process.exit(1);
  }

  await initDatabase();

  // A synthetic super_admin actor so hardDelete's self-delete guard never trips.
  const actor = { id: -1, role: 'super_admin' };

  console.log(`\n  Mode: ${confirm ? 'EXECUTE' : 'DRY RUN'} · ${purge ? 'PURGE records' : 'KEEP records'}\n`);

  for (const email of emails) {
    const u = await findByEmail(email);
    if (!u) { console.log(`  - ${email}: not found, skipped`); continue; }

    if (!confirm) {
      console.log(`  - ${email}: would delete (id=${u.id}, role=${u.role})${purge ? ' + purge their quotations/leads/customers' : ''}`);
      continue;
    }
    try {
      const res = await users.hardDelete(u.id, actor, { purge });
      console.log(`  - ${email}: deleted (id=${u.id}). Removed: ${JSON.stringify(res.purged)}`);
    } catch (e) {
      console.log(`  - ${email}: FAILED — ${e.message}`);
    }
  }

  if (!confirm) console.log('\n  Dry run only. Re-run with --confirm to execute.\n');
  else console.log('\n  Done.\n');

  await closeDatabase();
  process.exit(0);
})().catch((err) => {
  console.error('[purge] failed:', err);
  process.exit(1);
});
