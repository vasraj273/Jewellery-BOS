import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authSvc from '../services/auth.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Brute-force guard on the login endpoint only.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};
  try {
    const result = await authSvc.login({ email, password });
    audit.record({
      actor: result.user, action: 'auth.login',
      entityType: 'auth', entityId: result.user.id, req
    });
    res.json({ success: true, data: result });
  } catch (e) {
    if (e.status === 401) {
      audit.record({
        actor: null, action: 'auth.login_failed',
        entityType: 'auth', metadata: { email: email || null }, req
      });
      return res.status(401).json({ success: false, error: e.message });
    }
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

// Stateless logout — client drops the token. Endpoint exists for symmetry / future audit.
router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.user });
});

export default router;
