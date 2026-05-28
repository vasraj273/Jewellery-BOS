import { Router } from 'express';
import * as leads from '../services/leads.service.js';
import * as catalog from '../services/leadCatalog.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

// Catalogs (read) — any authenticated user.
router.get('/sources',  async (_req, res, next) => {
  try { res.json({ success: true, data: await catalog.listSources() }); } catch (e) { next(e); }
});
router.get('/statuses', async (_req, res, next) => {
  try { res.json({ success: true, data: await catalog.listStatuses() }); } catch (e) { next(e); }
});

router.get('/stats', async (req, res, next) => {
  try { res.json({ success: true, data: await leads.stats(req.user) }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await leads.list(req.user, req.query || {}) }); }
  catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const lead = await leads.findById(req.params.id, req.user);
    if (!lead) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: lead });
  } catch (e) { next(e); }
});

router.get('/:id/followups', async (req, res, next) => {
  try { res.json({ success: true, data: await leads.listFollowups(req.params.id, req.user) }); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const lead = await leads.create(req.body || {}, req.user);
    audit.record({
      actor: req.user, action: 'lead.create',
      entityType: 'lead', entityId: lead.id,
      metadata: { lead_code: lead.lead_code, assigned_user_id: lead.assigned_user_id },
      req
    });
    res.status(201).json({ success: true, data: lead });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { lead, reassigned } = await leads.update(req.params.id, req.body || {}, req.user);
    audit.record({
      actor: req.user, action: 'lead.update',
      entityType: 'lead', entityId: req.params.id,
      metadata: { patch: Object.keys(req.body || {}) },
      req
    });
    if (reassigned.changed) {
      audit.record({
        actor: req.user, action: 'lead.assign',
        entityType: 'lead', entityId: req.params.id,
        metadata: { from: reassigned.from, to: reassigned.to },
        req
      });
    }
    res.json({ success: true, data: lead });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

router.post('/:id/followups', async (req, res, next) => {
  try {
    const row = await leads.addFollowup(req.params.id, req.body || {}, req.user);
    audit.record({
      actor: req.user, action: 'lead.followup.add',
      entityType: 'lead', entityId: req.params.id,
      metadata: { followup_id: row.id },
      req
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
