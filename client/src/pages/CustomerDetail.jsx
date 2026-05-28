import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customersApi, usersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

export default function CustomerDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [c, setC] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [executives, setExecutives] = useState([]);
  const [editing, setEditing] = useState(false);

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [rem, setRem] = useState({ title: '', notes: '', due_at: '' });
  const [savingRem, setSavingRem] = useState(false);

  useEffect(() => {
    if (isAdminTier) usersApi.list().then((u) => setExecutives(u.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  function load() {
    setError('');
    Promise.all([customersApi.get(id), customersApi.events(id)])
      .then(([cust, ev]) => { setC(cust); setEvents(ev); })
      .catch((e) => setError(e?.response?.data?.error || 'Failed to load customer'));
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    try { await customersApi.addEvent(id, { title: 'Manual Note', notes: note.trim() }); setNote(''); load(); }
    finally { setSavingNote(false); }
  }

  async function addReminder(e) {
    e.preventDefault();
    if (!rem.title.trim() || !rem.due_at) return;
    setSavingRem(true);
    try {
      await customersApi.addReminder(id, {
        title: rem.title.trim(),
        notes: rem.notes.trim() || null,
        due_at: new Date(rem.due_at).toISOString()
      });
      setRem({ title: '', notes: '', due_at: '' });
      load();
    } finally { setSavingRem(false); }
  }

  if (error) return <div className="card border-l-4 border-l-red-400 text-red-700 text-sm">{error}</div>;
  if (!c) return <div className="text-ink-muted">Loading customer…</div>;

  const isRepeat = c.quotation_count > 1;
  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl sm:text-2xl tracking-wider text-ink truncate">{c.customer_code}</h1>
            <span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${isRepeat ? 'bg-ink text-gold border-gold' : 'bg-off-white text-ink-mid border-gold-light'}`}>
              {isRepeat ? 'Repeat Customer' : 'First-Time'}
            </span>
          </div>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1">{c.name} · {c.mobile}</p>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <Link to="/customers" className="btn-secondary flex-1 sm:flex-none justify-center min-w-[80px]">← Back</Link>
          <button onClick={() => setEditing(true)} className="btn-primary flex-1 sm:flex-none justify-center min-w-[80px]">Edit</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="section-title">Basic Info</h2>
            <Row k="Name" v={c.name} />
            <Row k="Mobile" v={c.mobile} />
            <Row k="Email" v={c.email || '—'} />
            <Row k="Address" v={c.address || '—'} />
          </div>
          <div className="card">
            <h2 className="section-title">Jewellery Preferences</h2>
            <Row k="Ring Size" v={c.ring_size || '—'} />
            <Row k="Preferred Metal" v={c.preferred_metal || '—'} />
            <Row k="Budget Range" v={c.budget_range || '—'} />
          </div>
          <div className="card">
            <h2 className="section-title">Important Dates</h2>
            <Row k="Birthday" v={fmtD(c.birthday)} />
            <Row k="Anniversary" v={fmtD(c.anniversary)} />
          </div>
          <div className="card">
            <h2 className="section-title">Relationship Metrics</h2>
            <Row k="Total Quotations" v={c.quotation_count} />
            <Row k="Assigned" v={c.assigned_name || '—'} />
            <Row k="Lead Source" v={c.source_lead_id ? `Lead #${c.source_lead_id}` : '—'} />
            <Row k="Last Activity" v={fmtD(c.last_activity_at)} />
          </div>
          {c.notes && (
            <div className="card">
              <h2 className="section-title">Notes</h2>
              <p className="text-sm text-ink-mid whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="section-title">Add Reminder</h2>
            <form onSubmit={addReminder} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Title *</label><input className="input" value={rem.title} onChange={(e) => setRem({ ...rem, title: e.target.value })} placeholder="e.g. Anniversary gift call" /></div>
                <div><label className="label">Due *</label><input className="input" type="datetime-local" value={rem.due_at} onChange={(e) => setRem({ ...rem, due_at: e.target.value })} /></div>
              </div>
              <textarea className="input min-h-[60px]" value={rem.notes} onChange={(e) => setRem({ ...rem, notes: e.target.value })} placeholder="Notes (optional)" />
              <div className="flex justify-end">
                <button type="submit" disabled={savingRem || !rem.title.trim() || !rem.due_at} className="btn-primary">{savingRem ? 'Saving…' : 'Add Reminder'}</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Add Timeline Note</h2>
            <form onSubmit={addNote} className="space-y-3">
              <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer prefers rose gold and vintage designs" />
              <div className="flex justify-end">
                <button type="submit" disabled={savingNote || !note.trim()} className="btn-primary">{savingNote ? 'Saving…' : 'Add Note'}</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Customer Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-ink-muted">No timeline events yet.</p>
            ) : (
              <ul className="space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="relative pl-5 border-l-2 border-gold-light">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 bg-gold rounded-full" />
                    <div className="text-[11px] uppercase tracking-widest text-gold-dark">{fmt(e.created_at)} · {e.event_type.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-ink mt-1 font-medium">{e.title}</div>
                    {e.notes && <div className="text-sm text-ink-mid mt-0.5 whitespace-pre-wrap">{e.notes}</div>}
                    <div className="text-[10px] text-ink-muted mt-1">by {e.actor_name || 'System'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditModal
          customer={c}
          isAdminTier={isAdminTier}
          executives={executives}
          me={me}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
    </div>
  );
}

function EditModal({ customer, isAdminTier, executives, me, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: customer.name || '', mobile: customer.mobile || '', email: customer.email || '',
    address: customer.address || '', ring_size: customer.ring_size || '',
    preferred_metal: customer.preferred_metal || '', budget_range: customer.budget_range || '',
    birthday: customer.birthday ? customer.birthday.slice(0, 10) : '',
    anniversary: customer.anniversary ? customer.anniversary.slice(0, 10) : '',
    notes: customer.notes || '',
    assigned_user_id: customer.assigned_user_id || me?.id || ''
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const payload = { ...form };
      if (!isAdminTier) delete payload.assigned_user_id;
      await customersApi.update(customer.id, payload);
      onSaved();
    } catch (e2) { setErr(e2?.response?.data?.error || e2.message || 'Save failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl card border-l-4 border-l-gold my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg sm:text-xl text-ink">Edit · {customer.customer_code}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>
        {err && <div className="mb-4 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-sm">{err}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Name *"><input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} /></F>
            <F label="Mobile *"><input className="input" required value={form.mobile} onChange={(e) => set('mobile', e.target.value)} /></F>
            <F label="Email"><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></F>
            <F label="Address"><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></F>
            <F label="Ring Size"><input className="input" value={form.ring_size} onChange={(e) => set('ring_size', e.target.value)} /></F>
            <F label="Preferred Metal"><input className="input" value={form.preferred_metal} onChange={(e) => set('preferred_metal', e.target.value)} /></F>
            <F label="Budget Range"><input className="input" value={form.budget_range} onChange={(e) => set('budget_range', e.target.value)} placeholder="e.g. ₹1L–3L" /></F>
            <F label="Birthday"><input className="input" type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} /></F>
            <F label="Anniversary"><input className="input" type="date" value={form.anniversary} onChange={(e) => set('anniversary', e.target.value)} /></F>
            {isAdminTier && (
              <F label="Assigned Executive">
                <select className="input" value={form.assigned_user_id} onChange={(e) => set('assigned_user_id', e.target.value)}>
                  {executives.map((u) => <option key={u.id} value={u.id}>{u.full_name}{u.id === me?.id ? ' (you)' : ''}</option>)}
                </select>
              </F>
            )}
          </div>
          <F label="Notes"><textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></F>
          <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1.5 border-b border-gold-light/30 last:border-0">
      <span className="text-ink-muted">{k}</span>
      <span className="text-ink font-medium text-right truncate">{v}</span>
    </div>
  );
}
function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
