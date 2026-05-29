import { Router } from 'express';
import * as jobWorks from '../services/jobWorks.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/dashboard', async (req, res, next) => {
  try { res.json({ success: true, data: await jobWorks.dashboard() }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await jobWorks.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await jobWorks.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await jobWorks.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'job_work.create', entityType: 'job_work', entityId: row.id, metadata: { code: row.job_work_code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await jobWorks.update(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'job_work.update', entityType: 'job_work', entityId: req.params.id, metadata: { status: req.body?.status }, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
