import { getDb } from '../database/connection.js';

/** Generate `SKU-YYYY-NNNN` per calendar year, retry on unique collision. */
export async function generateSku() {
  const sql = getDb();
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM inventory_items WHERE sku LIKE ${`SKU-${year}-%`}`;
    const next = (n || 0) + 1 + attempt;
    const candidate = `SKU-${year}-${String(next).padStart(4, '0')}`;
    const exists = await sql`SELECT 1 FROM inventory_items WHERE sku = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  return `SKU-${year}-${Date.now().toString().slice(-4)}`;
}

/** Same generator bound to a transaction client (used inside procurement tx). */
export async function generateSkuTx(tx) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const [{ n }] = await tx`SELECT count(*)::int AS n FROM inventory_items WHERE sku LIKE ${`SKU-${year}-%`}`;
    const next = (n || 0) + 1 + attempt;
    const candidate = `SKU-${year}-${String(next).padStart(4, '0')}`;
    const exists = await tx`SELECT 1 FROM inventory_items WHERE sku = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  return `SKU-${year}-${Date.now().toString().slice(-4)}`;
}
