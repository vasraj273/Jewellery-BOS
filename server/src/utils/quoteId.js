import { getDatabase } from '../database/connection.js';

/**
 * Format: QT-YYYY-NNNN  (zero-padded sequence per calendar year)
 */
export function generateQuoteId() {
  const year = new Date().getFullYear();
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM quotations WHERE quote_id LIKE ?`
    )
    .get(`QT-${year}-%`);
  const next = (row?.n || 0) + 1;
  return `QT-${year}-${String(next).padStart(4, '0')}`;
}
