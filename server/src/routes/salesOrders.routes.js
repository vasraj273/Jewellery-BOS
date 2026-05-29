import { Router } from 'express';
import * as so from '../services/salesOrders.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: await so.dashboard() }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await so.list(req.user, req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await so.findById(req.params.id, req.user);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

// Convert a quotation → sales order (scoped quote read: owner or admin).
router.post('/from-quote/:quoteId', async (req, res, next) => {
  try {
    const row = await so.convertFromQuote(req.params.quoteId, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'sales_order.create', entityType: 'sales_order', entityId: row.id, metadata: { code: row.order_code, quote: req.params.quoteId }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const row = await so.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'sales_order.create', entityType: 'sales_order', entityId: row.id, metadata: { code: row.order_code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await so.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'sales_order.update', entityType: 'sales_order', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const row = await so.setStatus(req.params.id, req.body?.status, req.user);
    audit.record({ actor: req.user, action: `sales_order.${req.body?.status}`, entityType: 'sales_order', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
