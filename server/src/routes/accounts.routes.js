import { Router } from 'express';
import * as accounts from '../services/accounts.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/groups', async (req, res, next) => {
  try { res.json({ success: true, data: await accounts.listGroups() }); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await accounts.listAccounts(req.query || {}) }); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await accounts.createAccount(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'account.create', entityType: 'account', entityId: row.id, metadata: { code: row.code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await accounts.updateAccount(req.params.id, req.body || {});
    audit.record({ actor: req.user, action: 'account.update', entityType: 'account', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await accounts.deactivateAccount(req.params.id);
    audit.record({ actor: req.user, action: 'account.deactivate', entityType: 'account', entityId: req.params.id, req });
    res.json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

// ── Journals + ledger ──────────────────────────────────────
router.get('/journals', async (req, res, next) => {
  try { res.json({ success: true, data: await accounts.listJournals(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/journals/:id', async (req, res, next) => {
  try {
    const row = await accounts.getJournal(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post('/journals', async (req, res, next) => {
  try {
    const row = await accounts.createJournal(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'journal.create', entityType: 'journal_entry', entityId: row.id, metadata: { code: row.entry_code }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.get('/ledger/:accountId', async (req, res, next) => {
  try {
    const row = await accounts.ledger(req.params.accountId, req.query || {});
    if (!row) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

export default router;
