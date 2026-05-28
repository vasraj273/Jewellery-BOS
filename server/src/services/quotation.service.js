import { getDb } from '../database/connection.js';
import { computePricing } from './pricing.service.js';
import { generateQuoteId } from '../utils/quoteId.js';
import { validateQuotation } from '../utils/validate.js';
import { reserveForQuoteTx } from './inventory.service.js';

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
  return Number(actor.id); // sales_executive
}

const SORT_MAP = {
  newest:        'created_at DESC',
  oldest:        'created_at ASC',
  price_desc:    'final_price DESC NULLS LAST',
  price_asc:     'final_price ASC NULLS LAST',
  customer_asc:  'lower(customer_name) ASC',
  customer_desc: 'lower(customer_name) DESC'
};

/**
 * List quotations with optional admin-controlled filters.
 *   filters = {
 *     sales_exec  : number          — only honoured for admin/super_admin
 *     date_from   : 'YYYY-MM-DD'    — inclusive lower bound on created_at
 *     date_to     : 'YYYY-MM-DD'    — exclusive upper bound (one day after)
 *     product     : string          — product_category exact match
 *     status      : string          — quotation status exact match
 *     search      : string          — partial ILIKE across customer_name / mobile / email / quote_id
 *     min_price   : number          — final_price >=
 *     max_price   : number          — final_price <=
 *     sort        : key from SORT_MAP (default newest)
 *     limit       : number          — default 500
 *     offset      : number          — default 0
 *   }
 *
 * Sales-executive scope is *always* applied last and cannot be overridden by
 * a sales_exec filter from a sales-exec actor.
 */
export async function listAll(actor, filters = {}) {
  const sql = getDb();

  const scopedOwner = scopeFor(actor);
  const adminOwnerFilter =
    scopedOwner == null && filters.sales_exec != null && filters.sales_exec !== ''
      ? Number(filters.sales_exec)
      : null;

  const ownerClause = scopedOwner != null
    ? sql`AND owner_user_id = ${scopedOwner}`
    : (adminOwnerFilter != null ? sql`AND owner_user_id = ${adminOwnerFilter}` : sql``);

  const dateFromClause = filters.date_from
    ? sql`AND created_at >= ${filters.date_from}::date`
    : sql``;
  const dateToClause = filters.date_to
    // inclusive end: use < (date + 1 day) to capture the whole end day
    ? sql`AND created_at < (${filters.date_to}::date + INTERVAL '1 day')`
    : sql``;

  const productClause = filters.product
    ? sql`AND product_category = ${filters.product}`
    : sql``;

  const statusClause = filters.status
    ? sql`AND status = ${filters.status}`
    : sql``;

  const search = (filters.search || '').trim();
  const searchClause = search
    ? sql`AND (
        customer_name   ILIKE ${'%' + search + '%'} OR
        customer_mobile ILIKE ${'%' + search + '%'} OR
        customer_email  ILIKE ${'%' + search + '%'} OR
        quote_id        ILIKE ${'%' + search + '%'}
      )`
    : sql``;

  const minPriceClause = filters.min_price != null && filters.min_price !== ''
    ? sql`AND final_price >= ${Number(filters.min_price) || 0}`
    : sql``;
  const maxPriceClause = filters.max_price != null && filters.max_price !== ''
    ? sql`AND final_price <= ${Number(filters.max_price) || 0}`
    : sql``;

  const sortKey   = SORT_MAP[filters.sort] ? filters.sort : 'newest';
  const orderBy   = SORT_MAP[sortKey];
  const limit     = Math.min(Math.max(parseInt(filters.limit, 10)  || 500, 1), 1000);
  const offset    = Math.max(parseInt(filters.offset, 10) || 0, 0);

  return sql`
    SELECT *
    FROM quotations
    WHERE 1 = 1
    ${ownerClause}
    ${dateFromClause}
    ${dateToClause}
    ${productClause}
    ${statusClause}
    ${searchClause}
    ${minPriceClause}
    ${maxPriceClause}
    ORDER BY ${sql.unsafe(orderBy)}
    LIMIT ${limit} OFFSET ${offset}
  `;
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

  // ── Ownership enforcement ──────────────────────────────
  // Default: owner = actor. Sales executives can never assign to another
  // user. Admin / super_admin may pass owner_user_id explicitly; we
  // validate the target is active before honouring it.
  const actorId  = actor?.id != null ? Number(actor.id) : null;
  let ownerId    = actorId;
  let ownerName  = null;
  const requestedOwner = input.owner_user_id != null && input.owner_user_id !== ''
    ? Number(input.owner_user_id)
    : null;

  if (requestedOwner != null && requestedOwner !== actorId) {
    if (actor?.role !== 'super_admin' && actor?.role !== 'admin') {
      const err = new Error('You cannot assign a quotation to another user');
      err.status = 403; throw err;
    }
    const [target] = await sql`
      SELECT id, full_name FROM users WHERE id = ${requestedOwner} AND is_active = true LIMIT 1
    `;
    if (!target) {
      const err = new Error('Owner user not found or inactive');
      err.status = 400; throw err;
    }
    ownerId   = target.id;
    ownerName = target.full_name;
  }

  // Auto-fill the printed "Sales Executive" label from the resolved owner
  // when caller didn't supply one (sales_exec always falls through here).
  const salesExecLabel = (input.sales_executive && String(input.sales_executive).trim())
    || ownerName
    || actor?.full_name
    || '';

  const row = {
    quote_id: quoteId,
    owner_user_id: ownerId,
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
    sales_executive: salesExecLabel,
    valid_till: validTill,
    notes: input.notes || '',
    source_lead_id: input.source_lead_id ? Number(input.source_lead_id) : null,
    inventory_item_id: input.inventory_item_id ? Number(input.inventory_item_id) : null
  };

  // postgres.js helper: sql(obj) expands to (col1, col2, ...) VALUES (val1, val2, ...)
  if (row.inventory_item_id) {
    // M8 — raising a quote from an inventory item reserves it atomically.
    // reserveForQuoteTx guards against double-reservation (FOR UPDATE +
    // status check) and throws 409 if the item is no longer in stock, so the
    // quotation is never inserted against an unavailable piece.
    await sql.begin(async (tx) => {
      await reserveForQuoteTx(tx, row.inventory_item_id, quoteId, actor, row.net_weight);
      await tx`INSERT INTO quotations ${tx(row)}`;
    });
  } else {
    await sql`INSERT INTO quotations ${sql(row)}`;
  }
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
