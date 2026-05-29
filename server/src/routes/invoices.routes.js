import { Router } from 'express';
import * as invoices from '../services/invoices.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await invoices.list(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await invoices.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const buffer = await invoices.pdf(req.params.id);
    if (!buffer) return res.status(404).json({ success: false, error: 'Not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

router.post('/from-so/:soId', async (req, res, next) => {
  try {
    const row = await invoices.createFromSalesOrder(req.params.soId, req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'invoice.create', entityType: 'invoice', entityId: row.id, metadata: { code: row.invoice_code, total: row.total_amount }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
