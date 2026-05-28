import { Router } from 'express';
import * as suppliers from '../services/suppliers.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
// Procurement is admin tier only.
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await suppliers.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await suppliers.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await suppliers.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'supplier.create', entityType: 'supplier', entityId: row.id, metadata: { code: row.supplier_code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await suppliers.update(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'supplier.update', entityType: 'supplier', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await suppliers.deactivate(req.params.id);
    audit.record({ actor: req.user, action: 'supplier.deactivate', entityType: 'supplier', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
