import { useEffect, useMemo, useState } from 'react';
import { attendanceApi, employeesApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const STATUSES = [
  { value: 'present',  label: 'Present' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent',   label: 'Absent' },
  { value: 'leave',    label: 'Leave' }
];
const STATUS_STYLE = {
  present:  'bg-green-50 text-green-700 border-green-300',
  half_day: 'bg-gold-pale text-gold-dark border-gold-light',
  absent:   'bg-red-50 text-red-700 border-red-300',
  leave:    'bg-off-white text-ink-mid border-gold-light/60'
};
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Attendance() {
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ employee_id: '', attendance_date: todayStr(), status: 'present', check_in_time: '', check_out_time: '', notes: '' });
  const [filters, setFilters] = useState({ employee_id: '', status: '', month: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdminTier) employeesApi.list().then((e) => setEmployees(e.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  const params = useMemo(() => {
    const p = {};
    if (filters.employee_id) p.employee_id = filters.employee_id;
    if (filters.status)      p.status = filters.status;
    if (filters.month)       p.month = filters.month;
    return p;
  }, [filters]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [params]);
  function reload() {
    setLoading(true);
    attendanceApi.list(params).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function mark(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      if (!isAdminTier) delete payload.employee_id;
      await attendanceApi.mark(payload);
      flash('ok', 'Attendance marked');
      setForm({ ...form, notes: '', check_in_time: '', check_out_time: '' });
      reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message || 'Failed'); }
    finally { setBusy(false); }
  }

  const fmtD = (d) => new Date(d).toLocaleDateString('en-IN');

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Attendance</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{isAdminTier ? 'Mark + review attendance' : 'Mark your attendance'}</p>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="card mb-4">
        <h2 className="section-title">Mark Attendance</h2>
        <form onSubmit={mark} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {isAdminTier && (
            <F label="Employee *">
              <select className="input" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Select…</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </F>
          )}
          <F label="Date"><input className="input" type="date" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} /></F>
          <F label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </F>
          <F label="Check-in"><input className="input" type="time" value={form.check_in_time} onChange={(e) => setForm({ ...form, check_in_time: e.target.value })} /></F>
          <F label="Check-out"><input className="input" type="time" value={form.check_out_time} onChange={(e) => setForm({ ...form, check_out_time: e.target.value })} /></F>
          <F label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
          <button type="submit" disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Mark'}</button>
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
          <F label="Status">
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </F>
          <F label="Month"><input className="input" type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></F>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">In</th>
              <th className="px-4 py-3 text-left">Out</th>
              <th className="px-4 py-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-ink-muted">No records.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3">{fmtD(r.attendance_date)}</td>
                <td className="px-4 py-3 text-ink-mid">{r.employee_name}</td>
                <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${STATUS_STYLE[r.status] || ''}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-ink-muted">{r.check_in_time || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{r.check_out_time || '—'}</td>
                <td className="px-4 py-3 text-ink-muted truncate max-w-[200px]">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
