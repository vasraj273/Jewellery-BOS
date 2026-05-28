import { getDb } from '../database/connection.js';
import { generateEmployeeCode } from '../utils/employeeCode.js';

const EMPLOYMENT = ['active', 'on_leave', 'resigned', 'terminated'];

const SELECT = `
  SELECT e.*,
         m.full_name AS manager_name,
         u.is_active AS user_active
  FROM employees e
  LEFT JOIN employees m ON m.id = e.reporting_manager_id
  LEFT JOIN users u     ON u.id = e.user_id
`;

export async function list(filters = {}) {
  const sql = getDb();
  const search = (filters.search || '').trim();
  const searchClause = search
    ? sql`AND (e.full_name ILIKE ${'%' + search + '%'} OR e.email ILIKE ${'%' + search + '%'} OR e.mobile ILIKE ${'%' + search + '%'} OR e.employee_code ILIKE ${'%' + search + '%'})`
    : sql``;
  const statusClause = filters.employment_status ? sql`AND e.employment_status = ${filters.employment_status}` : sql``;
  const deptClause   = filters.department ? sql`AND e.department = ${filters.department}` : sql``;
  const activeClause = filters.include_inactive === '1' ? sql`` : sql`AND e.is_active = true`;
  return sql`
    ${sql.unsafe(SELECT)}
    WHERE 1 = 1 ${activeClause} ${searchClause} ${statusClause} ${deptClause}
    ORDER BY e.is_active DESC, e.full_name ASC
  `;
}

export async function findById(id) {
  const sql = getDb();
  const rows = await sql`${sql.unsafe(SELECT)} WHERE e.id = ${id}`;
  return rows[0] || null;
}

export async function findByUserId(userId) {
  const sql = getDb();
  const rows = await sql`${sql.unsafe(SELECT)} WHERE e.user_id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

/** Resolve (or lazily create) the employee record for a user. */
export async function ensureForUser(user) {
  const existing = await findByUserId(user.id);
  if (existing) return existing;
  const sql = getDb();
  const code = await generateEmployeeCode();
  await sql`
    INSERT INTO employees (employee_code, user_id, full_name, email, role, employment_status)
    VALUES (${code}, ${Number(user.id)}, ${user.full_name}, ${user.email || null}, ${user.role}, 'active')
    ON CONFLICT (user_id) DO NOTHING
  `;
  return findByUserId(user.id);
}

export async function create(input) {
  if (!input?.full_name?.trim()) { const e = new Error('Full name required'); e.status = 400; throw e; }
  const sql = getDb();
  const code = await generateEmployeeCode();
  const row = {
    employee_code:       code,
    user_id:             input.user_id ? Number(input.user_id) : null,
    full_name:           input.full_name.trim(),
    email:               input.email?.trim() || null,
    mobile:              input.mobile?.trim() || null,
    role:                input.role || null,
    department:          input.department?.trim() || null,
    designation:         input.designation?.trim() || null,
    joining_date:        input.joining_date || null,
    reporting_manager_id: input.reporting_manager_id ? Number(input.reporting_manager_id) : null,
    employment_status:   EMPLOYMENT.includes(input.employment_status) ? input.employment_status : 'active',
    emergency_contact:   input.emergency_contact?.trim() || null,
    address:             input.address?.trim() || null,
    notes:               input.notes?.trim() || null
  };
  await sql`INSERT INTO employees ${sql(row)}`;
  const [created] = await sql`SELECT id FROM employees WHERE employee_code = ${code} LIMIT 1`;
  return findById(created.id);
}

export async function update(id, patch) {
  const sql = getDb();
  const current = await findById(id);
  if (!current) { const e = new Error('Employee not found'); e.status = 404; throw e; }
  const fields = {};
  for (const k of ['full_name', 'email', 'mobile', 'department', 'designation', 'emergency_contact', 'address', 'notes']) {
    if (k in patch) fields[k] = patch[k] === '' ? null : patch[k];
  }
  if ('joining_date' in patch) fields.joining_date = patch.joining_date || null;
  if (patch.reporting_manager_id !== undefined) fields.reporting_manager_id = patch.reporting_manager_id ? Number(patch.reporting_manager_id) : null;
  if (patch.employment_status && EMPLOYMENT.includes(patch.employment_status)) fields.employment_status = patch.employment_status;
  if (typeof patch.is_active === 'boolean') fields.is_active = patch.is_active;
  if (fields.full_name != null && !String(fields.full_name).trim()) { const e = new Error('Full name required'); e.status = 400; throw e; }
  if (Object.keys(fields).length === 0) return current;
  const cols = Object.keys(fields);
  await sql`UPDATE employees SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id}`;
  return findById(id);
}

export async function deactivate(id) {
  return update(id, { is_active: false, employment_status: 'resigned' });
}
