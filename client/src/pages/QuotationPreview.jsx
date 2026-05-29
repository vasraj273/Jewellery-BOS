import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { quotationsApi, salesOrdersApi } from '../api/client.js';
import { openQuotationPdf } from '../api/pdfActions.js';
import SendWhatsAppButton from '../components/SendWhatsAppButton.jsx';

export default function QuotationPreview() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [converting, setConverting] = useState(false);

  async function handleConvert() {
    if (converting) return;
    setConverting(true);
    setError('');
    try {
      const so = await salesOrdersApi.fromQuote(quoteId, {});
      navigate(`/sales-orders/${so.id}`);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setError('');
    Promise.all([
      quotationsApi.get(quoteId),
      quotationsApi.previewHtml(quoteId)
    ])
      .then(([row, previewHtml]) => {
        if (cancelled) return;
        setQ(row);
        setHtml(previewHtml);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.error || e.message || 'Failed to load quotation');
      });
    return () => { cancelled = true; };
  }, [quoteId]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      await openQuotationPdf(quoteId, { action: 'download' });
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'PDF failed');
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <div className="card border-l-4 border-l-red-400 text-red-700 text-sm">
        {error}
      </div>
    );
  }
  if (!q) return <div className="text-ink-muted">Loading quotation…</div>;

  const reload = () => quotationsApi.get(quoteId).then(setQ).catch(() => {});

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-xl sm:text-2xl tracking-wider text-ink truncate">{q.quote_id}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1 sm:mt-2 truncate">{q.customer_name}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/quotations"
            className="btn-secondary flex-1 sm:flex-none justify-center min-w-[90px]"
          >
            ← Back
          </Link>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary flex-1 sm:flex-none justify-center min-w-[120px]"
          >
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            onClick={handleConvert}
            disabled={converting}
            className="btn-secondary flex-1 sm:flex-none justify-center min-w-[150px]"
          >
            {converting ? 'Converting…' : 'Convert to Order'}
          </button>
          <div className="flex-1 sm:flex-none min-w-[140px]">
            <SendWhatsAppButton
              quoteId={quoteId}
              variant="card"
              initialStatus={q.whatsapp_status}
              onSent={reload}
            />
          </div>
        </div>
      </header>

      <div className="card p-0 overflow-hidden bg-white">
        <iframe
          title="Quotation Preview"
          srcDoc={html}
          className="w-full block border-0"
          style={{ height: 'calc(100vh - 240px)', minHeight: '520px' }}
        />
      </div>
    </div>
  );
}
