import { Router } from 'express';
import * as settings from '../services/settings.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();

// Any authenticated user can read settings (form/preview need them).
router.get('/', requireAuth, async (_req, res, next) => {
  try { res.json({ success: true, data: await settings.get() }); }
  catch (e) { next(e); }
});

// Mutations: admin tier only.
router.put('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const row = await settings.update(req.body || {}, req.user);
    audit.record({
      actor: req.user, action: 'settings.update',
      entityType: 'settings', entityId: 1,
      metadata: { fields: Object.keys(req.body || {}) },
      req
    });
    res.json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
