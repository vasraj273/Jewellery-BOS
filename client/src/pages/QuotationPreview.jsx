import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quotationsApi } from '../api/client.js';
import SendWhatsAppButton from '../components/SendWhatsAppButton.jsx';

export default function QuotationPreview() {
  const { quoteId } = useParams();
  const [q, setQ] = useState(null);

  useEffect(() => {
    quotationsApi.get(quoteId).then(setQ).catch(() => setQ(null));
  }, [quoteId]);

  if (!q) return <div className="text-ink-muted">Loading quotation…</div>;

  const reload = () => quotationsApi.get(quoteId).then(setQ).catch(() => {});

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-xl sm:text-2xl tracking-wider text-ink truncate">{q.quote_id}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1 sm:mt-2 truncate">{q.customer_name}</p>
        </div>

        {/* Action bar — wraps cleanly, all 3 buttons always visible. */}
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/quotations"
            className="btn-secondary flex-1 sm:flex-none justify-center min-w-[90px]"
          >
            ← Back
          </Link>
          <a
            href={quotationsApi.pdfUrl(quoteId)}
            className="btn-primary flex-1 sm:flex-none justify-center min-w-[90px]"
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
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
          src={quotationsApi.previewUrl(quoteId)}
          className="w-full block border-0"
          style={{ height: 'calc(100vh - 240px)', minHeight: '520px' }}
        />
      </div>
    </div>
  );
}
