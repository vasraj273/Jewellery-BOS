import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { leadsApi, usersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import LeadFormModal from '../components/LeadFormModal.jsx';
import { PageHeader } from '../components/ui.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

const PRIORITY_STYLES = {
  low:    'bg-off-white text-ink-mid border-gold-light/60',
  medium: 'bg-gold-pale text-gold-dark border-gold-light',
  high:   'bg-ink text-gold border-gold'
};

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' }
];

const PRIORITIES = [
  { value: '',       label: 'All Priorities' },
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' }
];

const INITIAL_FILTERS = {
  search: '', status_id: '', source_id: '', priority: '', sort: 'newest', assigned_user_id: ''
};

export default function Leads() {
  const { user: me } = useAuth();
  const isAdminTier  = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    leadsApi.sources().then(setSources).catch(() => setSources([]));
    leadsApi.statuses().then(setStatuses).catch(() => setStatuses([]));
    if (isAdminTier) {
      usersApi.list().then((u) => setExecutives(u.filter((x) => x.is_active))).catch(() => setExecutives([]));
    }
  }, [isAdminTier]);

  const queryParams = useMemo(() => {
    const p = {};
    if (filters.search.trim())   p.search = filters.search.trim();
    if (filters.status_id)       p.status_id = filters.status_id;
    if (filters.source_id)       p.source_id = filters.source_id;
    if (filters.priority)        p.priority = filters.priority;
    if (filters.assigned_user_id) p.assigned_user_id = filters.assigned_user_id;
    p.sort = filters.sort || 'newest';
    return p;
  }, [filters]);

  const fetchRef = useRef(0);
  useEffect(() => {
    const myReq = ++fetchRef.current;
    setLoading(true);
    const t = setTimeout(() => {
      leadsApi.list(queryParams)
        .then((r) => { if (myReq === fetchRef.current) setRows(r); })
        .catch(() => { if (myReq === fetchRef.current) setRows([]); })
        .finally(() => { if (myReq === fetchRef.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [queryParams]);

  function reload() { leadsApi.list(queryParams).then(setRows).catch(() => {}); }
  function set(k, v) { setFilters((f) => ({ ...f, [k]: v })); }
  function reset() { setFilters(INITIAL_FILTERS); }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={loading ? 'Loading…' : `${rows.length} lead${rows.length === 1 ? '' : 's'}`}
        actions={<button onClick={() => setShowCreate(true)} className="btn-primary">+ New Lead</button>}
      />

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Search">
            <input className="input" placeholder="Name, mobile, email, LD-…" value={filters.search} onChange={(e) => set('search', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={filters.status_id} onChange={(e) => set('status_id', e.target.value)}>
              <option value="">All Statuses</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select className="input" value={filters.source_id} onChange={(e) => set('source_id', e.target.value)}>
              <option value="">All Sources</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={filters.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Sort">
            <select className="input" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
          <div className="flex items-end">
            <button onClick={reset} className="btn-secondary w-full justify-center">Clear Filters</button>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Lead ID</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Assigned</th>
              <th className="px-4 py-3 text-left">Next Followup</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="8" className="px-4 py-6 text-center text-ink-muted">No leads match.</td></tr>
            ) : rows.map((l) => (
              <tr key={l.id} className="border-b border-gold-light/20 transition-colors hover:bg-gold-pale/40">
                <td className="px-4 py-3 font-medium">{l.lead_code}</td>
                <td className="px-4 py-3">
                  {l.name}
                  <span className={`ml-2 text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${PRIORITY_STYLES[l.priority] || ''}`}>{l.priority}</span>
                </td>
                <td className="px-4 py-3 text-ink-mid">{l.mobile}</td>
                <td className="px-4 py-3 text-ink-mid">{l.source_label || '—'}</td>
                <td className="px-4 py-3"><StatusPill label={l.status_label} terminal={l.status_terminal} /></td>
                <td className="px-4 py-3 text-ink-mid">{l.assigned_name || '—'}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{fmtDate(l.next_followup_at)}</td>
                <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                  <Link to={`/leads/${l.id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View</Link>
                  <Link to={`/quotations/new?lead=${l.id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Quote</Link>
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
          <div className="card text-center text-ink-muted">No leads match.</div>
        ) : rows.map((l) => (
          <div key={l.id} className="card border-l-4 border-l-gold">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-serif text-base text-ink truncate">{l.lead_code}</div>
                <div className="text-sm text-ink-mid truncate">{l.name} · {l.mobile}</div>
              </div>
              <span className={`shrink-0 text-[10px] uppercase tracking-widest border px-2 py-0.5 ${PRIORITY_STYLES[l.priority] || ''}`}>{l.priority}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gold-light/40">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Status</div>
                <StatusPill label={l.status_label} terminal={l.status_terminal} />
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Next Followup</div>
                <div className="text-sm text-ink">{fmtDate(l.next_followup_at)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Source</div>
                <div className="text-sm text-ink">{l.source_label || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Assigned</div>
                <div className="text-sm text-ink truncate">{l.assigned_name || '—'}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gold-light/40">
              <Link to={`/leads/${l.id}`} className="flex-1 min-w-[90px] text-center text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold">View</Link>
              <Link to={`/quotations/new?lead=${l.id}`} className="flex-1 min-w-[90px] text-center text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold">Quote</Link>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <LeadFormModal
          mode="create"
          sources={sources}
          statuses={statuses}
          executives={executives}
          isAdminTier={isAdminTier}
          me={me}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); reload(); }}
        />
      )}
    </div>
  );
}

function StatusPill({ label, terminal }) {
  const cls = terminal === 'converted'
    ? 'bg-green-50 text-green-700 border-green-300'
    : terminal === 'lost'
      ? 'bg-red-50 text-red-700 border-red-300'
      : 'bg-gold-pale text-gold-dark border-gold-light';
  return <span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${cls}`}>{label || '—'}</span>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
