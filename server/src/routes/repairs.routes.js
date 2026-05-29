import { Router } from 'express';
import * as repairs from '../services/repairs.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/dashboard', async (req, res, next) => {
  try { res.json({ success: true, data: await repairs.dashboard() }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await repairs.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await repairs.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await repairs.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'repair.create', entityType: 'repair_order', entityId: row.id, metadata: { code: row.repair_code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await repairs.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'repair.update', entityType: 'repair_order', entityId: req.params.id, metadata: { status: req.body?.status }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
