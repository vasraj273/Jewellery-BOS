import { getDb } from '../database/connection.js';

export async function list({ include_inactive } = {}) {
  const sql = getDb();
  if (include_inactive === '1') return sql`SELECT * FROM shifts ORDER BY is_active DESC, shift_name`;
  return sql`SELECT * FROM shifts WHERE is_active = true ORDER BY shift_name`;
}

export async function create(input) {
  if (!input?.shift_name?.trim()) { const e = new Error('Shift name required'); e.status = 400; throw e; }
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO shifts (shift_name, start_time, end_time, weekly_off)
    VALUES (${input.shift_name.trim()}, ${input.start_time || null}, ${input.end_time || null}, ${input.weekly_off || null})
    RETURNING *
  `;
  return row;
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  if (typeof patch.shift_name === 'string') fields.shift_name = patch.shift_name.trim();
  if ('start_time' in patch) fields.start_time = patch.start_time || null;
  if ('end_time' in patch)   fields.end_time = patch.end_time || null;
  if ('weekly_off' in patch) fields.weekly_off = patch.weekly_off || null;
  if (typeof patch.is_active === 'boolean') fields.is_active = patch.is_active;
  if (Object.keys(fields).length === 0) {
    const [r] = await sql`SELECT * FROM shifts WHERE id = ${id}`;
    return r || null;
  }
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE shifts SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Shift not found'); e.status = 404; throw e; }
  return row;
}

export async function deactivate(id) {
  return update(id, { is_active: false });
}

export async function activate(id) {
  return update(id, { is_active: true });
}

/** Assign (or clear) an employee's active shift. One active shift per employee. */
export async function assignToEmployee(employeeId, shiftId) {
  const sql = getDb();
  await sql`UPDATE employees SET assigned_shift_id = ${shiftId ? Number(shiftId) : null}, updated_at = now() WHERE id = ${employeeId}`;
  const [emp] = await sql`SELECT id, assigned_shift_id FROM employees WHERE id = ${employeeId}`;
  return emp;
}
