import { useState } from 'react';
import { leadsApi } from '../api/client.js';

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' }
];

// Convert an ISO/Date value to the yyyy-MM-ddTHH:mm string a datetime-local wants.
function toLocalInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Create or edit a lead.
 *   mode: 'create' | 'edit'
 *   lead: existing row (edit mode)
 * Sales executives get a locked, read-only Assigned Executive showing their
 * own name; admins get a dropdown. Backend enforces the same rule.
 */
export default function LeadFormModal({ mode = 'create', lead, sources, statuses, executives, isAdminTier, me, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name:             lead?.name || '',
    mobile:           lead?.mobile || '',
    email:            lead?.email || '',
    occasion:         lead?.occasion || '',
    budget:           lead?.budget ?? '',
    source_id:        lead?.source_id || '',
    status_id:        lead?.status_id || (statuses?.[0]?.id ?? ''),
    priority:         lead?.priority || 'medium',
    assigned_user_id: lead?.assigned_user_id || me?.id || '',
    next_followup_at: toLocalInput(lead?.next_followup_at),
    notes:            lead?.notes || ''
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) { setError('Name and mobile are required'); return; }
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        budget: form.budget === '' ? null : Number(form.budget),
        next_followup_at: form.next_followup_at ? new Date(form.next_followup_at).toISOString() : null
      };
      // Sales execs don't send assigned_user_id (backend locks to self anyway).
      if (!isAdminTier) delete payload.assigned_user_id;

      const saved = mode === 'create'
        ? await leadsApi.create(payload)
        : await leadsApi.update(lead.id, payload);
      onSaved(saved);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Save failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl card border-l-4 border-l-gold my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg sm:text-xl text-ink">{mode === 'create' ? 'New Lead' : `Edit · ${lead.lead_code}`}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        {error && <div className="mb-4 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-5">
          <Section title="Customer">
            <Grid>
              <Field label="Name *"><input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Mobile *"><input className="input" required value={form.mobile} onChange={(e) => set('mobile', e.target.value)} /></Field>
              <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Occasion"><input className="input" value={form.occasion} onChange={(e) => set('occasion', e.target.value)} /></Field>
            </Grid>
          </Section>

          <Section title="Sales">
            <Grid>
              <Field label="Budget (₹)"><input className="input" type="number" min="0" value={form.budget} onChange={(e) => set('budget', e.target.value)} /></Field>
              <Field label="Source">
                <select className="input" value={form.source_id} onChange={(e) => set('source_id', e.target.value)}>
                  <option value="">Select…</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input" value={form.status_id} onChange={(e) => set('status_id', e.target.value)}>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Assigned Executive">
                {isAdminTier ? (
                  <select className="input" value={form.assigned_user_id} onChange={(e) => set('assigned_user_id', e.target.value)}>
                    {executives.map((u) => <option key={u.id} value={u.id}>{u.full_name}{u.id === me?.id ? ' (you)' : ''}</option>)}
                  </select>
                ) : (
                  <>
                    <input className="input bg-off-white cursor-not-allowed" value={me?.full_name || ''} readOnly disabled />
                    <div className="text-[10px] text-ink-muted mt-1">Locked to you.</div>
                  </>
                )}
              </Field>
              <Field label="Next Followup">
                <input className="input" type="datetime-local" value={form.next_followup_at} onChange={(e) => set('next_followup_at', e.target.value)} />
              </Field>
            </Grid>
          </Section>

          <Section title="Notes">
            <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Remarks…" />
          </Section>

          <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : (mode === 'create' ? 'Create Lead' : 'Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
