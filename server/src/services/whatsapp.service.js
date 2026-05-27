/**
 * WhatsApp Cloud API (Meta Graph) — quotation PDF delivery.
 *
 * Flow:
 *   sendQuotation(quoteId)
 *     1. renderQuotationHtml  → generatePdf  → PDF buffer
 *     2. uploadMedia          → media_id
 *     3. sendDocument         → message_id
 *     4. persist whatsapp_status on quotation row
 *
 * Failures never break the quotation flow. Caller gets a clear result object;
 * row stamped with status='failed' + error text.
 */

import { getDb } from '../database/connection.js';
import { findByQuoteId } from './quotation.service.js';
import { renderQuotationHtml } from './template.service.js';
import { generatePdf } from './pdf.service.js';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

function requireEnv() {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    const err = new Error('WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set');
    err.status = 500;
    throw err;
  }
  return { token, phoneId };
}

/**
 * Normalize any common Indian / international mobile input to E.164 (+<digits>).
 *
 * Accepts:
 *   "9876543210"       → "+919876543210"   (10-digit local → assume India)
 *   "919876543210"     → "+919876543210"
 *   "+919876543210"    → "+919876543210"
 *   "+91 98765 43210"  → "+919876543210"   (spaces, dashes ignored)
 *   "  +91-98765-43210" → "+919876543210"
 *   "+447911123456"    → "+447911123456"   (non-IN preserved if already has +)
 *
 * Returns '' if not parseable.
 */
function normalizeMobile(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const hadPlus = trimmed.startsWith('+');
  const digits  = trimmed.replace(/\D+/g, '');
  if (!digits) return '';
  if (hadPlus)             return '+' + digits;
  if (digits.length === 10) return '+91' + digits;       // 10-digit Indian local
  return '+' + digits;                                    // already includes country code
}

/** Mask middle digits for log lines (keep +CC + last 2). */
function maskMobile(e164) {
  if (!e164) return '';
  if (e164.length <= 6) return e164;
  const head = e164.slice(0, 3);
  const tail = e164.slice(-2);
  return `${head}${'X'.repeat(Math.max(0, e164.length - 5))}${tail}`;
}

/** Upload PDF to Meta /media — returns media_id. */
async function uploadMedia(pdfBuffer, filename) {
  const { token, phoneId } = requireEnv();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/media`;

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    throw new Error(`media upload failed (${res.status}): ${json?.error?.message || JSON.stringify(json).slice(0, 200)}`);
  }
  return json.id;
}

/**
 * Send TEMPLATE message with document header + body variables.
 *
 * Template contract (must be APPROVED on the WABA):
 *   name:     WHATSAPP_TEMPLATE_NAME  (default 'quotation_document')
 *   lang:     WHATSAPP_TEMPLATE_LANG  (default 'en')
 *   header:   type=DOCUMENT
 *   body:     {{1}} customer_name, {{2}} quote_id, {{3}} final_price
 */
async function sendDocumentTemplate({ to, mediaId, filename, vars }) {
  const { token, phoneId } = requireEnv();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'quotation_document';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  // Meta accepts `to` with or without leading `+`. Pass digits-only.
  const toDigits = to.replace(/^\+/, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toDigits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'header',
          parameters: [
            { type: 'document', document: { id: mediaId, filename } }
          ]
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(vars.customer_name || '') },
            { type: 'text', text: String(vars.quote_id || '') },
            { type: 'text', text: String(vars.final_price || '') }
          ]
        }
      ]
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`send failed (${res.status}): ${json?.error?.message || JSON.stringify(json).slice(0, 200)}`);
  }
  return {
    message_id: json.messages?.[0]?.id || null,
    wa_id:      json.contacts?.[0]?.wa_id || null,
    input:      json.contacts?.[0]?.input || null,
    template:   templateName,
    raw:        json
  };
}

function buildTemplateVars(q) {
  return {
    customer_name: q.customer_name || 'Customer',
    quote_id:      q.quote_id,
    final_price:   Number(q.final_price || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  };
}

async function updateStatus(quoteId, fields) {
  const sql = getDb();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  // postgres.js `sql(obj, ...cols)` builds the SET fragment safely.
  await sql`
    UPDATE quotations
    SET ${sql(fields, ...keys)}, updated_at = now()
    WHERE quote_id = ${quoteId}
  `;
}

/** Orchestrator: render → upload → send → persist. */
export async function sendQuotation(quoteId) {
  const q = await findByQuoteId(quoteId);
  if (!q) {
    const err = new Error('quotation not found');
    err.status = 404;
    throw err;
  }

  const to = normalizeMobile(q.customer_mobile);
  if (!to) {
    const reason = 'customer mobile missing or invalid';
    await updateStatus(quoteId, { whatsapp_status: 'failed', whatsapp_error: reason });
    return { ok: false, error: reason };
  }

  await updateStatus(quoteId, { whatsapp_status: 'pending', whatsapp_error: null });

  try {
    const html = renderQuotationHtml(q);
    const pdf  = await generatePdf(html);
    const filename = `${q.quote_id}.pdf`;

    const mediaId = await uploadMedia(pdf, filename);
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'quotation_document';
    console.log(`[WhatsApp] Sending quote ${q.quote_id} to: ${maskMobile(to)} (raw="${q.customer_mobile}") via template "${templateName}"`);

    const meta = await sendDocumentTemplate({
      to,
      mediaId,
      filename,
      vars: buildTemplateVars(q)
    });

    console.log(`[WhatsApp] Accepted by Meta. message_id=${meta.message_id} wa_id=${meta.wa_id} template=${meta.template}`);

    await updateStatus(quoteId, {
      whatsapp_status: 'sent',
      whatsapp_message_id: meta.message_id,
      whatsapp_sent_at: new Date(),
      whatsapp_error: null
    });

    return {
      ok: true,
      message_id: meta.message_id,
      recipient: to,            // E.164 we sent
      wa_id: meta.wa_id,        // Meta-resolved WhatsApp ID
      input: meta.input,        // Meta echo of input
      status: 'sent'
    };
  } catch (err) {
    console.warn(`[WhatsApp] send failed for ${quoteId}: ${err.message}`);
    await updateStatus(quoteId, {
      whatsapp_status: 'failed',
      whatsapp_error: err.message?.slice(0, 500) || 'unknown error'
    });
    return { ok: false, error: err.message };
  }
}

export function getConfig() {
  return {
    configured: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    waba_id: process.env.WHATSAPP_WABA_ID || null,
    graph_version: GRAPH_VERSION,
    template_name: process.env.WHATSAPP_TEMPLATE_NAME || 'quotation_document',
    template_lang: process.env.WHATSAPP_TEMPLATE_LANG || 'en'
  };
}
