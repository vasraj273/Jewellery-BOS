import { Router } from 'express';
import * as karigars from '../services/karigars.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await karigars.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await karigars.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await karigars.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'karigar.create', entityType: 'karigar', entityId: row.id, metadata: { code: row.karigar_code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await karigars.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'karigar.update', entityType: 'karigar', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await karigars.deactivate(req.params.id);
    audit.record({ actor: req.user, action: 'karigar.deactivate', entityType: 'karigar', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id/activate', async (req, res, next) => {
  try {
    const row = await karigars.activate(req.params.id);
    audit.record({ actor: req.user, action: 'karigar.activate', entityType: 'karigar', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
