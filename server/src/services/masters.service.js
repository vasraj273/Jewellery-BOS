import { getDb } from '../database/connection.js';

/**
 * Generic CRUD across the six M3 master tables. Same shape for each:
 *   (id, label, sort_order, is_active, extra jsonb, created_at, updated_at)
 *
 * `extra` carries per-type fields (e.g. making_presets stash charge_type +
 * charge_value there) so the route layer stays generic and we don't sprout
 * a separate controller per master.
 */

const TYPE_TO_TABLE = {
  product_categories: 'master_product_categories',
  metal_types:        'master_metal_types',
  purities:           'master_purities',
  diamond_types:      'master_diamond_types',
  cities:             'master_cities',
  making_presets:     'master_making_presets'
};

export function resolveTable(type) {
  const table = TYPE_TO_TABLE[type];
  if (!table) {
    const err = new Error(`Unknown master type "${type}"`);
    err.status = 400; throw err;
  }
  return table;
}

export function listTypes() { return Object.keys(TYPE_TO_TABLE); }

export async function list(type, { includeInactive = false } = {}) {
  const table = resolveTable(type);
  const sql = getDb();
  if (includeInactive) {
    return sql.unsafe(`SELECT * FROM ${table} ORDER BY sort_order ASC, label ASC`);
  }
  return sql.unsafe(`SELECT * FROM ${table} WHERE is_active = true ORDER BY sort_order ASC, label ASC`);
}

export async function create(type, payload) {
  const table = resolveTable(type);
  const { label, sort_order = 100, extra = {} } = payload || {};
  if (!label || !label.trim()) {
    const err = new Error('label is required'); err.status = 400; throw err;
  }
  const sql = getDb();
  const [row] = await sql.unsafe(
    `INSERT INTO ${table} (label, sort_order, extra) VALUES ($1, $2, $3) RETURNING *`,
    [label.trim(), parseInt(sort_order, 10) || 100, JSON.stringify(extra || {})]
  );
  return row;
}

export async function update(type, id, patch) {
  const table = resolveTable(type);
  const sql = getDb();
  const fields = {};
  if (typeof patch?.label === 'string')      fields.label      = patch.label.trim();
  if (patch?.sort_order  != null)            fields.sort_order = parseInt(patch.sort_order, 10) || 100;
  if (typeof patch?.is_active === 'boolean') fields.is_active  = patch.is_active;
  if (patch?.extra && typeof patch.extra === 'object') fields.extra = JSON.stringify(patch.extra);

  if (Object.keys(fields).length === 0) {
    const [row] = await sql.unsafe(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    return row || null;
  }

  const setSql = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.values(fields);
  values.push(id);
  const [row] = await sql.unsafe(
    `UPDATE ${table} SET ${setSql}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!row) { const err = new Error('Not found'); err.status = 404; throw err; }
  return row;
}

export async function deactivate(type, id) {
  return update(type, id, { is_active: false });
}

export async function activate(type, id) {
  return update(type, id, { is_active: true });
}
