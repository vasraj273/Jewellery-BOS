import { getDb } from '../database/connection.js';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES   = ['pending', 'in_progress', 'completed', 'cancelled'];
const ADMIN = (a) => a?.role === 'super_admin' || a?.role === 'admin';

const SELECT = `
  SELECT t.*,
         au.full_name AS assignee_name,
         bu.full_name AS assigner_name
  FROM tasks t
  LEFT JOIN users au ON au.id = t.assigned_to_user_id
  LEFT JOIN users bu ON bu.id = t.assigned_by_user_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();
  const scoped = ADMIN(actor) ? null : Number(actor.id);

  const ownClause = scoped != null
    ? sql`AND t.assigned_to_user_id = ${scoped}`
    : (filters.assigned_to_user_id ? sql`AND t.assigned_to_user_id = ${Number(filters.assigned_to_user_id)}` : sql``);
  const prClause   = filters.priority ? sql`AND t.priority = ${filters.priority}` : sql``;
  const stClause   = filters.status ? sql`AND t.status = ${filters.status}` : sql``;
  const fromClause = filters.date_from ? sql`AND t.due_date >= ${filters.date_from}::date` : sql``;
  const toClause   = filters.date_to   ? sql`AND t.due_date <= ${filters.date_to}::date` : sql``;

  return sql`
    ${sql.unsafe(SELECT)}
    WHERE 1 = 1 ${ownClause} ${prClause} ${stClause} ${fromClause} ${toClause}
    ORDER BY
      CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
    LIMIT 1000
  `;
}

export async function create(input, actor) {
  if (!input?.title?.trim()) { const e = new Error('Title required'); e.status = 400; throw e; }
  const sql = getDb();
  // Sales exec can only self-assign. Admin assigns to anyone.
  let assignee = Number(actor.id);
  if (ADMIN(actor) && input.assigned_to_user_id) assignee = Number(input.assigned_to_user_id);

  const priority = PRIORITIES.includes(input.priority) ? input.priority : 'medium';
  const [row] = await sql`
    INSERT INTO tasks (title, description, assigned_to_user_id, assigned_by_user_id, due_date, priority, linked_entity_type, linked_entity_id, status)
    VALUES (
      ${input.title.trim()}, ${input.description || null},
      ${assignee}, ${Number(actor.id)},
      ${input.due_date || null}, ${priority},
      ${input.linked_entity_type || null}, ${input.linked_entity_id ? String(input.linked_entity_id) : null},
      'pending'
    )
    RETURNING *
  `;
  return row;
}

export async function update(id, patch, actor) {
  const sql = getDb();
  const [cur] = await sql`SELECT * FROM tasks WHERE id = ${id} LIMIT 1`;
  if (!cur) { const e = new Error('Task not found'); e.status = 404; throw e; }

  const isOwner = Number(cur.assigned_to_user_id) === Number(actor.id);
  if (!ADMIN(actor) && !isOwner) { const e = new Error('Not found'); e.status = 404; throw e; }

  const fields = {};
  // Sales exec (owner, non-admin): status only.
  if (patch.status && STATUSES.includes(patch.status)) {
    fields.status = patch.status;
    fields.completed_at = patch.status === 'completed' ? new Date() : null;
  }
  if (ADMIN(actor)) {
    if (typeof patch.title === 'string')        fields.title = patch.title.trim();
    if ('description' in patch)                 fields.description = patch.description || null;
    if (patch.assigned_to_user_id)              fields.assigned_to_user_id = Number(patch.assigned_to_user_id);
    if ('due_date' in patch)                    fields.due_date = patch.due_date || null;
    if (patch.priority && PRIORITIES.includes(patch.priority)) fields.priority = patch.priority;
    if ('linked_entity_type' in patch)          fields.linked_entity_type = patch.linked_entity_type || null;
    if ('linked_entity_id' in patch)            fields.linked_entity_id = patch.linked_entity_id ? String(patch.linked_entity_id) : null;
  }
  if (Object.keys(fields).length === 0) return cur;
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE tasks SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return row;
}

/** Dashboard counts: pending, overdue, completed today — scoped. */
export async function dashboard(actor) {
  const sql = getDb();
  const scoped = ADMIN(actor) ? null : Number(actor.id);
  const ownAnd = scoped != null ? sql`AND assigned_to_user_id = ${scoped}` : sql``;
  const [[{ pending }], [{ overdue }], [{ completed_today }]] = await Promise.all([
    sql`SELECT count(*)::int AS pending FROM tasks WHERE status IN ('pending','in_progress') ${ownAnd}`,
    sql`SELECT count(*)::int AS overdue FROM tasks WHERE status IN ('pending','in_progress') AND due_date IS NOT NULL AND due_date < current_date ${ownAnd}`,
    sql`SELECT count(*)::int AS completed_today FROM tasks WHERE status = 'completed' AND completed_at >= date_trunc('day', now()) ${ownAnd}`
  ]);
  return { pending, overdue, completed_today };
}
