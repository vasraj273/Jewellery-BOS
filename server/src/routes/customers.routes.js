import { Router } from 'express';
import * as customers from '../services/customers.service.js';
import * as reminders from '../services/reminders.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', async (req, res, next) => {
  try { res.json({ success: true, data: await customers.stats(req.user) }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await customers.list(req.user, req.query || {}) }); }
  catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const c = await customers.findById(req.params.id, req.user);
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const c = await customers.update(req.params.id, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'customer.update', entityType: 'customer', entityId: req.params.id, metadata: { patch: Object.keys(req.body || {}) }, req });
    res.json({ success: true, data: c });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.get('/:id/events', async (req, res, next) => {
  try { res.json({ success: true, data: await customers.listEvents(req.params.id, req.user) }); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.post('/:id/events', async (req, res, next) => {
  try {
    // Scope check: actor must be able to see the customer.
    const c = await customers.findById(req.params.id, req.user);
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    const row = await customers.addEvent(req.params.id, { event_type: 'note', title: req.body?.title || 'Note', notes: req.body?.notes }, req.user);
    audit.record({ actor: req.user, action: 'customer.note', entityType: 'customer', entityId: req.params.id, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post('/:id/reminders', async (req, res, next) => {
  try {
    const c = await customers.findById(req.params.id, req.user);
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    const row = await reminders.create({ ...req.body, customer_id: req.params.id }, req.user);
    await customers.addEvent(req.params.id, { event_type: 'reminder_added', title: `Reminder: ${row.title}`, notes: row.notes }, req.user);
    audit.record({ actor: req.user, action: 'customer.reminder.add', entityType: 'customer', entityId: req.params.id, metadata: { reminder_id: row.id, due_at: row.due_at }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
