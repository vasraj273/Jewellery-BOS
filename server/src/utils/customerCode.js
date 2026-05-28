import { getDb } from '../database/connection.js';

/** Generate `CUST-YYYY-NNNN` per calendar year, retry on unique collision. */
export async function generateCustomerCode() {
  const sql = getDb();
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM customers WHERE customer_code LIKE ${`CUST-${year}-%`}
    `;
    const next = (rows[0]?.n || 0) + 1 + attempt;
    const candidate = `CUST-${year}-${String(next).padStart(4, '0')}`;
    const exists = await sql`SELECT 1 FROM customers WHERE customer_code = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  return `CUST-${year}-${Date.now().toString().slice(-4)}`;
}
