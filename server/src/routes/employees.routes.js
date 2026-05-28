import { Router } from 'express';
import * as employees from '../services/employees.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
// Entire directory is admin tier only.
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await employees.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const emp = await employees.findById(req.params.id);
    if (!emp) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: emp });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const emp = await employees.create(req.body || {});
    audit.record({ actor: req.user, action: 'employee.create', entityType: 'employee', entityId: emp.id, metadata: { code: emp.employee_code }, req });
    res.status(201).json({ success: true, data: emp });
  } catch (e) {
    if (e?.message?.includes('duplicate key')) return res.status(409).json({ success: false, error: 'Employee already exists for that user' });
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const emp = await employees.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'employee.update', entityType: 'employee', entityId: req.params.id, metadata: { patch: Object.keys(req.body || {}) }, req });
    res.json({ success: true, data: emp });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const emp = await employees.deactivate(req.params.id);
    audit.record({ actor: req.user, action: 'employee.deactivate', entityType: 'employee', entityId: req.params.id, req });
    res.json({ success: true, data: emp });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
