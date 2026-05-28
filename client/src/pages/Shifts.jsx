import { useEffect, useState } from 'react';
import { shiftsApi, employeesApi } from '../api/client.js';

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ shift_name: '', start_time: '', end_time: '', weekly_off: '' });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { reload(); }, []);
  function reload() {
    setLoading(true);
    Promise.all([shiftsApi.list({ include_inactive: '1' }), employeesApi.list()])
      .then(([s, e]) => { setShifts(s); setEmployees(e.filter((x) => x.is_active)); })
      .finally(() => setLoading(false));
  }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function save(e) {
    e.preventDefault();
    if (!form.shift_name.trim()) return flash('err', 'Shift name required');
    setBusy(true);
    try {
      if (editing) { await shiftsApi.update(editing, form); flash('ok', 'Shift updated'); }
      else { await shiftsApi.create(form); flash('ok', 'Shift created'); }
      setForm({ shift_name: '', start_time: '', end_time: '', weekly_off: '' });
      setEditing(null);
      reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function assignShift(employeeId, shiftId) {
    try { await shiftsApi.assign(employeeId, shiftId || null); flash('ok', 'Shift assigned'); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
  }

  const shiftName = (id) => shifts.find((s) => s.id === id)?.shift_name || '—';

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Shifts</h1>
        <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Showroom shift management</p>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="card mb-4">
        <h2 className="section-title">{editing ? 'Edit Shift' : 'Add Shift'}</h2>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <F label="Name *"><input className="input" value={form.shift_name} onChange={(e) => setForm({ ...form, shift_name: e.target.value })} placeholder="Morning / Evening…" /></F>
          <F label="Start"><input className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></F>
          <F label="End"><input className="input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></F>
          <F label="Weekly Off"><input className="input" value={form.weekly_off} onChange={(e) => setForm({ ...form, weekly_off: e.target.value })} placeholder="Sunday" /></F>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">{busy ? '…' : (editing ? 'Save' : 'Add')}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ shift_name: '', start_time: '', end_time: '', weekly_off: '' }); }} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Shifts</div>
          <table className="w-full text-sm">
            <tbody>
              {loading ? <tr><td className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
               : shifts.length === 0 ? <tr><td className="px-4 py-6 text-center text-ink-muted">No shifts.</td></tr>
               : shifts.map((s, i) => (
                <tr key={s.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''} ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{s.shift_name}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{s.start_time || '—'}–{s.end_time || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">Off: {s.weekly_off || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => { setEditing(s.id); setForm({ shift_name: s.shift_name, start_time: s.start_time || '', end_time: s.end_time || '', weekly_off: s.weekly_off || '' }); }} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Edit</button>
                    {s.is_active && <button onClick={async () => { await shiftsApi.deactivate(s.id); flash('ok', 'Deactivated'); reload(); }} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Off</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Employee Assignment</div>
          <table className="w-full text-sm">
            <tbody>
              {employees.length === 0 ? <tr><td className="px-4 py-6 text-center text-ink-muted">No employees.</td></tr>
               : employees.map((emp, i) => (
                <tr key={emp.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''}`}>
                  <td className="px-4 py-3">{emp.full_name}<div className="text-[10px] text-ink-muted">{shiftName(emp.assigned_shift_id)}</div></td>
                  <td className="px-4 py-3 text-right">
                    <select className="input py-1 text-xs w-auto inline-block" value={emp.assigned_shift_id || ''} onChange={(e) => assignShift(emp.id, e.target.value)}>
                      <option value="">— none —</option>
                      {shifts.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
                    </select>
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
