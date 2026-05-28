import { getDb } from '../database/connection.js';
import * as employees from './employees.service.js';

const STATUSES = ['present', 'half_day', 'absent', 'leave'];
const ADMIN = (a) => a?.role === 'super_admin' || a?.role === 'admin';

const SELECT = `
  SELECT a.*, e.full_name AS employee_name, e.employee_code
  FROM attendance a
  JOIN employees e ON e.id = a.employee_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();

  // Sales-exec: scope to own employee record.
  let ownEmpId = null;
  if (!ADMIN(actor)) {
    const emp = await employees.ensureForUser(actor);
    ownEmpId = emp?.id ?? -1;
  }
  const ownClause = ownEmpId != null ? sql`AND a.employee_id = ${ownEmpId}` : sql``;

  const empClause    = (ownEmpId == null && filters.employee_id) ? sql`AND a.employee_id = ${Number(filters.employee_id)}` : sql``;
  const statusClause = filters.status ? sql`AND a.status = ${filters.status}` : sql``;
  const fromClause   = filters.date_from ? sql`AND a.attendance_date >= ${filters.date_from}::date` : sql``;
  const toClause     = filters.date_to   ? sql`AND a.attendance_date <= ${filters.date_to}::date` : sql``;
  const monthClause  = filters.month ? sql`AND to_char(a.attendance_date, 'YYYY-MM') = ${filters.month}` : sql``;

  return sql`
    ${sql.unsafe(SELECT)}
    WHERE 1 = 1 ${ownClause} ${empClause} ${statusClause} ${fromClause} ${toClause} ${monthClause}
    ORDER BY a.attendance_date DESC, e.full_name ASC
    LIMIT 1000
  `;
}

/** Resolve which employee an actor may mark. Sales-exec → self only. */
async function resolveTargetEmployee(actor, requestedEmployeeId) {
  if (ADMIN(actor)) {
    if (!requestedEmployeeId) { const e = new Error('employee_id required'); e.status = 400; throw e; }
    return Number(requestedEmployeeId);
  }
  const emp = await employees.ensureForUser(actor);
  if (requestedEmployeeId && Number(requestedEmployeeId) !== emp.id) {
    const e = new Error('You can only mark your own attendance'); e.status = 403; throw e;
  }
  return emp.id;
}

export async function mark(input, actor) {
  const sql = getDb();
  const employeeId = await resolveTargetEmployee(actor, input.employee_id);
  const date = input.attendance_date || new Date().toISOString().slice(0, 10);
  const status = STATUSES.includes(input.status) ? input.status : 'present';

  const existing = await sql`SELECT id FROM attendance WHERE employee_id = ${employeeId} AND attendance_date = ${date}::date LIMIT 1`;
  if (existing.length) { const e = new Error('Attendance already marked for this employee on this date'); e.status = 409; throw e; }

  const [row] = await sql`
    INSERT INTO attendance (employee_id, attendance_date, status, check_in_time, check_out_time, notes, marked_by_user_id)
    VALUES (${employeeId}, ${date}::date, ${status}, ${input.check_in_time || null}, ${input.check_out_time || null}, ${input.notes || null}, ${Number(actor.id)})
    RETURNING *
  `;
  return { row, edited: false };
}

export async function edit(id, patch, actor) {
  if (!ADMIN(actor)) { const e = new Error('Only admins can edit attendance'); e.status = 403; throw e; }
  const sql = getDb();
  const [cur] = await sql`SELECT * FROM attendance WHERE id = ${id} LIMIT 1`;
  if (!cur) { const e = new Error('Attendance not found'); e.status = 404; throw e; }
  const fields = {};
  if (patch.status && STATUSES.includes(patch.status)) fields.status = patch.status;
  if ('check_in_time' in patch)  fields.check_in_time = patch.check_in_time || null;
  if ('check_out_time' in patch) fields.check_out_time = patch.check_out_time || null;
  if ('notes' in patch)          fields.notes = patch.notes || null;
  if (Object.keys(fields).length === 0) return cur;
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE attendance SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return row;
}

/** The acting user's own attendance status for today (sales-exec dashboard). */
export async function myToday(actor) {
  const sql = getDb();
  const emp = await employees.ensureForUser(actor);
  const empId = emp?.id ?? -1;
  const [row] = await sql`
    SELECT status, check_in_time, check_out_time
    FROM attendance WHERE employee_id = ${empId} AND attendance_date = current_date LIMIT 1
  `;
  return { status: row?.status || null, check_in_time: row?.check_in_time || null, check_out_time: row?.check_out_time || null };
}

/** Today's present / absent / leave counts (whole org; admin dashboard). */
export async function todayStats() {
  const sql = getDb();
  const [r] = await sql`
    SELECT
      count(*) FILTER (WHERE status = 'present')::int  AS present,
      count(*) FILTER (WHERE status = 'absent')::int   AS absent,
      count(*) FILTER (WHERE status = 'leave')::int     AS leave,
      count(*) FILTER (WHERE status = 'half_day')::int  AS half_day
    FROM attendance
    WHERE attendance_date = current_date
  `;
  return r;
}
