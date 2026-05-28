import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { inventoryApi, uploadsApi, docUploadApi, assetUrl } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const MANUAL_MOVES = ['repair', 'damaged', 'transfer_out', 'transfer_in', 'return_in', 'return_out'];

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const isAdmin = !!me && ADMIN_ROLES.includes(me.role);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [move, setMove] = useState({ movement_type: 'repair', reason: '' });
  const [busy, setBusy] = useState(false);

  function flash(kind, text) { setToast({ kind, text }); setTimeout(() => setToast(null), 4000); }
  function reload() { return inventoryApi.get(id).then(setItem).catch(() => setItem(null)).finally(() => setLoading(false)); }
  useEffect(() => { setLoading(true); reload(); /* eslint-disable-next-line */ }, [id]);

  async function act(fn, okMsg) {
    setBusy(true);
    try { await fn(); flash('ok', okMsg); await reload(); }
    catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function uploadImage(file, kind) {
    if (!file) return;
    setBusy(true);
    try {
      const up = kind === 'certificate' ? await docUploadApi.upload(file) : await uploadsApi.image(file);
      await inventoryApi.update(id, kind === 'certificate' ? { certificate_url: up.url } : { image_url: up.url });
      flash('ok', `${kind === 'certificate' ? 'Certificate' : 'Image'} uploaded`);
      await reload();
    } catch (err) { flash('err', err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="text-ink-muted">Loading…</div>;
  if (!item) return <div className="card">Item not found. <Link to="/inventory" className="text-gold-dark">← Inventory</Link></div>;

  const val = item.valuation || {};
  const canQuote = item.status === 'in_stock';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <Link to="/inventory" className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold">← Inventory</Link>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink mt-1">{item.name}</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-1 font-mono">{item.sku} · {item.status.replace('_', ' ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canQuote && (
            <button onClick={() => navigate(`/quotations/new?item=${item.id}`)} className="btn-primary">Reserve &amp; Quote</button>
          )}
          {isAdmin && item.status === 'reserved' && (
            <>
              <button onClick={() => act(() => inventoryApi.release(item.id), 'Reservation released')} disabled={busy} className="btn-secondary">Release</button>
              <button onClick={() => act(() => inventoryApi.sell(item.id, {}), 'Marked sold')} disabled={busy} className="btn-primary">Mark Sold</button>
            </>
          )}
          {isAdmin && item.status === 'in_stock' && (
            <button onClick={() => act(() => inventoryApi.sell(item.id, {}), 'Marked sold')} disabled={busy} className="btn-secondary">Mark Sold</button>
          )}
          {isAdmin && item.status !== 'archived' && (
            <button onClick={() => { if (confirm('Archive this item?')) act(() => inventoryApi.archive(item.id), 'Archived'); }} disabled={busy} className="btn-secondary">Archive</button>
          )}
        </div>
      </div>

      {toast && <div className={`mb-4 px-4 py-3 text-sm border ${toast.kind === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>{toast.text}</div>}

      {item.reserved_quotation_id && (
        <div className="mb-4 px-4 py-3 border border-amber-300 bg-amber-50 text-amber-700 text-sm">
          Reserved against quotation <Link to={`/quotations/${item.reserved_quotation_id}`} className="font-medium underline">{item.reserved_quotation_id}</Link>
        </div>
      )}
      {item.sold_quotation_id && (
        <div className="mb-4 px-4 py-3 border border-gray-300 bg-gray-50 text-gray-600 text-sm">
          Sold against quotation <Link to={`/quotations/${item.sold_quotation_id}`} className="font-medium underline">{item.sold_quotation_id}</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="section-title">Specifications</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
              <KV k="Category" v={item.category} />
              <KV k="Metal" v={item.metal_type} />
              <KV k="Purity" v={item.purity} />
              <KV k="Gross Wt" v={`${Number(item.gross_weight || 0).toFixed(3)} g`} />
              <KV k="Net Wt" v={`${Number(item.net_weight || 0).toFixed(3)} g`} />
              <KV k="Design Code" v={item.design_code} />
              <KV k="Diamond" v={item.diamond_type} />
              <KV k="Diamond Carat" v={item.diamond_carat} />
              <KV k="Gemstone" v={item.gemstone} />
              <KV k="Gemstone Carat" v={item.gemstone_carat} />
              <KV k="Location" v={item.location} />
              <KV k="Supplier" v={item.supplier_name} />
            </div>
            {item.notes && <p className="text-sm text-ink-muted mt-4 border-t border-gold-light/40 pt-3">{item.notes}</p>}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Movement Ledger</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {(!item.movements || item.movements.length === 0) ? <tr><td className="px-4 py-6 text-center text-ink-muted">No movements.</td></tr>
                   : item.movements.map((m, i) => (
                    <tr key={m.id} className={`border-b border-gold-light/20 ${i % 2 ? 'bg-off-white' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-wider font-medium ${m.direction === 'in' ? 'text-green-700' : 'text-red-600'}`}>{m.direction === 'in' ? '▲ IN' : '▼ OUT'}</span>
                        <div className="font-medium">{m.movement_type.replace('_', ' ')}</div>
                        {m.reason && <div className="text-[10px] text-ink-muted">{m.reason}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-ink-muted">{Number(m.weight || 0).toFixed(2)}g · qty {m.quantity}</td>
                      <td className="px-4 py-3 text-right text-xs text-ink-muted">{m.actor_name || '—'}<div>{fmtDate(m.created_at)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isAdmin && item.status !== 'archived' && item.status !== 'sold' && (
            <div className="card">
              <h2 className="section-title">Record Movement</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div><label className="label">Type</label>
                  <select className="input" value={move.movement_type} onChange={(e) => setMove({ ...move, movement_type: e.target.value })}>
                    {MANUAL_MOVES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Reason</label><input className="input" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} /></div>
                <button onClick={() => act(() => inventoryApi.movement(item.id, move), 'Movement recorded')} disabled={busy} className="btn-primary justify-center">Record</button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card border-l-4 border-l-gold">
            <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-1">Valuation</div>
            <div className="font-serif text-3xl text-ink">{inr(val.market_value)}</div>
            <div className="text-xs text-ink-muted mt-2 space-y-1">
              <div className="flex justify-between"><span>Purchase Cost</span><span>{inr(val.purchase_cost)}</span></div>
              <div className="flex justify-between"><span>Margin</span><span className={val.margin >= 0 ? 'text-green-700' : 'text-red-600'}>{inr(val.margin)}</span></div>
            </div>
            <div className="text-[10px] text-ink-muted mt-3 border-t border-gold-light/40 pt-2">Market value = net weight × live gold rate + stone value + making.</div>
          </div>

          {item.image_url && (
            <div className="card">
              <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">Image</div>
              <img src={assetUrl(item.image_url)} alt={item.name} className="w-full rounded border border-gold-light/40" />
            </div>
          )}
          {item.certificate_url && (
            <a href={assetUrl(item.certificate_url)} target="_blank" rel="noreferrer" className="card block text-center text-sm text-gold-dark hover:text-gold">View Certificate →</a>
          )}

          {isAdmin && (
            <div className="card">
              <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">Upload</div>
              <label className="label">Image</label>
              <input type="file" accept="image/*" className="text-xs mb-3" onChange={(e) => uploadImage(e.target.files?.[0], 'image')} disabled={busy} />
              <label className="label">Certificate (PDF/Image)</label>
              <input type="file" accept="image/*,application/pdf" className="text-xs" onChange={(e) => uploadImage(e.target.files?.[0], 'certificate')} disabled={busy} />
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
