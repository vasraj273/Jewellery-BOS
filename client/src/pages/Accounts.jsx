import { useEffect, useMemo, useState } from 'react';
import { accountsApi } from '../api/client.js';
import { PageHeader, Tabs, EmptyState } from '../components/ui.jsx';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const TABS = [{ key: 'coa', label: 'Chart of Accounts' }, { key: 'journals', label: 'Journals' }, { key: 'ledger', label: 'Ledger' }];

export default function Accounts() {
  const [tab, setTab] = useState('coa');
  return (
    <div>
      <PageHeader title="Accounts" subtitle="Chart of accounts · double-entry ledger" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="animate-fade-in">
        {tab === 'coa' && <ChartOfAccounts />}
        {tab === 'journals' && <Journals />}
        {tab === 'ledger' && <Ledger />}
      </div>
    </div>
  );
}

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: '', group_id: '', is_cash_bank: false });
  const [busy, setBusy] = useState(false);
  function flash(k, t) { setToast({ k, t }); setTimeout(() => setToast(null), 4000); }
  function reload() { accountsApi.list().then(setAccounts).catch(() => {}); }
  useEffect(() => { accountsApi.groups().then(setGroups).catch(() => {}); reload(); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.group_id) return flash('err', 'Name + group required');
    setBusy(true);
    try { await accountsApi.create(form); flash('ok', 'Account added'); setForm({ name: '', group_id: '', is_cash_bank: false }); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  const byGroup = useMemo(() => {
    const m = {};
    for (const a of accounts) { (m[a.group_name || 'Ungrouped'] ||= []).push(a); }
    return m;
  }, [accounts]);

  return (
    <>
      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.k === 'ok' ? 'bg-success-bg border-success-border text-success' : 'bg-danger-bg border-danger-border text-danger'}`}>{toast.t}</div>}
      <div className="card mb-6">
        <h2 className="section-title">Add Ledger Account</h2>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Group</label>
            <select className="input" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
              <option value="">—</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm h-[38px]"><input type="checkbox" checked={form.is_cash_bank} onChange={(e) => setForm({ ...form, is_cash_bank: e.target.checked })} /> Cash/Bank</label>
          <button type="submit" disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Add'}</button>
        </form>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(byGroup).map(([g, accs]) => (
          <div key={g} className="card p-0 overflow-hidden">
            <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">{g}</div>
            <table className="w-full text-sm">
              <tbody>
                {accs.map((a) => (
                  <tr key={a.id} className="border-b border-gold-light/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{a.code}</td>
                    <td className="px-4 py-2.5">{a.name}{a.is_cash_bank ? ' 💵' : ''}</td>
                    <td className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-ink-muted">{a.nature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}

function Journals() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [view, setView] = useState(null);
  const [head, setHead] = useState({ entry_date: new Date().toISOString().slice(0, 10), narration: '' });
  const [lines, setLines] = useState([{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }]);
  function flash(k, t) { setToast({ k, t }); setTimeout(() => setToast(null), 4000); }
  function reload() { accountsApi.journals().then(setRows).catch(() => {}); }
  useEffect(() => { reload(); accountsApi.list().then(setAccounts).catch(() => {}); }, []);

  const totD = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totC = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totD > 0 && Math.round(totD * 100) === Math.round(totC * 100);

  async function save(e) {
    e.preventDefault();
    if (!balanced) return flash('err', 'Debit must equal credit and be > 0');
    setBusy(true);
    try {
      await accountsApi.createJournal({ ...head, lines: lines.filter((l) => l.account_id && (Number(l.debit) || Number(l.credit))) });
      flash('ok', 'Journal posted');
      setHead({ entry_date: new Date().toISOString().slice(0, 10), narration: '' });
      setLines([{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }]);
      setShow(false); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }
  function setLine(i, p) { setLines((ls) => ls.map((l, x) => x === i ? { ...l, ...p } : l)); }

  return (
    <>
      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.k === 'ok' ? 'bg-success-bg border-success-border text-success' : 'bg-danger-bg border-danger-border text-danger'}`}>{toast.t}</div>}
      <div className="flex justify-end mb-4"><button onClick={() => setShow((s) => !s)} className="btn-primary">{show ? 'Close' : '+ New Journal'}</button></div>

      {show && (
        <div className="card mb-6">
          <h2 className="section-title">Manual Journal Entry</h2>
          <form onSubmit={save}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div><label className="label">Date</label><input className="input" type="date" value={head.entry_date} onChange={(e) => setHead({ ...head, entry_date: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Narration</label><input className="input" value={head.narration} onChange={(e) => setHead({ ...head, narration: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select className="input col-span-6" value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })}>
                    <option value="">— account —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input className="input col-span-2 text-right" type="number" min="0" placeholder="Debit" value={l.debit || ''} onChange={(e) => setLine(i, { debit: +e.target.value, credit: 0 })} />
                  <input className="input col-span-2 text-right" type="number" min="0" placeholder="Credit" value={l.credit || ''} onChange={(e) => setLine(i, { credit: +e.target.value, debit: 0 })} />
                  <div className="col-span-2 text-center">{lines.length > 2 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))} className="text-danger">✕</button>}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <button type="button" onClick={() => setLines((ls) => [...ls, { account_id: '', debit: 0, credit: 0 }])} className="btn-secondary">+ Line</button>
              <div className="flex items-center gap-4 text-sm">
                <span>DR {inr(totD)} · CR {inr(totC)}</span>
                <span className={balanced ? 'badge-success' : 'badge-danger'}>{balanced ? 'Balanced' : 'Unbalanced'}</span>
                <button type="submit" disabled={busy || !balanced} className="btn-primary">{busy ? '…' : 'Post'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr><th className="px-4 py-3 text-left">Entry</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Narration</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <EmptyState colSpan={6} title="No journal entries" />
             : rows.map((j) => (
              <tr key={j.id} className="border-b border-gold-light/20 hover:bg-gold-pale/40">
                <td className="px-4 py-3 font-mono text-xs">{j.entry_code}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{j.entry_date}</td>
                <td className="px-4 py-3 text-ink-muted">{j.narration || '—'}</td>
                <td className="px-4 py-3"><span className="badge-neutral">{j.source}</span></td>
                <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(j.total)}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => accountsApi.journal(j.id).then(setView)} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setView(null)}>
          <div className="bg-white border-l-4 border-l-gold max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-ink text-gold px-4 py-3 flex justify-between"><span className="font-serif tracking-widest text-sm">{view.entry_code}</span><button onClick={() => setView(null)} className="text-xs uppercase tracking-widest">Close</button></div>
            <div className="p-4">
              <div className="text-xs text-ink-muted mb-3">{view.entry_date} · {view.narration || '—'}</div>
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-ink-muted border-b border-gold-light/40"><tr><th className="py-2 text-left">Account</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th></tr></thead>
                <tbody>
                  {view.lines.map((l) => (
                    <tr key={l.id} className="border-b border-gold-light/20"><td className="py-2">{l.account_name}</td><td className="py-2 text-right">{Number(l.debit) ? inr(l.debit) : ''}</td><td className="py-2 text-right">{Number(l.credit) ? inr(l.credit) : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Ledger() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [data, setData] = useState(null);
  useEffect(() => { accountsApi.list().then(setAccounts).catch(() => {}); }, []);
  useEffect(() => { if (accountId) accountsApi.ledger(accountId).then(setData).catch(() => setData(null)); else setData(null); }, [accountId]);

  return (
    <>
      <div className="card mb-4">
        <label className="label">Account</label>
        <select className="input sm:max-w-md" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— select account —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
        </select>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="card"><div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-1">Total Debit</div><div className="font-serif text-2xl">{inr(data.total_debit)}</div></div>
            <div className="card"><div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-1">Total Credit</div><div className="font-serif text-2xl">{inr(data.total_credit)}</div></div>
            <div className="card border-l-4 border-l-gold"><div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-1">Balance</div><div className="font-serif text-2xl">{inr(data.balance)}</div></div>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest"><tr><th className="px-4 py-3 text-left">Entry</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Narration</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th></tr></thead>
              <tbody>
                {data.lines.length === 0 ? <EmptyState colSpan={6} title="No entries for this account" />
                 : data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-gold-light/20 hover:bg-gold-pale/40">
                    <td className="px-4 py-3 font-mono text-xs">{l.entry_code}</td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{l.entry_date}</td>
                    <td className="px-4 py-3 text-ink-muted">{l.narration || '—'}</td>
                    <td className="px-4 py-3 text-right">{Number(l.debit) ? inr(l.debit) : ''}</td>
                    <td className="px-4 py-3 text-right">{Number(l.credit) ? inr(l.credit) : ''}</td>
                    <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
