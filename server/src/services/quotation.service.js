import { getDb } from '../database/connection.js';
import { computePricing } from './pricing.service.js';
import { generateQuoteId } from '../utils/quoteId.js';
import { validateQuotation } from '../utils/validate.js';

/**
 * RBAC visibility scope.
 *   super_admin / admin → see all
 *   sales_executive     → see only own rows (owner_user_id = self)
 *
 * Passing `actor = null` short-circuits the scope and returns all rows
 * (used by internal callers like WhatsApp send that already know the row).
 */
function scopeFor(actor) {
  if (!actor) return null;
  if (actor.role === 'super_admin' || actor.role === 'admin') return null;
  return actor.id; // sales_executive
}

export async function listAll(actor) {
  const sql = getDb();
  const ownerId = scopeFor(actor);
  if (ownerId == null) {
    return sql`SELECT * FROM quotations ORDER BY created_at DESC`;
  }
  return sql`SELECT * FROM quotations WHERE owner_user_id = ${ownerId} ORDER BY created_at DESC`;
}

export async function findByQuoteId(quoteId, actor) {
  const sql = getDb();
  const ownerId = scopeFor(actor);
  if (ownerId == null) {
    const rows = await sql`SELECT * FROM quotations WHERE quote_id = ${quoteId}`;
    return rows[0] || null;
  }
  const rows = await sql`
    SELECT * FROM quotations WHERE quote_id = ${quoteId} AND owner_user_id = ${ownerId}
  `;
  return rows[0] || null;
}

export async function create(input, actor) {
  validateQuotation(input);
  const sql = getDb();
  const pricing = computePricing(input);
  const quoteId = input.quote_id || (await generateQuoteId());
  const validTill = input.valid_till || defaultValidTill();

  const row = {
    quote_id: quoteId,
    owner_user_id: actor?.id ?? null,
    status: input.status || 'draft',

    customer_name: input.customer_name || '',
    customer_mobile: input.customer_mobile || '',
    customer_email: input.customer_email || '',
    occasion: input.occasion || '',

    product_name: input.product_name || '',
    product_category: input.product_category || '',
    product_description: input.product_description || '',
    product_image_path: input.product_image_path || '',

    metal_type: input.metal_type || '',
    metal_color: input.metal_color || '',
    purity: input.purity || '',
    gross_weight: num(input.gross_weight),
    net_weight: num(input.net_weight),

    diamond_type: input.diamond_type || '',
    diamond_shape: input.diamond_shape || '',
    diamond_carat: num(input.diamond_carat),
    diamond_clarity: input.diamond_clarity || '',
    diamond_color: input.diamond_color || '',

    gemstone: input.gemstone || '',
    gemstone_carat: num(input.gemstone_carat),

    hallmark: input.hallmark || '',
    certification: input.certification || '',
    setting_style: input.setting_style || '',

    gold_rate_per_gram: num(input.gold_rate_per_gram),
    diamond_rate_per_carat: num(input.diamond_rate_per_carat),
    gemstone_rate_per_carat: num(input.gemstone_rate_per_carat),

    making_charge_type: input.making_charge_type || 'per_gram',
    making_charge_value: num(input.making_charge_value),

    hallmark_charge: pricing.hallmark_charge,
    certification_charge: pricing.certification_charge,
    shipping_charge: pricing.shipping_charge,

    gold_cost: pricing.gold_cost,
    diamond_cost: pricing.diamond_cost,
    gemstone_cost: pricing.gemstone_cost,
    making_charge: pricing.making_charge,
    subtotal: pricing.subtotal,
    gst_rate: pricing.gst_rate,
    gst_amount: pricing.gst_amount,
    final_price: pricing.final_price,

    pricing_location: input.pricing_location || 'Mumbai',
    sales_executive: input.sales_executive || '',
    valid_till: validTill,
    notes: input.notes || ''
  };

  // postgres.js helper: sql(obj) expands to (col1, col2, ...) VALUES (val1, val2, ...)
  await sql`INSERT INTO quotations ${sql(row)}`;
  // Skip scope when reading back — we know we just wrote it.
  return findByQuoteId(quoteId, null);
}

export async function remove(quoteId, actor) {
  const sql = getDb();
  const ownerId = scopeFor(actor);
  const res = ownerId == null
    ? await sql`DELETE FROM quotations WHERE quote_id = ${quoteId}`
    : await sql`DELETE FROM quotations WHERE quote_id = ${quoteId} AND owner_user_id = ${ownerId}`;
  return res.count > 0;
}

function num(v) {
  return Number.isFinite(+v) ? +v : 0;
}

function defaultValidTill() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
