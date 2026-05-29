import { getDb } from '../database/connection.js';
import { generateCodeTx } from '../utils/seqCode.js';
import { postJournalTx, resolveAccountTx } from './accounts.service.js';

export const MODES = ['cash', 'bank', 'upi', 'card', 'other'];
const round2 = (n) => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;

// Map a free-text category to a seeded expense account code.
const CATEGORY_CODE = {
  salary: 'EXP_SALARY', rent: 'EXP_RENT', electricity: 'EXP_ELEC', labour: 'EXP_LABOUR',
  marketing: 'EXP_MKTG', repairs: 'EXP_REPAIR'
};
const codeForCategory = (cat) => CATEGORY_CODE[String(cat || '').trim().toLowerCase()] || 'EXP_MISC';

export async function list({ search, category, date_from, date_to } = {}) {
  const sql = getDb();
  const s = (search || '').trim();
  const searchClause = s ? sql`AND (e.expense_code ILIKE ${'%' + s + '%'} OR e.notes ILIKE ${'%' + s + '%'} OR e.category ILIKE ${'%' + s + '%'})` : sql``;
  const catClause = category ? sql`AND e.category = ${category}` : sql``;
  const fromClause = date_from ? sql`AND e.expense_date >= ${date_from}::date` : sql``;
  const toClause = date_to ? sql`AND e.expense_date <= ${date_to}::date` : sql``;
  const rows = await sql`
    SELECT e.*, a.name AS account_name, p.name AS paid_account_name
    FROM expenses e
    LEFT JOIN accounts a ON a.id = e.expense_account_id
    LEFT JOIN accounts p ON p.id = e.paid_account_id
    WHERE 1 = 1 ${searchClause} ${catClause} ${fromClause} ${toClause}
    ORDER BY e.expense_date DESC, e.id DESC LIMIT 1000
  `;
  const total = round2(rows.reduce((s2, r) => s2 + Number(r.amount), 0));
  return { expenses: rows, total };
}

export async function create(input, actor) {
  const sql = getDb();
  const amount = round2(input.amount);
  if (!input?.category?.trim()) { const e = new Error('Category required'); e.status = 400; throw e; }
  if (!(amount > 0)) { const e = new Error('Amount must be greater than 0'); e.status = 400; throw e; }
  const mode = MODES.includes(input.mode) ? input.mode : 'cash';

  return sql.begin(async (tx) => {
    const expAcc = input.expense_account_id ? Number(input.expense_account_id) : await resolveAccountTx(tx, codeForCategory(input.category));
    const paidAcc = input.paid_account_id ? Number(input.paid_account_id) : await resolveAccountTx(tx, mode === 'cash' || mode === 'other' ? 'CASH' : 'BANK');
    const code = await generateCodeTx(tx, 'expenses', 'expense_code', 'EXP');
    // DR Expense · CR Cash/Bank
    const entry = await postJournalTx(tx, {
      entry_date: input.expense_date, narration: `Expense ${code} · ${input.category}`, source: 'expense',
      ref_type: 'expense', ref_id: code,
      lines: [{ account_id: expAcc, debit: amount, credit: 0 }, { account_id: paidAcc, debit: 0, credit: amount }],
      actor
    });
    const [row] = await tx`
      INSERT INTO expenses (expense_code, category, expense_account_id, amount, expense_date, mode, paid_account_id, notes, receipt_url, journal_entry_id, created_by_user_id)
      VALUES (${code}, ${input.category.trim()}, ${expAcc}, ${amount}, ${input.expense_date || new Date().toISOString().slice(0, 10)}, ${mode}, ${paidAcc}, ${input.notes || null}, ${input.receipt_url || null}, ${entry.id}, ${actor?.id ?? null})
      RETURNING *
    `;
    return row;
  });
}
