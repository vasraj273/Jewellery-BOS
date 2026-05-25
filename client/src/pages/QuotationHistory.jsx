import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { quotationsApi } from '../api/client.js';

const STATUS_STYLES = {
  draft:    'bg-gold-pale text-gold-dark border-gold-light',
  sent:     'bg-ink text-gold border-gold',
  accepted: 'bg-green-50 text-green-700 border-green-300',
  expired:  'bg-red-50 text-red-700 border-red-300'
};

export default function QuotationHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { reload(); }, []);
  function reload() {
    setLoading(true);
    quotationsApi.list().then(setRows).finally(() => setLoading(false));
  }

  return (
    <div>
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-serif text-3xl tracking-wider text-ink">Quotation History</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">All Saved Proposals</p>
        </div>
        <Link to="/quotations/new" className="btn-primary">+ New Quotation</Link>
      </header>

      <div className="card p-0 overflow-hidden">
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
              <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No quotations yet.</td></tr>
            ) : rows.map((q, i) => {
              const cls = STATUS_STYLES[q.status] || STATUS_STYLES.draft;
              return (
                <tr key={q.quote_id} className={i % 2 ? 'bg-off-white' : ''}>
                  <td className="px-4 py-3 font-medium">{q.quote_id}</td>
                  <td className="px-4 py-3">{q.customer_name}</td>
                  <td className="px-4 py-3 text-ink-mid">{q.product_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">₹ {(q.final_price || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${cls}`}>{q.status || 'draft'}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link to={`/quotations/${q.quote_id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Preview</Link>
                    <a href={quotationsApi.pdfUrl(q.quote_id)} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">PDF</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
