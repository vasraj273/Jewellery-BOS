import { useEffect, useMemo, useState } from 'react';
import { tasksApi, usersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const PRIORITIES = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }
];
const STATUSES = [
  { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }
];
const PR_STYLE = {
  low: 'bg-off-white text-ink-mid border-gold-light/60', medium: 'bg-gold-pale text-gold-dark border-gold-light',
  high: 'bg-ink text-gold border-gold', urgent: 'bg-red-50 text-red-700 border-red-300'
};
const ST_STYLE = {
  pending: 'bg-gold-pale text-gold-dark border-gold-light', in_progress: 'bg-blue-50 text-blue-700 border-blue-300',
  completed: 'bg-green-50 text-green-700 border-green-300', cancelled: 'bg-off-white text-ink-muted border-gold-light/60'
};

export default function Tasks() {
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ priority: '', status: '', assigned_to_user_id: '' });
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assigned_to_user_id: '', due_date: '', priority: 'medium', linked_entity_type: '', linked_entity_id: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdminTier) usersApi.list().then((u) => setUsers(u.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  const params = useMemo(() => {
    const p = {};
    if (filters.priority) p.priority = filters.priority;
    if (filters.status)   p.status = filters.status;
    if (filters.assigned_to_user_id) p.assigned_to_user_id = filters.assigned_to_user_id;
    return p;
  }, [filters]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [params]);
  function reload() { setLoading(true); tasksApi.list(params).then(setRows).catch(() => setRows([])).finally(() => setLoading(false)); }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function create(e) {
    e.preventDefault();
    if (!form.title.trim()) return flash('err', 'Title required');
    setBusy(true);
    try {
      const payload = { ...form };
      if (!isAdminTier) delete payload.assigned_to_user_id;
      await tasksApi.create(payload);
      flash('ok', 'Task created');
      setForm({ ...form, title: '', description: '', due_date: '', linked_entity_id: '' });
      reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function setStatus(id, status) {
    try { await tasksApi.update(id, { status }); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
  }

  const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
  const isOverdue = (t) => t.due_date && ['pending', 'in_progress'].includes(t.status) && new Date(t.due_date) < new Date(new Date().toDateString());

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Tasks</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{isAdminTier ? 'Assign + track work' : 'Your tasks'}</p>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="card mb-4">
        <h2 className="section-title">{isAdminTier ? 'Assign Task' : 'New Task'}</h2>
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <F label="Title *"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></F>
          {isAdminTier && (
            <F label="Assign To">
              <select className="input" value={form.assigned_to_user_id} onChange={(e) => setForm({ ...form, assigned_to_user_id: e.target.value })}>
                <option value="">Myself</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </F>
          )}
          <F label="Due Date"><input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></F>
          <F label="Priority">
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </F>
          <F label="Link Type">
            <select className="input" value={form.linked_entity_type} onChange={(e) => setForm({ ...form, linked_entity_type: e.target.value })}>
              <option value="">None</option>
              <option value="lead">Lead</option>
              <option value="customer">Customer</option>
              <option value="quotation">Quotation</option>
            </select>
          </F>
          <F label="Link ID"><input className="input" value={form.linked_entity_id} onChange={(e) => setForm({ ...form, linked_entity_id: e.target.value })} placeholder="optional" /></F>
          <F label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
          <div className="flex items-end"><button type="submit" disabled={busy} className="btn-primary w-full justify-center">{busy ? '…' : 'Create'}</button></div>
        </form>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <F label="Priority">
            <select className="input" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">All</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </F>
          <F label="Status">
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </F>
          {isAdminTier && (
            <F label="Assignee">
              <select className="input" value={filters.assigned_to_user_id} onChange={(e) => setFilters({ ...filters, assigned_to_user_id: e.target.value })}>
                <option value="">All</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </F>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Assignee</th>
              <th className="px-4 py-3 text-left">Due</th>
              <th className="px-4 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Update</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-ink-muted">No tasks.</td></tr>
            ) : rows.map((t, i) => (
              <tr key={t.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3">
                  <div className="font-medium">{t.title}</div>
                  {t.linked_entity_type && <div className="text-[10px] text-ink-muted uppercase tracking-widest">{t.linked_entity_type} #{t.linked_entity_id}</div>}
                </td>
                <td className="px-4 py-3 text-ink-mid">{t.assignee_name || '—'}</td>
                <td className={`px-4 py-3 text-xs ${isOverdue(t) ? 'text-red-600 font-medium' : 'text-ink-muted'}`}>{fmtD(t.due_date)}{isOverdue(t) && ' · overdue'}</td>
                <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${PR_STYLE[t.priority]}`}>{t.priority}</span></td>
                <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${ST_STYLE[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-right">
                  <select className="input py-1 text-xs w-auto inline-block" value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
