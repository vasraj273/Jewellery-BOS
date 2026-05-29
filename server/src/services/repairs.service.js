import { getDb } from '../database/connection.js';
import { generateCode } from '../utils/seqCode.js';

export const STATUSES = ['received', 'in_progress', 'ready', 'delivered', 'cancelled'];
const num = (v) => (Number.isFinite(+v) ? +v : 0);

export async function list({ status, search } = {}) {
  const sql = getDb();
  const statusClause = status ? sql`AND status = ${status}` : sql``;
  const s = (search || '').trim();
  const searchClause = s
    ? sql`AND (repair_code ILIKE ${'%' + s + '%'} OR customer_name ILIKE ${'%' + s + '%'} OR customer_mobile ILIKE ${'%' + s + '%'} OR item_description ILIKE ${'%' + s + '%'})`
    : sql``;
  return sql`
    SELECT r.*, c.customer_code FROM repair_orders r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE 1 = 1 ${statusClause} ${searchClause}
    ORDER BY r.received_date DESC, r.id DESC
    LIMIT 1000
  `;
}

export async function findById(id) {
  const sql = getDb();
  const [row] = await sql`SELECT * FROM repair_orders WHERE id = ${id}`;
  return row || null;
}

export async function create(input, actor) {
  if (!input?.customer_name?.trim() && !input?.customer_mobile?.trim()) {
    const e = new Error('Customer name or mobile required'); e.status = 400; throw e;
  }
  if (!input?.item_description?.trim()) { const e = new Error('Item description required'); e.status = 400; throw e; }
  const sql = getDb();
  const code = await generateCode('repair_orders', 'repair_code', 'RPO');
  const [cust] = input.customer_mobile
    ? await sql`SELECT id FROM customers WHERE mobile = ${input.customer_mobile} LIMIT 1`
    : [null];
  const [row] = await sql`
    INSERT INTO repair_orders (
      repair_code, customer_id, customer_name, customer_mobile, item_description, issue_notes,
      received_date, promised_date, charge, status, notes, created_by_user_id
    ) VALUES (
      ${code}, ${cust?.id || null}, ${input.customer_name || null}, ${input.customer_mobile || null},
      ${input.item_description.trim()}, ${input.issue_notes || null},
      ${input.received_date || new Date().toISOString().slice(0, 10)}, ${input.promised_date || null},
      ${num(input.charge)}, 'received', ${input.notes || null}, ${actor?.id ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  for (const k of ['item_description', 'issue_notes', 'notes']) if (k in patch) fields[k] = patch[k] || null;
  if ('promised_date' in patch) fields.promised_date = patch.promised_date || null;
  if ('charge' in patch) fields.charge = num(patch.charge);
  if (patch.status && STATUSES.includes(patch.status)) {
    fields.status = patch.status;
    if (patch.status === 'delivered') fields.delivered_at = new Date();
  }
  if (Object.keys(fields).length === 0) return findById(id);
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE repair_orders SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Repair order not found'); e.status = 404; throw e; }
  return row;
}

export async function dashboard() {
  const sql = getDb();
  const rows = await sql`SELECT status, count(*)::int AS n FROM repair_orders GROUP BY status`;
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r.status] = r.n;
  const pending = (byStatus.received || 0) + (byStatus.in_progress || 0) + (byStatus.ready || 0);
  const [{ overdue }] = await sql`
    SELECT count(*)::int AS overdue FROM repair_orders
    WHERE status NOT IN ('delivered', 'cancelled') AND promised_date IS NOT NULL AND promised_date < current_date
  `;
  return { by_status: byStatus, pending, overdue };
}
