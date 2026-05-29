import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { employeesApi, shiftsApi, docUploadApi, assetUrl } from '../api/client.js';
import { Tabs } from '../components/ui.jsx';

const SALARY_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
  { value: 'contract', label: 'Contract' }
];
const DOC_CATEGORIES = ['Identity', 'Employment', 'Legal', 'Other'];

export default function EmployeeDetail() {
  const { id } = useParams();
  const [emp, setEmp] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [comp, setComp] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('profile');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  function load() {
    setError('');
    Promise.all([employeesApi.get(id), employeesApi.getComp(id), employeesApi.docs(id), shiftsApi.list()])
      .then(([e, c, d, s]) => { setEmp(e); setComp(c); setDocs(d); setShifts(s); })
      .catch((e) => setError(e?.response?.data?.error || 'Failed to load employee'));
  }
  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  if (error) return <div className="card border-l-4 border-l-red-400 text-red-700 text-sm">{error}</div>;
  if (!emp) return <div className="text-ink-muted">Loading…</div>;

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-xl sm:text-2xl tracking-wider text-ink truncate">{emp.employee_code}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1">{emp.full_name} · {emp.designation || '—'}</p>
        </div>
        <Link to="/employees" className="btn-secondary self-start sm:self-auto">← Back</Link>
      </header>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <Tabs
        tabs={[{ key: 'profile', label: 'Profile' }, { key: 'compensation', label: 'Compensation' }, { key: 'documents', label: 'Documents' }]}
        value={tab}
        onChange={setTab}
      />

      <div className="animate-fade-in">
        {tab === 'profile' && (
          <div className="card max-w-2xl">
            <h2 className="section-title">Profile</h2>
            <Row k="Name" v={emp.full_name} />
            <Row k="Email" v={emp.email || '—'} />
            <Row k="Mobile" v={emp.mobile || '—'} />
            <Row k="Department" v={emp.department || '—'} />
            <Row k="Designation" v={emp.designation || '—'} />
            <Row k="Manager" v={emp.manager_name || '—'} />
            <Row k="Birthday" v={emp.birthday ? new Date(emp.birthday).toLocaleDateString('en-IN') : '—'} />
            <Row k="Status" v={(emp.employment_status || '').replace('_', ' ')} />
            <Row k="Shift" v={shifts.find((s) => s.id === emp.assigned_shift_id)?.shift_name || '—'} />
          </div>
        )}
        {tab === 'compensation' && (
          <CompensationCard employeeId={id} comp={comp} onSaved={(c) => { setComp(c); flash('ok', 'Compensation saved'); }} onError={(m) => flash('err', m)} />
        )}
        {tab === 'documents' && (
          <DocumentsCard employeeId={id} docs={docs} onChanged={() => { load(); }} onError={(m) => flash('err', m)} flash={flash} categories={DOC_CATEGORIES} />
        )}
      </div>
    </div>
  );
}

function CompensationCard({ employeeId, comp, onSaved, onError }) {
  const [form, setForm] = useState({
    salary_type: comp?.salary_type || 'monthly',
    base_salary: comp?.base_salary ?? '',
    allowance: comp?.allowance ?? '',
    deduction: comp?.deduction ?? '',
    overtime_rate: comp?.overtime_rate ?? '',
    commission_eligible: !!comp?.commission_eligible,
    notes: comp?.notes || ''
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm({
      salary_type: comp?.salary_type || 'monthly',
      base_salary: comp?.base_salary ?? '',
      allowance: comp?.allowance ?? '',
      deduction: comp?.deduction ?? '',
      overtime_rate: comp?.overtime_rate ?? '',
      commission_eligible: !!comp?.commission_eligible,
      notes: comp?.notes || ''
    });
  }, [comp]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try { onSaved(await employeesApi.saveComp(employeeId, form)); }
    catch (err) { onError(err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h2 className="section-title">Compensation (Payroll Foundation)</h2>
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <F label="Salary Type">
          <select className="input" value={form.salary_type} onChange={(e) => setForm({ ...form, salary_type: e.target.value })}>
            {SALARY_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </F>
        <F label="Base Salary"><input className="input" type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></F>
        <F label="Allowance"><input className="input" type="number" value={form.allowance} onChange={(e) => setForm({ ...form, allowance: e.target.value })} /></F>
        <F label="Deduction"><input className="input" type="number" value={form.deduction} onChange={(e) => setForm({ ...form, deduction: e.target.value })} /></F>
        <F label="Overtime Rate"><input className="input" type="number" value={form.overtime_rate} onChange={(e) => setForm({ ...form, overtime_rate: e.target.value })} /></F>
        <F label="Commission Eligible">
          <label className="flex items-center gap-2 text-sm h-[38px]">
            <input type="checkbox" checked={form.commission_eligible} onChange={(e) => setForm({ ...form, commission_eligible: e.target.checked })} /> Yes
          </label>
        </F>
        <div className="sm:col-span-2"><F label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F></div>
        <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save Compensation'}</button></div>
      </form>
    </div>
  );
}

function DocumentsCard({ employeeId, docs, onChanged, onError, flash, categories }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function upload(e) {
    e.preventDefault();
    if (!name.trim() || !file) return onError('Name + file required');
    setBusy(true);
    try {
      const { url } = await docUploadApi.upload(file);
      await employeesApi.addDoc(employeeId, { document_name: name.trim(), category, upload_url: url });
      setName(''); setFile(null);
      flash('ok', 'Document uploaded');
      onChanged();
    } catch (err) { onError(err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card mt-6">
      <h2 className="section-title">Document Vault</h2>
      <form onSubmit={upload} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end mb-4">
        <F label="Document Name *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></F>
        <F label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        <F label="File (img/pdf) *"><input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></F>
        <button type="submit" disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Upload'}</button>
      </form>

      {docs.length === 0 ? (
        <p className="text-sm text-ink-muted">No documents.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-gold-light/20">
                <td className="py-2"><a href={assetUrl(d.upload_url)} target="_blank" rel="noreferrer" className="text-gold-dark hover:text-gold">{d.document_name}</a></td>
                <td className="py-2 text-ink-muted text-xs">{d.category}</td>
                <td className="py-2 text-right">
                  <button onClick={async () => { await employeesApi.removeDoc(d.id); flash('ok', 'Document removed'); onChanged(); }} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
