import { Router } from 'express';
import * as calendar from '../services/hrCalendar.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await calendar.month(req.query?.month) }); } catch (e) { next(e); }
});

export default router;
