import { useEffect, useState } from 'react';
import { ratesApi } from '../api/client.js';

/**
 * Location-aware live gold rate widget.
 *
 * Props:
 *   location          — controlled selected location (string)
 *   onLocationChange  — optional callback when user changes location
 *   compact           — denser layout
 */
export default function GoldRateWidget({ location: controlledLoc, onLocationChange, compact = false }) {
  const [locations, setLocations] = useState([]);
  const [location, setLocation]   = useState(controlledLoc || 'Mumbai');
  const [rates, setRates]         = useState([]);
  const [config, setConfig]       = useState({ provider: '', markup_enabled: false, markup_pct: 0 });
  const [busy, setBusy]           = useState(false);

  useEffect(() => { ratesApi.goldLocations().then(setLocations).catch(() => setLocations(['Mumbai'])); }, []);
  useEffect(() => { ratesApi.goldConfig().then(setConfig).catch(() => {}); }, []);
  useEffect(() => { if (controlledLoc && controlledLoc !== location) setLocation(controlledLoc); }, [controlledLoc]);
  useEffect(() => { load(); }, [location]);

  function load() { ratesApi.goldLatest(location).then(setRates).catch(() => setRates([])); }

  function pick(loc) {
    setLocation(loc);
    onLocationChange?.(loc);
  }

  async function refresh() {
    setBusy(true);
    try { await ratesApi.goldRefresh(); load(); } finally { setBusy(false); }
  }

  const lastUpdated = rates.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), '');
  const hasOverride = rates.some((r) => r.is_override);

  return (
    <div className={`card border-l-4 border-l-gold ${compact ? 'p-4' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[2.5px] text-gold">Live Gold Rate</div>
          <div className="text-[10px] text-ink-muted mt-1 break-words">
            {lastUpdated ? `Last updated: ${formatStamp(lastUpdated)}` : 'No data yet'}
            {hasOverride && <span className="ml-2 text-gold-dark">· Manual override active</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={location}
            onChange={(e) => pick(e.target.value)}
            className="flex-1 sm:flex-none text-xs px-2 py-1 bg-white border border-gold-light/60 text-ink focus:outline-none focus:border-gold"
          >
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={refresh} disabled={busy} className="text-[10px] uppercase tracking-widest text-gold-dark hover:text-gold disabled:opacity-50 px-2 py-1 border border-gold-light/40 sm:border-0">
            {busy ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {rates.length === 0 ? (
        <div className="text-xs text-ink-muted">No rates for {location}.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {rates.map((r) => {
              const isAdj = config.markup_enabled && !r.is_override && /markup/.test(r.source);
              const spot = isAdj ? Math.round(r.rate_per_gram / (1 + config.markup_pct / 100)) : null;
              return (
                <div key={r.purity} className={`border px-2 py-2 text-center ${r.is_override ? 'bg-gold-pale border-gold' : 'bg-off-white border-gold-light/40'}`}>
                  <div className="text-[9px] uppercase tracking-widest text-ink-muted">{r.purity}</div>
                  {spot !== null && (
                    <div className="text-[8px] text-ink-muted line-through">₹{spot.toLocaleString('en-IN')}</div>
                  )}
                  <div className="font-serif text-sm text-ink mt-0.5">₹{Math.round(r.rate_per_gram).toLocaleString('en-IN')}</div>
                  <div className="text-[8px] text-ink-muted mt-0.5">/gm · {r.is_override ? 'override' : r.source}</div>
                </div>
              );
            })}
          </div>

          {config.markup_enabled && (
            <div className="mt-3 px-3 py-2 bg-ink/5 border border-gold-light/40 flex flex-wrap justify-between items-center gap-2 text-[10px] uppercase tracking-widest text-ink-muted">
              <span>Provider: <b className="text-ink">{config.provider}</b></span>
              <span>India Adjustment: <b className="text-gold-dark">+{config.markup_pct}%</b></span>
              <span className="hidden sm:inline">= Final Working Rate</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatStamp(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
