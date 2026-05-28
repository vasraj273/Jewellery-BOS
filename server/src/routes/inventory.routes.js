import { Router } from 'express';
import * as inventory from '../services/inventory.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth);

// ── Admin-only dashboard reads (declared before /:id) ──────────
router.get('/summary', requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: await inventory.summary() }); } catch (e) { next(e); }
});

router.get('/alerts', requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: await inventory.alerts(req.query || {}) }); } catch (e) { next(e); }
});

// ── Reads available to all roles (sales-exec views to quote) ───
router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await inventory.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await inventory.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

// ── Writes — admin tier only ───────────────────────────────────
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const row = await inventory.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'inventory.create', entityType: 'inventory_item', entityId: row.id, metadata: { sku: row.sku }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await inventory.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'inventory.update', entityType: 'inventory_item', entityId: req.params.id, metadata: { patch: Object.keys(req.body || {}) }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await inventory.archive(req.params.id);
    audit.record({ actor: req.user, action: 'inventory.archive', entityType: 'inventory_item', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/:id/movement', requireAdmin, async (req, res, next) => {
  try {
    const row = await inventory.recordMovement(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'inventory.movement', entityType: 'inventory_item', entityId: req.params.id, metadata: { type: req.body?.movement_type }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/:id/reserve', requireAdmin, async (req, res, next) => {
  try {
    // Manual admin reservation (the main reserve path is quotation creation).
    const sql = (await import('../database/connection.js')).getDb();
    const row = await sql.begin(async (tx) => {
      await inventory.reserveForQuoteTx(tx, Number(req.params.id), req.body?.quote_id || null, req.user, req.body?.weight);
      const [updated] = await tx`SELECT * FROM inventory_items WHERE id = ${Number(req.params.id)}`;
      return updated;
    });
    audit.record({ actor: req.user, action: 'inventory.reserve', entityType: 'inventory_item', entityId: req.params.id, metadata: { quote_id: req.body?.quote_id || null }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/:id/release', requireAdmin, async (req, res, next) => {
  try {
    const row = await inventory.release(req.params.id, req.user);
    audit.record({ actor: req.user, action: 'inventory.release', entityType: 'inventory_item', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/:id/sell', requireAdmin, async (req, res, next) => {
  try {
    const row = await inventory.markSold(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'inventory.sold', entityType: 'inventory_item', entityId: req.params.id, metadata: { quote_id: row.sold_quotation_id || null }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
