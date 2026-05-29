import { Router } from 'express';
import * as finance from '../services/finance.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/dashboard', async (req, res, next) => {
  try { res.json({ success: true, data: await finance.dashboard() }); } catch (e) { next(e); }
});

export default router;
