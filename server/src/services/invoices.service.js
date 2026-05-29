import { getDb } from '../database/connection.js';
import { generateCodeTx } from '../utils/seqCode.js';
import { postJournalTx, resolveAccountTx } from './accounts.service.js';
import { generatePdf } from './pdf.service.js';

const round2 = (n) => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;
const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

async function paidForSO(sql, soId) {
  if (!soId) return 0;
  const [{ paid }] = await sql`SELECT COALESCE(sum(amount), 0) AS paid FROM payments WHERE sales_order_id = ${soId} AND direction = 'in'`;
  return round2(paid);
}
function statusFor(total, paid) {
  if (paid <= 0) return 'issued';
  if (paid >= total) return 'paid';
  return 'partial';
}

export async function list({ search, status } = {}) {
  const sql = getDb();
  const s = (search || '').trim();
  const searchClause = s ? sql`AND (invoice_code ILIKE ${'%' + s + '%'} OR customer_name ILIKE ${'%' + s + '%'})` : sql``;
  const statusClause = status ? sql`AND status = ${status}` : sql``;
  return sql`SELECT * FROM invoices WHERE 1 = 1 ${searchClause} ${statusClause} ORDER BY created_at DESC LIMIT 1000`;
}

export async function findById(id) {
  const sql = getDb();
  const [inv] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!inv) return null;
  // Keep paid/balance/status live against the linked SO's receipts.
  const paid = await paidForSO(sql, inv.sales_order_id);
  const total = Number(inv.total_amount);
  return { ...inv, paid_amount: paid, balance_amount: round2(total - paid), status: inv.status === 'cancelled' ? 'cancelled' : statusFor(total, paid) };
}

/** Generate an invoice from a sales order (one per SO). Auto-posts AR/Sales/GST. */
export async function createFromSalesOrder(soId, input, actor) {
  const sql = getDb();
  return sql.begin(async (tx) => {
    const [so] = await tx`SELECT * FROM sales_orders WHERE id = ${Number(soId)}`;
    if (!so) { const e = new Error('Sales order not found'); e.status = 404; throw e; }
    const [dupe] = await tx`SELECT id, invoice_code FROM invoices WHERE sales_order_id = ${so.id} LIMIT 1`;
    if (dupe) { const e = new Error(`Invoice ${dupe.invoice_code} already exists for this order`); e.status = 409; throw e; }

    // Pull the priced breakdown from the linked quotation when available.
    let metal = 0, making = 0, stone = 0, subtotal = 0, taxRate = 3, taxAmt = 0, total = round2(so.total_amount);
    if (so.quotation_id) {
      const [q] = await tx`SELECT gold_cost, diamond_cost, gemstone_cost, making_charge, subtotal, gst_rate, gst_amount, final_price FROM quotations WHERE id = ${so.quotation_id}`;
      if (q) {
        metal = round2(q.gold_cost); making = round2(q.making_charge);
        stone = round2(Number(q.diamond_cost) + Number(q.gemstone_cost));
        subtotal = round2(q.subtotal); taxRate = round2(Number(q.gst_rate) * 100);
        taxAmt = round2(q.gst_amount); total = round2(q.final_price);
      }
    }
    if (!(subtotal > 0)) { subtotal = total; taxAmt = 0; taxRate = 0; } // fallback when no quotation breakdown

    const paid = round2(await (async () => { const [{ p }] = await tx`SELECT COALESCE(sum(amount),0) AS p FROM payments WHERE sales_order_id=${so.id} AND direction='in'`; return p; })());

    const code = await generateCodeTx(tx, 'invoices', 'invoice_code', 'INV');
    // DR Accounts Receivable (total) · CR Jewellery Sales (subtotal) · CR GST Payable (tax)
    const arId = await resolveAccountTx(tx, 'AR');
    const salesId = await resolveAccountTx(tx, 'SALES');
    const lines = [{ account_id: arId, debit: total, credit: 0 }, { account_id: salesId, debit: 0, credit: subtotal }];
    if (taxAmt > 0) lines.push({ account_id: await resolveAccountTx(tx, 'GST'), debit: 0, credit: taxAmt });
    const entry = await postJournalTx(tx, {
      entry_date: input?.invoice_date, narration: `Invoice ${code} for ${so.order_code}`, source: 'invoice',
      ref_type: 'sales_order', ref_id: so.id, lines, actor
    });

    const [row] = await tx`
      INSERT INTO invoices (
        invoice_code, sales_order_id, quotation_id, customer_id, customer_name, customer_mobile,
        product_name, product_category, metal_value, making_charge, stone_value,
        subtotal, tax_rate, tax_amount, total_amount, paid_amount, balance_amount, status, notes, journal_entry_id, created_by_user_id
      ) VALUES (
        ${code}, ${so.id}, ${so.quotation_id}, ${so.customer_id}, ${so.customer_name}, ${so.customer_mobile},
        ${so.product_name}, ${so.product_category}, ${metal}, ${making}, ${stone},
        ${subtotal}, ${taxRate}, ${taxAmt}, ${total}, ${paid}, ${round2(total - paid)}, ${statusFor(total, paid)}, ${input?.notes || null}, ${entry.id}, ${actor?.id ?? null}
      )
      RETURNING *
    `;
    return row;
  });
}

// ── PDF ──────────────────────────────────────────────────────
export async function renderHtml(id) {
  const sql = getDb();
  const inv = await findById(id);
  if (!inv) return null;
  const [co] = await sql`SELECT company_name, company_address, company_contact, company_gstin FROM company_settings WHERE id = 1`;
  const c = co || { company_name: 'JBOS', company_address: '', company_contact: '', company_gstin: '' };
  const row = (k, v) => `<tr><td style="padding:6px 0;color:#7A7A7A">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600">${v}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; font-family: 'Helvetica Neue', Arial, sans-serif; }
    body { margin:0; color:#1E1E1E; }
    .sheet { width:794px; min-height:1123px; padding:48px; margin:0 auto; }
    h1 { font-family: Georgia, serif; letter-spacing:3px; color:#8B6C14; font-size:26px; margin:0; }
    .muted { color:#7A7A7A; font-size:12px; }
    .bar { background:#1E1E1E; color:#C5A028; padding:10px 16px; letter-spacing:2px; text-transform:uppercase; font-size:11px; margin:24px 0 0; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    .tot { background:#1E1E1E; color:#C5A028; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; margin-top:8px; }
  </style></head><body><div class="sheet">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C5A028;padding-bottom:16px">
      <div><h1>${c.company_name}</h1><div class="muted" style="margin-top:6px">${c.company_address}</div><div class="muted">${c.company_contact}</div><div class="muted">${c.company_gstin || ''}</div></div>
      <div style="text-align:right"><div style="font-family:Georgia,serif;font-size:20px;letter-spacing:2px">TAX INVOICE</div><div class="muted" style="margin-top:6px">${inv.invoice_code}</div><div class="muted">${new Date(inv.created_at).toLocaleDateString('en-IN')}</div></div>
    </div>
    <div class="bar">Billed To</div>
    <div style="padding:12px 0;font-size:13px"><strong>${inv.customer_name || '—'}</strong>${inv.customer_mobile ? ` · ${inv.customer_mobile}` : ''}</div>
    <div class="bar">Item</div>
    <div style="padding:12px 0;font-size:13px"><strong>${inv.product_name || '—'}</strong>${inv.product_category ? ` · ${inv.product_category}` : ''}</div>
    <div class="bar">Charges</div>
    <table style="margin-top:12px">
      ${row('Metal Value', inr(inv.metal_value))}
      ${row('Making Charge', inr(inv.making_charge))}
      ${row('Stone Value', inr(inv.stone_value))}
      <tr><td colspan="2"><hr style="border:none;border-top:1px solid #E8D5A3;margin:8px 0"></td></tr>
      ${row('Subtotal', inr(inv.subtotal))}
      ${row(`GST @ ${inv.tax_rate}%`, inr(inv.tax_amount))}
    </table>
    <div class="tot"><div style="font-family:Georgia,serif;letter-spacing:2px">TOTAL</div><div style="font-family:Georgia,serif;font-size:20px">${inr(inv.total_amount)}</div></div>
    <table style="margin-top:16px">
      ${row('Paid', inr(inv.paid_amount))}
      ${row('Balance Due', inr(inv.balance_amount))}
    </table>
    <div class="muted" style="margin-top:40px;text-align:center;letter-spacing:2px">Thank you for your patronage</div>
  </div></body></html>`;
}

export async function pdf(id) {
  const html = await renderHtml(id);
  if (!html) return null;
  return generatePdf(html);
}
