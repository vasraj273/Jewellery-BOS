import { getDb } from '../database/connection.js';
import * as employees from './employees.service.js';

const TYPES = ['casual', 'sick', 'emergency', 'paid', 'unpaid'];
const ADMIN = (a) => a?.role === 'super_admin' || a?.role === 'admin';

const SELECT = `
  SELECT lv.*, e.full_name AS employee_name, e.employee_code,
         d.full_name AS decided_by_name
  FROM leaves lv
  JOIN employees e ON e.id = lv.employee_id
  LEFT JOIN users d ON d.id = lv.decided_by_user_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();
  let ownEmpId = null;
  if (!ADMIN(actor)) {
    const emp = await employees.ensureForUser(actor);
    ownEmpId = emp?.id ?? -1;
  }
  const ownClause   = ownEmpId != null ? sql`AND lv.employee_id = ${ownEmpId}` : sql``;
  const empClause   = (ownEmpId == null && filters.employee_id) ? sql`AND lv.employee_id = ${Number(filters.employee_id)}` : sql``;
  const typeClause  = filters.leave_type ? sql`AND lv.leave_type = ${filters.leave_type}` : sql``;
  const statusClause= filters.status ? sql`AND lv.status = ${filters.status}` : sql``;
  const fromClause  = filters.date_from ? sql`AND lv.end_date >= ${filters.date_from}::date` : sql``;
  const toClause    = filters.date_to   ? sql`AND lv.start_date <= ${filters.date_to}::date` : sql``;

  return sql`
    ${sql.unsafe(SELECT)}
    WHERE 1 = 1 ${ownClause} ${empClause} ${typeClause} ${statusClause} ${fromClause} ${toClause}
    ORDER BY lv.created_at DESC
    LIMIT 1000
  `;
}

export async function request(input, actor) {
  const sql = getDb();
  // Employee = own record (sales exec); admin may file for someone via employee_id.
  let employeeId;
  if (ADMIN(actor) && input.employee_id) {
    employeeId = Number(input.employee_id);
  } else {
    const emp = await employees.ensureForUser(actor);
    employeeId = emp.id;
  }
  const type = TYPES.includes(input.leave_type) ? input.leave_type : null;
  if (!type) { const e = new Error('Valid leave_type required'); e.status = 400; throw e; }
  if (!input.start_date || !input.end_date) { const e = new Error('Start and end dates required'); e.status = 400; throw e; }
  if (input.end_date < input.start_date) { const e = new Error('End date must be on/after start date'); e.status = 400; throw e; }

  const [row] = await sql`
    INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason, status)
    VALUES (${employeeId}, ${type}, ${input.start_date}::date, ${input.end_date}::date, ${input.reason || null}, 'pending')
    RETURNING *
  `;
  return row;
}

export async function decide(id, decision, actor) {
  if (!ADMIN(actor)) { const e = new Error('Only admins can approve or reject leave'); e.status = 403; throw e; }
  if (!['approved', 'rejected'].includes(decision)) { const e = new Error('Invalid decision'); e.status = 400; throw e; }
  const sql = getDb();
  const [cur] = await sql`SELECT * FROM leaves WHERE id = ${id} LIMIT 1`;
  if (!cur) { const e = new Error('Leave not found'); e.status = 404; throw e; }
  const [row] = await sql`
    UPDATE leaves
    SET status = ${decision}, decided_by_user_id = ${Number(actor.id)}, decided_at = now(), updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return row;
}

/** Dashboard: pending approvals (org-wide for admin; own for sales-exec) + on-leave-today. */
export async function dashboard(actor) {
  const sql = getDb();
  let ownEmpId = null;
  if (!ADMIN(actor)) {
    const emp = await employees.ensureForUser(actor);
    ownEmpId = emp?.id ?? -1;
  }
  const ownAnd = ownEmpId != null ? sql`AND employee_id = ${ownEmpId}` : sql``;

  const [[{ pending }], [{ today }]] = await Promise.all([
    sql`SELECT count(*)::int AS pending FROM leaves WHERE status = 'pending' ${ownAnd}`,
    sql`SELECT count(*)::int AS today FROM leaves WHERE status = 'approved' AND current_date BETWEEN start_date AND end_date ${ownAnd}`
  ]);
  return { pending_approvals: pending, leaves_today: today };
}
