import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { leadsApi, usersApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import LeadFormModal from '../components/LeadFormModal.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [lead, setLead] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [error, setError] = useState('');
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [editing, setEditing] = useState(false);

  const [fuNotes, setFuNotes] = useState('');
  const [fuNext, setFuNext]   = useState('');
  const [savingFu, setSavingFu] = useState(false);

  useEffect(() => {
    leadsApi.sources().then(setSources).catch(() => {});
    leadsApi.statuses().then(setStatuses).catch(() => {});
    if (isAdminTier) usersApi.list().then((u) => setExecutives(u.filter((x) => x.is_active))).catch(() => {});
  }, [isAdminTier]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  function load() {
    setError('');
    Promise.all([leadsApi.get(id), leadsApi.followups(id)])
      .then(([l, f]) => { setLead(l); setFollowups(f); })
      .catch((e) => setError(e?.response?.data?.error || 'Failed to load lead'));
  }

  async function addFollowup(e) {
    e.preventDefault();
    if (!fuNotes.trim()) return;
    setSavingFu(true);
    try {
      await leadsApi.addFollowup(id, {
        notes: fuNotes.trim(),
        next_followup_at: fuNext ? new Date(fuNext).toISOString() : null
      });
      setFuNotes(''); setFuNext('');
      load();
    } finally { setSavingFu(false); }
  }

  if (error) return <div className="card border-l-4 border-l-red-400 text-red-700 text-sm">{error}</div>;
  if (!lead) return <div className="text-ink-muted">Loading lead…</div>;

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-xl sm:text-2xl tracking-wider text-ink truncate">{lead.lead_code}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1">{lead.name} · {lead.status_label || '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <Link to="/leads" className="btn-secondary flex-1 sm:flex-none justify-center min-w-[80px]">← Back</Link>
          <button onClick={() => setEditing(true)} className="btn-secondary flex-1 sm:flex-none justify-center min-w-[80px]">Edit</button>
          <button onClick={() => navigate(`/quotations/new?lead=${lead.id}`)} className="btn-primary flex-1 sm:flex-none justify-center min-w-[120px]">Create Quotation</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info + Sales */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="section-title">Lead Info</h2>
            <Row k="Name" v={lead.name} />
            <Row k="Mobile" v={lead.mobile} />
            <Row k="Email" v={lead.email || '—'} />
            <Row k="Occasion" v={lead.occasion || '—'} />
          </div>
          <div className="card">
            <h2 className="section-title">Sales Info</h2>
            <Row k="Source" v={lead.source_label || '—'} />
            <Row k="Status" v={lead.status_label || '—'} />
            <Row k="Priority" v={lead.priority} />
            <Row k="Budget" v={lead.budget ? `₹ ${Number(lead.budget).toLocaleString('en-IN')}` : '—'} />
            <Row k="Assigned" v={lead.assigned_name || '—'} />
            <Row k="Next Followup" v={fmtD(lead.next_followup_at)} />
            {lead.converted_quotation_id && <Row k="Quotation" v={`#${lead.converted_quotation_id}`} />}
          </div>
          {lead.notes && (
            <div className="card">
              <h2 className="section-title">Notes</h2>
              <p className="text-sm text-ink-mid whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Followup timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="section-title">Add Followup</h2>
            <form onSubmit={addFollowup} className="space-y-3">
              <textarea className="input min-h-[70px]" placeholder="What happened? e.g. Called customer, shared diamond options…" value={fuNotes} onChange={(e) => setFuNotes(e.target.value)} />
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="label">Set Next Followup (optional)</label>
                  <input className="input" type="datetime-local" value={fuNext} onChange={(e) => setFuNext(e.target.value)} />
                </div>
                <button type="submit" disabled={savingFu || !fuNotes.trim()} className="btn-primary justify-center">{savingFu ? 'Saving…' : 'Add Followup'}</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Followup Timeline</h2>
            {followups.length === 0 ? (
              <p className="text-sm text-ink-muted">No followups yet.</p>
            ) : (
              <ul className="space-y-4">
                {followups.map((f) => (
                  <li key={f.id} className="relative pl-5 border-l-2 border-gold-light">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 bg-gold rounded-full" />
                    <div className="text-[11px] uppercase tracking-widest text-gold-dark">{fmt(f.created_at)}</div>
                    <div className="text-sm text-ink mt-1 whitespace-pre-wrap">{f.notes}</div>
                    <div className="text-[10px] text-ink-muted mt-1">by {f.created_by_name || 'Unknown'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <LeadFormModal
          mode="edit"
          lead={lead}
          sources={sources}
          statuses={statuses}
          executives={executives}
          isAdminTier={isAdminTier}
          me={me}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
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
