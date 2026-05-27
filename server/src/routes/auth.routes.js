import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authSvc from '../services/auth.service.js';
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
  try {
    const { email, password } = req.body || {};
    const result = await authSvc.login({ email, password });
    res.json({ success: true, data: result });
  } catch (e) {
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
