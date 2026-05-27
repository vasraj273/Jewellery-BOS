import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { quotationsApi } from '../api/client.js';
import { openQuotationPdf } from '../api/pdfActions.js';
import SendWhatsAppButton from '../components/SendWhatsAppButton.jsx';

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

  function handlePdf(quoteId) {
    // Fetched through axios so the JWT goes with it; opened in a new tab via
    // blob URL. Plain <a href> bypasses our axios interceptor.
    openQuotationPdf(quoteId).catch(() => {});
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Quotation History</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">All Saved Proposals</p>
        </div>
        <Link to="/quotations/new" className="btn-primary self-start sm:self-auto">+ New Quotation</Link>
      </header>

      {/* ─── Desktop / tablet table (lg+) ─── */}
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
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link to={`/quotations/${q.quote_id}`} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Preview</Link>
                    <button
                      onClick={() => handlePdf(q.quote_id)}
                      className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold"
                    >
                      PDF
                    </button>
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
          <div className="card text-center text-ink-muted">No quotations yet.</div>
        ) : rows.map((q) => {
          const cls = STATUS_STYLES[q.status] || STATUS_STYLES.draft;
          return (
            <div key={q.quote_id} className="card border-l-4 border-l-gold">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-serif text-base text-ink truncate">{q.quote_id}</div>
                  <div className="text-sm text-ink-mid truncate">{q.customer_name || '—'}</div>
                  {q.product_name && <div className="text-xs text-ink-muted truncate mt-0.5">{q.product_name}</div>}
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
