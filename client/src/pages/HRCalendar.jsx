import { useEffect, useMemo, useState } from 'react';
import { hrCalendarApi } from '../api/client.js';

const TYPE_STYLE = {
  leave:            'bg-gold-pale text-gold-dark border-gold-light',
  birthday:         'bg-pink-50 text-pink-700 border-pink-200',
  anniversary:      'bg-blue-50 text-blue-700 border-blue-200',
  pending_approval: 'bg-red-50 text-red-700 border-red-300',
  followup:         'bg-green-50 text-green-700 border-green-300',
  task:             'bg-off-white text-ink-mid border-gold-light/60',
  manual:           'bg-ink text-gold border-gold'
};
const TYPE_DOT = {
  leave: 'bg-gold', birthday: 'bg-pink-400', anniversary: 'bg-blue-400',
  pending_approval: 'bg-red-500', followup: 'bg-green-500', task: 'bg-ink-mid', manual: 'bg-gold-dark'
};
const TYPE_LABEL = {
  leave: 'Leave', birthday: 'Birthday', anniversary: 'Anniversary',
  pending_approval: 'Approval', followup: 'Followup', task: 'Task', manual: 'Manual Event'
};
const CATEGORIES = ['meeting', 'exhibition', 'audit', 'holiday', 'promotion', 'training', 'general'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEGEND = ['manual', 'leave', 'pending_approval', 'followup', 'task', 'birthday', 'anniversary'];

const todayStr = () => new Date().toISOString().slice(0, 10);
const blankForm = (date = '') => ({ id: null, title: '', description: '', event_date: date, category: 'general' });

export default function HRCalendar() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ events: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // YYYY-MM-DD of open day modal
  const [form, setForm] = useState(null);          // manual-event form (add/edit) or null
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }
  function reload() {
    setLoading(true);
    hrCalendarApi.month(month).then(setData).catch(() => setData({ events: [] })).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [month]);

  const byDate = useMemo(() => {
    const map = {};
    for (const e of data.events) (map[e.date] ||= []).push(e);
    return map;
  }, [data]);

  const grid = useMemo(() => {
    const [y, mo] = month.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const lead = first.getDay(); // 0=Sun
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  function shiftMonth(delta) {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthLabel = useMemo(() => {
    const [y, mo] = month.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [month]);

  async function saveEvent(e) {
    e.preventDefault();
    if (!form.title.trim()) return flash('err', 'Title required');
    setBusy(true);
    try {
      if (form.id) { await hrCalendarApi.updateEvent(form.id, form); flash('ok', 'Event updated'); }
      else         { await hrCalendarApi.createEvent(form); flash('ok', 'Event created'); }
      setForm(null);
      reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }
  async function removeEvent(id) {
    setBusy(true);
    try { await hrCalendarApi.deleteEvent(id); flash('ok', 'Event deleted'); setForm(null); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  const dayEvents = selected ? (byDate[selected] || []) : [];

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">HR Calendar</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{loading ? 'Loading…' : `${data.events.length} event${data.events.length === 1 ? '' : 's'} this month`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="btn-secondary px-3" aria-label="Previous month">‹</button>
          <div className="font-serif text-base sm:text-lg text-ink min-w-[150px] text-center tracking-wide">{monthLabel}</div>
          <button onClick={() => shiftMonth(1)} className="btn-secondary px-3" aria-label="Next month">›</button>
          <button onClick={() => setMonth(new Date().toISOString().slice(0, 7))} className="btn-secondary hidden sm:inline-block">Today</button>
        </div>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-[10px] uppercase tracking-widest text-ink-muted">
        {LEGEND.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${TYPE_DOT[t]}`} />{TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {/* Month grid */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 bg-ink text-gold text-[10px] uppercase tracking-widest">
          {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[84px] sm:min-h-[104px] border-b border-r border-gold-light/20 bg-off-white/40" />;
            const dd = Number(cell.slice(-2));
            const evs = byDate[cell] || [];
            const isToday = cell === todayStr();
            return (
              <button
                key={i}
                onClick={() => setSelected(cell)}
                className={`min-h-[84px] sm:min-h-[104px] border-b border-r border-gold-light/20 p-1.5 text-left align-top hover:bg-gold-pale/40 transition relative ${isToday ? 'bg-gold-pale/60' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-gold-dark' : 'text-ink-mid'}`}>
                  <span className={isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink text-gold' : ''}>{dd}</span>
                </div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((e, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[9px] leading-tight text-ink truncate">
                      <span className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${TYPE_DOT[e.type] || 'bg-ink-mid'}`} />
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                  {evs.length > 3 && <div className="text-[9px] text-gold-dark">+{evs.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day modal */}
      {selected && !form && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-lg card border-l-4 border-l-gold my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-ink">{new Date(selected).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => setSelected(null)} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
            </div>

            {dayEvents.length === 0 ? (
              <p className="text-sm text-ink-muted mb-4">No events on this day.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {dayEvents.map((e, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 border-b border-gold-light/30 pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${TYPE_STYLE[e.type] || ''}`}>{e.type === 'manual' ? (e.category || 'manual') : TYPE_LABEL[e.type]}</span>
                        <span className="text-sm text-ink truncate">{e.title}</span>
                      </div>
                      {e.description && <div className="text-xs text-ink-muted mt-0.5">{e.description}</div>}
                    </div>
                    {e.editable && (
                      <div className="shrink-0 space-x-2 whitespace-nowrap">
                        <button onClick={() => setForm({ id: e.id, title: e.title, description: e.description || '', event_date: selected, category: e.category || 'general' })} className="text-[10px] uppercase tracking-widest text-gold-dark hover:text-gold">Edit</button>
                        <button onClick={() => removeEvent(e.id)} disabled={busy} className="text-[10px] uppercase tracking-widest text-red-600 hover:text-red-700">Delete</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <button onClick={() => setForm(blankForm(selected))} className="btn-primary w-full justify-center">+ Add Event</button>
          </div>
        </div>
      )}

      {/* Add / edit manual event modal */}
      {form && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setForm(null)}>
          <div className="bg-white w-full max-w-lg card border-l-4 border-l-gold my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-ink">{form.id ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setForm(null)} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
            </div>
            <form onSubmit={saveEvent} className="space-y-4">
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Staff meeting, Exhibition…" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Date *</label><input className="input" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Description</label><textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex gap-3 justify-between pt-2 border-t border-gold-light/40">
                {form.id
                  ? <button type="button" onClick={() => removeEvent(form.id)} disabled={busy} className="text-xs uppercase tracking-widest text-red-600 hover:text-red-700">Delete</button>
                  : <span />}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setForm(null)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : (form.id ? 'Save' : 'Create')}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
