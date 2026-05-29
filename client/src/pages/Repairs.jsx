import { useEffect, useState } from 'react';
import { repairsApi } from '../api/client.js';

const STATUSES = ['received', 'in_progress', 'ready', 'delivered', 'cancelled'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const EMPTY = { customer_name: '', customer_mobile: '', item_description: '', issue_notes: '', promised_date: '', charge: 0 };
const STATUS_STYLE = {
  received:    'bg-blue-50 text-blue-700 border-blue-300',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-300',
  ready:       'bg-purple-50 text-purple-700 border-purple-300',
  delivered:   'bg-green-50 text-green-700 border-green-300',
  cancelled:   'bg-red-50 text-red-600 border-red-300'
};

export default function Repairs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [edit, setEdit] = useState(null);
  const [filters, setFilters] = useState({ status: '', search: '' });

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }
  function reload() {
    setLoading(true);
    repairsApi.list(filters).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { const t = setTimeout(reload, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [filters]);

  async function save(e) {
    e.preventDefault();
    if (!form.item_description.trim()) return flash('err', 'Item description required');
    if (!form.customer_name.trim() && !form.customer_mobile.trim()) return flash('err', 'Customer name or mobile required');
    setBusy(true);
    try { await repairsApi.create(form); flash('ok', 'Repair logged'); setForm(EMPTY); setShowForm(false); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await repairsApi.update(edit.id, { status: edit.status, promised_date: edit.promised_date || null, charge: edit.charge, notes: edit.notes, issue_notes: edit.issue_notes });
      flash('ok', 'Repair updated'); setEdit(null); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Repairs</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Service &amp; repair orders</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary self-start sm:self-auto">{showForm ? 'Close' : '+ New Repair'}</button>
      </div>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {showForm && (
        <div className="card mb-6">
          <h2 className="section-title">Log Repair</h2>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <F label="Customer Name"><input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></F>
            <F label="Mobile"><input className="input" value={form.customer_mobile} onChange={(e) => setForm({ ...form, customer_mobile: e.target.value })} /></F>
            <F label="Promised Date"><input className="input" type="date" value={form.promised_date} onChange={(e) => setForm({ ...form, promised_date: e.target.value })} /></F>
            <F label="Item Description *"><input className="input" value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })} /></F>
            <F label="Issue Notes"><input className="input" value={form.issue_notes} onChange={(e) => setForm({ ...form, issue_notes: e.target.value })} /></F>
            <F label="Charge (₹)"><input className="input" type="number" min="0" value={form.charge} onChange={(e) => setForm({ ...form, charge: +e.target.value })} /></F>
            <div className="flex items-end"><button type="submit" disabled={busy} className="btn-primary w-full justify-center">{busy ? '…' : 'Log Repair'}</button></div>
          </form>
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Search"><input className="input" placeholder="code / customer / item" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></F>
          <F label="Status">
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </F>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-left">Promised</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
               : rows.length === 0 ? <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No repairs.</td></tr>
               : rows.map((r, i) => {
                  const overdue = r.promised_date && !['delivered', 'cancelled'].includes(r.status) && new Date(r.promised_date) < new Date(new Date().toISOString().slice(0, 10));
                  return (
                  <tr key={r.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs">{r.repair_code}</td>
                    <td className="px-4 py-3">{r.customer_name || '—'}<div className="text-[10px] text-ink-muted">{r.customer_mobile || ''}</div></td>
                    <td className="px-4 py-3 text-ink-muted">{r.item_description}</td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{r.received_date}</td>
                    <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-ink-muted'}`}>{r.promised_date || '—'}{overdue ? ' · late' : ''}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded ${STATUS_STYLE[r.status] || ''}`}>{r.status.replace('_', ' ')}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => setEdit({ ...r, promised_date: r.promised_date || '', charge: r.charge || 0, notes: r.notes || '', issue_notes: r.issue_notes || '' })} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Manage</button></td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <form className="bg-white border-l-4 border-l-gold max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="bg-ink text-gold px-4 py-3 flex justify-between items-center">
              <div className="font-serif tracking-widest text-sm">{edit.repair_code} · {edit.customer_name || edit.customer_mobile}</div>
              <button type="button" onClick={() => setEdit(null)} className="text-xs uppercase tracking-widest">Close</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <F label="Status">
                <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </F>
              <F label="Promised Date"><input className="input" type="date" value={edit.promised_date} onChange={(e) => setEdit({ ...edit, promised_date: e.target.value })} /></F>
              <F label="Charge (₹)"><input className="input" type="number" min="0" value={edit.charge} onChange={(e) => setEdit({ ...edit, charge: +e.target.value })} /></F>
              <F label="Issue Notes"><input className="input" value={edit.issue_notes} onChange={(e) => setEdit({ ...edit, issue_notes: e.target.value })} /></F>
              <F label="Notes"><input className="input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></F>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEdit(null)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary">{busy ? '…' : 'Save'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
