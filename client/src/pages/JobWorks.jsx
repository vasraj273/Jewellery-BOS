import { useEffect, useState } from 'react';
import { jobWorksApi, karigarsApi } from '../api/client.js';
import { PageHeader, StatusBadge, EmptyState, SkeletonRows } from '../components/ui.jsx';

const STATUSES = ['issued', 'in_progress', 'completed', 'cancelled'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const EMPTY = { karigar_id: '', description: '', gold_issued_gm: 0, labour_charge: 0, amount_paid: 0, notes: '' };

export default function JobWorks() {
  const [rows, setRows] = useState([]);
  const [karigars, setKarigars] = useState([]);
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
    jobWorksApi.list(filters).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { const t = setTimeout(reload, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [filters]);
  useEffect(() => { karigarsApi.list().then(setKarigars).catch(() => {}); }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await jobWorksApi.create({ ...form, karigar_id: form.karigar_id || null });
      flash('ok', 'Job work issued'); setForm(EMPTY); setShowForm(false); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await jobWorksApi.update(edit.id, {
        status: edit.status, gold_returned_gm: edit.gold_returned_gm, wastage_gm: edit.wastage_gm,
        labour_charge: edit.labour_charge, amount_paid: edit.amount_paid, notes: edit.notes
      });
      flash('ok', 'Job work updated'); setEdit(null); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Job Work"
        subtitle="Karigar gold & labour ledger"
        actions={<button onClick={() => setShowForm((s) => !s)} className="btn-primary">{showForm ? 'Close' : '+ Issue Job Work'}</button>}
      />

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {showForm && (
        <div className="card mb-6">
          <h2 className="section-title">Issue Job Work</h2>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <F label="Karigar">
              <select className="input" value={form.karigar_id} onChange={(e) => setForm({ ...form, karigar_id: e.target.value })}>
                <option value="">—</option>
                {karigars.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </F>
            <F label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
            <F label="Gold Issued (gm)"><input className="input" type="number" min="0" step="0.001" value={form.gold_issued_gm} onChange={(e) => setForm({ ...form, gold_issued_gm: +e.target.value })} /></F>
            <F label="Labour Charge (₹)"><input className="input" type="number" min="0" value={form.labour_charge} onChange={(e) => setForm({ ...form, labour_charge: +e.target.value })} /></F>
            <F label="Amount Paid (₹)"><input className="input" type="number" min="0" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: +e.target.value })} /></F>
            <F label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
            <div className="flex items-end"><button type="submit" disabled={busy} className="btn-primary w-full justify-center">{busy ? '…' : 'Issue'}</button></div>
          </form>
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Search"><input className="input" placeholder="code / description" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></F>
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
                <th className="px-4 py-3 text-left">Karigar</th>
                <th className="px-4 py-3 text-right">Gold Out/In</th>
                <th className="px-4 py-3 text-right">Wastage</th>
                <th className="px-4 py-3 text-right">Due</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows rows={6} cols={7} />
               : rows.length === 0 ? <EmptyState colSpan={7} title="No job work" hint="Issue job work to a karigar to start the ledger." />
               : rows.map((j) => (
                <tr key={j.id} className="border-b border-gold-light/20 transition-colors hover:bg-gold-pale/40">
                  <td className="px-4 py-3 font-mono text-xs">{j.job_work_code}<div className="text-[10px] text-ink-muted">{j.description || ''}</div></td>
                  <td className="px-4 py-3">{j.karigar_name || '—'}</td>
                  <td className="px-4 py-3 text-right text-xs">{Number(j.gold_issued_gm || 0).toFixed(2)} / {Number(j.gold_returned_gm || 0).toFixed(2)}g</td>
                  <td className="px-4 py-3 text-right text-xs">{Number(j.wastage_gm || 0).toFixed(2)}g</td>
                  <td className={`px-4 py-3 text-right ${Number(j.payment_due) > 0 ? 'text-danger font-medium' : 'text-ink-muted'}`}>{inr(j.payment_due)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={j.status} /></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setEdit({ ...j, gold_returned_gm: j.gold_returned_gm || 0, wastage_gm: j.wastage_gm || 0, labour_charge: j.labour_charge || 0, amount_paid: j.amount_paid || 0, notes: j.notes || '' })} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <form className="bg-white border-l-4 border-l-gold max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="bg-ink text-gold px-4 py-3 flex justify-between items-center">
              <div className="font-serif tracking-widest text-sm">{edit.job_work_code}</div>
              <button type="button" onClick={() => setEdit(null)} className="text-xs uppercase tracking-widest">Close</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <F label="Status">
                <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </F>
              <F label="Gold Returned (gm)"><input className="input" type="number" min="0" step="0.001" value={edit.gold_returned_gm} onChange={(e) => setEdit({ ...edit, gold_returned_gm: +e.target.value })} /></F>
              <F label="Wastage (gm)"><input className="input" type="number" min="0" step="0.001" value={edit.wastage_gm} onChange={(e) => setEdit({ ...edit, wastage_gm: +e.target.value })} /></F>
              <F label="Labour Charge (₹)"><input className="input" type="number" min="0" value={edit.labour_charge} onChange={(e) => setEdit({ ...edit, labour_charge: +e.target.value })} /></F>
              <F label="Amount Paid (₹)"><input className="input" type="number" min="0" value={edit.amount_paid} onChange={(e) => setEdit({ ...edit, amount_paid: +e.target.value })} /></F>
              <F label="Notes"><input className="input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></F>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEdit(null)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary">{busy ? '…' : 'Save'}</button>
              </div>
              <div className="col-span-2 text-[10px] text-ink-muted">Marking completed with gold returned posts a return-in to the linked item's inventory ledger.</div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
