import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesOrdersApi, productionApi, employeesApi, karigarsApi, paymentsApi, invoicesApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const SO_STATUSES = ['draft', 'confirmed', 'production', 'ready', 'delivered', 'cancelled'];
const STAGES = ['design_approved', 'in_production', 'stone_setting', 'polishing', 'qc', 'ready', 'delivered'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function SalesOrderDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const isAdmin = !!me && ADMIN_ROLES.includes(me.role);

  const [order, setOrder] = useState(null);
  const [job, setJob] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [karigars, setKarigars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusSel, setStatusSel] = useState('');
  const [stageSel, setStageSel] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [pay, setPay] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, mode: 'cash', paid_at: new Date().toISOString().slice(0, 10), notes: '' });

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }

  async function reload() {
    const o = await salesOrdersApi.get(id).catch(() => null);
    setOrder(o);
    setStatusSel(o?.status || '');
    paymentsApi.forSalesOrder(id).then(setPay).catch(() => setPay(null));
    if (o?.production_job_id) {
      const j = await productionApi.get(o.production_job_id).catch(() => null);
      setJob(j); setStageSel(j?.stage || '');
    } else { setJob(null); }
    setLoading(false);
  }
  useEffect(() => { setLoading(true); reload(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    if (!isAdmin) return;
    employeesApi.list().then((r) => setEmployees(r.filter((x) => x.is_active))).catch(() => {});
    karigarsApi.list().then(setKarigars).catch(() => {});
  }, [isAdmin]);

  async function act(fn, okMsg) {
    setBusy(true);
    try { await fn(); flash('ok', okMsg); await reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function savePayment(e) {
    e.preventDefault();
    if (!(Number(payForm.amount) > 0)) return flash('err', 'Amount must be > 0');
    await act(() => paymentsApi.createCustomer({ ...payForm, sales_order_id: order.id }), 'Payment recorded');
    setPayForm({ amount: 0, mode: 'cash', paid_at: new Date().toISOString().slice(0, 10), notes: '' });
  }

  async function genInvoice() {
    setBusy(true);
    try {
      const inv = await invoicesApi.fromSO(order.id);
      flash('ok', `Invoice ${inv.invoice_code} created`);
      const blob = await invoicesApi.pdfBlob(inv.id);
      const url = URL.createObjectURL(blob); window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="text-ink-muted">Loading…</div>;
  if (!order) return <div className="card">Order not found. <Link to="/sales-orders" className="text-gold-dark">← Sales Orders</Link></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <Link to="/sales-orders" className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">← Sales Orders</Link>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink mt-1">{order.order_code}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1">{order.status} · {order.customer_name}</p>
        </div>
      </div>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="section-title">Order</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
              <KV k="Customer" v={order.customer_name} />
              <KV k="Mobile" v={order.customer_mobile} />
              <KV k="Product" v={order.product_name} />
              <KV k="Category" v={order.product_category} />
              <KV k="Quotation" v={order.quote_code ? <Link to={`/quotations/${order.quote_code}`} className="text-gold-dark underline">{order.quote_code}</Link> : '—'} />
              <KV k="Expected Delivery" v={order.expected_delivery} />
              <KV k="Total" v={inr(order.total_amount)} />
              <KV k="Advance" v={inr(order.advance_amount)} />
              <KV k="Balance" v={inr(order.balance_amount)} />
              <KV k="Delivered" v={order.delivered_at ? fmt(order.delivered_at) : '—'} />
            </div>
            {order.notes && <p className="text-sm text-ink-muted mt-4 border-t border-gold-light/40 pt-3">{order.notes}</p>}
          </div>

          {/* Payments */}
          {pay && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title mb-0">Payments</h2>
                {isAdmin && <button onClick={genInvoice} disabled={busy} className="btn-secondary">Generate Invoice</button>}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Mini label="Order Total" v={inr(pay.order_total)} />
                <Mini label="Paid" v={inr(pay.paid)} tone="success" />
                <Mini label="Balance" v={inr(pay.balance)} tone={pay.balance > 0 ? 'danger' : 'success'} />
              </div>
              {isAdmin && pay.balance > 0 && (
                <form onSubmit={savePayment} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end border-t border-gold-light/40 pt-4 mb-4">
                  <div><label className="label">Amount</label><input className="input" type="number" min="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: +e.target.value })} /></div>
                  <div><label className="label">Mode</label><select className="input" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>{['cash', 'bank', 'upi', 'card', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                  <div><label className="label">Date</label><input className="input" type="date" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} /></div>
                  <div className="sm:col-span-1"><label className="label">Notes</label><input className="input" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
                  <button type="submit" disabled={busy} className="btn-primary justify-center">Record</button>
                </form>
              )}
              <div className="text-[10px] uppercase tracking-widest text-gold mb-2">Payment Timeline</div>
              {pay.payments.length === 0 ? <p className="text-sm text-ink-muted">No payments yet.</p> : (
                <ul className="text-sm divide-y divide-gold-light/30">
                  {pay.payments.map((p) => (
                    <li key={p.id} className="py-2 flex justify-between gap-3">
                      <span>{p.payment_code} · <span className="text-ink-muted">{p.mode}</span>{p.notes ? ` · ${p.notes}` : ''}</span>
                      <span className="whitespace-nowrap"><span className="font-medium text-success">{inr(p.amount)}</span> <span className="text-[10px] text-ink-muted">{p.paid_at}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Production pipeline */}
          {job ? (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title mb-0">Production · {job.job_code}</h2>
                {job.delayed && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-red-300 bg-red-50 text-red-600 rounded">Delayed</span>}
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {STAGES.map((st) => (
                  <span key={st} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${st === job.stage ? 'bg-gold text-ink border-gold' : 'border-gold-light/40 text-ink-muted'}`}>{st.replace('_', ' ')}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm mb-4">
                <KV k="Assigned" v={job.employee_name} />
                <KV k="Karigar" v={job.karigar_name} />
                <KV k="Expected" v={job.expected_date} />
                <KV k="Completed" v={job.completed_date} />
              </div>

              {isAdmin && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-t border-gold-light/40 pt-4">
                    <div><label className="label">Stage</label>
                      <select className="input" value={stageSel} onChange={(e) => setStageSel(e.target.value)}>
                        {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2"><label className="label">Note</label><input className="input" value={stageNote} onChange={(e) => setStageNote(e.target.value)} /></div>
                    <button onClick={() => act(() => productionApi.setStage(job.id, { stage: stageSel, note: stageNote }).then(() => setStageNote('')), 'Stage updated')} disabled={busy} className="btn-primary justify-center">Set Stage</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mt-3">
                    <div><label className="label">Assign Employee</label>
                      <select className="input" value={job.assigned_employee_id || ''} onChange={(e) => act(() => productionApi.update(job.id, { assigned_employee_id: e.target.value || null }), 'Assigned')}>
                        <option value="">—</option>
                        {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                      </select>
                    </div>
                    <div><label className="label">Karigar</label>
                      <select className="input" value={job.karigar_id || ''} onChange={(e) => act(() => productionApi.update(job.id, { karigar_id: e.target.value || null }), 'Karigar set')}>
                        <option value="">—</option>
                        {karigars.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </select>
                    </div>
                    <div><label className="label">Expected Date</label>
                      <input type="date" className="input" defaultValue={job.expected_date || ''} onBlur={(e) => act(() => productionApi.update(job.id, { expected_date: e.target.value || null }), 'Date set')} />
                    </div>
                  </div>
                  <button onClick={() => act(() => productionApi.finishedStock(job.id, {}), 'Finished stock created')} disabled={busy} className="btn-secondary mt-4">+ Add to Finished Stock</button>
                </>
              )}

              <div className="mt-4 border-t border-gold-light/40 pt-3">
                <div className="text-[10px] uppercase tracking-widest text-gold mb-2">Stage History</div>
                <ul className="text-sm divide-y divide-gold-light/30">
                  {(job.events || []).map((ev) => (
                    <li key={ev.id} className="py-1.5 flex justify-between gap-3">
                      <span>{ev.stage.replace('_', ' ')}{ev.note ? ` · ${ev.note}` : ''}</span>
                      <span className="text-[10px] text-ink-muted whitespace-nowrap">{ev.actor_name || ''} · {fmt(ev.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            isAdmin && <div className="card text-sm text-ink-muted">Set status to <strong>production</strong> to start the production pipeline.</div>
          )}
        </div>

        {/* Status control */}
        <aside className="space-y-6">
          {isAdmin && (
            <div className="card border-l-4 border-l-gold">
              <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">Order Status</div>
              <select className="input mb-3" value={statusSel} onChange={(e) => setStatusSel(e.target.value)}>
                {SO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => act(() => salesOrdersApi.setStatus(order.id, statusSel), 'Status updated')} disabled={busy || statusSel === order.status} className="btn-primary w-full justify-center">Update Status</button>
              <div className="text-[10px] text-ink-muted mt-2">production → starts pipeline · delivered → marks linked stock sold · cancelled → releases reservation.</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function KV({ k, v }) {
  return (<div><div className="text-[10px] uppercase tracking-wider text-ink-muted">{k}</div><div className="text-ink">{v || '—'}</div></div>);
}

function Mini({ label, v, tone }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="card border-l-4 border-l-gold py-3">
      <div className="text-[10px] uppercase tracking-[2px] text-gold mb-1">{label}</div>
      <div className={`font-serif text-xl ${color}`}>{v}</div>
    </div>
  );
}
