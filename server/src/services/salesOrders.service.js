import { getDb } from '../database/connection.js';
import { generateCode } from '../utils/seqCode.js';
import * as quotations from './quotation.service.js';
import * as production from './production.service.js';
import * as inventory from './inventory.service.js';

export const STATUSES = ['draft', 'confirmed', 'production', 'ready', 'delivered', 'cancelled'];

const num = (v) => (Number.isFinite(+v) ? +v : 0);

/** RBAC scope — admin sees all, sales_executive sees own (owner_user_id). */
function scopeFor(actor) {
  if (!actor) return null;
  if (actor.role === 'super_admin' || actor.role === 'admin') return null;
  return Number(actor.id);
}

export async function list(actor, filters = {}) {
  const sql = getDb();
  const owner = scopeFor(actor);
  const ownerClause = owner != null ? sql`AND owner_user_id = ${owner}` : sql``;
  const statusClause = filters.status ? sql`AND status = ${filters.status}` : sql``;
  const search = (filters.search || '').trim();
  const searchClause = search
    ? sql`AND (order_code ILIKE ${'%' + search + '%'} OR customer_name ILIKE ${'%' + search + '%'} OR customer_mobile ILIKE ${'%' + search + '%'})`
    : sql``;
  return sql`
    SELECT * FROM sales_orders
    WHERE 1 = 1 ${ownerClause} ${statusClause} ${searchClause}
    ORDER BY created_at DESC
    LIMIT 1000
  `;
}

export async function findById(id, actor) {
  const sql = getDb();
  const owner = scopeFor(actor);
  const ownerClause = owner != null ? sql`AND owner_user_id = ${owner}` : sql``;
  const [row] = await sql`SELECT * FROM sales_orders WHERE id = ${id} ${ownerClause}`;
  if (!row) return null;
  const [job] = await sql`SELECT * FROM production_jobs WHERE sales_order_id = ${id} LIMIT 1`;
  return { ...row, production_job_id: job?.id || null, production_stage: job?.stage || null };
}

/** Convert a quotation into a confirmed sales order. */
export async function convertFromQuote(quoteId, input, actor) {
  const sql = getDb();
  const quote = await quotations.findByQuoteId(quoteId, actor); // scoped read
  if (!quote) { const e = new Error('Quotation not found'); e.status = 404; throw e; }

  const [dupe] = await sql`SELECT id, order_code FROM sales_orders WHERE quotation_id = ${quote.id} LIMIT 1`;
  if (dupe) { const e = new Error(`Sales order ${dupe.order_code} already exists for this quotation`); e.status = 409; throw e; }

  const [cust] = quote.customer_mobile
    ? await sql`SELECT id FROM customers WHERE mobile = ${quote.customer_mobile} LIMIT 1`
    : [null];

  const code = await generateCode('sales_orders', 'order_code', 'SO');
  const advance = num(input?.advance_amount);
  const total = num(quote.final_price);
  const [row] = await sql`
    INSERT INTO sales_orders (
      order_code, quotation_id, quote_code, customer_id, customer_name, customer_mobile,
      product_name, product_category, total_amount, advance_amount, balance_amount,
      status, expected_delivery, notes, owner_user_id, created_by_user_id
    ) VALUES (
      ${code}, ${quote.id}, ${quote.quote_id}, ${cust?.id || null}, ${quote.customer_name}, ${quote.customer_mobile},
      ${quote.product_name}, ${quote.product_category}, ${total}, ${advance}, ${total - advance},
      'confirmed', ${input?.expected_delivery || null}, ${input?.notes || null},
      ${quote.owner_user_id || actor?.id || null}, ${actor?.id ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function create(input, actor) {
  if (!input?.customer_name?.trim()) { const e = new Error('Customer name required'); e.status = 400; throw e; }
  const sql = getDb();
  const code = await generateCode('sales_orders', 'order_code', 'SO');
  const total = num(input.total_amount);
  const advance = num(input.advance_amount);
  const [row] = await sql`
    INSERT INTO sales_orders (
      order_code, customer_name, customer_mobile, product_name, product_category,
      total_amount, advance_amount, balance_amount, status, expected_delivery, notes,
      owner_user_id, created_by_user_id
    ) VALUES (
      ${code}, ${input.customer_name.trim()}, ${input.customer_mobile || null}, ${input.product_name || null}, ${input.product_category || null},
      ${total}, ${advance}, ${total - advance}, ${STATUSES.includes(input.status) ? input.status : 'draft'},
      ${input.expected_delivery || null}, ${input.notes || null}, ${actor?.id ?? null}, ${actor?.id ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  if ('expected_delivery' in patch) fields.expected_delivery = patch.expected_delivery || null;
  if ('notes' in patch) fields.notes = patch.notes || null;
  if ('advance_amount' in patch) fields.advance_amount = num(patch.advance_amount);
  if (Object.keys(fields).length === 0) return findById(id, null);
  // Keep balance in step with advance.
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE sales_orders SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Sales order not found'); e.status = 404; throw e; }
  if ('advance_amount' in patch) {
    await sql`UPDATE sales_orders SET balance_amount = ${num(row.total_amount) - num(row.advance_amount)} WHERE id = ${id}`;
  }
  return findById(id, null);
}

export async function setStatus(id, status, actor) {
  if (!STATUSES.includes(status)) { const e = new Error('Invalid status'); e.status = 400; throw e; }
  const sql = getDb();
  const [order] = await sql`SELECT * FROM sales_orders WHERE id = ${id}`;
  if (!order) { const e = new Error('Sales order not found'); e.status = 404; throw e; }

  const delivered = status === 'delivered' ? (order.delivered_at || new Date()) : (status === 'cancelled' ? order.delivered_at : order.delivered_at);
  const [updated] = await sql`
    UPDATE sales_orders SET status = ${status}, delivered_at = ${status === 'delivered' ? delivered : order.delivered_at}, updated_at = now()
    WHERE id = ${id} RETURNING *
  `;

  // Production starts when the order enters production.
  if (status === 'production') {
    await production.ensureForOrder(id, actor).catch(() => {});
  }

  // Inventory integration on the linked quotation's reserved piece.
  if (order.quotation_id) {
    const [q] = await sql`SELECT inventory_item_id FROM quotations WHERE id = ${order.quotation_id}`;
    const itemId = q?.inventory_item_id;
    if (itemId) {
      if (status === 'delivered') await inventory.markSold(itemId, { quote_id: order.quote_code, reason: 'Sold via sales order ' + order.order_code }, actor).catch(() => {});
      if (status === 'cancelled') await inventory.release(itemId, actor).catch(() => {});
    }
  }
  return updated;
}

export async function dashboard() {
  const sql = getDb();
  const rows = await sql`SELECT status, count(*)::int AS n FROM sales_orders GROUP BY status`;
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r.status] = r.n;
  const active = (byStatus.confirmed || 0) + (byStatus.production || 0) + (byStatus.ready || 0);
  const [{ due }] = await sql`
    SELECT count(*)::int AS due FROM sales_orders
    WHERE status NOT IN ('delivered', 'cancelled') AND expected_delivery IS NOT NULL
      AND expected_delivery <= (current_date + INTERVAL '7 days')
  `;
  return { by_status: byStatus, active_orders: active, delivery_due: due };
}
