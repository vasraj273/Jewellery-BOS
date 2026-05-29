import { useEffect, useState } from 'react';
import { expensesApi, docUploadApi, assetUrl } from '../api/client.js';
import { PageHeader, EmptyState, SkeletonRows } from '../components/ui.jsx';

const CATEGORIES = ['Salary', 'Rent', 'Electricity', 'Labour', 'Marketing', 'Repairs', 'Misc'];
const MODES = ['cash', 'bank', 'upi', 'card', 'other'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { category: 'Misc', amount: 0, expense_date: today(), mode: 'cash', notes: '', receipt_url: '' };

export default function Expenses() {
  const [data, setData] = useState({ expenses: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState({ search: '', category: '' });

  function flash(k, t) { setToast({ k, t }); setTimeout(() => setToast(null), 4000); }
  function reload() {
    setLoading(true);
    expensesApi.list(filters).then(setData).catch(() => setData({ expenses: [], total: 0 })).finally(() => setLoading(false));
  }
  useEffect(() => { const t = setTimeout(reload, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [filters]);

  async function save(e) {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return flash('err', 'Amount must be > 0');
    setBusy(true);
    try {
      await expensesApi.create(form);
      flash('ok', 'Expense recorded'); setForm(EMPTY); setShowForm(false); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function pickReceipt(file) {
    if (!file) return;
    try { const { url } = await docUploadApi.upload(file); setForm((f) => ({ ...f, receipt_url: url })); flash('ok', 'Receipt attached'); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
  }

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Operating costs" actions={<button onClick={() => setShowForm((s) => !s)} className="btn-primary">{showForm ? 'Close' : '+ New Expense'}</button>} />
      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.k === 'ok' ? 'bg-success-bg border-success-border text-success' : 'bg-danger-bg border-danger-border text-danger'}`}>{toast.t}</div>}

      {showForm && (
        <div className="card mb-6">
          <h2 className="section-title">Record Expense</h2>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div><label className="label">Category</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Amount</label><input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
            <div><label className="label">Date</label><input className="input" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
            <div><label className="label">Mode</label><select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><label className="label">Receipt (optional)</label><input className="input text-xs" type="file" accept="image/*,application/pdf" onChange={(e) => pickReceipt(e.target.files?.[0])} /></div>
            <div className="sm:col-span-3 flex justify-end"><button type="submit" disabled={busy} className="btn-primary">{busy ? '…' : 'Record Expense'}</button></div>
          </form>
        </div>
      )}

      <div className="card mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className="label">Search</label><input className="input" placeholder="code / notes" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
        <div><label className="label">Category</label><select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="flex items-end"><div className="card border-l-4 border-l-gold w-full"><div className="text-[10px] uppercase tracking-[2.5px] text-gold">Total</div><div className="font-serif text-xl">{inr(data.total)}</div></div></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest"><tr><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Receipt</th></tr></thead>
          <tbody>
            {loading ? <SkeletonRows rows={6} cols={6} />
             : data.expenses.length === 0 ? <EmptyState colSpan={6} title="No expenses" hint="Record an operating cost to begin." />
             : data.expenses.map((x) => (
              <tr key={x.id} className="border-b border-gold-light/20 hover:bg-gold-pale/40">
                <td className="px-4 py-3 font-mono text-xs">{x.expense_code}</td>
                <td className="px-4 py-3">{x.category}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{x.expense_date}</td>
                <td className="px-4 py-3"><span className="badge-neutral">{x.mode}</span></td>
                <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(x.amount)}</td>
                <td className="px-4 py-3 text-xs">{x.receipt_url ? <a href={assetUrl(x.receipt_url)} target="_blank" rel="noreferrer" className="text-gold-dark hover:text-gold">view</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
