import { getDb } from '../database/connection.js';
import * as employees from './employees.service.js';

const TYPES = ['percentage', 'fixed', 'target_bonus'];
const ADMIN = (a) => a?.role === 'super_admin' || a?.role === 'admin';

const SELECT = `
  SELECT i.*, e.full_name AS employee_name, e.employee_code,
         ap.full_name AS approved_by_name
  FROM incentives i
  JOIN employees e ON e.id = i.employee_id
  LEFT JOIN users ap ON ap.id = i.approved_by_user_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();
  // Sales exec → only incentives tied to their own employee record.
  let ownEmpId = null;
  if (!ADMIN(actor)) {
    const emp = await employees.ensureForUser(actor);
    ownEmpId = emp?.id ?? -1;
  }
  const ownClause = ownEmpId != null ? sql`AND i.employee_id = ${ownEmpId}` : sql``;
  const empClause = (ownEmpId == null && filters.employee_id) ? sql`AND i.employee_id = ${Number(filters.employee_id)}` : sql``;
  const stClause  = filters.status ? sql`AND i.status = ${filters.status}` : sql``;
  return sql`
    ${sql.unsafe(SELECT)}
    WHERE 1 = 1 ${ownClause} ${empClause} ${stClause}
    ORDER BY i.created_at DESC
    LIMIT 1000
  `;
}

function resolveAmount(input) {
  // Resolved payout: fixed → fixed_amount; percentage/target → fixed_amount if given else null.
  if (input.type === 'fixed') return Number(input.fixed_amount) || 0;
  if (input.amount != null && input.amount !== '') return Number(input.amount) || 0;
  return Number(input.fixed_amount) || null;
}

export async function create(input, actor) {
  if (!ADMIN(actor)) { const e = new Error('Only admins can create incentives'); e.status = 403; throw e; }
  if (!input?.employee_id) { const e = new Error('employee_id required'); e.status = 400; throw e; }
  const type = TYPES.includes(input.type) ? input.type : 'fixed';
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO incentives (employee_id, type, percentage, fixed_amount, amount, linked_quotation_id, linked_customer_id, notes, status, created_by_user_id)
    VALUES (
      ${Number(input.employee_id)}, ${type},
      ${input.percentage != null && input.percentage !== '' ? Number(input.percentage) : null},
      ${input.fixed_amount != null && input.fixed_amount !== '' ? Number(input.fixed_amount) : null},
      ${resolveAmount(input)},
      ${input.linked_quotation_id ? Number(input.linked_quotation_id) : null},
      ${input.linked_customer_id ? Number(input.linked_customer_id) : null},
      ${input.notes || null}, 'draft', ${Number(actor.id)}
    )
    RETURNING *
  `;
  return row;
}

export async function setStatus(id, status, actor) {
  if (!ADMIN(actor)) { const e = new Error('Only admins can change incentive status'); e.status = 403; throw e; }
  if (!['draft', 'approved', 'paid'].includes(status)) { const e = new Error('Invalid status'); e.status = 400; throw e; }
  const sql = getDb();
  const [cur] = await sql`SELECT * FROM incentives WHERE id = ${id} LIMIT 1`;
  if (!cur) { const e = new Error('Incentive not found'); e.status = 404; throw e; }

  const fields = { status };
  if (status === 'approved') { fields.approved_by_user_id = Number(actor.id); fields.approved_at = new Date(); }
  if (status === 'paid')     { fields.paid_at = new Date(); }
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE incentives SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return row;
}

/** Self summary for a sales-exec dashboard: their own total / pending / paid. */
export async function mySummary(actor) {
  const sql = getDb();
  const emp = await employees.ensureForUser(actor);
  const empId = emp?.id ?? -1;
  const [r] = await sql`
    SELECT
      COALESCE(sum(COALESCE(amount, fixed_amount, 0)), 0)::numeric AS total,
      COALESCE(sum(COALESCE(amount, fixed_amount, 0)) FILTER (WHERE status IN ('draft','approved')), 0)::numeric AS pending,
      COALESCE(sum(COALESCE(amount, fixed_amount, 0)) FILTER (WHERE status = 'paid'), 0)::numeric AS paid
    FROM incentives WHERE employee_id = ${empId}
  `;
  return { total: Number(r.total), pending: Number(r.pending), paid: Number(r.paid) };
}

/** Dashboard: count + sum of incentives not yet paid; top earners (paid). */
export async function dashboard() {
  const sql = getDb();
  const [[pendingRow], top] = await Promise.all([
    sql`SELECT count(*)::int AS count, COALESCE(sum(amount),0)::numeric AS total
        FROM incentives WHERE status IN ('draft','approved')`,
    sql`SELECT e.full_name, COALESCE(sum(i.amount),0)::numeric AS earned
        FROM incentives i JOIN employees e ON e.id = i.employee_id
        WHERE i.status = 'paid'
        GROUP BY e.id, e.full_name ORDER BY earned DESC LIMIT 5`
  ]);
  return { pending_count: pendingRow.count, pending_total: Number(pendingRow.total), top_earners: top };
}
