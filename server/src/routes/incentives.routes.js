import { Router } from 'express';
import * as incentives from '../services/incentives.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth);

// Dashboard summary — admin only.
router.get('/dashboard', requireAdmin, async (_req, res, next) => {
  try { res.json({ success: true, data: await incentives.dashboard() }); } catch (e) { next(e); }
});

// Self summary — any authenticated user (scoped to their own employee record).
router.get('/my-summary', async (req, res, next) => {
  try { res.json({ success: true, data: await incentives.mySummary(req.user) }); } catch (e) { next(e); }
});

// List — sales-exec sees own; admin sees all/filtered (scope inside service).
router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await incentives.list(req.user, req.query || {}) }); } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const row = await incentives.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'incentive.create', entityType: 'incentive', entityId: row.id, metadata: { employee_id: row.employee_id, type: row.type }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const status = req.body?.status;
    const row = await incentives.setStatus(req.params.id, status, req.user);
    audit.record({ actor: req.user, action: `incentive.${status}`, entityType: 'incentive', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
