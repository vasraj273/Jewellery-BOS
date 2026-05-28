import { getDb } from '../database/connection.js';

const CATEGORIES = ['Identity', 'Employment', 'Legal', 'Other'];

export async function list(employeeId, { include_inactive } = {}) {
  const sql = getDb();
  if (include_inactive === '1') {
    return sql`
      SELECT d.*, u.full_name AS uploaded_by_name
      FROM employee_documents d LEFT JOIN users u ON u.id = d.uploaded_by_user_id
      WHERE d.employee_id = ${employeeId} ORDER BY d.created_at DESC`;
  }
  return sql`
    SELECT d.*, u.full_name AS uploaded_by_name
    FROM employee_documents d LEFT JOIN users u ON u.id = d.uploaded_by_user_id
    WHERE d.employee_id = ${employeeId} AND d.is_active = true ORDER BY d.created_at DESC`;
}

export async function create(employeeId, input, actor) {
  if (!input?.document_name?.trim()) { const e = new Error('Document name required'); e.status = 400; throw e; }
  if (!input?.upload_url?.trim())     { const e = new Error('upload_url required'); e.status = 400; throw e; }
  const category = CATEGORIES.includes(input.category) ? input.category : 'Other';
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO employee_documents (employee_id, document_name, category, upload_url, uploaded_by_user_id)
    VALUES (${Number(employeeId)}, ${input.document_name.trim()}, ${category}, ${input.upload_url.trim()}, ${Number(actor.id)})
    RETURNING *
  `;
  return row;
}

export async function deactivate(id) {
  const sql = getDb();
  const [row] = await sql`UPDATE employee_documents SET is_active = false WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Document not found'); e.status = 404; throw e; }
  return row;
}
