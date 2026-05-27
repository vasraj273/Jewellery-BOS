import { useState } from 'react';
import { quotationsApi } from '../api/client.js';

/**
 * Send-on-WhatsApp action.
 *
 * Props:
 *   quoteId            — required
 *   variant: 'primary' | 'link'  (default 'primary')
 *   onSent             — optional callback(result) after success/fail
 *   initialStatus      — last known whatsapp_status to bootstrap label
 */
export default function SendWhatsAppButton({ quoteId, variant = 'primary', onSent, initialStatus }) {
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState(initialStatus || null);
  const [toast, setToast]   = useState(null); // { kind: 'ok'|'err', text }

  async function send() {
    if (busy) return;
    setBusy(true);
    setStatus('pending');
    setToast(null);
    try {
      const res = await quotationsApi.sendWhatsApp(quoteId);
      const ok  = !!res.success;
      const wpStatus = res?.data?.quotation?.whatsapp_status || (ok ? 'sent' : 'failed');
      setStatus(wpStatus);
      setToast(ok
        ? { kind: 'ok',  text: 'Sent on WhatsApp' }
        : { kind: 'err', text: res?.data?.error || 'Send failed' });
      onSent?.(res);
    } catch (e) {
      setStatus('failed');
      setToast({ kind: 'err', text: e?.response?.data?.data?.error || e.message || 'Send failed' });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const label = busy
    ? 'Sending…'
    : status === 'sent'   ? 'Resend on WhatsApp'
    : status === 'failed' ? 'Retry WhatsApp'
    :                       'Send on WhatsApp';

  if (variant === 'link') {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={send}
          disabled={busy}
          className="text-xs uppercase tracking-widest text-gold-dark hover:text-gold disabled:opacity-50"
        >
          {label}
        </button>
        {toast && <span className={`text-[10px] ${toast.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{toast.text}</span>}
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div className="flex flex-col gap-1 w-full">
        <button
          onClick={send}
          disabled={busy}
          className="w-full inline-flex items-center justify-center px-3 py-2 text-xs uppercase tracking-widest bg-[#25D366] text-white border border-[#1ea952] hover:bg-[#1ea952] disabled:opacity-50"
        >
          {label}
        </button>
        {toast && (
          <span className={`text-[10px] text-center ${toast.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{toast.text}</span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={busy}
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium tracking-wide uppercase bg-[#25D366] text-white border border-[#1ea952] hover:bg-[#1ea952] disabled:opacity-50"
      >
        {label}
      </button>
      {toast && (
        <span className={`text-[11px] ${toast.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{toast.text}</span>
      )}
    </div>
  );
}
