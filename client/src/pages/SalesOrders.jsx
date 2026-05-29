import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesOrdersApi } from '../api/client.js';

const STATUSES = ['draft', 'confirmed', 'production', 'ready', 'delivered', 'cancelled'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const STATUS_STYLE = {
  draft:      'bg-gray-100 text-gray-600 border-gray-300',
  confirmed:  'bg-blue-50 text-blue-700 border-blue-300',
  production: 'bg-amber-50 text-amber-700 border-amber-300',
  ready:      'bg-purple-50 text-purple-700 border-purple-300',
  delivered:  'bg-green-50 text-green-700 border-green-300',
  cancelled:  'bg-red-50 text-red-600 border-red-300'
};

export default function SalesOrders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      salesOrdersApi.list(filters).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [filters]);

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Sales Orders</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Confirmed orders &amp; fulfilment</p>
      </header>

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Search</label><input className="input" placeholder="order / customer / mobile" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Delivery</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
               : rows.length === 0 ? <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No sales orders. Convert a quotation to create one.</td></tr>
               : rows.map((o, i) => (
                <tr key={o.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs">{o.order_code}</td>
                  <td className="px-4 py-3">{o.customer_name || '—'}<div className="text-[10px] text-ink-muted">{o.customer_mobile || ''}</div></td>
                  <td className="px-4 py-3 text-ink-muted">{o.product_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(o.total_amount)}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{o.expected_delivery || '—'}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded ${STATUS_STYLE[o.status] || ''}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-right"><Link to={`/sales-orders/${o.id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
