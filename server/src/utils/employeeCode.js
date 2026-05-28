import { getDb } from '../database/connection.js';

/** Generate `EMP-YYYY-NNNN` per calendar year, retry on unique collision. */
export async function generateEmployeeCode() {
  const sql = getDb();
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM employees WHERE employee_code LIKE ${`EMP-${year}-%`}`;
    const next = (n || 0) + 1 + attempt;
    const candidate = `EMP-${year}-${String(next).padStart(4, '0')}`;
    const exists = await sql`SELECT 1 FROM employees WHERE employee_code = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  return `EMP-${year}-${Date.now().toString().slice(-4)}`;
}
