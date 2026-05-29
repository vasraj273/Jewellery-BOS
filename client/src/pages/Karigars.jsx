import { useEffect, useState } from 'react';
import { karigarsApi } from '../api/client.js';

const EMPTY = { name: '', mobile: '', email: '', address: '', skill: '', notes: '' };

export default function Karigars() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }
  function reload() {
    setLoading(true);
    karigarsApi.list({ include_inactive: '1', search }).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { const t = setTimeout(reload, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return flash('err', 'Karigar name required');
    setBusy(true);
    try {
      if (editing) { await karigarsApi.update(editing, form); flash('ok', 'Karigar updated'); }
      else { await karigarsApi.create(form); flash('ok', 'Karigar added'); }
      setForm(EMPTY); setEditing(null); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Karigars</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Job workers &amp; craftsmen</p>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="card mb-4">
        <h2 className="section-title">{editing ? 'Edit Karigar' : 'Add Karigar'}</h2>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <F label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Skill"><input className="input" placeholder="setting / polishing / casting" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} /></F>
          <F label="Mobile"><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></F>
          <F label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
          <F label="Address"><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
          <F label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">{busy ? '…' : (editing ? 'Save' : 'Add')}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card mb-4"><F label="Search"><input className="input" placeholder="name / code / skill / mobile" value={search} onChange={(e) => setSearch(e.target.value)} /></F></div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Skill</th>
                <th className="px-4 py-3 text-left">Mobile</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
               : rows.length === 0 ? <tr><td colSpan="5" className="px-4 py-6 text-center text-ink-muted">No karigars.</td></tr>
               : rows.map((k, i) => (
                <tr key={k.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''} ${!k.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs">{k.karigar_code}</td>
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{k.skill || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{k.mobile || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => { setEditing(k.id); setForm({ name: k.name, mobile: k.mobile || '', email: k.email || '', address: k.address || '', skill: k.skill || '', notes: k.notes || '' }); }} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Edit</button>
                    {k.is_active
                      ? <button onClick={async () => { try { await karigarsApi.deactivate(k.id); flash('ok', 'Deactivated'); reload(); } catch (err) { flash('err', err?.response?.data?.error || err.message); } }} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Off</button>
                      : <button onClick={async () => { try { await karigarsApi.activate(k.id); flash('ok', 'Reactivated'); reload(); } catch (err) { flash('err', err?.response?.data?.error || err.message); } }} className="text-xs uppercase tracking-widest text-green-700 hover:text-green-800">On</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
