import { Router } from 'express';
import * as reminders from '../services/reminders.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try { res.json({ success: true, data: await reminders.dashboard(req.user) }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await reminders.list(req.user, req.query || {}) }); }
  catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (req.body?.status === 'done' || req.body?.done === true) {
      const row = await reminders.markDone(req.params.id, req.user);
      audit.record({ actor: req.user, action: 'customer.reminder.done', entityType: 'reminder', entityId: req.params.id, req });
      return res.json({ success: true, data: row });
    }
    res.status(400).json({ success: false, error: 'Unsupported update' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
