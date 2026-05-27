import { getDb } from '../database/connection.js';

/**
 * Company-wide settings. Single-row table (id = 1) holding business identity,
 * quotation defaults, and pricing defaults.
 *
 *   - Cached in-process so template renders don't hit the DB on every PDF /
 *     preview request. Cache is invalidated whenever update() runs.
 *   - Server starts with a row already present (seeded in connection.js).
 */

const ALLOWED_FIELDS = [
  'company_name', 'company_tagline', 'company_address', 'company_contact',
  'company_web', 'company_gstin', 'company_logo_url',
  'quotation_footer', 'quotation_terms', 'quotation_validity_days', 'whatsapp_default_message',
  'default_pricing_location', 'default_markup_pct'
];

let cache = null;

export async function get() {
  if (cache) return cache;
  const sql = getDb();
  const rows = await sql`SELECT * FROM company_settings WHERE id = 1 LIMIT 1`;
  cache = rows[0] || null;
  return cache;
}

export function invalidate() { cache = null; }

export async function update(patch, actor) {
  if (!patch || typeof patch !== 'object') {
    const err = new Error('patch is required'); err.status = 400; throw err;
  }
  const sql = getDb();
  const fields = {};
  for (const k of ALLOWED_FIELDS) {
    if (patch[k] == null) continue;
    fields[k] = patch[k];
  }
  if (Object.keys(fields).length === 0) return get();

  // Coerce numerics
  if (fields.quotation_validity_days != null) fields.quotation_validity_days = Math.max(1, parseInt(fields.quotation_validity_days, 10) || 30);
  if (fields.default_markup_pct      != null) fields.default_markup_pct      = Math.max(0, Number(fields.default_markup_pct) || 0);

  fields.updated_by_user_id = actor?.id ?? null;
  const cols = Object.keys(fields);
  const [row] = await sql`
    UPDATE company_settings SET ${sql(fields, ...cols)}, updated_at = now()
    WHERE id = 1
    RETURNING *
  `;
  cache = row;
  return row;
}
