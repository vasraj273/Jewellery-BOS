import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesOrdersApi } from '../api/client.js';
import { PageHeader, StatusBadge, EmptyState, SkeletonRows } from '../components/ui.jsx';

const STATUSES = ['draft', 'confirmed', 'production', 'ready', 'delivered', 'cancelled'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

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
      <PageHeader title="Sales Orders" subtitle="Confirmed orders & fulfilment" />

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
              {loading ? <SkeletonRows rows={6} cols={7} />
               : rows.length === 0 ? <EmptyState colSpan={7} title="No sales orders" hint="Convert a quotation to create one." />
               : rows.map((o) => (
                <tr key={o.id} className="border-b border-gold-light/20 transition-colors hover:bg-gold-pale/40">
                  <td className="px-4 py-3 font-mono text-xs">{o.order_code}</td>
                  <td className="px-4 py-3">{o.customer_name || '—'}<div className="text-[10px] text-ink-muted">{o.customer_mobile || ''}</div></td>
                  <td className="px-4 py-3 text-ink-muted">{o.product_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(o.total_amount)}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{o.expected_delivery || '—'}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={o.status} /></td>
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
