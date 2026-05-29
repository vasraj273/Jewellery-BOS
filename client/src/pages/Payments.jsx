import { useEffect, useState } from 'react';
import { paymentsApi, salesOrdersApi, suppliersApi } from '../api/client.js';
import { PageHeader, Tabs, EmptyState } from '../components/ui.jsx';

const MODES = ['cash', 'bank', 'upi', 'card', 'other'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Payments() {
  const [tab, setTab] = useState('customer');
  return (
    <div>
      <PageHeader title="Payments" subtitle="Receipts & supplier payments" />
      <Tabs tabs={[{ key: 'customer', label: 'Customer Receipts' }, { key: 'supplier', label: 'Supplier Payments' }]} value={tab} onChange={setTab} />
      <div className="animate-fade-in">{tab === 'customer' ? <CustomerPayments /> : <SupplierPayments />}</div>
    </div>
  );
}

function flashHook(setToast) { return (k, t) => { setToast({ k, t }); setTimeout(() => setToast(null), 4000); }; }
function Toast({ toast }) { return toast ? <div className={`mb-4 px-4 py-3 text-sm border ${toast.k === 'ok' ? 'bg-success-bg border-success-border text-success' : 'bg-danger-bg border-danger-border text-danger'}`}>{toast.t}</div> : null; }

function CustomerPayments() {
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ sales_order_id: '', amount: 0, mode: 'cash', paid_at: today(), notes: '' });
  const flash = flashHook(setToast);
  function reload() { paymentsApi.customerList().then(setRows).catch(() => {}); }
  useEffect(() => { reload(); salesOrdersApi.list().then(setOrders).catch(() => {}); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.sales_order_id) return flash('err', 'Select a sales order');
    if (!(Number(form.amount) > 0)) return flash('err', 'Amount must be > 0');
    setBusy(true);
    try { await paymentsApi.createCustomer(form); flash('ok', 'Receipt recorded'); setForm({ sales_order_id: '', amount: 0, mode: 'cash', paid_at: today(), notes: '' }); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Toast toast={toast} />
      <div className="card mb-6">
        <h2 className="section-title">Record Receipt</h2>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2"><label className="label">Sales Order</label>
            <select className="input" value={form.sales_order_id} onChange={(e) => setForm({ ...form, sales_order_id: e.target.value })}>
              <option value="">—</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.order_code} · {o.customer_name} · {inr(o.total_amount)}</option>)}
            </select>
          </div>
          <div><label className="label">Amount</label><input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
          <div><label className="label">Mode</label><select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <div><label className="label">Date</label><input className="input" type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} /></div>
          <div className="sm:col-span-4"><label className="label">Notes</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button type="submit" disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Record'}</button>
        </form>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest"><tr><th className="px-4 py-3 text-left">Receipt</th><th className="px-4 py-3 text-left">Order</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-left">Date</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <EmptyState colSpan={6} title="No receipts yet" />
             : rows.map((p) => (
              <tr key={p.id} className="border-b border-gold-light/20 hover:bg-gold-pale/40">
                <td className="px-4 py-3 font-mono text-xs">{p.payment_code}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.order_code || '—'}</td>
                <td className="px-4 py-3">{p.customer_name || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-success">{inr(p.amount)}</td>
                <td className="px-4 py-3"><span className="badge-neutral">{p.mode}</span></td>
                <td className="px-4 py-3 text-ink-muted text-xs">{p.paid_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SupplierPayments() {
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', amount: 0, mode: 'cash', paid_at: today(), notes: '' });
  const flash = flashHook(setToast);
  function reload() { paymentsApi.supplierSummary().then(setSummary).catch(() => {}); paymentsApi.supplierList().then(setRows).catch(() => {}); }
  useEffect(() => { reload(); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.supplier_id) return flash('err', 'Select a supplier');
    if (!(Number(form.amount) > 0)) return flash('err', 'Amount must be > 0');
    setBusy(true);
    try { await paymentsApi.createSupplier(form); flash('ok', 'Payment recorded'); setForm({ supplier_id: '', amount: 0, mode: 'cash', paid_at: today(), notes: '' }); reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Toast toast={toast} />
      <div className="card mb-6">
        <h2 className="section-title">Record Supplier Payment</h2>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2"><label className="label">Supplier</label>
            <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">—</option>
              {summary.map((s) => <option key={s.id} value={s.id}>{s.name} · outstanding {inr(Number(s.payable) - Number(s.paid))}</option>)}
            </select>
          </div>
          <div><label className="label">Amount</label><input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
          <div><label className="label">Mode</label><select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <div><label className="label">Date</label><input className="input" type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} /></div>
          <div className="sm:col-span-4"><label className="label">Notes</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button type="submit" disabled={busy} className="btn-primary justify-center">{busy ? '…' : 'Record'}</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Supplier Outstanding</div>
          <table className="w-full text-sm">
            <tbody>
              {summary.length === 0 ? <tr><td className="px-4 py-6 text-center text-ink-muted">No suppliers.</td></tr>
               : summary.map((s) => (
                <tr key={s.id} className="border-b border-gold-light/20">
                  <td className="px-4 py-2.5">{s.name}</td>
                  <td className="px-4 py-2.5 text-right text-ink-muted text-xs">payable {inr(s.payable)} · paid {inr(s.paid)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${Number(s.payable) - Number(s.paid) > 0 ? 'text-danger' : 'text-success'}`}>{inr(Number(s.payable) - Number(s.paid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Payment History</div>
          <table className="w-full text-sm">
            <tbody>
              {rows.length === 0 ? <tr><td className="px-4 py-6 text-center text-ink-muted">No payments.</td></tr>
               : rows.map((p) => (
                <tr key={p.id} className="border-b border-gold-light/20">
                  <td className="px-4 py-2.5 font-mono text-xs">{p.payment_code}</td>
                  <td className="px-4 py-2.5">{p.supplier_name || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gold-dark">{inr(p.amount)}</td>
                  <td className="px-4 py-2.5 text-ink-muted text-xs">{p.paid_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
