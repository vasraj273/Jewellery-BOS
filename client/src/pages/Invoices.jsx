import { useEffect, useState } from 'react';
import { invoicesApi } from '../api/client.js';
import { PageHeader, StatusBadge, EmptyState, SkeletonRows } from '../components/ui.jsx';

const STATUSES = ['issued', 'partial', 'paid', 'cancelled'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { invoicesApi.list(filters).then(setRows).catch(() => setRows([])).finally(() => setLoading(false)); }, 250);
    return () => clearTimeout(t);
  }, [filters]);

  async function openPdf(id) {
    setBusyId(id);
    try {
      const blob = await invoicesApi.pdfBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { /* ignore */ }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Bills & tax invoices" />
      <div className="card mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Search</label><input className="input" placeholder="invoice / customer" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
        <div><label className="label">Status</label><select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest"><tr><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right"></th></tr></thead>
          <tbody>
            {loading ? <SkeletonRows rows={6} cols={7} />
             : rows.length === 0 ? <EmptyState colSpan={7} title="No invoices" hint="Generate an invoice from a sales order." />
             : rows.map((v) => (
              <tr key={v.id} className="border-b border-gold-light/20 hover:bg-gold-pale/40">
                <td className="px-4 py-3 font-mono text-xs">{v.invoice_code}</td>
                <td className="px-4 py-3">{v.customer_name || '—'}<div className="text-[10px] text-ink-muted">{v.product_name || ''}</div></td>
                <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(v.total_amount)}</td>
                <td className="px-4 py-3 text-right text-success">{inr(v.paid_amount)}</td>
                <td className={`px-4 py-3 text-right ${Number(v.balance_amount) > 0 ? 'text-danger font-medium' : 'text-ink-muted'}`}>{inr(v.balance_amount)}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3 text-right"><button onClick={() => openPdf(v.id)} disabled={busyId === v.id} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">{busyId === v.id ? '…' : 'PDF'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
