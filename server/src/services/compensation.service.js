import { getDb } from '../database/connection.js';

const SALARY_TYPES = ['monthly', 'daily', 'contract'];

export async function getForEmployee(employeeId) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM employee_compensation WHERE employee_id = ${employeeId} LIMIT 1`;
  return rows[0] || null;
}

/** Upsert (one row per employee). Admin only — route enforces. */
export async function upsert(employeeId, input, actor) {
  const sql = getDb();
  const salaryType = SALARY_TYPES.includes(input.salary_type) ? input.salary_type : 'monthly';
  const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
  const row = {
    employee_id:        Number(employeeId),
    salary_type:        salaryType,
    base_salary:        num(input.base_salary),
    allowance:          num(input.allowance),
    deduction:          num(input.deduction),
    overtime_rate:      num(input.overtime_rate),
    commission_eligible: !!input.commission_eligible,
    notes:              input.notes || null,
    updated_by_user_id: Number(actor.id)
  };

  const existing = await getForEmployee(employeeId);
  if (existing) {
    const { employee_id, ...upd } = row;
    const cols = Object.keys(upd);
    const [r] = await sql`UPDATE employee_compensation SET ${sql(upd, ...cols)}, updated_at = now() WHERE employee_id = ${employeeId} RETURNING *`;
    return r;
  }
  await sql`INSERT INTO employee_compensation ${sql(row)}`;
  return getForEmployee(employeeId);
}
