import { useEffect, useMemo, useState } from 'react';
import { usersApi } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const ROLE_LABELS = {
  super_admin:     'Super Admin',
  admin:           'Admin',
  sales_executive: 'Sales Executive'
};

const ROLE_BADGE = {
  super_admin:     'bg-ink text-gold border-gold',
  admin:           'bg-gold-pale text-gold-dark border-gold-light',
  sales_executive: 'bg-off-white text-ink-mid border-gold-light/60'
};

export default function UsersAdmin() {
  const { user: me } = useAuth();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState(null);
  const canCreateSuper = me?.role === 'super_admin';
  const canDelete = me?.role === 'super_admin';

  useEffect(() => { reload(); }, []);
  async function reload() {
    setLoading(true);
    try { setRows(await usersApi.list()); }
    finally { setLoading(false); }
  }

  function flash(kind, text) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">User Management</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">JBOS Access Control</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary self-start sm:self-auto">+ New User</button>
      </header>

      {toast && (
        <div className={`mb-4 px-4 py-3 text-sm border ${
          toast.kind === 'ok'
            ? 'bg-green-50 border-green-300 text-green-700'
            : 'bg-red-50 border-red-300 text-red-700'
        }`}>{toast.text}</div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold">
            <tr className="text-[10px] uppercase tracking-widest">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-ink-muted">No users yet.</td></tr>
            ) : rows.map((u, i) => (
              <tr key={u.id} className={i % 2 ? 'bg-off-white' : ''}>
                <td className="px-4 py-3 font-medium">{u.full_name}{u.id === me?.id && <span className="ml-2 text-[10px] uppercase tracking-widest text-gold-dark">(you)</span>}</td>
                <td className="px-4 py-3 text-ink-mid">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3">{u.is_active ? <span className="text-green-700 text-xs uppercase tracking-widest">Active</span> : <span className="text-red-700 text-xs uppercase tracking-widest">Disabled</span>}</td>
                <td className="px-4 py-3 text-ink-muted text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(u)} className="action-btn">Edit</button>
                    <button onClick={() => setResetting(u)} className="action-btn">Reset password</button>
                    {canDelete && u.id !== me?.id && (
                      <button onClick={() => setDeleting(u)} className="action-btn-danger">Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="card text-center text-ink-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="card text-center text-ink-muted">No users yet.</div>
        ) : rows.map((u) => (
          <div key={u.id} className="card border-l-4 border-l-gold">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-serif text-base text-ink truncate">{u.full_name}{u.id === me?.id && ' (you)'}</div>
                <div className="text-sm text-ink-mid truncate">{u.email}</div>
              </div>
              <RoleBadge role={u.role} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gold-light/40">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Status</div>
                <div className={`text-sm ${u.is_active ? 'text-green-700' : 'text-red-700'}`}>{u.is_active ? 'Active' : 'Disabled'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">Last Login</div>
                <div className="text-xs text-ink">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : '—'}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gold-light/40">
              <button onClick={() => setEditing(u)} className="action-btn flex-1 min-w-[100px] py-2">Edit</button>
              <button onClick={() => setResetting(u)} className="action-btn flex-1 min-w-[100px] py-2">Reset password</button>
              {canDelete && u.id !== me?.id && (
                <button onClick={() => setDeleting(u)} className="action-btn-danger flex-1 min-w-[100px] py-2">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateModal
          canCreateSuper={canCreateSuper}
          onClose={() => setShowCreate(false)}
          onCreated={(u) => { setShowCreate(false); flash('ok', `Created ${u.email}`); reload(); }}
          onError={(msg) => flash('err', msg)}
        />
      )}
      {editing && (
        <EditModal
          user={editing}
          canAssignSuper={canCreateSuper}
          self={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={(u) => { setEditing(null); flash('ok', `Updated ${u.email}`); reload(); }}
          onError={(msg) => flash('err', msg)}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => { setResetting(null); flash('ok', `Password reset for ${resetting.email}`); }}
          onError={(msg) => flash('err', msg)}
        />
      )}
      {deleting && (
        <DeleteModal
          user={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(email) => { setDeleting(null); flash('ok', `Deleted ${email}`); reload(); }}
          onError={(msg) => flash('err', msg)}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 ${ROLE_BADGE[role] || ROLE_BADGE.sales_executive}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function CreateModal({ canCreateSuper, onClose, onCreated, onError }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'sales_executive' });
  const [busy, setBusy] = useState(false);

  const roles = useMemo(() => {
    const base = [
      { value: 'sales_executive', label: 'Sales Executive' },
      { value: 'admin',           label: 'Admin' }
    ];
    if (canCreateSuper) base.push({ value: 'super_admin', label: 'Super Admin' });
    return base;
  }, [canCreateSuper]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try { onCreated(await usersApi.create(form)); }
    catch (err) { onError(err?.response?.data?.error || err.message || 'Create failed'); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title="Create User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name *"><input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Email *"><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Temporary password *">
          <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          <div className="text-[10px] text-ink-muted mt-1">Min 8 characters. Share with the user securely; they will sign in with it.</div>
        </Field>
        <Field label="Role *">
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create User'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditModal({ user, canAssignSuper, self, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role, is_active: user.is_active });
  const [busy, setBusy] = useState(false);

  const roles = useMemo(() => {
    const base = [
      { value: 'sales_executive', label: 'Sales Executive' },
      { value: 'admin',           label: 'Admin' }
    ];
    if (canAssignSuper || user.role === 'super_admin') base.push({ value: 'super_admin', label: 'Super Admin' });
    return base;
  }, [canAssignSuper, user.role]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try { onSaved(await usersApi.update(user.id, form)); }
    catch (err) { onError(err?.response?.data?.error || err.message || 'Update failed'); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title={`Edit · ${user.email}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Role">
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={self}>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {self && <div className="text-[10px] text-ink-muted mt-1">You cannot change your own role.</div>}
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={form.is_active} disabled={self} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          {self && <div className="text-[10px] text-ink-muted mt-1">You cannot disable yourself.</div>}
        </Field>
        <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({ user, onClose, onDone, onError }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try { await usersApi.resetPassword(user.id, password); onDone(); }
    catch (err) { onError(err?.response?.data?.error || err.message || 'Reset failed'); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title={`Reset password · ${user.email}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New temporary password *">
          <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <div className="text-[10px] text-ink-muted mt-1">Min 8 characters. Share with the user securely.</div>
        </Field>
        <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Resetting…' : 'Reset'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteModal({ user, onClose, onDeleted, onError }) {
  const [purge, setPurge] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try { await usersApi.remove(user.id, purge); onDeleted(user.email); }
    catch (err) { onError(err?.response?.data?.error || err.message || 'Delete failed'); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title={`Delete · ${user.email}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-mid">
          Removes <span className="font-medium text-ink">{user.full_name}</span> from the Users list and revokes
          their portal access. By default their records (quotations, CRM, employee profile &amp; HR history) are
          <span className="font-medium text-ink"> kept</span>. This cannot be undone.
        </p>
        <label className="flex items-start gap-3 text-sm bg-danger-bg border border-danger-border rounded p-3">
          <input type="checkbox" className="mt-0.5" checked={purge} onChange={(e) => setPurge(e.target.checked)} />
          <span>
            <span className="font-medium text-danger">Demo / sample account — delete every record too</span>
            <span className="block text-xs text-ink-muted mt-1">
              Also permanently wipes their quotations, leads, customers and employee/HR data so no trace remains
              in History, Shifts, Attendance or any list. Use only for test accounts.
            </span>
          </span>
        </label>
        <div className="flex gap-3 justify-end pt-2 border-t border-gold-light/40">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={confirm} disabled={busy}
            className="btn bg-danger text-white border border-danger hover:bg-red-800 hover:-translate-y-px">
            {busy ? 'Deleting…' : (purge ? 'Delete + Purge' : 'Delete User')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md card border-l-4 border-l-gold">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg sm:text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
