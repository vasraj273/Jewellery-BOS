import { Router } from 'express';
import * as attendance from '../services/attendance.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth);

// Org-wide today counts — admin/super-admin only (HR visibility).
router.get('/today', requireAdmin, async (_req, res, next) => {
  try { res.json({ success: true, data: await attendance.todayStats() }); } catch (e) { next(e); }
});

// The acting user's own status for today — any authenticated user.
router.get('/my-today', async (req, res, next) => {
  try { res.json({ success: true, data: await attendance.myToday(req.user) }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await attendance.list(req.user, req.query || {}) }); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { row } = await attendance.mark(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'attendance.mark', entityType: 'attendance', entityId: row.id, metadata: { employee_id: row.employee_id, date: row.attendance_date, status: row.status }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await attendance.edit(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'attendance.edit', entityType: 'attendance', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
