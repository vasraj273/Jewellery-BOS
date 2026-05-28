import { useEffect, useState } from 'react';
import { incentivesApi, employeesApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const TYPES = [
  { value: 'percentage', label: 'Percentage of Sales' },
  { value: 'fixed', label: 'Fixed Incentive' },
  { value: 'target_bonus', label: 'Target Bonus' }
];
const ST_STYLE = {
  draft: 'bg-off-white text-ink-mid border-gold-light/60',
  approved: 'bg-gold-pale text-gold-dark border-gold-light',
  paid: 'bg-green-50 text-green-700 border-green-300'
};

export default function Incentives() {
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ employee_id: '', type: 'fixed', percentage: '', fixed_amount: '', notes: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdminTier) employeesApi.list().then((e) => setEmployees(e.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  useEffect(() => { reload(); }, []);
  function reload() { setLoading(true); incentivesApi.list().then(setRows).catch(() => setRows([])).finally(() => setLoading(false)); }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function create(e) {
    e.preventDefault();
    if (!form.employee_id) return flash('err', 'Employee required');
    setBusy(true);
    try { await incentivesApi.create(form); flash('ok', 'Incentive created (draft)'); setForm({ ...form, percentage: '', fixed_amount: '', notes: '' }); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function setStatus(id, status) {
    try { await incentivesApi.setStatus(id, status); flash('ok', `Marked ${status}`); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
  }

  const inr = (n) => n == null ? '—' : `₹ ${Number(n).toLocaleString('en-IN')}`;

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Incentives</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{isAdminTier ? 'Commission tracking' : 'Your incentives'}</p>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {isAdminTier && (
        <div className="card mb-4">
          <h2 className="section-title">Create Incentive</h2>
          <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <F label="Employee *">
              <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Select…</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </F>
            <F label="Type">
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </F>
            <F label="Percentage %"><input className="input" type="number" min="0" step="0.5" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} disabled={form.type === 'fixed'} /></F>
            <F label="Amount ₹"><input className="input" type="number" min="0" value={form.fixed_amount} onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })} /></F>
            <div className="flex items-end"><button type="submit" disabled={busy} className="btn-primary w-full justify-center">{busy ? '…' : 'Create'}</button></div>
            <F label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-left">Status</th>
              {isAdminTier && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdminTier ? 6 : 5} className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isAdminTier ? 6 : 5} className="px-4 py-6 text-center text-ink-muted">No incentives.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3 text-ink-mid">{r.employee_name}</td>
                <td className="px-4 py-3 capitalize">{r.type.replace('_', ' ')}{r.percentage ? ` (${r.percentage}%)` : ''}</td>
                <td className="px-4 py-3 text-right font-medium">{inr(r.amount ?? r.fixed_amount)}</td>
                <td className="px-4 py-3 text-ink-muted truncate max-w-[160px]">{r.notes || '—'}</td>
                <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${ST_STYLE[r.status]}`}>{r.status}</span></td>
                {isAdminTier && (
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    {r.status === 'draft' && <button onClick={() => setStatus(r.id, 'approved')} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Approve</button>}
                    {r.status === 'approved' && <button onClick={() => setStatus(r.id, 'paid')} className="text-xs uppercase tracking-widest text-green-700 hover:text-green-800">Mark Paid</button>}
                    {r.status === 'paid' && <span className="text-[10px] text-ink-muted">paid</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
