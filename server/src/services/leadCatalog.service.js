import { getDb } from '../database/connection.js';

/** Read-only lead source + status catalogs (admin CRUD can come later). */
export async function listSources() {
  const sql = getDb();
  return sql`SELECT id, label, sort_order, is_active FROM lead_sources WHERE is_active = true ORDER BY sort_order, label`;
}

export async function listStatuses() {
  const sql = getDb();
  return sql`SELECT id, label, sort_order, is_active, is_terminal FROM lead_statuses WHERE is_active = true ORDER BY sort_order, label`;
}
