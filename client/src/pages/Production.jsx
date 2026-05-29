import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productionApi } from '../api/client.js';
import { PageHeader, EmptyState, SkeletonRows } from '../components/ui.jsx';

const STAGES = ['design_approved', 'in_production', 'stone_setting', 'polishing', 'qc', 'ready', 'delivered'];

export default function Production() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: '', delayed: '' });

  useEffect(() => {
    setLoading(true);
    productionApi.list(filters).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [filters]);

  return (
    <div>
      <PageHeader title="Production" subtitle="Manufacturing pipeline" />

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Stage</label>
            <select className="input" value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
              <option value="">All</option>
              {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div><label className="label">Delayed only</label>
            <select className="input" value={filters.delayed} onChange={(e) => setFilters({ ...filters, delayed: e.target.value })}>
              <option value="">No</option>
              <option value="1">Yes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Job</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Assigned</th>
                <th className="px-4 py-3 text-left">Expected</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows rows={6} cols={7} />
               : rows.length === 0 ? <EmptyState colSpan={7} title="No production jobs" hint="Set a sales order to production to start a job." />
               : rows.map((j) => (
                <tr key={j.id} className={`border-b border-gold-light/20 transition-colors hover:bg-gold-pale/40 ${j.delayed ? 'bg-danger-bg/60' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs">{j.job_code}</td>
                  <td className="px-4 py-3 font-mono text-xs">{j.order_code}</td>
                  <td className="px-4 py-3">{j.product_name || '—'}<div className="text-[10px] text-ink-muted">{j.customer_name}</div></td>
                  <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-gold-light/50 rounded">{j.stage.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-ink-muted">{j.employee_name || j.karigar_name || '—'}</td>
                  <td className={`px-4 py-3 text-xs ${j.delayed ? 'text-red-600 font-medium' : 'text-ink-muted'}`}>{j.expected_date || '—'}{j.delayed ? ' · late' : ''}</td>
                  <td className="px-4 py-3 text-right"><Link to={`/sales-orders/${j.sales_order_id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
