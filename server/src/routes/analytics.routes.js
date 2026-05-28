import { Router } from 'express';
import * as analytics from '../services/analytics.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/sales', async (_req, res, next) => {
  try { res.json({ success: true, data: await analytics.salesByExecutive() }); } catch (e) { next(e); }
});

router.get('/conversion', async (_req, res, next) => {
  try { res.json({ success: true, data: await analytics.conversionRate() }); } catch (e) { next(e); }
});

export default router;
