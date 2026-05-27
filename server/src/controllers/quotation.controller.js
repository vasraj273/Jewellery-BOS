import * as quotationService from '../services/quotation.service.js';
import { computePricing } from '../services/pricing.service.js';
import { renderQuotationHtml } from '../services/template.service.js';
import { generatePdf } from '../services/pdf.service.js';
import * as whatsapp from '../services/whatsapp.service.js';

export function list(req, res, next) {
  try {
    const rows = quotationService.listAll();
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}

export function getOne(req, res, next) {
  try {
    const row = quotationService.findByQuoteId(req.params.quoteId);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export function calculate(req, res, next) {
  try {
    const pricing = computePricing(req.body);
    res.json({ success: true, data: pricing });
  } catch (e) { next(e); }
}

/** Renders the master template from raw form input — no DB write. */
export function previewDraft(req, res, next) {
  try {
    const input = req.body || {};
    const pricing = computePricing(input);
    const draft = {
      ...input,
      ...pricing,
      quote_id: input.quote_id || 'QT-DRAFT',
      status: 'draft',
      created_at: new Date().toISOString(),
      valid_till: input.valid_till || defaultValidTill()
    };
    const html = renderQuotationHtml(draft);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { next(e); }
}

function defaultValidTill() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function create(req, res, next) {
  try {
    const saved = quotationService.create(req.body);
    res.status(201).json({ success: true, data: saved });
  } catch (e) { next(e); }
}

export async function preview(req, res, next) {
  try {
    const row = quotationService.findByQuoteId(req.params.quoteId);
    if (!row) return res.status(404).send('Quotation not found');
    const html = renderQuotationHtml(row);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { next(e); }
}

export async function pdf(req, res, next) {
  try {
    const row = quotationService.findByQuoteId(req.params.quoteId);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const html = renderQuotationHtml(row);
    const buffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${row.quote_id}.pdf"`);
    res.send(buffer);
  } catch (e) { next(e); }
}

export function remove(req, res, next) {
  try {
    const ok = quotationService.remove(req.params.quoteId);
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function sendWhatsApp(req, res, next) {
  try {
    const result = await whatsapp.sendQuotation(req.params.quoteId);
    const updated = quotationService.findByQuoteId(req.params.quoteId);
    res.status(result.ok ? 200 : 502).json({ success: result.ok, data: { ...result, quotation: updated } });
  } catch (e) { next(e); }
}

export function whatsappConfig(_req, res, next) {
  try { res.json({ success: true, data: whatsapp.getConfig() }); } catch (e) { next(e); }
}
