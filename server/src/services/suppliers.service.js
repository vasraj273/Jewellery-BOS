import { getDb } from '../database/connection.js';
import { generateSupplierCode } from '../utils/supplierCode.js';

export async function list({ include_inactive, search } = {}) {
  const sql = getDb();
  const s = (search || '').trim();
  const searchClause = s
    ? sql`AND (name ILIKE ${'%' + s + '%'} OR supplier_code ILIKE ${'%' + s + '%'} OR mobile ILIKE ${'%' + s + '%'} OR gst_number ILIKE ${'%' + s + '%'})`
    : sql``;
  const activeClause = include_inactive === '1' ? sql`` : sql`AND is_active = true`;
  return sql`
    SELECT * FROM suppliers
    WHERE 1 = 1 ${activeClause} ${searchClause}
    ORDER BY is_active DESC, name
    LIMIT 1000
  `;
}

export async function findById(id) {
  const sql = getDb();
  const [row] = await sql`SELECT * FROM suppliers WHERE id = ${id}`;
  return row || null;
}

export async function create(input, actor) {
  if (!input?.name?.trim()) { const e = new Error('Supplier name required'); e.status = 400; throw e; }
  const sql = getDb();
  const code = await generateSupplierCode();
  const [row] = await sql`
    INSERT INTO suppliers (supplier_code, name, gst_number, contact_person, mobile, email, address, category, notes, created_by_user_id)
    VALUES (
      ${code},
      ${input.name.trim()},
      ${input.gst_number || null},
      ${input.contact_person || null},
      ${input.mobile || null},
      ${input.email || null},
      ${input.address || null},
      ${input.category || null},
      ${input.notes || null},
      ${actor?.id ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  if (typeof patch.name === 'string') fields.name = patch.name.trim();
  for (const k of ['gst_number', 'contact_person', 'mobile', 'email', 'address', 'category', 'notes']) {
    if (k in patch) fields[k] = patch[k] || null;
  }
  if (typeof patch.is_active === 'boolean') fields.is_active = patch.is_active;
  if (Object.keys(fields).length === 0) return findById(id);
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE suppliers SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Supplier not found'); e.status = 404; throw e; }
  return row;
}

export async function deactivate(id) {
  return update(id, { is_active: false });
}
