import { useEffect, useMemo, useRef, useState } from 'react';
import { employeesApi, usersApi } from '../api/client.js';

const EMPLOYMENT = [
  { value: 'active',     label: 'Active' },
  { value: 'on_leave',   label: 'On Leave' },
  { value: 'resigned',   label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' }
];
const EMP_STYLE = {
  active:     'bg-green-50 text-green-700 border-green-300',
  on_leave:   'bg-gold-pale text-gold-dark border-gold-light',
  resigned:   'bg-off-white text-ink-mid border-gold-light/60',
  terminated: 'bg-red-50 text-red-700 border-red-300'
};

export default function Employees() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    usersApi.list().then((u) => setUsers(u.filter((x) => x.is_active))).catch(() => {});
  }, []);

  const params = useMemo(() => (search.trim() ? { search: search.trim(), include_inactive: '1' } : { include_inactive: '1' }), [search]);
  const fetchRef = useRef(0);
  useEffect(() => {
    const my = ++fetchRef.current;
    setLoading(true);
    const t = setTimeout(() => {
      employeesApi.list(params)
        .then((r) => { if (my === fetchRef.current) { setRows(r); setEmployees(r); } })
        .catch(() => { if (my === fetchRef.current) setRows([]); })
        .finally(() => { if (my === fetchRef.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [params]);

  function reload() { employeesApi.list(params).then((r) => { setRows(r); setEmployees(r); }).catch(() => {}); }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Employees</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{loading ? 'Loading…' : `${rows.length} employee${rows.length === 1 ? '' : 's'}`}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary self-start sm:self-auto">+ New Employee</button>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="card mb-4">
        <label className="label">Search</label>
        <input className="input sm:max-w-md" placeholder="Name, email, mobile, EMP-…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Designation</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No employees.</td></tr>
            ) : rows.map((e, i) => (
              <tr key={e.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3 font-medium">{e.employee_code}</td>
                <td className="px-4 py-3">{e.full_name}{!e.is_active && <span className="ml-2 text-[9px] uppercase tracking-widest text-red-600">inactive</span>}</td>
                <td className="px-4 py-3 text-ink-mid">{e.department || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{e.designation || '—'}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{fmtD(e.joining_date)}</td>
                <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${EMP_STYLE[e.employment_status] || ''}`}>{(e.employment_status || '').replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                  <button onClick={() => setEditing(e)} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Edit</button>
                  {e.is_active && <button onClick={async () => { await employeesApi.deactivate(e.id); flash('ok', `${e.full_name} deactivated`); reload(); }} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-3">
        {loading ? <div className="card text-center text-ink-muted">Loading…</div>
         : rows.length === 0 ? <div className="card text-center text-ink-muted">No employees.</div>
         : rows.map((e) => (
          <div key={e.id} className="card border-l-4 border-l-gold">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-serif text-base text-ink truncate">{e.employee_code}</div>
                <div className="text-sm text-ink-mid truncate">{e.full_name}</div>
                <div className="text-xs text-ink-muted truncate">{e.designation || '—'} · {e.department || '—'}</div>
              </div>
              <span className={`shrink-0 text-[10px] uppercase tracking-widest border px-2 py-0.5 ${EMP_STYLE[e.employment_status] || ''}`}>{(e.employment_status || '').replace('_', ' ')}</span>
            </div>
            <div className="flex gap-2 pt-3 border-t border-gold-light/40">
              <button onClick={() => setEditing(e)} className="flex-1 text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold">Edit</button>
              {e.is_active && <button onClick={async () => { await employeesApi.deactivate(e.id); flash('ok', `${e.full_name} deactivated`); reload(); }} className="flex-1 text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold">Deactivate</button>}
            </div>
          </div>
        ))}
      </div>

      {(showCreate || editing) && (
        <EmployeeModal
          employee={editing}
          users={users}
          managers={employees}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={(msg) => { setShowCreate(false); setEditing(null); flash('ok', msg); reload(); }}
          onError={(msg) => flash('err', msg)}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, users, managers, onClose, onSaved, onError }) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    user_id: employee?.user_id || '',
    full_name: employee?.full_name || '',
    email: employee?.email || '',
    mobile: employee?.mobile || '',
    department: employee?.department || '',
    designation: employee?.designation || '',
    joining_date: employee?.joining_date ? employee.joining_date.slice(0, 10) : '',
    reporting_manager_id: employee?.reporting_manager_id || '',
    employment_status: employee?.employment_status || 'active',
    emergency_contact: employee?.emergency_contact || '',
    address: employee?.address || '',
    notes: employee?.notes || ''
  });
  const [busy, setBusy] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) return onError('Full name required');
    setBusy(true);
    try {
      if (isEdit) { await employeesApi.update(employee.id, form); onSaved(`Updated ${form.full_name}`); }
      else        { const c = await employeesApi.create(form); onSaved(`Created ${c.employee_code}`); }
    } catch (err) { onError(err?.response?.data?.error || err.message || 'Save failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl card border-l-4 border-l-gold my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg sm:text-xl text-ink">{isEdit ? `Edit · ${employee.employee_code}` : 'New Employee'}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isEdit && (
              <F label="Link to User (optional)">
                <select className="input" value={form.user_id} onChange={(e) => set('user_id', e.target.value)}>
                  <option value="">— none —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role.replace('_', ' ')})</option>)}
                </select>
              </F>
            )}
            <F label="Full Name *"><input className="input" required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></F>
            <F label="Email"><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></F>
            <F label="Mobile"><input className="input" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} /></F>
            <F label="Department"><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></F>
            <F label="Designation"><input className="input" value={form.designation} onChange={(e) => set('designation', e.target.value)} /></F>
            <F label="Joining Date"><input className="input" type="date" value={form.joining_date} onChange={(e) => set('joining_date', e.target.value)} /></F>
            <F label="Reporting Manager">
              <select className="input" value={form.reporting_manager_id} onChange={(e) => set('reporting_manager_id', e.target.value)}>
                <option value="">— none —</option>
                {managers.filter((m) => !employee || m.id !== employee.id).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </F>
            <F label="Employment Status">
              <select className="input" value={form.employment_status} onChange={(e) => set('employment_status', e.target.value)}>
                {EMPLOYMENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </F>
            <F label="Emergency Contact"><input className="input" value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} /></F>
          </div>
          <F label="Address"><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></F>
          <F label="Notes"><textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></F>
          <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : (isEdit ? 'Save' : 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
