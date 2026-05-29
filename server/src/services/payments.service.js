import { getDb } from '../database/connection.js';
import { generateCodeTx } from '../utils/seqCode.js';
import { postJournalTx, resolveAccountTx } from './accounts.service.js';

export const MODES = ['cash', 'bank', 'upi', 'card', 'other'];
const round2 = (n) => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;

async function resolveCashTx(tx, mode, accountId) {
  if (accountId) return Number(accountId);
  const code = mode === 'cash' || mode === 'other' ? 'CASH' : 'BANK';
  return resolveAccountTx(tx, code);
}

// ── Reads ────────────────────────────────────────────────────
export async function forSalesOrder(soId) {
  const sql = getDb();
  const rows = await sql`
    SELECT p.*, u.full_name AS recorded_by, a.name AS account_name
    FROM payments p LEFT JOIN users u ON u.id = p.created_by_user_id LEFT JOIN accounts a ON a.id = p.account_id
    WHERE p.sales_order_id = ${soId} AND p.direction = 'in'
    ORDER BY p.created_at DESC
  `;
  const paid = round2(rows.reduce((s, r) => s + Number(r.amount), 0));
  return { payments: rows, paid };
}

export async function forSupplier(supplierId) {
  const sql = getDb();
  const rows = await sql`
    SELECT p.*, u.full_name AS recorded_by, a.name AS account_name
    FROM payments p LEFT JOIN users u ON u.id = p.created_by_user_id LEFT JOIN accounts a ON a.id = p.account_id
    WHERE p.supplier_id = ${supplierId} AND p.direction = 'out'
    ORDER BY p.created_at DESC
  `;
  const [{ payable }] = await sql`SELECT COALESCE(sum(total_amount), 0) AS payable FROM purchases WHERE supplier_id = ${supplierId} AND status <> 'cancelled'`;
  const paid = round2(rows.reduce((s, r) => s + Number(r.amount), 0));
  return { payments: rows, paid, payable: Number(payable) || 0, outstanding: round2((Number(payable) || 0) - paid) };
}

export async function listCustomerPayments({ search } = {}) {
  const sql = getDb();
  const s = (search || '').trim();
  const searchClause = s ? sql`AND (p.payment_code ILIKE ${'%' + s + '%'} OR so.order_code ILIKE ${'%' + s + '%'})` : sql``;
  return sql`
    SELECT p.*, so.order_code, c.name AS customer_name
    FROM payments p
    LEFT JOIN sales_orders so ON so.id = p.sales_order_id
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE p.direction = 'in' ${searchClause}
    ORDER BY p.created_at DESC LIMIT 1000
  `;
}

export async function listSupplierPayments({ search } = {}) {
  const sql = getDb();
  const s = (search || '').trim();
  const searchClause = s ? sql`AND (p.payment_code ILIKE ${'%' + s + '%'} OR sup.name ILIKE ${'%' + s + '%'})` : sql``;
  return sql`
    SELECT p.*, sup.name AS supplier_name
    FROM payments p LEFT JOIN suppliers sup ON sup.id = p.supplier_id
    WHERE p.direction = 'out' ${searchClause}
    ORDER BY p.created_at DESC LIMIT 1000
  `;
}

/** Per-supplier payable summary for the supplier finance view. */
export async function supplierSummary() {
  const sql = getDb();
  return sql`
    SELECT s.id, s.supplier_code, s.name,
      COALESCE((SELECT sum(total_amount) FROM purchases pu WHERE pu.supplier_id = s.id AND pu.status <> 'cancelled'), 0) AS payable,
      COALESCE((SELECT sum(amount) FROM payments p WHERE p.supplier_id = s.id AND p.direction = 'out'), 0) AS paid
    FROM suppliers s WHERE s.is_active = true
    ORDER BY s.name
  `;
}

// ── Writes (auto-posted) ─────────────────────────────────────
export async function createCustomerPayment(input, actor) {
  const sql = getDb();
  const amount = round2(input.amount);
  if (!(amount > 0)) { const e = new Error('Amount must be greater than 0'); e.status = 400; throw e; }
  if (!input.sales_order_id) { const e = new Error('Sales order required'); e.status = 400; throw e; }
  const mode = MODES.includes(input.mode) ? input.mode : 'cash';

  return sql.begin(async (tx) => {
    const [so] = await tx`SELECT id, customer_id, order_code FROM sales_orders WHERE id = ${Number(input.sales_order_id)}`;
    if (!so) { const e = new Error('Sales order not found'); e.status = 404; throw e; }
    const cashAcc = await resolveCashTx(tx, mode, input.account_id);
    const arId = await resolveAccountTx(tx, 'AR');
    const code = await generateCodeTx(tx, 'payments', 'payment_code', 'PAY');
    // DR Cash/Bank · CR Accounts Receivable
    const entry = await postJournalTx(tx, {
      entry_date: input.paid_at, narration: `Receipt ${code} for ${so.order_code}`, source: 'payment',
      ref_type: 'sales_order', ref_id: so.id,
      lines: [{ account_id: cashAcc, debit: amount, credit: 0 }, { account_id: arId, debit: 0, credit: amount }],
      actor
    });
    const [row] = await tx`
      INSERT INTO payments (payment_code, party_type, direction, sales_order_id, customer_id, amount, mode, account_id, paid_at, notes, journal_entry_id, created_by_user_id)
      VALUES (${code}, 'customer', 'in', ${so.id}, ${so.customer_id}, ${amount}, ${mode}, ${cashAcc}, ${input.paid_at || new Date().toISOString().slice(0, 10)}, ${input.notes || null}, ${entry.id}, ${actor?.id ?? null})
      RETURNING *
    `;
    return row;
  });
}

export async function createSupplierPayment(input, actor) {
  const sql = getDb();
  const amount = round2(input.amount);
  if (!(amount > 0)) { const e = new Error('Amount must be greater than 0'); e.status = 400; throw e; }
  if (!input.supplier_id) { const e = new Error('Supplier required'); e.status = 400; throw e; }
  const mode = MODES.includes(input.mode) ? input.mode : 'cash';

  return sql.begin(async (tx) => {
    const cashAcc = await resolveCashTx(tx, mode, input.account_id);
    const apId = await resolveAccountTx(tx, 'AP');
    const code = await generateCodeTx(tx, 'payments', 'payment_code', 'PAY');
    // DR Supplier Payables · CR Cash/Bank
    const entry = await postJournalTx(tx, {
      entry_date: input.paid_at, narration: `Supplier payment ${code}`, source: 'supplier_payment',
      ref_type: input.purchase_id ? 'purchase' : 'supplier', ref_id: input.purchase_id || input.supplier_id,
      lines: [{ account_id: apId, debit: amount, credit: 0 }, { account_id: cashAcc, debit: 0, credit: amount }],
      actor
    });
    const [row] = await tx`
      INSERT INTO payments (payment_code, party_type, direction, purchase_id, supplier_id, amount, mode, account_id, paid_at, notes, journal_entry_id, created_by_user_id)
      VALUES (${code}, 'supplier', 'out', ${input.purchase_id ? Number(input.purchase_id) : null}, ${Number(input.supplier_id)}, ${amount}, ${mode}, ${cashAcc}, ${input.paid_at || new Date().toISOString().slice(0, 10)}, ${input.notes || null}, ${entry.id}, ${actor?.id ?? null})
      RETURNING *
    `;
    return row;
  });
}
