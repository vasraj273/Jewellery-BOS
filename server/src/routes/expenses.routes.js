import { Router } from 'express';
import * as expenses from '../services/expenses.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await expenses.list(req.query || {}) }); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await expenses.create(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'expense.create', entityType: 'expense', entityId: row.id, metadata: { code: row.expense_code, amount: row.amount, category: row.category }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
