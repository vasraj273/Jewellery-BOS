import { getDb } from '../database/connection.js';

/**
 * Generate `LD-YYYY-NNNN` per calendar year. Mirrors the quoteId approach:
 * count + retry against the UNIQUE lead_code constraint, with a timestamp
 * fallback that is effectively never reached.
 */
export async function generateLeadCode() {
  const sql = getDb();
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM leads WHERE lead_code LIKE ${`LD-${year}-%`}
    `;
    const next = (rows[0]?.n || 0) + 1 + attempt;
    const candidate = `LD-${year}-${String(next).padStart(4, '0')}`;
    const exists = await sql`SELECT 1 FROM leads WHERE lead_code = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  return `LD-${year}-${Date.now().toString().slice(-4)}`;
}
