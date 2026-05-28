import { useEffect, useState } from 'react';
import { hrCalendarApi } from '../api/client.js';

const TYPE_STYLE = {
  leave:            'bg-gold-pale text-gold-dark border-gold-light',
  birthday:         'bg-pink-50 text-pink-700 border-pink-200',
  anniversary:      'bg-blue-50 text-blue-700 border-blue-200',
  pending_approval: 'bg-red-50 text-red-700 border-red-300',
  followup:         'bg-green-50 text-green-700 border-green-300',
  task:             'bg-off-white text-ink-mid border-gold-light/60'
};

export default function HRCalendar() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ events: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    hrCalendarApi.month(month).then(setData).catch(() => setData({ events: [] })).finally(() => setLoading(false));
  }, [month]);

  // Group events by date.
  const byDate = {};
  for (const e of data.events) (byDate[e.date] ||= []).push(e);
  const dates = Object.keys(byDate).sort();

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">HR Calendar</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{loading ? 'Loading…' : `${data.events.length} events`}</p>
        </div>
        <input className="input sm:w-auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </header>

      {dates.length === 0 ? (
        <div className="card text-center text-ink-muted">No events this month.</div>
      ) : (
        <div className="space-y-3">
          {dates.map((d) => (
            <div key={d} className="card">
              <div className="text-[11px] uppercase tracking-widest text-gold-dark mb-2">
                {new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>
              <ul className="space-y-2">
                {byDate[d].map((e, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <span className={`text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${TYPE_STYLE[e.type] || ''}`}>{e.type.replace('_', ' ')}</span>
                    <span className="text-ink">{e.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
