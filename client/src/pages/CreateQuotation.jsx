import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quotationsApi, ratesApi, usersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import GoldRateWidget from '../components/GoldRateWidget.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

const INITIAL = {
  pricing_location: 'Mumbai',
  customer_name: '', customer_mobile: '', customer_email: '', occasion: '',
  product_name: '', product_category: 'Ring', product_description: '',
  metal_type: 'Gold', metal_color: 'Yellow', purity: '18Kt',
  gross_weight: 0, net_weight: 0,
  diamond_type: 'None', diamond_shape: '', diamond_carat: 0,
  diamond_clarity: '', diamond_color: '',
  gemstone: '', gemstone_carat: 0,
  hallmark: 'BIS Hallmarked', certification: '', setting_style: '',
  gold_rate_per_gram: 5850, diamond_rate_per_carat: 85000, gemstone_rate_per_carat: 0,
  making_charge_type: 'per_gram', making_charge_value: 1200,
  hallmark_charge: 250, certification_charge: 0, shipping_charge: 500,
  owner_user_id: null, sales_executive: '', notes: ''
};

// Mirror of server pricing.service.js — runs client-side for instant feedback.
function computePricing(input) {
  const n = (v) => (Number.isFinite(+v) && +v >= 0 ? +v : 0);
  const goldCost     = n(input.net_weight) * n(input.gold_rate_per_gram);
  const diamondCost  = n(input.diamond_carat) * n(input.diamond_rate_per_carat);
  const gemstoneCost = n(input.gemstone_carat) * n(input.gemstone_rate_per_carat);

  let making = 0;
  const mv = n(input.making_charge_value);
  if (input.making_charge_type === 'per_gram')        making = n(input.net_weight) * mv;
  else if (input.making_charge_type === 'fixed')      making = mv;
  else if (input.making_charge_type === 'percentage') making = (goldCost + diamondCost + gemstoneCost) * (mv / 100);

  const subtotal = goldCost + diamondCost + gemstoneCost + making
    + n(input.hallmark_charge) + n(input.certification_charge) + n(input.shipping_charge);

  const gstRate = 0.03;
  const gstAmount = subtotal * gstRate;
  const finalPrice = subtotal + gstAmount;

  return {
    gold_cost: round(goldCost), diamond_cost: round(diamondCost), gemstone_cost: round(gemstoneCost),
    making_charge: round(making), subtotal: round(subtotal),
    gst_rate: gstRate, gst_amount: round(gstAmount), final_price: round(finalPrice)
  };
}
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const inr = (n) => `₹ ${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function validate(form) {
  const errors = {};
  if (!form.customer_name?.trim()) errors.customer_name = 'Required';
  if (!form.product_category)      errors.product_category = 'Required';
  if (!form.purity)                errors.purity = 'Required';
  if (!(+form.net_weight > 0))     errors.net_weight = 'Must be > 0';

  for (const key of [
    'gross_weight', 'net_weight', 'diamond_carat', 'gemstone_carat',
    'gold_rate_per_gram', 'diamond_rate_per_carat', 'making_charge_value',
    'hallmark_charge', 'certification_charge', 'shipping_charge'
  ]) {
    if (form[key] !== '' && +form[key] < 0) errors[key] = 'Cannot be negative';
    if (form[key] !== '' && !Number.isFinite(+form[key])) errors[key] = 'Invalid number';
  }
  return errors;
}

export default function CreateQuotation() {
  const { user: me } = useAuth();
  const isAdminTier  = !!me && ADMIN_ROLES.includes(me.role);

  const [form, setForm] = useState(() => ({
    ...INITIAL,
    owner_user_id: me?.id ?? null,
    sales_executive: me?.full_name || ''
  }));
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [serverError, setServerError] = useState('');
  const [liveRates, setLiveRates] = useState({});  // { '18Kt': 5800, ... }
  const [assignees, setAssignees] = useState([]);   // admin tier only
  const navigate = useNavigate();

  // Admin tier can re-assign the owner; load active users for the dropdown.
  useEffect(() => {
    if (!isAdminTier) return;
    usersApi.list()
      .then((rows) => setAssignees(rows.filter((u) => u.is_active)))
      .catch(() => setAssignees([]));
  }, [isAdminTier]);

  function pickOwner(idStr) {
    const id = Number(idStr);
    const u = assignees.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      owner_user_id: id,
      sales_executive: u?.full_name || f.sales_executive
    }));
    setTouched((t) => ({ ...t, owner_user_id: true }));
  }

  const pricing = useMemo(() => computePricing(form), [form]);
  const errors  = useMemo(() => validate(form), [form]);
  const valid   = Object.keys(errors).length === 0;

  // Load live gold rates for selected location whenever location changes
  useEffect(() => {
    ratesApi.goldLatest(form.pricing_location).then((rows) => {
      const map = Object.fromEntries(rows.map((r) => [r.purity, Math.round(r.rate_per_gram)]));
      setLiveRates(map);
      if (map[form.purity]) setForm((f) => ({ ...f, gold_rate_per_gram: map[f.purity] }));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pricing_location]);

  // Re-pick rate when purity changes (within currently loaded location)
  useEffect(() => {
    if (liveRates[form.purity]) {
      setForm((f) => ({ ...f, gold_rate_per_gram: liveRates[f.purity] }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.purity]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
    setServerError('');
  }
  const errOf = (k) => (touched[k] && errors[k]) || '';

  async function openPreview() {
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    if (!valid) return;
    const html = await quotationsApi.previewDraft(form);
    setPreviewHtml(html);
  }

  async function save() {
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    if (!valid) return;
    setSaving(true);
    setServerError('');
    try {
      const saved = await quotationsApi.create(form);
      navigate(`/quotations/${saved.quote_id}`);
    } catch (e) {
      setServerError(e?.response?.data?.error || e.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Create Quotation</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">New Customer Proposal</p>
      </header>

      {serverError && (
        <div className="mb-4 px-4 py-3 border border-red-300 bg-red-50 text-red-700 text-sm">{serverError}</div>
      )}

      <div className="mb-6">
        <GoldRateWidget
          compact
          location={form.pricing_location}
          onLocationChange={(loc) => update('pricing_location', loc)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="order-1 lg:col-span-2 space-y-6">

          <Section title="Customer Details">
            <Grid>
              <Field label="Name *" error={errOf('customer_name')}>
                <input className={inputCls(errOf('customer_name'))} required value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} />
              </Field>
              <Field label="Mobile"><input className="input" value={form.customer_mobile} onChange={(e) => update('customer_mobile', e.target.value)} /></Field>
              <Field label="Email"><input className="input" type="email" value={form.customer_email} onChange={(e) => update('customer_email', e.target.value)} /></Field>
              <Field label="Occasion"><input className="input" value={form.occasion} onChange={(e) => update('occasion', e.target.value)} /></Field>
            </Grid>
          </Section>

          <Section title="Jewellery Details">
            <Grid>
              <Field label="Product Name"><input className="input" value={form.product_name} onChange={(e) => update('product_name', e.target.value)} /></Field>
              <Field label="Product Category *" error={errOf('product_category')}>
                <select className={inputCls(errOf('product_category'))} value={form.product_category} onChange={(e) => update('product_category', e.target.value)}>
                  {['Ring','Necklace','Bangle','Earring','Pendant','Bracelet'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Metal Type">
                <select className="input" value={form.metal_type} onChange={(e) => update('metal_type', e.target.value)}>
                  {['Gold','Platinum','Silver'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Metal Color">
                <select className="input" value={form.metal_color} onChange={(e) => update('metal_color', e.target.value)}>
                  {['Yellow','White','Rose'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Purity *" error={errOf('purity')}>
                <select className={inputCls(errOf('purity'))} value={form.purity} onChange={(e) => update('purity', e.target.value)}>
                  {['24Kt','22Kt','18Kt','14Kt'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Gross Weight (gm)" error={errOf('gross_weight')}>
                <input className={inputCls(errOf('gross_weight'))} type="number" min="0" step="0.001" value={form.gross_weight} onChange={(e) => update('gross_weight', +e.target.value)} />
              </Field>
              <Field label="Net Weight (gm) *" error={errOf('net_weight')}>
                <input className={inputCls(errOf('net_weight'))} type="number" min="0" step="0.001" value={form.net_weight} onChange={(e) => update('net_weight', +e.target.value)} />
              </Field>
              <Field label="Diamond Type">
                <select className="input" value={form.diamond_type} onChange={(e) => update('diamond_type', e.target.value)}>
                  {['None','Natural','Lab-Grown'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Diamond Shape"><input className="input" value={form.diamond_shape} onChange={(e) => update('diamond_shape', e.target.value)} /></Field>
              <Field label="Diamond Carat" error={errOf('diamond_carat')}>
                <input className={inputCls(errOf('diamond_carat'))} type="number" min="0" step="0.01" value={form.diamond_carat} onChange={(e) => update('diamond_carat', +e.target.value)} />
              </Field>
              <Field label="Diamond Clarity"><input className="input" value={form.diamond_clarity} onChange={(e) => update('diamond_clarity', e.target.value)} /></Field>
              <Field label="Diamond Color"><input className="input" value={form.diamond_color} onChange={(e) => update('diamond_color', e.target.value)} /></Field>
              <Field label="Gemstone"><input className="input" value={form.gemstone} onChange={(e) => update('gemstone', e.target.value)} /></Field>
              <Field label="Gemstone Carat" error={errOf('gemstone_carat')}>
                <input className={inputCls(errOf('gemstone_carat'))} type="number" min="0" step="0.01" value={form.gemstone_carat} onChange={(e) => update('gemstone_carat', +e.target.value)} />
              </Field>
              <Field label="Hallmark"><input className="input" value={form.hallmark} onChange={(e) => update('hallmark', e.target.value)} /></Field>
              <Field label="Certification"><input className="input" value={form.certification} onChange={(e) => update('certification', e.target.value)} /></Field>
              <Field label="Setting Style"><input className="input" value={form.setting_style} onChange={(e) => update('setting_style', e.target.value)} /></Field>
            </Grid>
          </Section>

          <Section title="Rates & Charges">
            <Grid>
              <Field label="Gold Rate / gm (₹)" error={errOf('gold_rate_per_gram')}>
                <input className={inputCls(errOf('gold_rate_per_gram'))} type="number" min="0" value={form.gold_rate_per_gram} onChange={(e) => update('gold_rate_per_gram', +e.target.value)} />
              </Field>
              <Field label="Diamond Rate / Ct (₹)" error={errOf('diamond_rate_per_carat')}>
                <input className={inputCls(errOf('diamond_rate_per_carat'))} type="number" min="0" value={form.diamond_rate_per_carat} onChange={(e) => update('diamond_rate_per_carat', +e.target.value)} />
              </Field>
              <Field label="Gemstone Rate / Ct (₹)">
                <input className="input" type="number" min="0" value={form.gemstone_rate_per_carat} onChange={(e) => update('gemstone_rate_per_carat', +e.target.value)} />
              </Field>
              <Field label="Making Type">
                <select className="input" value={form.making_charge_type} onChange={(e) => update('making_charge_type', e.target.value)}>
                  <option value="per_gram">Per Gram</option>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
              </Field>
              <Field label="Making Value" error={errOf('making_charge_value')}>
                <input className={inputCls(errOf('making_charge_value'))} type="number" min="0" value={form.making_charge_value} onChange={(e) => update('making_charge_value', +e.target.value)} />
              </Field>
              <Field label="Hallmark Charge (₹)" error={errOf('hallmark_charge')}>
                <input className={inputCls(errOf('hallmark_charge'))} type="number" min="0" value={form.hallmark_charge} onChange={(e) => update('hallmark_charge', +e.target.value)} />
              </Field>
              <Field label="Certification Charge (₹)" error={errOf('certification_charge')}>
                <input className={inputCls(errOf('certification_charge'))} type="number" min="0" value={form.certification_charge} onChange={(e) => update('certification_charge', +e.target.value)} />
              </Field>
              <Field label="Shipping Charge (₹)" error={errOf('shipping_charge')}>
                <input className={inputCls(errOf('shipping_charge'))} type="number" min="0" value={form.shipping_charge} onChange={(e) => update('shipping_charge', +e.target.value)} />
              </Field>
              {isAdminTier ? (
                <Field label="Quotation Owner">
                  <select
                    className="input"
                    value={form.owner_user_id ?? ''}
                    onChange={(e) => pickOwner(e.target.value)}
                  >
                    {/* Always include the actor as a fallback option in case the
                        users list is still loading. */}
                    {me && !assignees.some((u) => u.id === me.id) && (
                      <option value={me.id}>{me.full_name} (you)</option>
                    )}
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}{u.id === me?.id ? ' (you)' : ''} · {u.role.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-ink-muted mt-1">
                    Picks who is accountable for this quotation. Also printed as the Sales Executive on the PDF.
                  </div>
                </Field>
              ) : (
                <Field label="Sales Executive">
                  <input
                    className="input bg-off-white cursor-not-allowed"
                    value={me?.full_name || ''}
                    readOnly
                    disabled
                  />
                  <div className="text-[10px] text-ink-muted mt-1">
                    Locked to you — quotations are recorded under the signed-in executive.
                  </div>
                </Field>
              )}
            </Grid>
          </Section>

        </div>

        <aside className="order-2 lg:col-span-1">
          <div className="card border-l-4 border-l-gold lg:sticky lg:top-6">
            <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-1">Live Pricing</div>
            <h3 className="font-serif text-lg sm:text-xl text-ink mb-3 sm:mb-4">Auto-Calculated</h3>
            <Row k="Gold Cost"        v={inr(pricing.gold_cost)} />
            <Row k="Diamond Cost"     v={inr(pricing.diamond_cost)} />
            <Row k="Gemstone Cost"    v={inr(pricing.gemstone_cost)} />
            <Row k="Making Charge"    v={inr(pricing.making_charge)} />
            <Row k="Hallmark"         v={inr(form.hallmark_charge)} />
            <Row k="Certification"    v={inr(form.certification_charge)} />
            <Row k="Shipping"         v={inr(form.shipping_charge)} />
            <div className="border-t border-gold-light/40 my-3" />
            <Row k="Subtotal"         v={inr(pricing.subtotal)} bold />
            <Row k="GST @ 3%"         v={inr(pricing.gst_amount)} />
            <div className="bg-ink text-gold mt-4 px-4 py-3 flex justify-between items-end">
              <div>
                <div className="text-[8px] uppercase tracking-[2px] text-gold-light/60">Final Quoted Value</div>
                <div className="font-serif text-sm tracking-widest">Total Investment</div>
              </div>
              <div className="font-serif text-xl">{inr(pricing.final_price)}</div>
            </div>
          </div>
        </aside>

        {/* ─── Bottom action bar.
              Mobile: order-3 → sits after pricing aside (user sees final price first).
              Desktop: lg:order-2 + lg:col-span-2 → sits in row 2 under forms,
                       same right edge as Rates & Charges card. */}
        <div className="order-3 lg:col-span-2 lg:order-2 pt-4 sm:pt-6 border-t border-gold-light/40 flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            onClick={openPreview}
            disabled={!valid}
            className="btn-secondary w-full sm:w-auto sm:min-w-[160px] justify-center"
          >
            Preview
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="btn-primary w-full sm:w-auto sm:min-w-[160px] justify-center"
          >
            {saving ? 'Saving…' : 'Save Quotation'}
          </button>
        </div>
      </div>

      {previewHtml && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex flex-col">
          <div className="bg-ink text-gold px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap justify-between items-center gap-2">
            <div className="font-serif tracking-widest text-xs sm:text-sm">Quotation Preview · DRAFT</div>
            <div className="flex gap-2">
              <button onClick={() => setPreviewHtml('')} className="text-xs uppercase tracking-widest px-3 py-1 border border-gold hover:bg-black">Close</button>
              <button onClick={save} disabled={saving} className="text-xs uppercase tracking-widest px-3 py-1 bg-gold text-ink hover:bg-gold-light">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <iframe title="Preview" srcDoc={previewHtml} className="flex-1 w-full bg-white" />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) { return <div className="card"><h2 className="section-title">{title}</h2>{children}</div>; }
function Grid({ children }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
    </div>
  );
}
function Row({ k, v, bold }) {
  return (
    <div className={`flex justify-between text-sm py-1 ${bold ? 'font-semibold text-ink' : 'text-ink-mid'}`}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
const inputCls = (err) => `input ${err ? 'border-red-400' : ''}`;
