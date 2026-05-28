import { getDb } from '../database/connection.js';

const ADMIN = (a) => a?.role === 'super_admin' || a?.role === 'admin';
function scopeFor(actor) {
  if (!actor) return null;
  if (ADMIN(actor)) return null;
  return Number(actor.id);
}

const SELECT = `
  SELECT r.*,
         c.name AS customer_name,
         c.customer_code,
         u.full_name AS assigned_name,
         CASE WHEN r.status = 'pending' AND r.due_at <= now() THEN true ELSE false END AS is_overdue
  FROM reminder_tasks r
  LEFT JOIN customers c ON c.id = r.customer_id
  LEFT JOIN users u     ON u.id = r.assigned_user_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();
  const scoped = scopeFor(actor);
  const ownerClause = scoped != null ? sql`AND r.assigned_user_id = ${scoped}` : sql``;
  const statusClause = filters.status ? sql`AND r.status = ${filters.status}` : sql``;
  return sql`
    ${sql.unsafe(SELECT)}
    WHERE 1 = 1
    ${ownerClause}
    ${statusClause}
    ORDER BY r.status ASC, r.due_at ASC
    LIMIT 500
  `;
}

export async function create({ customer_id, lead_id, title, notes, due_at, assigned_user_id }, actor) {
  if (!title?.trim() || !due_at) { const e = new Error('Title and due date required'); e.status = 400; throw e; }
  const sql = getDb();
  // Sales exec → reminder owned by self. Admin may target another user.
  let assignee = Number(actor.id);
  if (ADMIN(actor) && assigned_user_id) {
    const [t] = await sql`SELECT id FROM users WHERE id = ${Number(assigned_user_id)} AND is_active = true LIMIT 1`;
    if (t) assignee = t.id;
  }
  const [row] = await sql`
    INSERT INTO reminder_tasks (customer_id, lead_id, title, notes, due_at, assigned_user_id, created_by_user_id)
    VALUES (
      ${customer_id ? Number(customer_id) : null},
      ${lead_id ? Number(lead_id) : null},
      ${title.trim()}, ${notes || null}, ${due_at},
      ${assignee}, ${Number(actor.id)}
    )
    RETURNING *
  `;
  return row;
}

export async function markDone(id, actor) {
  const sql = getDb();
  const [r] = await sql`SELECT * FROM reminder_tasks WHERE id = ${id} LIMIT 1`;
  if (!r) { const e = new Error('Reminder not found'); e.status = 404; throw e; }
  if (!ADMIN(actor) && Number(r.assigned_user_id) !== Number(actor.id)) {
    const e = new Error('Not found'); e.status = 404; throw e;
  }
  await sql`UPDATE reminder_tasks SET status = 'done', done_at = now() WHERE id = ${id}`;
  return { ...r, status: 'done' };
}

/** Dashboard buckets: overdue / today / upcoming + due count. */
export async function dashboard(actor) {
  const sql = getDb();
  const scoped = scopeFor(actor);
  const ownerAnd = scoped != null ? sql`AND assigned_user_id = ${scoped}` : sql``;

  const [[{ overdue }], [{ today }], [{ upcoming }]] = await Promise.all([
    sql`SELECT count(*)::int AS overdue FROM reminder_tasks WHERE status = 'pending' AND due_at < date_trunc('day', now()) ${ownerAnd}`,
    sql`SELECT count(*)::int AS today FROM reminder_tasks WHERE status = 'pending' AND due_at >= date_trunc('day', now()) AND due_at < date_trunc('day', now()) + INTERVAL '1 day' ${ownerAnd}`,
    sql`SELECT count(*)::int AS upcoming FROM reminder_tasks WHERE status = 'pending' AND due_at >= date_trunc('day', now()) + INTERVAL '1 day' ${ownerAnd}`
  ]);
  return { overdue, today, upcoming, due: overdue + today };
}
