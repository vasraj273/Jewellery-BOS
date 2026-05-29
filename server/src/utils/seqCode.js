import { getDb } from '../database/connection.js';

/**
 * Generic per-year sequential code generator: `<PREFIX>-YYYY-NNNN`.
 * Retries on unique collision. table/column/prefix are internal constants
 * (never user input), so the interpolation into the query is safe.
 *
 *   generateCode('sales_orders', 'order_code', 'SO')
 *   generateCodeTx(tx, 'production_jobs', 'job_code', 'PRJ')
 */
export async function generateCode(table, column, prefix) {
  return _gen(getDb(), table, column, prefix);
}

export async function generateCodeTx(tx, table, column, prefix) {
  return _gen(tx, table, column, prefix);
}

async function _gen(q, table, column, prefix) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  for (let i = 0; i < 8; i++) {
    const [{ n }] = await q.unsafe(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} LIKE $1`, [like]);
    const next = (n || 0) + 1 + i;
    const candidate = `${prefix}-${year}-${String(next).padStart(4, '0')}`;
    const exists = await q.unsafe(`SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`, [candidate]);
    if (exists.length === 0) return candidate;
  }
  return `${prefix}-${year}-${Date.now().toString().slice(-4)}`;
}
