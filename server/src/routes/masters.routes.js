import { Router } from 'express';
import * as masters from '../services/masters.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();

router.get('/_types', requireAuth, (_req, res) => {
  res.json({ success: true, data: masters.listTypes() });
});

// Any authenticated user can read masters (form dropdowns need them).
router.get('/:type', requireAuth, async (req, res, next) => {
  try {
    const includeInactive = req.query.all === '1' && (req.user.role === 'super_admin' || req.user.role === 'admin');
    const rows = await masters.list(req.params.type, { includeInactive });
    res.json({ success: true, data: rows });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

// Mutations: admin tier only.
router.post('/:type', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const row = await masters.create(req.params.type, req.body || {});
    audit.record({
      actor: req.user, action: `master.${req.params.type}.create`,
      entityType: 'master', entityId: row.id,
      metadata: { type: req.params.type, label: row.label },
      req
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (e?.message?.includes('duplicate key')) {
      return res.status(409).json({ success: false, error: 'A row with that label already exists' });
    }
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:type/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const row = await masters.update(req.params.type, req.params.id, req.body || {});
    audit.record({
      actor: req.user, action: `master.${req.params.type}.update`,
      entityType: 'master', entityId: req.params.id,
      metadata: { type: req.params.type, patch: Object.keys(req.body || {}) },
      req
    });
    res.json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.delete('/:type/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const row = await masters.deactivate(req.params.type, req.params.id);
    audit.record({
      actor: req.user, action: `master.${req.params.type}.deactivate`,
      entityType: 'master', entityId: req.params.id,
      metadata: { type: req.params.type },
      req
    });
    res.json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
