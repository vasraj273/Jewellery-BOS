import { Router } from 'express';
import * as production from '../services/production.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/alerts', async (req, res, next) => {
  try { res.json({ success: true, data: await production.alerts() }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await production.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await production.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.put('/:id/stage', async (req, res, next) => {
  try {
    const row = await production.setStage(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'production.stage', entityType: 'production_job', entityId: req.params.id, metadata: { stage: req.body?.stage }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await production.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'production.update', entityType: 'production_job', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/:id/finished-stock', async (req, res, next) => {
  try {
    const row = await production.addFinishedStock(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'production.finished_stock', entityType: 'production_job', entityId: req.params.id, metadata: { sku: row.sku }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
