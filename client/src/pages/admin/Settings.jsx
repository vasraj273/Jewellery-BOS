import { useEffect, useState } from 'react';
import { settingsApi } from '../../api/client.js';

const TABS = [
  { key: 'business',  label: 'Business' },
  { key: 'quotation', label: 'Quotation Defaults' },
  { key: 'pricing',   label: 'Pricing' }
];

export default function SettingsAdmin() {
  const [tab, setTab] = useState('business');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { settingsApi.get().then(setData).finally(() => setLoading(false)); }, []);

  function set(field, value) { setData((d) => ({ ...d, [field]: value })); }

  async function save() {
    setSaving(true);
    try {
      const updated = await settingsApi.update(data);
      setData(updated);
      flash('ok', 'Settings saved');
    } catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setSaving(false); }
  }

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  if (loading) return <div className="text-ink-muted">Loading settings…</div>;
  if (!data)   return <div className="text-red-600">Failed to load settings.</div>;

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Company Settings</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Single source of truth · Quotation branding</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary self-start sm:self-auto">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </header>

      {toast && (
        <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok'
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>
      )}

      <div className="flex flex-wrap gap-1 mb-4 border-b border-gold-light/40">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs uppercase tracking-widest border-b-2 transition ${tab === t.key
              ? 'border-gold text-gold-dark'
              : 'border-transparent text-ink-muted hover:text-gold'}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'business'  && <BusinessTab  data={data} set={set} />}
      {tab === 'quotation' && <QuotationTab data={data} set={set} />}
      {tab === 'pricing'   && <PricingTab   data={data} set={set} />}
    </div>
  );
}

function BusinessTab({ data, set }) {
  return (
    <div className="card space-y-4">
      <h2 className="section-title">Business Identity</h2>
      <Grid>
        <Field label="Company Name"><input className="input" value={data.company_name || ''} onChange={(e) => set('company_name', e.target.value)} /></Field>
        <Field label="Tagline"><input className="input" value={data.company_tagline || ''} onChange={(e) => set('company_tagline', e.target.value)} /></Field>
        <Field label="Address (HTML <br> supported)"><textarea className="input min-h-[80px]" value={data.company_address || ''} onChange={(e) => set('company_address', e.target.value)} /></Field>
        <Field label="Contact (phone · email)"><input className="input" value={data.company_contact || ''} onChange={(e) => set('company_contact', e.target.value)} /></Field>
        <Field label="Website / Socials"><input className="input" value={data.company_web || ''} onChange={(e) => set('company_web', e.target.value)} /></Field>
        <Field label="GSTIN line (printed)"><input className="input" value={data.company_gstin || ''} onChange={(e) => set('company_gstin', e.target.value)} /></Field>
        <Field label="Logo URL (optional)"><input className="input" value={data.company_logo_url || ''} onChange={(e) => set('company_logo_url', e.target.value)} /></Field>
      </Grid>
    </div>
  );
}

function QuotationTab({ data, set }) {
  return (
    <div className="card space-y-4">
      <h2 className="section-title">Quotation Defaults</h2>
      <Grid>
        <Field label="Footer Tagline"><input className="input" value={data.quotation_footer || ''} onChange={(e) => set('quotation_footer', e.target.value)} /></Field>
        <Field label="Validity (days)"><input className="input" type="number" min="1" value={data.quotation_validity_days || 30} onChange={(e) => set('quotation_validity_days', +e.target.value)} /></Field>
        <Field label="Default WhatsApp Message" full>
          <textarea className="input min-h-[80px]" value={data.whatsapp_default_message || ''} onChange={(e) => set('whatsapp_default_message', e.target.value)} placeholder="Optional fallback message (template body still wins for sends)" />
        </Field>
        <Field label="Terms (printed on PDF)" full>
          <textarea className="input min-h-[120px]" value={data.quotation_terms || ''} onChange={(e) => set('quotation_terms', e.target.value)} placeholder="One clause per line" />
        </Field>
      </Grid>
    </div>
  );
}

function PricingTab({ data, set }) {
  return (
    <div className="card space-y-4">
      <h2 className="section-title">Pricing Defaults</h2>
      <Grid>
        <Field label="Default Pricing Location"><input className="input" value={data.default_pricing_location || ''} onChange={(e) => set('default_pricing_location', e.target.value)} /></Field>
        <Field label="Default Markup % (India retail)"><input className="input" type="number" min="0" step="0.5" value={data.default_markup_pct ?? 18} onChange={(e) => set('default_markup_pct', +e.target.value)} /></Field>
      </Grid>
      <p className="text-[11px] text-ink-muted mt-2">
        Markup % is the India retail adjustment layered on top of the international goldapi spot rate.
        Live pricing always reads this value at the time of refresh.
      </p>
    </div>
  );
}

function Grid({ children }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, full, children }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
