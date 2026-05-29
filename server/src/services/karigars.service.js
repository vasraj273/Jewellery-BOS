import { getDb } from '../database/connection.js';
import { generateCode } from '../utils/seqCode.js';

export async function list({ include_inactive, search } = {}) {
  const sql = getDb();
  const s = (search || '').trim();
  const searchClause = s
    ? sql`AND (name ILIKE ${'%' + s + '%'} OR karigar_code ILIKE ${'%' + s + '%'} OR mobile ILIKE ${'%' + s + '%'} OR skill ILIKE ${'%' + s + '%'})`
    : sql``;
  const activeClause = include_inactive === '1' ? sql`` : sql`AND is_active = true`;
  return sql`
    SELECT * FROM karigars
    WHERE 1 = 1 ${activeClause} ${searchClause}
    ORDER BY is_active DESC, name
    LIMIT 1000
  `;
}

export async function findById(id) {
  const sql = getDb();
  const [row] = await sql`SELECT * FROM karigars WHERE id = ${id}`;
  return row || null;
}

export async function create(input, actor) {
  if (!input?.name?.trim()) { const e = new Error('Karigar name required'); e.status = 400; throw e; }
  const sql = getDb();
  const code = await generateCode('karigars', 'karigar_code', 'KRG');
  const [row] = await sql`
    INSERT INTO karigars (karigar_code, name, mobile, email, address, skill, notes, created_by_user_id)
    VALUES (${code}, ${input.name.trim()}, ${input.mobile || null}, ${input.email || null}, ${input.address || null}, ${input.skill || null}, ${input.notes || null}, ${actor?.id ?? null})
    RETURNING *
  `;
  return row;
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  if (typeof patch.name === 'string') fields.name = patch.name.trim();
  for (const k of ['mobile', 'email', 'address', 'skill', 'notes']) {
    if (k in patch) fields[k] = patch[k] || null;
  }
  if (typeof patch.is_active === 'boolean') fields.is_active = patch.is_active;
  if (Object.keys(fields).length === 0) return findById(id);
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE karigars SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Karigar not found'); e.status = 404; throw e; }
  return row;
}

export async function deactivate(id) { return update(id, { is_active: false }); }
export async function activate(id) { return update(id, { is_active: true }); }
