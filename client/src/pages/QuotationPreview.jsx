import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quotationsApi } from '../api/client.js';

export default function QuotationPreview() {
  const { quoteId } = useParams();
  const [q, setQ] = useState(null);

  useEffect(() => {
    quotationsApi.get(quoteId).then(setQ).catch(() => setQ(null));
  }, [quoteId]);

  if (!q) return <div className="text-ink-muted">Loading quotation…</div>;

  return (
    <div>
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-serif text-2xl tracking-wider text-ink">{q.quote_id}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{q.customer_name}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/quotations" className="btn-secondary">← Back</Link>
          <a href={quotationsApi.pdfUrl(quoteId)} className="btn-primary" target="_blank" rel="noreferrer">Download PDF</a>
        </div>
      </header>

      <div className="card p-0 overflow-hidden bg-white">
        <iframe
          title="Quotation Preview"
          src={quotationsApi.previewUrl(quoteId)}
          className="w-full"
          style={{ height: '1100px', border: 'none' }}
        />
      </div>
    </div>
  );
}
