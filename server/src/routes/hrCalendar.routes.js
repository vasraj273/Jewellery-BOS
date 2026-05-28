import { Router } from 'express';
import * as calendar from '../services/hrCalendar.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await calendar.month(req.query?.month) }); } catch (e) { next(e); }
});

router.post('/events', async (req, res, next) => {
  try {
    const row = await calendar.createEvent(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'calendar.create', entityType: 'calendar_event', entityId: row.id, metadata: { title: row.title, date: row.event_date }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/events/:id', async (req, res, next) => {
  try {
    const row = await calendar.updateEvent(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'calendar.update', entityType: 'calendar_event', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.delete('/events/:id', async (req, res, next) => {
  try {
    const row = await calendar.deleteEvent(req.params.id);
    audit.record({ actor: req.user, action: 'calendar.delete', entityType: 'calendar_event', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
