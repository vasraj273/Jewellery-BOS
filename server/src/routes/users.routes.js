import { Router } from 'express';
import * as users from '../services/users.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/roles.middleware.js';

const router = Router();

// All user-management endpoints require auth + admin tier.
router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res, next) => {
  try { res.json({ success: true, data: await users.listAll() }); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    // Only super_admin can create another super_admin.
    if (req.body?.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only a super_admin can create another super_admin' });
    }
    const user = await users.create(req.body || {});
    audit.record({
      actor: req.user, action: 'user.create',
      entityType: 'user', entityId: user.id,
      metadata: { role: user.role, email: user.email },
      req
    });
    res.status(201).json({ success: true, data: user });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    // Only super_admin can elevate someone to super_admin.
    if (req.body?.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only a super_admin can assign the super_admin role' });
    }
    const user = await users.update(req.params.id, req.body || {}, req.user);
    audit.record({
      actor: req.user, action: 'user.update',
      entityType: 'user', entityId: user.id,
      metadata: { patch: Object.keys(req.body || {}) },
      req
    });
    res.json({ success: true, data: user });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:id/password', async (req, res, next) => {
  try {
    await users.resetPassword(req.params.id, req.body?.password);
    audit.record({
      actor: req.user, action: 'user.password_reset',
      entityType: 'user', entityId: req.params.id,
      req
    });
    res.json({ success: true });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

// Permanent delete. Only super_admin. `?purge=true` also wipes the user's
// quotations / leads / customers; otherwise those are kept (unassigned).
router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const purge = req.query.purge === 'true' || req.body?.purge === true;
    const result = await users.hardDelete(req.params.id, req.user, { purge });
    audit.record({
      actor: req.user, action: purge ? 'user.purge' : 'user.delete',
      entityType: 'user', entityId: req.params.id,
      metadata: { email: result.email, purge, purged: result.purged },
      req
    });
    res.json({ success: true, data: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
