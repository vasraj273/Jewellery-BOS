import { getDb } from '../database/connection.js';
import { generateCode } from '../utils/seqCode.js';

export const STATUSES = ['issued', 'in_progress', 'completed', 'cancelled'];
const num = (v) => (Number.isFinite(+v) ? +v : 0);

export async function list({ status, karigar_id, search } = {}) {
  const sql = getDb();
  const statusClause = status ? sql`AND j.status = ${status}` : sql``;
  const karigarClause = karigar_id ? sql`AND j.karigar_id = ${Number(karigar_id)}` : sql``;
  const s = (search || '').trim();
  const searchClause = s ? sql`AND (j.job_work_code ILIKE ${'%' + s + '%'} OR j.description ILIKE ${'%' + s + '%'})` : sql``;
  return sql`
    SELECT j.*, k.name AS karigar_name, so.order_code, i.sku AS inventory_sku
    FROM job_works j
    LEFT JOIN karigars k ON k.id = j.karigar_id
    LEFT JOIN sales_orders so ON so.id = j.sales_order_id
    LEFT JOIN inventory_items i ON i.id = j.inventory_item_id
    WHERE 1 = 1 ${statusClause} ${karigarClause} ${searchClause}
    ORDER BY j.created_at DESC
    LIMIT 1000
  `;
}

export async function findById(id) {
  const sql = getDb();
  const [row] = await sql`
    SELECT j.*, k.name AS karigar_name, so.order_code, i.sku AS inventory_sku
    FROM job_works j
    LEFT JOIN karigars k ON k.id = j.karigar_id
    LEFT JOIN sales_orders so ON so.id = j.sales_order_id
    LEFT JOIN inventory_items i ON i.id = j.inventory_item_id
    WHERE j.id = ${id}
  `;
  return row || null;
}

export async function create(input, actor) {
  const sql = getDb();
  const code = await generateCode('job_works', 'job_work_code', 'JW');
  const labour = num(input.labour_charge);
  const paid = num(input.amount_paid);
  const itemId = input.inventory_item_id ? Number(input.inventory_item_id) : null;
  const goldIssued = num(input.gold_issued_gm);

  return sql.begin(async (tx) => {
    const [row] = await tx`
      INSERT INTO job_works (
        job_work_code, karigar_id, sales_order_id, inventory_item_id, description,
        gold_issued_gm, gold_returned_gm, wastage_gm, labour_charge, amount_paid, payment_due,
        status, issued_date, notes, created_by_user_id
      ) VALUES (
        ${code}, ${input.karigar_id ? Number(input.karigar_id) : null}, ${input.sales_order_id ? Number(input.sales_order_id) : null},
        ${itemId}, ${input.description || null},
        ${goldIssued}, ${num(input.gold_returned_gm)}, ${num(input.wastage_gm)}, ${labour}, ${paid}, ${labour - paid},
        ${STATUSES.includes(input.status) ? input.status : 'issued'}, ${input.issued_date || new Date().toISOString().slice(0, 10)},
        ${input.notes || null}, ${actor?.id ?? null}
      )
      RETURNING *
    `;
    // Inventory ledger: gold issued out to the karigar (item status unchanged).
    if (itemId && goldIssued > 0) {
      await tx`
        INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
        VALUES (${itemId}, 'out', 'transfer_out', 1, ${goldIssued}, ${'Gold issued to karigar (' + code + ')'}, 'job_work', ${code}, ${actor?.id ?? null})
      `;
    }
    return row;
  });
}

export async function update(id, patch, actor) {
  const sql = getDb();
  return sql.begin(async (tx) => {
    const [job] = await tx`SELECT * FROM job_works WHERE id = ${id} FOR UPDATE`;
    if (!job) { const e = new Error('Job work not found'); e.status = 404; throw e; }

    const fields = {};
    for (const k of ['description', 'notes']) if (k in patch) fields[k] = patch[k] || null;
    for (const k of ['gold_issued_gm', 'gold_returned_gm', 'wastage_gm']) if (k in patch) fields[k] = num(patch[k]);
    if ('labour_charge' in patch) fields.labour_charge = num(patch.labour_charge);
    if ('amount_paid' in patch) fields.amount_paid = num(patch.amount_paid);
    if ('karigar_id' in patch) fields.karigar_id = patch.karigar_id ? Number(patch.karigar_id) : null;
    if (patch.status && STATUSES.includes(patch.status)) fields.status = patch.status;
    if (patch.status === 'completed') fields.completed_date = patch.completed_date || new Date().toISOString().slice(0, 10);

    const labour = 'labour_charge' in fields ? fields.labour_charge : num(job.labour_charge);
    const paid = 'amount_paid' in fields ? fields.amount_paid : num(job.amount_paid);
    fields.payment_due = labour - paid;

    const cols = Object.keys(fields);
    const [row] = await tx`UPDATE job_works SET ${tx(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;

    // On completion, return gold to the inventory ledger.
    const returned = 'gold_returned_gm' in fields ? fields.gold_returned_gm : num(job.gold_returned_gm);
    if (patch.status === 'completed' && job.inventory_item_id && returned > 0) {
      await tx`
        INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
        VALUES (${job.inventory_item_id}, 'in', 'return_in', 1, ${returned}, ${'Gold returned from karigar (' + job.job_work_code + ')'}, 'job_work', ${job.job_work_code}, ${actor?.id ?? null})
      `;
    }
    return row;
  });
}

export async function dashboard() {
  const sql = getDb();
  const [{ pending }] = await sql`SELECT count(*)::int AS pending FROM job_works WHERE status IN ('issued', 'in_progress')`;
  const [{ due_total }] = await sql`SELECT COALESCE(sum(payment_due), 0) AS due_total FROM job_works WHERE status <> 'cancelled' AND payment_due > 0`;
  return { pending, payment_due_total: Number(due_total) || 0 };
}
