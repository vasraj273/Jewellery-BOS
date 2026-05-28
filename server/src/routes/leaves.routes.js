import { Router } from 'express';
import * as leaves from '../services/leaves.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try { res.json({ success: true, data: await leaves.dashboard(req.user) }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await leaves.list(req.user, req.query || {}) }); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await leaves.request(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'leave.request', entityType: 'leave', entityId: row.id, metadata: { type: row.leave_type, start: row.start_date, end: row.end_date }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const decision = req.body?.status;
    const row = await leaves.decide(req.params.id, decision, req.user);
    audit.record({ actor: req.user, action: `leave.${decision === 'approved' ? 'approve' : 'reject'}`, entityType: 'leave', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
