import { useEffect, useMemo, useState } from 'react';
import { ratesApi } from '../../api/client.js';

const PURITIES = ['24Kt', '22Kt', '18Kt', '14Kt'];

export default function GoldRatesAdmin() {
  const [config, setConfig]   = useState({ provider: '', markup_enabled: false, markup_pct: 0 });
  const [locations, setLocations] = useState([]);
  const [location, setLocation]   = useState('Mumbai');
  const [rates, setRates]     = useState([]);
  const [draft, setDraft]     = useState({ purity: '22Kt', rate_per_gram: '' });
  const [busy, setBusy]       = useState(false);
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    ratesApi.goldConfig().then(setConfig).catch(() => {});
    ratesApi.goldLocations().then((ls) => { setLocations(ls); if (ls[0]) setLocation((cur) => cur || ls[0]); }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [location]);
  function load() { ratesApi.goldLatest(location).then(setRates).catch(() => setRates([])); }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function refresh() {
    setBusy(true);
    try { await ratesApi.goldRefresh(); load(); flash('ok', 'Provider refresh complete'); }
    catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  async function applyOverride() {
    if (!(+draft.rate_per_gram > 0)) return flash('err', 'Rate must be > 0');
    setBusy(true);
    try {
      await ratesApi.goldManual({ location, purity: draft.purity, rate_per_gram: +draft.rate_per_gram, is_override: true });
      flash('ok', `Override set: ${location} ${draft.purity} = ₹${draft.rate_per_gram}/gm`);
      setDraft({ ...draft, rate_per_gram: '' });
      load();
    } catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  async function clearOverride(purity) {
    setBusy(true);
    try {
      await ratesApi.goldClearOverride({ location, purity });
      flash('ok', `Cleared override for ${location} ${purity} — using live rate`);
      load();
    } catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  const overrideCount = useMemo(() => rates.filter((r) => r.is_override).length, [rates]);

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Gold Rate Management</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">
            Provider: {config.provider || '—'} {config.markup_enabled ? `· +${config.markup_pct}% India Adjustment` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="input sm:w-auto" value={location} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={refresh} disabled={busy} className="btn-secondary">{busy ? '…' : 'Refresh Provider'}</button>
        </div>
      </header>

      {toast && (
        <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok'
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>
      )}

      <div className="card mb-4">
        <h3 className="section-title">Current Working Rates · {location}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {rates.length === 0 ? (
            <div className="col-span-full text-ink-muted text-sm">No rates loaded — click Refresh Provider.</div>
          ) : rates.map((r) => (
            <div key={r.purity} className={`border px-3 py-3 ${r.is_override ? 'bg-gold-pale border-gold' : 'bg-off-white border-gold-light/40'}`}>
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">{r.purity}</div>
                {r.is_override && (
                  <button onClick={() => clearOverride(r.purity)} disabled={busy} className="text-[9px] uppercase tracking-widest text-gold-dark hover:text-gold">
                    Clear
                  </button>
                )}
              </div>
              <div className="font-serif text-lg text-ink">₹{Math.round(r.rate_per_gram).toLocaleString('en-IN')}/gm</div>
              <div className="text-[10px] text-ink-muted mt-1">
                {r.is_override ? 'manual override' : r.source}
              </div>
            </div>
          ))}
        </div>
        {overrideCount > 0 && (
          <p className="text-[11px] text-gold-dark mt-3">{overrideCount} active override(s) in {location}. These survive provider refreshes.</p>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Set Manual Override</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Location">
            <input className="input bg-off-white cursor-not-allowed" value={location} readOnly />
          </Field>
          <Field label="Purity">
            <select className="input" value={draft.purity} onChange={(e) => setDraft({ ...draft, purity: e.target.value })}>
              {PURITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Rate per gram (₹)">
            <input className="input" type="number" min="0" value={draft.rate_per_gram} onChange={(e) => setDraft({ ...draft, rate_per_gram: e.target.value })} placeholder="e.g. 14000" />
          </Field>
          <button onClick={applyOverride} disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Apply Override'}</button>
        </div>
        <p className="text-[11px] text-ink-muted mt-3">
          Overrides override the provider rate for the selected location/purity until you clear them.
          Frozen quotation snapshots are unaffected — only new quotations pick up the override.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
