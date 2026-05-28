import { useEffect, useMemo, useState } from 'react';
import { leavesApi, employeesApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const TYPES = [
  { value: 'casual',    label: 'Casual' },
  { value: 'sick',      label: 'Sick' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'paid',      label: 'Paid' },
  { value: 'unpaid',    label: 'Unpaid' }
];
const STATUS_STYLE = {
  pending:  'bg-gold-pale text-gold-dark border-gold-light',
  approved: 'bg-green-50 text-green-700 border-green-300',
  rejected: 'bg-red-50 text-red-700 border-red-300'
};

export default function Leaves() {
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ employee_id: '', leave_type: 'casual', start_date: '', end_date: '', reason: '' });
  const [filters, setFilters] = useState({ employee_id: '', leave_type: '', status: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdminTier) employeesApi.list().then((e) => setEmployees(e.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  const params = useMemo(() => {
    const p = {};
    if (filters.employee_id) p.employee_id = filters.employee_id;
    if (filters.leave_type)  p.leave_type = filters.leave_type;
    if (filters.status)      p.status = filters.status;
    return p;
  }, [filters]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [params]);
  function reload() {
    setLoading(true);
    leavesApi.list(params).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function submit(e) {
    e.preventDefault();
    if (!form.start_date || !form.end_date) return flash('err', 'Dates required');
    setBusy(true);
    try {
      const payload = { ...form };
      if (!isAdminTier) delete payload.employee_id;
      await leavesApi.request(payload);
      flash('ok', 'Leave requested');
      setForm({ ...form, reason: '' });
      reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message || 'Failed'); }
    finally { setBusy(false); }
  }

  async function decide(id, status) {
    try { await leavesApi.decide(id, status); flash('ok', `Leave ${status}`); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
  }

  const fmtD = (d) => new Date(d).toLocaleDateString('en-IN');

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Leaves</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{isAdminTier ? 'Requests + approvals' : 'Request leave'}</p>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="card mb-4">
        <h2 className="section-title">Request Leave</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {isAdminTier && (
            <F label="Employee (optional)">
              <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Myself</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </F>
          )}
          <F label="Type">
            <select className="input" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </F>
          <F label="Start *"><input className="input" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></F>
          <F label="End *"><input className="input" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></F>
          <F label="Reason"><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></F>
          <button type="submit" disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Request'}</button>
        </form>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isAdminTier && (
            <F label="Employee">
              <select className="input" value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}>
                <option value="">All Employees</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </F>
          )}
          <F label="Type">
            <select className="input" value={filters.leave_type} onChange={(e) => setFilters({ ...filters, leave_type: e.target.value })}>
              <option value="">All Types</option>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </F>
          <F label="Status">
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </F>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Dates</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Status</th>
              {isAdminTier && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdminTier ? 6 : 5} className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isAdminTier ? 6 : 5} className="px-4 py-6 text-center text-ink-muted">No leave requests.</td></tr>
            ) : rows.map((l, i) => (
              <tr key={l.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3 text-ink-mid">{l.employee_name}</td>
                <td className="px-4 py-3 capitalize">{l.leave_type}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{fmtD(l.start_date)} → {fmtD(l.end_date)}</td>
                <td className="px-4 py-3 text-ink-muted truncate max-w-[180px]">{l.reason || '—'}</td>
                <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${STATUS_STYLE[l.status] || ''}`}>{l.status}</span></td>
                {isAdminTier && (
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    {l.status === 'pending' ? (
                      <>
                        <button onClick={() => decide(l.id, 'approved')} className="text-xs uppercase tracking-widest text-green-700 hover:text-green-800">Approve</button>
                        <button onClick={() => decide(l.id, 'rejected')} className="text-xs uppercase tracking-widest text-red-600 hover:text-red-700">Reject</button>
                      </>
                    ) : <span className="text-[10px] text-ink-muted">{l.decided_by_name || '—'}</span>}
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
