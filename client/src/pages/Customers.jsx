import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi, usersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/ui.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

const REPEAT_OPTIONS = [
  { value: '',  label: 'All Customers' },
  { value: '1', label: 'Repeat Customers' },
  { value: '0', label: 'First-Time' }
];

const INITIAL = { search: '', assigned_user_id: '', repeat: '', sort: 'newest' };

export default function Customers() {
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL);
  const [executives, setExecutives] = useState([]);

  useEffect(() => {
    if (isAdminTier) usersApi.list().then((u) => setExecutives(u.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  const params = useMemo(() => {
    const p = {};
    if (filters.search.trim())    p.search = filters.search.trim();
    if (filters.assigned_user_id) p.assigned_user_id = filters.assigned_user_id;
    if (filters.repeat)           p.repeat = filters.repeat;
    p.sort = filters.sort;
    return p;
  }, [filters]);

  const fetchRef = useRef(0);
  useEffect(() => {
    const myReq = ++fetchRef.current;
    setLoading(true);
    const t = setTimeout(() => {
      customersApi.list(params)
        .then((r) => { if (myReq === fetchRef.current) setRows(r); })
        .catch(() => { if (myReq === fetchRef.current) setRows([]); })
        .finally(() => { if (myReq === fetchRef.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [params]);

  function set(k, v) { setFilters((f) => ({ ...f, [k]: v })); }
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={loading ? 'Loading…' : `${rows.length} customer${rows.length === 1 ? '' : 's'}`}
      />

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Search">
            <input className="input" placeholder="Name, mobile, email, CUST-…" value={filters.search} onChange={(e) => set('search', e.target.value)} />
          </Field>
          <Field label="Type">
            <select className="input" value={filters.repeat} onChange={(e) => set('repeat', e.target.value)}>
              {REPEAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Sort">
            <select className="input" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </Field>
          {isAdminTier && (
            <Field label="Assigned Executive">
              <select className="input" value={filters.assigned_user_id} onChange={(e) => set('assigned_user_id', e.target.value)}>
                <option value="">All Executives</option>
                {executives.map((u) => <option key={u.id} value={u.id}>{u.full_name}{u.id === me?.id ? ' (you)' : ''}</option>)}
              </select>
            </Field>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Customer ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Assigned</th>
              <th className="px-4 py-3 text-left">Last Activity</th>
              <th className="px-4 py-3 text-right">Quotations</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No customers match.</td></tr>
            ) : rows.map((c, i) => (
              <tr key={c.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3 font-medium">{c.customer_code}</td>
                <td className="px-4 py-3">
                  {c.name}
                  {c.quotation_count > 1 && <span className="ml-2 text-[9px] uppercase tracking-widest border border-gold bg-ink text-gold px-1.5 py-0.5">Repeat</span>}
                </td>
                <td className="px-4 py-3 text-ink-mid">{c.mobile}</td>
                <td className="px-4 py-3 text-ink-mid">{c.assigned_name || '—'}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{fmt(c.last_activity_at)}</td>
                <td className="px-4 py-3 text-right">{c.quotation_count}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/customers/${c.id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="card text-center text-ink-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="card text-center text-ink-muted">No customers match.</div>
        ) : rows.map((c) => (
          <div key={c.id} className="card border-l-4 border-l-gold">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-serif text-base text-ink truncate">{c.customer_code}</div>
                <div className="text-sm text-ink-mid truncate">{c.name} · {c.mobile}</div>
              </div>
              {c.quotation_count > 1 && <span className="shrink-0 text-[9px] uppercase tracking-widest border border-gold bg-ink text-gold px-1.5 py-0.5">Repeat</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gold-light/40">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Quotations</div>
                <div className="text-sm text-ink">{c.quotation_count}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Assigned</div>
                <div className="text-sm text-ink truncate">{c.assigned_name || '—'}</div>
              </div>
            </div>
            <Link to={`/customers/${c.id}`} className="block text-center text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold">View Profile</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><label className="label">{label}</label>{children}</div>);
}
