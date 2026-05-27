import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { quotationsApi, mastersApi, usersApi } from '../api/client.js';
import { openQuotationPdf } from '../api/pdfActions.js';
import { useAuth } from '../auth/AuthContext.jsx';
import SendWhatsAppButton from '../components/SendWhatsAppButton.jsx';

const STATUS_STYLES = {
  draft:     'bg-gold-pale text-gold-dark border-gold-light',
  sent:      'bg-ink text-gold border-gold',
  approved:  'bg-green-50 text-green-700 border-green-300',
  rejected:  'bg-red-50 text-red-700 border-red-300',
  converted: 'bg-blue-50 text-blue-700 border-blue-300',
  expired:   'bg-red-50 text-red-700 border-red-300'
};

const STATUS_OPTIONS = [
  { value: '',          label: 'All Statuses' },
  { value: 'draft',     label: 'Draft' },
  { value: 'sent',      label: 'Sent' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'converted', label: 'Converted' }
];

const DATE_PRESETS = [
  { value: '',         label: 'All Dates' },
  { value: 'today',    label: 'Today' },
  { value: 'week',     label: 'This Week' },
  { value: 'month',    label: 'This Month' },
  { value: 'custom',   label: 'Custom Range' }
];

const PRICE_PRESETS = [
  { value: '',         label: 'All Prices' },
  { value: '0-50000',  label: '₹0–50k' },
  { value: '50000-200000', label: '₹50k–2L' },
  { value: '200000-',  label: '₹2L+' },
  { value: 'custom',   label: 'Custom' }
];

const SORT_OPTIONS = [
  { value: 'newest',        label: 'Newest first' },
  { value: 'oldest',        label: 'Oldest first' },
  { value: 'price_desc',    label: 'Highest Price' },
  { value: 'price_asc',     label: 'Lowest Price' },
  { value: 'customer_asc',  label: 'Customer A–Z' },
  { value: 'customer_desc', label: 'Customer Z–A' }
];

const ADMIN_ROLES = ['super_admin', 'admin'];

function resolveDateRange(preset) {
  if (!preset || preset === 'custom') return { date_from: null, date_to: null };
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (preset === 'today') return { date_from: iso(today), date_to: iso(today) };
  if (preset === 'week') {
    const day = today.getDay() || 7; // Mon=1..Sun=7
    const from = new Date(today); from.setDate(today.getDate() - (day - 1));
    return { date_from: iso(from), date_to: iso(today) };
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { date_from: iso(from), date_to: iso(today) };
  }
  return { date_from: null, date_to: null };
}

function resolvePriceRange(preset, customMin, customMax) {
  if (!preset) return { min_price: null, max_price: null };
  if (preset === 'custom') {
    return {
      min_price: customMin === '' ? null : Number(customMin),
      max_price: customMax === '' ? null : Number(customMax)
    };
  }
  const [a, b] = preset.split('-');
  return {
    min_price: a ? Number(a) : null,
    max_price: b ? Number(b) : null
  };
}

const INITIAL_FILTERS = {
  search: '',
  date_preset: '', date_from: '', date_to: '',
  product: '',
  status: '',
  price_preset: '', price_min: '', price_max: '',
  sales_exec: '',
  sort: 'newest'
};

export default function QuotationHistory() {
  const { user: me } = useAuth();
  const isAdminTier  = !!me && ADMIN_ROLES.includes(me.role);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [categories, setCategories] = useState([]);
  const [executives, setExecutives] = useState([]);

  // Load filter inventories (categories always; executives only for admins).
  useEffect(() => {
    mastersApi.list('product_categories')
      .then((rows) => setCategories(rows.map((r) => r.label)))
      .catch(() => setCategories([]));
    if (isAdminTier) {
      usersApi.list()
        .then((rows) => setExecutives(rows.filter((u) => u.role === 'sales_executive' || u.role === 'admin' || u.role === 'super_admin')))
        .catch(() => setExecutives([]));
    }
  }, [isAdminTier]);

  // Build query params from filter state.
  const queryParams = useMemo(() => {
    const { date_from, date_to } =
      filters.date_preset === 'custom'
        ? { date_from: filters.date_from || null, date_to: filters.date_to || null }
        : resolveDateRange(filters.date_preset);
    const { min_price, max_price } = resolvePriceRange(filters.price_preset, filters.price_min, filters.price_max);
    const p = {};
    if (filters.search.trim()) p.search = filters.search.trim();
    if (date_from)            p.date_from = date_from;
    if (date_to)              p.date_to = date_to;
    if (filters.product)      p.product = filters.product;
    if (filters.status)       p.status = filters.status;
    if (min_price != null)    p.min_price = min_price;
    if (max_price != null)    p.max_price = max_price;
    if (filters.sales_exec)   p.sales_exec = filters.sales_exec;
    p.sort = filters.sort || 'newest';
    return p;
  }, [filters]);

  // Debounced fetch (mostly for the search box).
  const fetchRef = useRef(0);
  useEffect(() => {
    const myReq = ++fetchRef.current;
    setLoading(true);
    const t = setTimeout(() => {
      quotationsApi.list(queryParams)
        .then((rows) => { if (myReq === fetchRef.current) setRows(rows); })
        .catch(() => { if (myReq === fetchRef.current) setRows([]); })
        .finally(() => { if (myReq === fetchRef.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [queryParams]);

  function reload() {
    quotationsApi.list(queryParams).then(setRows).catch(() => {});
  }

  function set(key, value) { setFilters((f) => ({ ...f, [key]: value })); }
  function reset() { setFilters(INITIAL_FILTERS); }

  function handlePdf(quoteId) { openQuotationPdf(quoteId).catch(() => {}); }

  const activeCount = useMemo(() => {
    const c = (() => {
      let n = 0;
      if (filters.search.trim()) n++;
      if (filters.date_preset)   n++;
      if (filters.product)       n++;
      if (filters.status)        n++;
      if (filters.price_preset)  n++;
      if (filters.sales_exec)    n++;
      if (filters.sort && filters.sort !== 'newest') n++;
      return n;
    })();
    return c;
  }, [filters]);

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Quotation History</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">
            {loading ? 'Loading…' : `${rows.length} result${rows.length === 1 ? '' : 's'}`}
            {activeCount > 0 && ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} active`}
          </p>
        </div>
        <Link to="/quotations/new" className="btn-primary self-start sm:self-auto">+ New Quotation</Link>
      </header>

      {/* ─── Filter toolbar ─── */}
      <div className="card mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Search">
            <input
              className="input"
              placeholder="Name, mobile, email, QT-…"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
            />
          </Field>
          <Field label="Date">
            <select className="input" value={filters.date_preset} onChange={(e) => set('date_preset', e.target.value)}>
              {DATE_PRESETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Product">
            <select className="input" value={filters.product} onChange={(e) => set('product', e.target.value)}>
              <option value="">All Products</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={filters.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Price">
            <select className="input" value={filters.price_preset} onChange={(e) => set('price_preset', e.target.value)}>
              {PRICE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Sort">
            <select className="input" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          {isAdminTier && (
            <Field label="Sales Executive">
              <select className="input" value={filters.sales_exec} onChange={(e) => set('sales_exec', e.target.value)}>
                <option value="">All Executives</option>
                {executives.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}{u.id === me?.id ? ' (you)' : ''} · {u.role.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex items-end">
            <button
              onClick={reset}
              disabled={activeCount === 0}
              className="btn-secondary w-full justify-center disabled:opacity-40"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Custom date range */}
        {filters.date_preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gold-light/40">
            <Field label="From"><input className="input" type="date" value={filters.date_from} onChange={(e) => set('date_from', e.target.value)} /></Field>
            <Field label="To"><input className="input" type="date" value={filters.date_to} onChange={(e) => set('date_to', e.target.value)} /></Field>
          </div>
        )}

        {/* Custom price range */}
        {filters.price_preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gold-light/40">
            <Field label="Min ₹"><input className="input" type="number" min="0" value={filters.price_min} onChange={(e) => set('price_min', e.target.value)} placeholder="0" /></Field>
            <Field label="Max ₹"><input className="input" type="number" min="0" value={filters.price_max} onChange={(e) => set('price_max', e.target.value)} placeholder="∞" /></Field>
          </div>
        )}
      </div>

      {/* ─── Desktop table (lg+) ─── */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold">
            <tr className="text-[10px] uppercase tracking-widest">
              <th className="px-4 py-3 text-left">Quote ID</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-right">Final Price</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No quotations match the current filters.</td></tr>
            ) : rows.map((q, i) => {
              const cls = STATUS_STYLES[q.status] || STATUS_STYLES.draft;
              return (
                <tr key={q.quote_id} className={i % 2 ? 'bg-off-white' : ''}>
                  <td className="px-4 py-3 font-medium">{q.quote_id}</td>
                  <td className="px-4 py-3">{q.customer_name}</td>
                  <td className="px-4 py-3 text-ink-mid">{q.product_name || q.product_category || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">₹ {(q.final_price || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${cls}`}>{q.status || 'draft'}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link to={`/quotations/${q.quote_id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Preview</Link>
                    <button onClick={() => handlePdf(q.quote_id)} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">PDF</button>
                    <SendWhatsAppButton
                      quoteId={q.quote_id}
                      variant="link"
                      initialStatus={q.whatsapp_status}
                      onSent={reload}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile / tablet cards (< lg) ─── */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="card text-center text-ink-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="card text-center text-ink-muted">No quotations match.</div>
        ) : rows.map((q) => {
          const cls = STATUS_STYLES[q.status] || STATUS_STYLES.draft;
          return (
            <div key={q.quote_id} className="card border-l-4 border-l-gold">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-serif text-base text-ink truncate">{q.quote_id}</div>
                  <div className="text-sm text-ink-mid truncate">{q.customer_name || '—'}</div>
                  {(q.product_name || q.product_category) && (
                    <div className="text-xs text-ink-muted truncate mt-0.5">{q.product_name || q.product_category}</div>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] uppercase tracking-widest border px-2 py-0.5 ${cls}`}>
                  {q.status || 'draft'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gold-light/40">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-muted">Final Price</div>
                  <div className="font-medium text-ink">₹ {(q.final_price || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-ink-muted">Date</div>
                  <div className="text-sm text-ink">{new Date(q.created_at).toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gold-light/40">
                <Link
                  to={`/quotations/${q.quote_id}`}
                  className="flex-1 min-w-[90px] text-center text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold"
                >
                  Preview
                </Link>
                <button
                  onClick={() => handlePdf(q.quote_id)}
                  className="flex-1 min-w-[90px] text-center text-xs uppercase tracking-widest px-3 py-2 border border-gold-light text-ink hover:border-gold"
                >
                  PDF
                </button>
                <div className="flex-1 min-w-[120px]">
                  <SendWhatsAppButton
                    quoteId={q.quote_id}
                    variant="card"
                    initialStatus={q.whatsapp_status}
                    onSent={reload}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
