import { getDatabase } from '../database/connection.js';
import { computePricing } from './pricing.service.js';
import { generateQuoteId } from '../utils/quoteId.js';
import { validateQuotation } from '../utils/validate.js';

const SELECT_COLS = '*';

export function listAll() {
  return getDatabase()
    .prepare(`SELECT ${SELECT_COLS} FROM quotations ORDER BY created_at DESC`)
    .all();
}

export function findByQuoteId(quoteId) {
  return getDatabase()
    .prepare(`SELECT ${SELECT_COLS} FROM quotations WHERE quote_id = ?`)
    .get(quoteId);
}

export function create(input) {
  validateQuotation(input);
  const db = getDatabase();
  const pricing = computePricing(input);
  const quoteId = input.quote_id || generateQuoteId();
  const validTill = input.valid_till || defaultValidTill();

  const row = {
    quote_id: quoteId,
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

  const cols = Object.keys(row);
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  db.prepare(
    `INSERT INTO quotations (${cols.join(', ')}) VALUES (${placeholders})`
  ).run(row);

  return findByQuoteId(quoteId);
}

export function remove(quoteId) {
  const info = getDatabase()
    .prepare('DELETE FROM quotations WHERE quote_id = ?')
    .run(quoteId);
  return info.changes > 0;
}

function num(v) {
  return Number.isFinite(+v) ? +v : 0;
}

function defaultValidTill() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
