import { useEffect, useState } from 'react';
import { purchasesApi, suppliersApi } from '../api/client.js';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = () => ({ name: '', category: '', metal_type: 'Gold', purity: '22Kt', gross_weight: 0, net_weight: 0, quantity: 1, unit_cost: 0 });

export default function Purchases() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [head, setHead] = useState({ supplier_id: '', purchase_date: today(), invoice_number: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }
  function reload() {
    setLoading(true);
    purchasesApi.list().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); suppliersApi.list().then(setSuppliers).catch(() => setSuppliers([])); }, []);

  const grandTotal = lines.reduce((s, l) => s + (Number(l.unit_cost) || 0) * (Number(l.quantity) || 1), 0);

  function setLine(idx, patch) { setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l))); }

  async function save(e) {
    e.preventDefault();
    const valid = lines.filter((l) => l.name.trim());
    if (valid.length === 0) return flash('err', 'Add at least one line item');
    setBusy(true);
    try {
      await purchasesApi.create({ ...head, supplier_id: head.supplier_id || null, items: valid });
      flash('ok', 'Purchase recorded — stock created');
      setHead({ supplier_id: '', purchase_date: today(), invoice_number: '', notes: '' });
      setLines([emptyLine()]); setShowForm(false); reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function openDetail(id) {
    try { setDetail(await purchasesApi.get(id)); } catch (err) { flash('err', err?.response?.data?.error || err.message); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Purchases</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">Procurement → stock entry</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary self-start sm:self-auto">{showForm ? 'Close' : '+ New Purchase'}</button>
      </div>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {showForm && (
        <div className="card mb-6">
          <h2 className="section-title">Record Purchase</h2>
          <form onSubmit={save}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <F label="Supplier">
                <select className="input" value={head.supplier_id} onChange={(e) => setHead({ ...head, supplier_id: e.target.value })}>
                  <option value="">— select —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </F>
              <F label="Date"><input className="input" type="date" value={head.purchase_date} onChange={(e) => setHead({ ...head, purchase_date: e.target.value })} /></F>
              <F label="Invoice #"><input className="input" value={head.invoice_number} onChange={(e) => setHead({ ...head, invoice_number: e.target.value })} /></F>
              <F label="Notes"><input className="input" value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></F>
            </div>

            <div className="overflow-x-auto border border-gold-light/40 rounded">
              <table className="w-full text-xs">
                <thead className="bg-off-white text-ink-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-2 py-2 text-left">Item *</th>
                    <th className="px-2 py-2 text-left">Category</th>
                    <th className="px-2 py-2 text-left">Metal</th>
                    <th className="px-2 py-2 text-left">Purity</th>
                    <th className="px-2 py-2 text-right">Gross</th>
                    <th className="px-2 py-2 text-right">Net</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Unit Cost</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-gold-light/30">
                      <td className="px-1 py-1"><input className="input py-1" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-24" value={l.category} onChange={(e) => setLine(i, { category: e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-20" value={l.metal_type} onChange={(e) => setLine(i, { metal_type: e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-16" value={l.purity} onChange={(e) => setLine(i, { purity: e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-20 text-right" type="number" min="0" step="0.001" value={l.gross_weight} onChange={(e) => setLine(i, { gross_weight: +e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-20 text-right" type="number" min="0" step="0.001" value={l.net_weight} onChange={(e) => setLine(i, { net_weight: +e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-14 text-right" type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: +e.target.value })} /></td>
                      <td className="px-1 py-1"><input className="input py-1 w-24 text-right" type="number" min="0" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: +e.target.value })} /></td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">{inr((Number(l.unit_cost) || 0) * (Number(l.quantity) || 1))}</td>
                      <td className="px-1 py-1 text-center">{lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))} className="text-red-500 hover:text-red-700">✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])} className="btn-secondary self-start">+ Add Line</button>
              <div className="flex items-center gap-4">
                <div className="text-sm">Total: <strong className="font-serif text-lg text-gold-dark">{inr(grandTotal)}</strong></div>
                <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Record & Create Stock'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-gold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-right">Lines</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">Loading…</td></tr>
               : rows.length === 0 ? <tr><td colSpan="7" className="px-4 py-6 text-center text-ink-muted">No purchases.</td></tr>
               : rows.map((p, i) => (
                <tr key={p.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs">{p.purchase_code}</td>
                  <td className="px-4 py-3">{p.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{p.purchase_date}</td>
                  <td className="px-4 py-3 text-ink-muted">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-right">{p.line_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gold-dark">{inr(p.total_amount)}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openDetail(p.id)} className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white border-l-4 border-l-gold max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-ink text-gold px-4 py-3 flex justify-between items-center">
              <div className="font-serif tracking-widest text-sm">{detail.purchase_code} · {detail.supplier_name || 'No supplier'}</div>
              <button onClick={() => setDetail(null)} className="text-xs uppercase tracking-widest">Close</button>
            </div>
            <div className="p-4">
              <div className="text-xs text-ink-muted mb-3">{detail.purchase_date} · Invoice {detail.invoice_number || '—'} · Total {inr(detail.total_amount)}</div>
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-ink-muted border-b border-gold-light/40">
                  <tr><th className="px-2 py-2 text-left">SKU</th><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id} className="border-b border-gold-light/20">
                      <td className="px-2 py-2 font-mono text-xs">{it.sku || '—'}</td>
                      <td className="px-2 py-2">{it.name}</td>
                      <td className="px-2 py-2 text-right">{it.quantity}</td>
                      <td className="px-2 py-2 text-right">{inr(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>); }
