import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi, suppliersApi, mastersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader, StatusBadge, EmptyState, SkeletonRows } from '../components/ui.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const STATUSES = ['in_stock', 'reserved', 'sold', 'repair', 'custom_order', 'archived'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const EMPTY = {
  name: '', category: '', metal_type: 'Gold', purity: '22Kt', design_code: '',
  gross_weight: 0, net_weight: 0, diamond_type: 'None', diamond_carat: 0,
  gemstone: '', gemstone_carat: 0, location: 'Mumbai',
  purchase_cost: 0, stone_value: 0, making_cost: 0, supplier_id: '', notes: ''
};

export default function Inventory() {
  const { user: me } = useAuth();
  const isAdmin = !!me && ADMIN_ROLES.includes(me.role);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({ status: '', category: '', search: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  useEffect(() => {
    mastersApi.list('product_categories').then((r) => setCats(r.map((x) => x.label))).catch(() => setCats([]));
    if (isAdmin) {
      suppliersApi.list().then(setSuppliers).catch(() => setSuppliers([]));
      inventoryApi.summary().then(setSummary).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      inventoryApi.list(filters).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [filters]);

  function reload() {
    inventoryApi.list(filters).then(setItems).catch(() => {});
    if (isAdmin) inventoryApi.summary().then(setSummary).catch(() => {});
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return flash('err', 'Item name required');
    setBusy(true);
    try {
      await inventoryApi.create({ ...form, supplier_id: form.supplier_id || null });
      flash('ok', 'Item added to stock');
      setForm(EMPTY); setShowForm(false); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  const total = useMemo(() => summary?.by_status || {}, [summary]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock & Valuation"
        actions={isAdmin && <button onClick={() => setShowForm((s) => !s)} className="btn-primary">{showForm ? 'Close' : '+ New Item'}</button>}
      />

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {isAdmin && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <Stat label="In Stock" value={total.in_stock || 0} />
          <Stat label="Reserved" value={total.reserved || 0} highlight={(total.reserved || 0) > 0} />
          <Stat label="Stock Value" value={inr(summary.stock_market_value)} hint={`Cost ${inr(summary.stock_cost_value)}`} />
          <Stat label="Potential Margin" value={inr(summary.potential_margin)} />
        </div>
      )}

      {isAdmin && showForm && (
        <div className="card mb-6">
          <h2 className="section-title">Add Stock Item</h2>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <F label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="Category">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">—</option>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            </F>
            <F label="Design Code"><input className="input" value={form.design_code} onChange={(e) => setForm({ ...form, design_code: e.target.value })} /></F>
            <F label="Metal"><input className="input" value={form.metal_type} onChange={(e) => setForm({ ...form, metal_type: e.target.value })} /></F>
            <F label="Purity"><input className="input" value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} /></F>
            <F label="Location"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></F>
            <F label="Gross Wt (gm)"><input className="input" type="number" min="0" step="0.001" value={form.gross_weight} onChange={(e) => setForm({ ...form, gross_weight: +e.target.value })} /></F>
            <F label="Net Wt (gm)"><input className="input" type="number" min="0" step="0.001" value={form.net_weight} onChange={(e) => setForm({ ...form, net_weight: +e.target.value })} /></F>
            <F label="Diamond Carat"><input className="input" type="number" min="0" step="0.01" value={form.diamond_carat} onChange={(e) => setForm({ ...form, diamond_carat: +e.target.value })} /></F>
            <F label="Purchase Cost (₹)"><input className="input" type="number" min="0" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: +e.target.value })} /></F>
            <F label="Stone Value (₹)"><input className="input" type="number" min="0" value={form.stone_value} onChange={(e) => setForm({ ...form, stone_value: +e.target.value })} /></F>
            <F label="Making Cost (₹)"><input className="input" type="number" min="0" value={form.making_cost} onChange={(e) => setForm({ ...form, making_cost: +e.target.value })} /></F>
            <F label="Supplier">
              <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </F>
            <F label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
            <div className="flex items-end"><button type="submit" disabled={busy} className="btn-primary w-full justify-center">{busy ? '…' : 'Add to Stock'}</button></div>
          </form>
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <F label="Search"><input className="input" placeholder="SKU / name / design" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></F>
          <F label="Status">
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </F>
          <F label="Category">
            <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All</option>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </F>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Net Wt</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows rows={6} cols={7} />
               : items.length === 0 ? <EmptyState colSpan={7} title="No items" hint="Add stock or record a purchase to populate inventory." />
               : items.map((it) => (
                <tr key={it.id} className="border-b border-gold-light/20 transition-colors hover:bg-gold-pale/40">
                  <td className="px-4 py-3 font-mono text-xs">{it.sku}</td>
                  <td className="px-4 py-3">{it.name}<div className="text-[10px] text-ink-muted">{it.metal_type} {it.purity}{it.design_code ? ` · ${it.design_code}` : ''}</div></td>
                  <td className="px-4 py-3 text-ink-muted">{it.category || '—'}</td>
                  <td className="px-4 py-3 text-right">{Number(it.net_weight || 0).toFixed(2)}g</td>
                  <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(it.valuation?.market_value)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={it.status} /></td>
                  <td className="px-4 py-3 text-right"><Link to={`/inventory/${it.id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, highlight }) {
  return (
    <div className={`card border-l-4 ${highlight ? 'border-l-amber-400' : 'border-l-gold'}`}>
      <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">{label}</div>
      <div className={`font-serif text-2xl sm:text-3xl ${highlight ? 'text-amber-600' : 'text-ink'}`}>{value}</div>
      {hint && <div className="text-[10px] text-ink-muted mt-1">{hint}</div>}
    </div>
  );
}
function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
