import { Router } from 'express';
import * as shifts from '../services/shifts.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await shifts.list(req.query || {}) }); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await shifts.create(req.body || {});
    audit.record({ actor: req.user, action: 'shift.create', entityType: 'shift', entityId: row.id, metadata: { name: row.shift_name }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await shifts.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'shift.update', entityType: 'shift', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await shifts.deactivate(req.params.id);
    audit.record({ actor: req.user, action: 'shift.deactivate', entityType: 'shift', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/assign/:employeeId', async (req, res, next) => {
  try {
    const row = await shifts.assignToEmployee(req.params.employeeId, req.body?.shift_id);
    audit.record({ actor: req.user, action: 'shift.assign', entityType: 'employee', entityId: req.params.employeeId, metadata: { shift_id: req.body?.shift_id || null }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
