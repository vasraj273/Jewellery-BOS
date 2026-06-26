import 'dotenv/config';
import { initDatabase, getDb, closeDatabase } from '../src/database/connection.js';

/**
 * READ-ONLY report. Mutates nothing.
 *
 * Lists every user with the volume of data attached to them, so demo/sample
 * accounts can be told apart from real ones before any deletion. Counts:
 *   - quotations  (owner_user_id)
 *   - leads       (assigned_user_id)
 *   - customers   (assigned_user_id)
 *   - attendance / leaves / incentives (via their employees row)
 *
 * Run: npm run report:owners --prefix server
 */
(async () => {
  await initDatabase();
  const sql = getDb();

  const rows = await sql`
    SELECT
      u.id, u.full_name, u.email, u.role, u.is_active, u.last_login_at, u.created_at,
      (SELECT count(*) FROM quotations q WHERE q.owner_user_id    = u.id)::int AS quotations,
      (SELECT count(*) FROM leads      l WHERE l.assigned_user_id = u.id)::int AS leads,
      (SELECT count(*) FROM customers  c WHERE c.assigned_user_id = u.id)::int AS customers,
      e.id AS employee_id,
      COALESCE((SELECT count(*) FROM attendance a WHERE a.employee_id = e.id), 0)::int AS attendance,
      COALESCE((SELECT count(*) FROM leaves     lv WHERE lv.employee_id = e.id), 0)::int AS leaves,
      COALESCE((SELECT count(*) FROM incentives i WHERE i.employee_id = e.id), 0)::int AS incentives
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    ORDER BY u.created_at ASC
  `;

  console.log(`\n  Users: ${rows.length}\n`);
  for (const r of rows) {
    const login = r.last_login_at ? new Date(r.last_login_at).toISOString().slice(0, 10) : 'never';
    console.log(`  [${r.id}] ${r.email}`);
    console.log(`        ${r.full_name} · ${r.role} · ${r.is_active ? 'active' : 'disabled'} · last login ${login}`);
    console.log(`        quotations=${r.quotations} leads=${r.leads} customers=${r.customers} ` +
                `attendance=${r.attendance} leaves=${r.leaves} incentives=${r.incentives}`);
    console.log('');
  }

  console.log('  Nothing was modified. Use scripts/purge-users.js to remove confirmed demo accounts.\n');
  await closeDatabase();
  process.exit(0);
})().catch((err) => {
  console.error('[report] failed:', err);
  process.exit(1);
});
