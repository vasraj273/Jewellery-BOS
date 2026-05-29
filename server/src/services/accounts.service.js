import { getDb } from '../database/connection.js';
import { generateCodeTx } from '../utils/seqCode.js';

const round2 = (n) => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;

// ── Chart of accounts ────────────────────────────────────────
export async function listGroups() {
  const sql = getDb();
  return sql`SELECT * FROM account_groups WHERE is_active = true ORDER BY sort_order, name`;
}

export async function listAccounts({ nature, cash_only } = {}) {
  const sql = getDb();
  const natureClause = nature ? sql`AND a.nature = ${nature}` : sql``;
  const cashClause = cash_only === '1' ? sql`AND a.is_cash_bank = true` : sql``;
  return sql`
    SELECT a.*, g.name AS group_name
    FROM accounts a LEFT JOIN account_groups g ON g.id = a.group_id
    WHERE a.is_active = true ${natureClause} ${cashClause}
    ORDER BY g.sort_order, a.name
  `;
}

export async function createAccount(input, actor) {
  if (!input?.name?.trim()) { const e = new Error('Account name required'); e.status = 400; throw e; }
  if (!input?.group_id)     { const e = new Error('Account group required'); e.status = 400; throw e; }
  const sql = getDb();
  const [group] = await sql`SELECT id, nature FROM account_groups WHERE id = ${Number(input.group_id)}`;
  if (!group) { const e = new Error('Account group not found'); e.status = 400; throw e; }
  const code = (input.code?.trim()) || `ACC_${Date.now().toString().slice(-6)}`;
  const [row] = await sql`
    INSERT INTO accounts (code, name, group_id, nature, is_system, is_cash_bank, created_by_user_id)
    VALUES (${code}, ${input.name.trim()}, ${group.id}, ${group.nature}, false, ${!!input.is_cash_bank}, ${actor?.id ?? null})
    RETURNING *
  `;
  return row;
}

export async function updateAccount(id, patch) {
  const sql = getDb();
  const fields = {};
  if (typeof patch.name === 'string') fields.name = patch.name.trim();
  if (typeof patch.is_cash_bank === 'boolean') fields.is_cash_bank = patch.is_cash_bank;
  if (typeof patch.is_active === 'boolean') fields.is_active = patch.is_active;
  if (Object.keys(fields).length === 0) { const [r] = await sql`SELECT * FROM accounts WHERE id = ${id}`; return r || null; }
  const cols = Object.keys(fields);
  const [row] = await sql`UPDATE accounts SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) { const e = new Error('Account not found'); e.status = 404; throw e; }
  return row;
}

export async function deactivateAccount(id) {
  const sql = getDb();
  const [acc] = await sql`SELECT is_system FROM accounts WHERE id = ${id}`;
  if (!acc) { const e = new Error('Account not found'); e.status = 404; throw e; }
  if (acc.is_system) { const e = new Error('System accounts cannot be removed'); e.status = 400; throw e; }
  return updateAccount(id, { is_active: false });
}

// ── Posting engine (used by manual journals + auto-posting flows) ──
/** Resolve a system account id by its stable code (CASH, AR, SALES, …). */
export async function resolveAccountTx(tx, code) {
  const [a] = await tx`SELECT id FROM accounts WHERE code = ${code} LIMIT 1`;
  if (!a) { const e = new Error(`Ledger account ${code} not configured`); e.status = 500; throw e; }
  return a.id;
}

/** Insert a balanced journal entry inside a transaction. Throws if DR != CR. */
export async function postJournalTx(tx, { entry_date, narration, source = 'manual', ref_type = null, ref_id = null, lines, actor }) {
  const norm = (lines || [])
    .map((l) => ({ account_id: Number(l.account_id), debit: round2(l.debit), credit: round2(l.credit) }))
    .filter((l) => l.account_id && (l.debit > 0 || l.credit > 0));
  if (norm.length < 2) { const e = new Error('A journal entry needs at least two lines'); e.status = 400; throw e; }
  const totalD = round2(norm.reduce((s, l) => s + l.debit, 0));
  const totalC = round2(norm.reduce((s, l) => s + l.credit, 0));
  if (totalD !== totalC) { const e = new Error(`Journal not balanced: debit ${totalD} ≠ credit ${totalC}`); e.status = 400; throw e; }

  const code = await generateCodeTx(tx, 'journal_entries', 'entry_code', 'JE');
  const [entry] = await tx`
    INSERT INTO journal_entries (entry_code, entry_date, narration, source, ref_type, ref_id, created_by_user_id)
    VALUES (${code}, ${entry_date || new Date().toISOString().slice(0, 10)}, ${narration || null}, ${source}, ${ref_type}, ${ref_id == null ? null : String(ref_id)}, ${actor?.id ?? null})
    RETURNING *
  `;
  for (const l of norm) {
    await tx`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (${entry.id}, ${l.account_id}, ${l.debit}, ${l.credit})`;
  }
  return entry;
}

// ── Manual journals ──────────────────────────────────────────
export async function createJournal(input, actor) {
  const sql = getDb();
  return sql.begin((tx) => postJournalTx(tx, {
    entry_date: input.entry_date,
    narration: input.narration,
    source: 'manual',
    lines: input.lines,
    actor
  }));
}

export async function listJournals({ limit } = {}) {
  const sql = getDb();
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  return sql`
    SELECT j.*,
           (SELECT COALESCE(sum(debit), 0) FROM journal_lines l WHERE l.journal_entry_id = j.id) AS total
    FROM journal_entries j
    ORDER BY j.entry_date DESC, j.id DESC
    LIMIT ${lim}
  `;
}

export async function getJournal(id) {
  const sql = getDb();
  const [entry] = await sql`SELECT * FROM journal_entries WHERE id = ${id}`;
  if (!entry) return null;
  const lines = await sql`
    SELECT l.*, a.name AS account_name, a.code AS account_code
    FROM journal_lines l JOIN accounts a ON a.id = l.account_id
    WHERE l.journal_entry_id = ${id} ORDER BY l.id
  `;
  return { ...entry, lines };
}

/** Per-account ledger with running balance. */
export async function ledger(accountId, { date_from, date_to } = {}) {
  const sql = getDb();
  const [account] = await sql`SELECT a.*, g.name AS group_name FROM accounts a LEFT JOIN account_groups g ON g.id = a.group_id WHERE a.id = ${accountId}`;
  if (!account) return null;
  const fromClause = date_from ? sql`AND j.entry_date >= ${date_from}::date` : sql``;
  const toClause = date_to ? sql`AND j.entry_date <= ${date_to}::date` : sql``;
  const rows = await sql`
    SELECT l.id, l.debit, l.credit, j.entry_code, j.entry_date, j.narration, j.source
    FROM journal_lines l JOIN journal_entries j ON j.id = l.journal_entry_id
    WHERE l.account_id = ${accountId} ${fromClause} ${toClause}
    ORDER BY j.entry_date, j.id, l.id
  `;
  // Debit-positive natures (asset/expense) increase with debit; others with credit.
  const debitPositive = account.nature === 'asset' || account.nature === 'expense';
  let running = 0;
  const lines = rows.map((r) => {
    const d = Number(r.debit), c = Number(r.credit);
    running += debitPositive ? (d - c) : (c - d);
    return { ...r, balance: round2(running) };
  });
  const totalDebit = round2(rows.reduce((s, r) => s + Number(r.debit), 0));
  const totalCredit = round2(rows.reduce((s, r) => s + Number(r.credit), 0));
  return { account, lines, total_debit: totalDebit, total_credit: totalCredit, balance: round2(running) };
}
