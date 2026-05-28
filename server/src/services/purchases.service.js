import { getDb } from '../database/connection.js';
import { generatePurchaseCodeTx } from '../utils/purchaseCode.js';
import { generateSkuTx } from '../utils/inventoryCode.js';

const num = (v) => (Number.isFinite(+v) ? +v : 0);

export async function list({ supplier_id, search } = {}) {
  const sql = getDb();
  const supplierClause = supplier_id ? sql`AND p.supplier_id = ${Number(supplier_id)}` : sql``;
  const s = (search || '').trim();
  const searchClause = s
    ? sql`AND (p.purchase_code ILIKE ${'%' + s + '%'} OR p.invoice_number ILIKE ${'%' + s + '%'})`
    : sql``;
  return sql`
    SELECT p.*, s.name AS supplier_name,
           (SELECT count(*)::int FROM purchase_items pi WHERE pi.purchase_id = p.id) AS line_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE 1 = 1 ${supplierClause} ${searchClause}
    ORDER BY p.purchase_date DESC, p.id DESC
    LIMIT 1000
  `;
}

export async function findById(id) {
  const sql = getDb();
  const [purchase] = await sql`
    SELECT p.*, s.name AS supplier_name
    FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ${id}
  `;
  if (!purchase) return null;
  const items = await sql`
    SELECT pi.*, i.sku, i.status AS item_status
    FROM purchase_items pi
    LEFT JOIN inventory_items i ON i.id = pi.inventory_item_id
    WHERE pi.purchase_id = ${id}
    ORDER BY pi.id
  `;
  return { ...purchase, items };
}

/**
 * Record a procurement batch. Header + N lines. Each line atomically creates an
 * inventory_items row (status in_stock) and a paired inventory_movements row
 * (direction in / type purchase). All-or-nothing in one transaction.
 */
export async function create(input, actor) {
  const sql = getDb();
  const lines = Array.isArray(input?.items) ? input.items.filter((l) => l && (l.name || '').trim()) : [];
  if (lines.length === 0) { const e = new Error('At least one purchase line item is required'); e.status = 400; throw e; }

  return sql.begin(async (tx) => {
    const code = await generatePurchaseCodeTx(tx);
    const totalAmount = lines.reduce((sum, l) => sum + num(l.unit_cost) * (Number(l.quantity) || 1), 0);

    const [purchase] = await tx`
      INSERT INTO purchases (purchase_code, supplier_id, purchase_date, invoice_number, total_amount, notes, created_by_user_id)
      VALUES (
        ${code},
        ${input.supplier_id ? Number(input.supplier_id) : null},
        ${input.purchase_date || new Date().toISOString().slice(0, 10)},
        ${input.invoice_number || null},
        ${totalAmount},
        ${input.notes || null},
        ${actor?.id ?? null}
      )
      RETURNING *
    `;

    for (const l of lines) {
      const qty = Number(l.quantity) || 1;
      const lineTotal = num(l.unit_cost) * qty;
      const sku = await generateSkuTx(tx);

      const [item] = await tx`
        INSERT INTO inventory_items (
          sku, name, category, metal_type, purity, gross_weight, net_weight,
          diamond_type, diamond_carat, gemstone, gemstone_carat, design_code,
          location, status, quantity, purchase_cost, stone_value, making_cost,
          supplier_id, purchase_id, notes, created_by_user_id
        ) VALUES (
          ${sku}, ${l.name.trim()}, ${l.category || null}, ${l.metal_type || null}, ${l.purity || null},
          ${num(l.gross_weight)}, ${num(l.net_weight)},
          ${l.diamond_type || null}, ${num(l.diamond_carat)}, ${l.gemstone || null}, ${num(l.gemstone_carat)},
          ${l.design_code || null}, ${l.location || 'Mumbai'}, 'in_stock', ${qty},
          ${lineTotal}, ${num(l.stone_value)}, ${num(l.making_cost)},
          ${input.supplier_id ? Number(input.supplier_id) : null}, ${purchase.id}, ${l.notes || null}, ${actor?.id ?? null}
        )
        RETURNING *
      `;

      await tx`
        INSERT INTO purchase_items (purchase_id, inventory_item_id, name, category, metal_type, purity, gross_weight, net_weight, quantity, unit_cost, line_total, notes)
        VALUES (${purchase.id}, ${item.id}, ${l.name.trim()}, ${l.category || null}, ${l.metal_type || null}, ${l.purity || null}, ${num(l.gross_weight)}, ${num(l.net_weight)}, ${qty}, ${num(l.unit_cost)}, ${lineTotal}, ${l.notes || null})
      `;

      await tx`
        INSERT INTO inventory_movements (inventory_item_id, direction, movement_type, quantity, weight, reason, ref_type, ref_id, actor_user_id)
        VALUES (${item.id}, 'in', 'purchase', ${qty}, ${num(l.net_weight)}, ${'Procured via ' + code}, 'purchase', ${String(purchase.id)}, ${actor?.id ?? null})
      `;
    }

    return purchase;
  });
}
