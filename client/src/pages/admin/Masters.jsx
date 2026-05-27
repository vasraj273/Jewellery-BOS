import { useEffect, useState } from 'react';
import { mastersApi } from '../../api/client.js';

const TYPES = [
  { key: 'product_categories', label: 'Product Categories' },
  { key: 'metal_types',        label: 'Metal Types' },
  { key: 'purities',           label: 'Purities' },
  { key: 'diamond_types',      label: 'Diamond Types' },
  { key: 'cities',             label: 'Cities' },
  { key: 'making_presets',     label: 'Making Presets' }
];

const CHARGE_TYPES = [
  { value: 'per_gram',   label: 'Per Gram (₹/gm)' },
  { value: 'fixed',      label: 'Fixed (₹)' },
  { value: 'percentage', label: 'Percentage (%)' }
];

export default function MastersAdmin() {
  const [type, setType] = useState(TYPES[0].key);
  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Master Data</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Admin-editable dropdown catalogs</p>
      </header>

      <div className="flex flex-wrap gap-1 mb-4 border-b border-gold-light/40 overflow-x-auto">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-xs uppercase tracking-widest border-b-2 transition ${type === t.key
              ? 'border-gold text-gold-dark'
              : 'border-transparent text-ink-muted hover:text-gold'}`}
          >{t.label}</button>
        ))}
      </div>

      <MasterTab key={type} type={type} />
    </div>
  );
}

function MasterTab({ type }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState(blankDraft(type));
  const [editing, setEditing] = useState(null);
  const isPreset = type === 'making_presets';

  useEffect(() => {
    setLoading(true);
    setDraft(blankDraft(type));
    setEditing(null);
    mastersApi.list(type, { all: true })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [type]);

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function add() {
    if (!draft.label?.trim()) return flash('err', 'Label required');
    setBusy(true);
    try {
      const payload = {
        label: draft.label.trim(),
        sort_order: draft.sort_order || 100,
        extra: isPreset
          ? { charge_type: draft.charge_type || 'per_gram', charge_value: +draft.charge_value || 0 }
          : {}
      };
      const row = await mastersApi.create(type, payload);
      setRows([...rows, row].sort(byOrder));
      setDraft(blankDraft(type));
      flash('ok', `Added ${row.label}`);
    } catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      const payload = {
        label: editing.label,
        sort_order: editing.sort_order,
        is_active: editing.is_active,
        extra: isPreset
          ? { charge_type: editing.extra?.charge_type || 'per_gram', charge_value: +editing.extra?.charge_value || 0 }
          : editing.extra
      };
      const row = await mastersApi.update(type, editing.id, payload);
      setRows(rows.map((r) => (r.id === row.id ? row : r)).sort(byOrder));
      setEditing(null);
      flash('ok', `Updated ${row.label}`);
    } catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  async function toggle(row) {
    setBusy(true);
    try {
      const updated = await mastersApi.update(type, row.id, { is_active: !row.is_active });
      setRows(rows.map((r) => (r.id === row.id ? updated : r)));
      flash('ok', `${updated.is_active ? 'Activated' : 'Deactivated'} ${updated.label}`);
    } catch (e) { flash('err', e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      {toast && (
        <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok'
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>
      )}

      {/* Add row */}
      <div className="card mb-4">
        <h3 className="section-title">Add Entry</h3>
        <div className={`grid grid-cols-1 ${isPreset ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3 items-end`}>
          <Field label="Label *">
            <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. 22Kt" />
          </Field>
          <Field label="Sort Order">
            <input className="input" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: +e.target.value })} />
          </Field>
          {isPreset && (
            <>
              <Field label="Charge Type">
                <select className="input" value={draft.charge_type} onChange={(e) => setDraft({ ...draft, charge_type: e.target.value })}>
                  {CHARGE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Charge Value">
                <input className="input" type="number" min="0" value={draft.charge_value} onChange={(e) => setDraft({ ...draft, charge_value: +e.target.value })} />
              </Field>
            </>
          )}
          <button onClick={add} disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Add'}</button>
        </div>
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Label</th>
              <th className="px-4 py-3 text-left">Order</th>
              {isPreset && <th className="px-4 py-3 text-left">Charge</th>}
              <th className="px-4 py-3 text-left">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isPreset ? 5 : 4} className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isPreset ? 5 : 4} className="px-4 py-6 text-center text-ink-muted">No entries.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3 font-medium">{r.label}</td>
                <td className="px-4 py-3 text-ink-mid">{r.sort_order}</td>
                {isPreset && (
                  <td className="px-4 py-3 text-ink-mid">
                    {r.extra?.charge_type === 'per_gram' && `₹${r.extra.charge_value} / gm`}
                    {r.extra?.charge_type === 'fixed'    && `₹${r.extra.charge_value} flat`}
                    {r.extra?.charge_type === 'percentage' && `${r.extra.charge_value}%`}
                  </td>
                )}
                <td className="px-4 py-3">
                  {r.is_active
                    ? <span className="text-green-700 text-xs uppercase tracking-widest">Active</span>
                    : <span className="text-red-700 text-xs uppercase tracking-widest">Hidden</span>}
                </td>
                <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                  <button onClick={() => setEditing(r)} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Edit</button>
                  <button onClick={() => toggle(r)} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">
                    {r.is_active ? 'Hide' : 'Show'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          type={type}
          row={editing}
          isPreset={isPreset}
          onChange={setEditing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
          busy={busy}
        />
      )}
    </>
  );
}

function EditModal({ row, isPreset, onChange, onSave, onClose, busy }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md card border-l-4 border-l-gold">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-ink">Edit · {row.label}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <Field label="Label"><input className="input" value={row.label} onChange={(e) => onChange({ ...row, label: e.target.value })} /></Field>
          <Field label="Sort Order"><input className="input" type="number" value={row.sort_order} onChange={(e) => onChange({ ...row, sort_order: +e.target.value })} /></Field>
          {isPreset && (
            <>
              <Field label="Charge Type">
                <select className="input" value={row.extra?.charge_type || 'per_gram'} onChange={(e) => onChange({ ...row, extra: { ...row.extra, charge_type: e.target.value } })}>
                  {CHARGE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Charge Value">
                <input className="input" type="number" min="0" value={row.extra?.charge_value ?? 0} onChange={(e) => onChange({ ...row, extra: { ...row.extra, charge_value: +e.target.value } })} />
              </Field>
            </>
          )}
          <Field label="Status">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!row.is_active} onChange={(e) => onChange({ ...row, is_active: e.target.checked })} />
              Active (shown in forms)
            </label>
          </Field>
          <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={onSave} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function blankDraft(type) {
  return type === 'making_presets'
    ? { label: '', sort_order: 100, charge_type: 'per_gram', charge_value: 0 }
    : { label: '', sort_order: 100 };
}
function byOrder(a, b) { return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label); }

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
