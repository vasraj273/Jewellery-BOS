import { getDb } from '../database/connection.js';

const round2 = (n) => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;

export async function dashboard() {
  const sql = getDb();
  const [{ collected }]   = await sql`SELECT COALESCE(sum(amount),0) AS collected FROM payments WHERE direction='in'`;
  const [{ paid_out }]    = await sql`SELECT COALESCE(sum(amount),0) AS paid_out FROM payments WHERE direction='out'`;
  const [{ exp_total }]   = await sql`SELECT COALESCE(sum(amount),0) AS exp_total FROM expenses`;
  const [{ invoiced }]    = await sql`SELECT COALESCE(sum(total_amount),0) AS invoiced FROM invoices WHERE status <> 'cancelled'`;
  const [{ inv_count }]   = await sql`SELECT count(*)::int AS inv_count FROM invoices WHERE status <> 'cancelled'`;
  const [{ so_total }]    = await sql`SELECT COALESCE(sum(total_amount),0) AS so_total FROM sales_orders WHERE status <> 'cancelled'`;
  const [{ purch_total }] = await sql`SELECT COALESCE(sum(total_amount),0) AS purch_total FROM purchases WHERE status <> 'cancelled'`;

  // Cash/bank balance from the ledger (debit - credit on cash/bank accounts).
  const [{ cash_balance }] = await sql`
    SELECT COALESCE(sum(l.debit - l.credit),0) AS cash_balance
    FROM journal_lines l JOIN accounts a ON a.id = l.account_id
    WHERE a.is_cash_bank = true
  `;

  const collectedN = Number(collected), paidOutN = Number(paid_out), expN = Number(exp_total);
  return {
    revenue_collected: round2(collectedN),
    invoiced: round2(invoiced),
    invoice_count: inv_count,
    expenses_total: round2(expN),
    receivables_outstanding: round2(Number(so_total) - collectedN),
    supplier_payables: round2(Number(purch_total) - paidOutN),
    cash_in: round2(collectedN),
    cash_out: round2(paidOutN + expN),
    net_cash: round2(collectedN - paidOutN - expN),
    cash_balance: round2(cash_balance)
  };
}
