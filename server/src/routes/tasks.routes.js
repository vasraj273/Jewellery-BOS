import { Router } from 'express';
import * as tasks from '../services/tasks.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try { res.json({ success: true, data: await tasks.dashboard(req.user) }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await tasks.list(req.user, req.query || {}) }); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await tasks.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'task.create', entityType: 'task', entityId: row.id, metadata: { assignee: row.assigned_to_user_id, priority: row.priority }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await tasks.update(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'task.update', entityType: 'task', entityId: req.params.id, metadata: { fields: Object.keys(req.body || {}) }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
