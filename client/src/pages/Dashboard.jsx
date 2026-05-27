import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { quotationsApi } from '../api/client.js';
import GoldRateWidget from '../components/GoldRateWidget.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, recent: [] });

  useEffect(() => {
    quotationsApi.list()
      .then((rows) => setStats({ total: rows.length, recent: rows.slice(0, 5) }))
      .catch(() => setStats({ total: 0, recent: [] }));
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 lg:mb-10">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Dashboard</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">JBOS Overview</p>
        </div>
        <Link to="/quotations/new" className="btn-primary self-start sm:self-auto">+ New Quotation</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <StatCard label="Total Quotations" value={stats.total} />
        <StatCard label="Module" value="Quotation" />
        <StatCard label="Version" value="V1.0" />
      </div>

      <div className="mb-10">
        <GoldRateWidget />
      </div>

      <div className="card">
        <h2 className="section-title">Recent Quotations</h2>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-ink-muted">No quotations yet. Create your first one.</p>
        ) : (
          <ul className="divide-y divide-gold-light/40">
            {stats.recent.map((q) => (
              <li key={q.quote_id} className="py-3 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{q.quote_id} · {q.customer_name}</div>
                  <div className="text-xs text-ink-muted truncate">{q.product_name || '—'}</div>
                </div>
                <Link to={`/quotations/${q.quote_id}`} className="shrink-0 text-xs uppercase tracking-widest text-gold-dark hover:text-gold">
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card border-l-4 border-l-gold">
      <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">{label}</div>
      <div className="font-serif text-3xl text-ink">{value}</div>
    </div>
  );
}
