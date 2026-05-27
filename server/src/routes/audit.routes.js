import { Router } from 'express';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await audit.listRecent(req.query.limit) }); }
  catch (e) { next(e); }
});

export default router;
