/** Generate `PO-YYYY-NNNN` per calendar year inside a transaction. */
export async function generatePurchaseCodeTx(tx) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const [{ n }] = await tx`SELECT count(*)::int AS n FROM purchases WHERE purchase_code LIKE ${`PO-${year}-%`}`;
    const next = (n || 0) + 1 + attempt;
    const candidate = `PO-${year}-${String(next).padStart(4, '0')}`;
    const exists = await tx`SELECT 1 FROM purchases WHERE purchase_code = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  return `PO-${year}-${Date.now().toString().slice(-4)}`;
}
