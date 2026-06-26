import * as quotationService from '../services/quotation.service.js';
import { computePricing } from '../services/pricing.service.js';
import { renderQuotationHtml } from '../services/template.service.js';
import { generatePdf } from '../services/pdf.service.js';
import * as whatsapp from '../services/whatsapp.service.js';
import * as audit from '../services/audit.service.js';
import * as leads from '../services/leads.service.js';
import * as customers from '../services/customers.service.js';

export async function list(req, res, next) {
  try {
    const rows = await quotationService.listAll(req.user, req.query || {});
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}

export async function getOne(req, res, next) {
  try {
    const row = await quotationService.findByQuoteId(req.params.quoteId, req.user);
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
export async function previewDraft(req, res, next) {
  try {
    const input = req.body || {};
    const pricing = computePricing(input);
    const draft = {
      ...input,
      ...pricing,
      quote_id: input.quote_id || 'QT-DRAFT',
      status: 'draft',
      created_at: new Date(),
      valid_till: input.valid_till || defaultValidTill()
    };
    const html = await renderQuotationHtml(draft);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { next(e); }
}

function defaultValidTill() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export async function create(req, res, next) {
  try {
    const saved = await quotationService.create(req.body, req.user);
    audit.record({
      actor: req.user, action: 'quotation.create',
      entityType: 'quotation', entityId: saved.quote_id,
      metadata: { final_price: saved.final_price, location: saved.pricing_location, source_lead_id: saved.source_lead_id || null },
      req
    });
    // CRM auto-conversion: a quote raised from a lead converts that lead.
    // Runs only after a successful save with a real source_lead_id.
    if (saved.source_lead_id) {
      audit.record({
        actor: req.user, action: 'lead.quote_create',
        entityType: 'lead', entityId: saved.source_lead_id,
        metadata: { quote_id: saved.quote_id },
        req
      });
      await leads.markConvertedFromQuotation(saved.source_lead_id, saved.id, req.user).catch(() => {});
    }
    // M8 — a quote raised from inventory reserved the item inside the create tx.
    if (saved.inventory_item_id) {
      audit.record({
        actor: req.user, action: 'inventory.reserve',
        entityType: 'inventory_item', entityId: saved.inventory_item_id,
        metadata: { quote_id: saved.quote_id },
        req
      });
    }

    // Log the quotation on the matching customer's timeline (by mobile).
    await customers.recordQuotationEvent(saved, req.user).catch(() => {});

    res.status(201).json({ success: true, data: saved });
  } catch (e) { next(e); }
}

export async function preview(req, res, next) {
  try {
    const row = await quotationService.findByQuoteId(req.params.quoteId, req.user);
    if (!row) return res.status(404).send('Quotation not found');
    const html = await renderQuotationHtml(row);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { next(e); }
}

export async function pdf(req, res, next) {
  try {
    const row = await quotationService.findByQuoteId(req.params.quoteId, req.user);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const html = await renderQuotationHtml(row);
    const buffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${row.quote_id}.pdf"`);
    res.send(buffer);
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    const ok = await quotationService.remove(req.params.quoteId, req.user);
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    audit.record({
      actor: req.user, action: 'quotation.delete',
      entityType: 'quotation', entityId: req.params.quoteId, req
    });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function updateImage(req, res, next) {
  try {
    const updated = await quotationService.updateImage(
      req.params.quoteId, req.body?.product_image_path, req.user
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
    audit.record({
      actor: req.user, action: 'quotation.image.update',
      entityType: 'quotation', entityId: req.params.quoteId,
      metadata: { product_image_path: updated.product_image_path || null },
      req
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}

export async function sendWhatsApp(req, res, next) {
  try {
    // Scope check first so sales_executive can't trigger WhatsApp on someone else's quote.
    const target = await quotationService.findByQuoteId(req.params.quoteId, req.user);
    if (!target) return res.status(404).json({ success: false, error: 'Not found' });

    const result = await whatsapp.sendQuotation(req.params.quoteId);
    const updated = await quotationService.findByQuoteId(req.params.quoteId, req.user);
    audit.record({
      actor: req.user, action: 'quotation.whatsapp_send',
      entityType: 'quotation', entityId: req.params.quoteId,
      metadata: { ok: result.ok, error: result.error || null },
      req
    });
    res.status(result.ok ? 200 : 502).json({ success: result.ok, data: { ...result, quotation: updated } });
  } catch (e) { next(e); }
}

export function whatsappConfig(_req, res, next) {
  try { res.json({ success: true, data: whatsapp.getConfig() }); } catch (e) { next(e); }
}
