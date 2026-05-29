import { getDb } from '../database/connection.js';
import { generateCode } from '../utils/seqCode.js';
import * as inventory from './inventory.service.js';

export const STAGES = ['design_approved', 'in_production', 'stone_setting', 'polishing', 'qc', 'ready', 'delivered'];
const DONE_STAGES = ['ready', 'delivered'];

/** Ensure a sales order has a production job (idempotent). */
export async function ensureForOrder(salesOrderId, actor) {
  const sql = getDb();
  const [existing] = await sql`SELECT * FROM production_jobs WHERE sales_order_id = ${salesOrderId} LIMIT 1`;
  if (existing) return existing;
  const code = await generateCode('production_jobs', 'job_code', 'PRJ');
  return sql.begin(async (tx) => {
    const [job] = await tx`
      INSERT INTO production_jobs (job_code, sales_order_id, stage, created_by_user_id)
      VALUES (${code}, ${salesOrderId}, 'design_approved', ${actor?.id ?? null})
      RETURNING *
    `;
    await tx`INSERT INTO production_events (production_job_id, stage, note, actor_user_id) VALUES (${job.id}, 'design_approved', 'Production started', ${actor?.id ?? null})`;
    return job;
  });
}

const isDelayed = (job) =>
  !!job.expected_date && !DONE_STAGES.includes(job.stage) &&
  new Date(job.expected_date) < new Date(new Date().toISOString().slice(0, 10));

export async function list(filters = {}) {
  const sql = getDb();
  const stageClause = filters.stage ? sql`AND p.stage = ${filters.stage}` : sql``;
  const rows = await sql`
    SELECT p.*, s.order_code, s.customer_name, s.product_name, s.expected_delivery,
           e.full_name AS employee_name, k.name AS karigar_name
    FROM production_jobs p
    JOIN sales_orders s ON s.id = p.sales_order_id
    LEFT JOIN employees e ON e.id = p.assigned_employee_id
    LEFT JOIN karigars k ON k.id = p.karigar_id
    WHERE 1 = 1 ${stageClause}
    ORDER BY p.created_at DESC
    LIMIT 1000
  `;
  let out = rows.map((r) => ({ ...r, delayed: isDelayed(r) }));
  if (filters.delayed === '1') out = out.filter((r) => r.delayed);
  return out;
}

export async function findById(id) {
  const sql = getDb();
  const [job] = await sql`
    SELECT p.*, s.order_code, s.customer_name, s.product_name,
           e.full_name AS employee_name, k.name AS karigar_name
    FROM production_jobs p
    JOIN sales_orders s ON s.id = p.sales_order_id
    LEFT JOIN employees e ON e.id = p.assigned_employee_id
    LEFT JOIN karigars k ON k.id = p.karigar_id
    WHERE p.id = ${id}
  `;
  if (!job) return null;
  const events = await sql`
    SELECT ev.*, u.full_name AS actor_name
    FROM production_events ev LEFT JOIN users u ON u.id = ev.actor_user_id
    WHERE ev.production_job_id = ${id} ORDER BY ev.created_at DESC
  `;
  return { ...job, delayed: isDelayed(job), events };
}

export async function setStage(id, { stage, note }, actor) {
  if (!STAGES.includes(stage)) { const e = new Error('Invalid production stage'); e.status = 400; throw e; }
  const sql = getDb();
  return sql.begin(async (tx) => {
    const [job] = await tx`SELECT * FROM production_jobs WHERE id = ${id} FOR UPDATE`;
    if (!job) { const e = new Error('Production job not found'); e.status = 404; throw e; }
    const completed = DONE_STAGES.includes(stage) ? (job.completed_date || new Date().toISOString().slice(0, 10)) : job.completed_date;
    const delayed = !!job.expected_date && !DONE_STAGES.includes(stage) && new Date(job.expected_date) < new Date(new Date().toISOString().slice(0, 10));
    const [updated] = await tx`
      UPDATE production_jobs SET stage = ${stage}, completed_date = ${completed}, is_delayed = ${delayed}, updated_at = now()
      WHERE id = ${id} RETURNING *
    `;
    await tx`INSERT INTO production_events (production_job_id, stage, note, actor_user_id) VALUES (${id}, ${stage}, ${note || null}, ${actor?.id ?? null})`;
    return updated;
  });
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  if ('assigned_employee_id' in patch) fields.assigned_employee_id = patch.assigned_employee_id ? Number(patch.assigned_employee_id) : null;
  if ('karigar_id' in patch) fields.karigar_id = patch.karigar_id ? Number(patch.karigar_id) : null;
  if ('expected_date' in patch) fields.expected_date = patch.expected_date || null;
  if ('notes' in patch) fields.notes = patch.notes || null;
  if (Object.keys(fields).length === 0) return findById(id);
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE production_jobs SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Production job not found'); e.status = 404; throw e; }
  // Recompute delay against the (possibly new) expected_date.
  const delayed = isDelayed(row);
  if (delayed !== row.is_delayed) await sql`UPDATE production_jobs SET is_delayed = ${delayed} WHERE id = ${id}`;
  return { ...row, is_delayed: delayed };
}

/** Create a finished inventory item from a completed production job. */
export async function addFinishedStock(id, input, actor) {
  const sql = getDb();
  const [job] = await sql`
    SELECT p.*, s.product_name, s.product_category FROM production_jobs p
    JOIN sales_orders s ON s.id = p.sales_order_id WHERE p.id = ${id}
  `;
  if (!job) { const e = new Error('Production job not found'); e.status = 404; throw e; }
  const item = await inventory.create({
    name: input.name || job.product_name || `Finished · ${job.job_code}`,
    category: input.category || job.product_category || null,
    metal_type: input.metal_type, purity: input.purity,
    gross_weight: input.gross_weight, net_weight: input.net_weight,
    purchase_cost: input.purchase_cost, stone_value: input.stone_value, making_cost: input.making_cost,
    location: input.location, movement_type: 'manufacture',
    notes: `Finished from production ${job.job_code}`
  }, actor);
  return item;
}

export async function alerts() {
  const sql = getDb();
  const active = await sql`
    SELECT p.*, s.expected_delivery FROM production_jobs p
    JOIN sales_orders s ON s.id = p.sales_order_id
    WHERE p.stage <> 'delivered'
  `;
  const delayed = active.filter(isDelayed);
  const byStage = {};
  for (const st of STAGES) byStage[st] = 0;
  for (const j of active) byStage[j.stage] = (byStage[j.stage] || 0) + 1;
  return {
    active_count: active.length,
    delayed_count: delayed.length,
    delayed: delayed.slice(0, 50).map((j) => ({ id: j.id, job_code: j.job_code, stage: j.stage, expected_date: j.expected_date })),
    by_stage: byStage
  };
}
