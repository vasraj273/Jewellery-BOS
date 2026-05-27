import { getDb } from '../database/connection.js';

/**
 * Generate `QT-YYYY-NNNN` per calendar year.
 *
 * Concurrency: SQLite's serial writes made naïve COUNT(*) safe. Postgres
 * allows concurrent inserts, so we retry up to 5 times on UNIQUE violation
 * (the quote_id column is UNIQUE — schema constraint catches collisions).
 * In practice n=1 wins; the loop is defence-in-depth.
 */
export async function generateQuoteId() {
  const sql = getDb();
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM quotations WHERE quote_id LIKE ${`QT-${year}-%`}
    `;
    const next = (rows[0]?.n || 0) + 1 + attempt;
    const candidate = `QT-${year}-${String(next).padStart(4, '0')}`;
    const exists = await sql`SELECT 1 FROM quotations WHERE quote_id = ${candidate} LIMIT 1`;
    if (exists.length === 0) return candidate;
  }
  // Extremely unlikely: 5 simultaneous creates with identical race. Fall back
  // to a timestamp suffix so we never block the user.
  return `QT-${year}-${Date.now().toString().slice(-4)}`;
}
