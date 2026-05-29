import { getDb } from '../database/connection.js';
import { generateSku } from '../utils/inventoryCode.js';
import * as goldRate from './goldRate.service.js';

export const ITEM_STATUSES = ['in_stock', 'reserved', 'sold', 'repair', 'custom_order', 'archived'];
export const MOVEMENT_TYPES = {
  in:  ['purchase', 'manufacture', 'return_in', 'transfer_in'],
  out: ['sold', 'damaged', 'return_out', 'repair', 'transfer_out', 'quotation_reserve']
};
// Status a manual movement transitions the item into (null = leave unchanged).
const MOVEMENT_STATUS = {
  manufacture: 'in_stock',
  return_in:   'in_stock',
  transfer_in: 'in_stock',
  repair:      'repair',
  damaged:     'archived',
  transfer_out:'archived',
  return_out:  'archived'
};

const num = (v) => (Number.isFinite(+v) ? +v : 0);

// Columns qualified with the `i.` alias — the list query LEFT JOINs suppliers,
// which shares column names (name, created_at, …) with inventory_items, so bare
// references would be ambiguous.
const SORT_MAP = {
  newest:   'i.created_at DESC',
  oldest:   'i.created_at ASC',
  sku_asc:  'i.sku ASC',
  name_asc: 'lower(i.name) ASC',
  weight_desc: 'i.net_weight DESC NULLS LAST'
};

// ── Valuation ────────────────────────────────────────────────
// market value = net_weight × live gold rate(purity, location) + stone_value
//   + making_cost. Falls back to purchase_cost when no live rate resolves.
async function buildRatesMap() {
  try {
    const rows = await goldRate.getLatest();
    const map = {};
    for (const r of rows) map[`${r.location}|${r.purity}`] = Number(r.rate_per_gram) || 0;
    return map;
  } catch {
    return {};
  }
}

function valuationOf(row, ratesMap) {
  const purchaseCost = num(row.purchase_cost);
  const stoneValue   = num(row.stone_value);
  const makingCost   = num(row.making_cost);
  const rate = ratesMap[`${row.location}|${row.purity}`] || 0;
  const metalValue = rate > 0 ? num(row.net_weight) * rate : 0;
  let market = metalValue + stoneValue + makingCost;
  if (!(market > 0)) market = purchaseCost;
  return {
    purchase_cost: round2(purchaseCost),
    market_value: round2(market),
    margin: round2(market - purchaseCost)
  };
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function withValuation(row, ratesMap) {
  return { ...row, valuation: valuationOf(row, ratesMap) };
}

// ── Reads ────────────────────────────────────────────────────
export async function list(filters = {}) {
  const sql = getDb();

  // All filter columns are qualified with i.* — suppliers (LEFT JOINed below)
  // shares column names (status has no clash but name/category/is_active do),
  // so bare references would raise "column reference ... is ambiguous".
  const statusClause = filters.status
    ? sql`AND i.status = ${filters.status}`
    : (filters.include_archived === '1' ? sql`` : sql`AND i.status <> 'archived'`);
  const categoryClause = filters.category ? sql`AND i.category = ${filters.category}` : sql``;
  const supplierClause = filters.supplier_id ? sql`AND i.supplier_id = ${Number(filters.supplier_id)}` : sql``;
  const search = (filters.search || '').trim();
  const searchClause = search
    ? sql`AND (i.sku ILIKE ${'%' + search + '%'} OR i.name ILIKE ${'%' + search + '%'} OR i.design_code ILIKE ${'%' + search + '%'})`
    : sql``;

  const sortKey = SORT_MAP[filters.sort] ? filters.sort : 'newest';
  const orderBy = SORT_MAP[sortKey];
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 500, 1), 1000);

  const rows = await sql`
    SELECT i.*, s.name AS supplier_name
    FROM inventory_items i
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.is_active = true ${statusClause} ${categoryClause} ${supplierClause} ${searchClause}
    ORDER BY ${sql.unsafe(orderBy)}
    LIMIT ${limit}
  `;
  const ratesMap = await buildRatesMap();
  return rows.map((r) => withValuation(r, ratesMap));
}

export async function findById(id) {
  const sql = getDb();
  const [row] = await sql`
    SELECT i.*, s.name AS supplier_name
    FROM inventory_items i
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.id = ${id}
  `;
  if (!row) return null;
  const ratesMap = await buildRatesMap();
  const movements = await sql`
    SELECT m.*, u.full_name AS actor_name
    FROM inventory_movements m
    LEFT JOIN users u ON u.id = m.actor_user_id
    WHERE m.inventory_item_id = ${id}
    ORDER BY m.created_at DESC
    LIMIT 500
  `;
  return { ...withValuation(row, ratesMap), movements };
}

// ── Writes ───────────────────────────────────────────────────
export async function create(input, actor) {
  if (!input?.name?.trim()) { const e = new Error('Item name required'); e.status = 400; throw e; }
  const sql = getDb();
  const sku = await generateSku();
  const status = ITEM_STATUSES.includes(input.status) ? input.status : 'in_stock';
  // Movement type for the opening stock-in entry.
  const moveType = MOVEMENT_TYPES.in.includes(input.movement_type) ? input.movement_type : 'manufacture';

  const row = await sql.begin(async (tx) => {
    const [item] = await tx`
      INSERT INTO inventory_items (
        sku, name, category, metal_type, purity, gross_weight, net_weight,
        diamond_type, diamond_carat, gemstone, gemstone_carat, design_code,
        location, status, quantity, purchase_cost, stone_value, making_cost,
        image_url, certificate_url, supplier_id, notes, created_by_user_id
      ) VALUES (
        ${sku}, ${input.name.trim()}, ${input.category || null}, ${input.metal_type || null}, ${input.purity || null},
        ${num(input.gross_weight)}, ${num(input.net_weight)},
        ${input.diamond_type || null}, ${num(input.diamond_carat)}, ${input.gemstone || null}, ${num(input.gemstone_carat)},
        ${input.design_code || null}, ${input.location || 'Mumbai'}, ${status}, ${Number(input.quantity) || 1},
        ${num(input.purchase_cost)}, ${num(input.stone_value)}, ${num(input.making_cost)},
        ${input.image_url || null}, ${input.certificate_url || null},
        ${input.supplier_id ? Number(input.supplier_id) : null}, ${input.notes || null}, ${actor?.id ?? null}
      )
      RETURNING *
    `;
    await tx`
      INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
      VALUES (${item.id}, 'in', ${moveType}, ${Number(input.quantity) || 1}, ${num(input.net_weight)}, ${'Opening stock'}, 'manual', ${null}, ${actor?.id ?? null})
    `;
    return item;
  });
  return row;
}

export async function update(id, patch) {
  const sql = getDb();
  const fields = {};
  if (typeof patch.name === 'string') fields.name = patch.name.trim();
  for (const k of ['category', 'metal_type', 'purity', 'diamond_type', 'gemstone', 'design_code', 'location', 'image_url', 'certificate_url', 'notes']) {
    if (k in patch) fields[k] = patch[k] || null;
  }
  for (const k of ['gross_weight', 'net_weight', 'diamond_carat', 'gemstone_carat', 'purchase_cost', 'stone_value', 'making_cost']) {
    if (k in patch) fields[k] = num(patch[k]);
  }
  if ('quantity' in patch) fields.quantity = Number(patch.quantity) || 1;
  if ('supplier_id' in patch) fields.supplier_id = patch.supplier_id ? Number(patch.supplier_id) : null;
  // status can be edited directly only between non-transactional states; reserve/sell go through dedicated endpoints.
  if (patch.status && ['in_stock', 'repair', 'custom_order', 'archived'].includes(patch.status)) fields.status = patch.status;
  if (Object.keys(fields).length === 0) {
    const [r] = await sql`SELECT * FROM inventory_items WHERE id = ${id}`;
    return r || null;
  }
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE inventory_items SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Inventory item not found'); e.status = 404; throw e; }
  return row;
}

export async function archive(id) {
  const sql = getDb();
  const [row] = await sql`UPDATE inventory_items SET status = 'archived', is_active = false, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Inventory item not found'); e.status = 404; throw e; }
  return row;
}

/** Manual ledger entry (damaged, repair, transfer, return …) with status sync. */
export async function recordMovement(id, input, actor) {
  const sql = getDb();
  const type = input?.movement_type;
  const direction = MOVEMENT_TYPES.in.includes(type) ? 'in'
    : MOVEMENT_TYPES.out.includes(type) ? 'out' : null;
  if (!direction || type === 'quotation_reserve' || type === 'sold') {
    // sold + quotation_reserve are driven by the quotation flow / sell endpoint.
    const e = new Error('Invalid or unsupported movement_type for manual entry'); e.status = 400; throw e;
  }
  return sql.begin(async (tx) => {
    const [item] = await tx`SELECT * FROM inventory_items WHERE id = ${id} FOR UPDATE`;
    if (!item) { const e = new Error('Inventory item not found'); e.status = 404; throw e; }
    await tx`
      INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
      VALUES (${id}, ${direction}, ${type}, ${Number(input.quantity) || 1}, ${num(input.weight) || num(item.net_weight)}, ${input.reason || null}, 'manual', ${null}, ${actor?.id ?? null})
    `;
    const newStatus = MOVEMENT_STATUS[type];
    const [updated] = newStatus
      ? await tx`UPDATE inventory_items SET status = ${newStatus}, is_active = ${newStatus !== 'archived'}, updated_at = now() WHERE id = ${id} RETURNING *`
      : [item];
    return updated;
  });
}

/** Reserve an item against a quotation. Transactional + guarded against double-book.
 *  Exported for the quotation create flow (runs inside its transaction). */
export async function reserveForQuoteTx(tx, itemId, quoteId, actor, weight) {
  const [item] = await tx`SELECT id, status, net_weight FROM inventory_items WHERE id = ${itemId} FOR UPDATE`;
  if (!item) { const e = new Error('Inventory item not found'); e.status = 400; throw e; }
  if (item.status !== 'in_stock') {
    const e = new Error('Inventory item is not available (already reserved or sold)'); e.status = 409; throw e;
  }
  await tx`UPDATE inventory_items SET status = 'reserved', reserved_quotation_id = ${quoteId}, updated_at = now() WHERE id = ${itemId}`;
  await tx`
    INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
    VALUES (${itemId}, 'out', 'quotation_reserve', 1, ${num(weight) || num(item.net_weight)}, ${'Reserved via quotation ' + quoteId}, 'quotation', ${quoteId}, ${actor?.id ?? null})
  `;
}

/** Release a reservation back to stock. */
export async function release(id, actor) {
  const sql = getDb();
  return sql.begin(async (tx) => {
    const [item] = await tx`SELECT * FROM inventory_items WHERE id = ${id} FOR UPDATE`;
    if (!item) { const e = new Error('Inventory item not found'); e.status = 404; throw e; }
    if (item.status !== 'reserved') { const e = new Error('Item is not reserved'); e.status = 409; throw e; }
    const [updated] = await tx`UPDATE inventory_items SET status = 'in_stock', reserved_quotation_id = NULL, updated_at = now() WHERE id = ${id} RETURNING *`;
    await tx`
      INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
      VALUES (${id}, 'in', 'return_in', 1, ${num(item.net_weight)}, ${'Reservation released'}, 'quotation', ${item.reserved_quotation_id}, ${actor?.id ?? null})
    `;
    return updated;
  });
}

/** Mark an item sold (from in_stock or reserved). */
export async function markSold(id, input, actor) {
  const sql = getDb();
  return sql.begin(async (tx) => {
    const [item] = await tx`SELECT * FROM inventory_items WHERE id = ${id} FOR UPDATE`;
    if (!item) { const e = new Error('Inventory item not found'); e.status = 404; throw e; }
    if (!['in_stock', 'reserved'].includes(item.status)) { const e = new Error('Item is already sold or unavailable'); e.status = 409; throw e; }
    const quoteId = input?.quote_id || item.reserved_quotation_id || null;
    const [updated] = await tx`UPDATE inventory_items SET status = 'sold', sold_quotation_id = ${quoteId}, reserved_quotation_id = NULL, updated_at = now() WHERE id = ${id} RETURNING *`;
    await tx`
      INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
      VALUES (${id}, 'out', 'sold', 1, ${num(item.net_weight)}, ${input?.reason || 'Item sold'}, 'quotation', ${quoteId}, ${actor?.id ?? null})
    `;
    return updated;
  });
}

// ── Dashboard summary + alerts ───────────────────────────────
export async function summary() {
  const sql = getDb();
  const rows = await sql`
    SELECT status, count(*)::int AS n FROM inventory_items WHERE is_active = true GROUP BY status
  `;
  const byStatus = Object.fromEntries(ITEM_STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r.status] = r.n;

  // Valuation of currently held stock (in_stock + reserved + repair + custom_order).
  const held = await sql`
    SELECT location, purity, net_weight, purchase_cost, stone_value, making_cost
    FROM inventory_items
    WHERE is_active = true AND status IN ('in_stock', 'reserved', 'repair', 'custom_order')
  `;
  const ratesMap = await buildRatesMap();
  let stockValue = 0;
  let stockCost = 0;
  for (const r of held) {
    const v = valuationOf(r, ratesMap);
    stockValue += v.market_value;
    stockCost += v.purchase_cost;
  }
  return {
    by_status: byStatus,
    total_active: Object.values(byStatus).reduce((a, b) => a + b, 0) - byStatus.archived,
    stock_market_value: round2(stockValue),
    stock_cost_value: round2(stockCost),
    potential_margin: round2(stockValue - stockCost)
  };
}

export async function alerts({ low_stock_threshold, dead_days } = {}) {
  const sql = getDb();
  const threshold = Math.max(parseInt(low_stock_threshold, 10) || 3, 0);
  const deadDays = Math.max(parseInt(dead_days, 10) || 90, 1);

  // Low stock: categories whose in_stock count is at or below the threshold.
  const lowStock = await sql`
    SELECT COALESCE(category, 'Uncategorised') AS category, count(*)::int AS in_stock
    FROM inventory_items
    WHERE is_active = true AND status = 'in_stock'
    GROUP BY COALESCE(category, 'Uncategorised')
    HAVING count(*) <= ${threshold}
    ORDER BY count(*) ASC, category
  `;

  // Dead stock: in_stock items that have sat unsold past the dead-days window.
  const deadStock = await sql`
    SELECT id, sku, name, category, net_weight, created_at
    FROM inventory_items
    WHERE is_active = true AND status = 'in_stock'
      AND created_at < (now() - (${deadDays} || ' days')::interval)
    ORDER BY created_at ASC
    LIMIT 100
  `;

  // Fast movers: most 'sold' movements in the last 30 days, grouped by category.
  const fastMovers = await sql`
    SELECT COALESCE(i.category, 'Uncategorised') AS category, count(*)::int AS sold_count
    FROM inventory_movements m
    JOIN inventory_items i ON i.id = m.inventory_item_id
    WHERE m.movement_type = 'sold' AND m.created_at >= (now() - INTERVAL '30 days')
    GROUP BY COALESCE(i.category, 'Uncategorised')
    ORDER BY sold_count DESC
    LIMIT 10
  `;

  return {
    low_stock_threshold: threshold,
    dead_days: deadDays,
    low_stock: lowStock,
    dead_stock: deadStock,
    dead_stock_count: deadStock.length,
    fast_movers: fastMovers
  };
}
