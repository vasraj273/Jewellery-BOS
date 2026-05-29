import { Router } from 'express';
import * as payments from '../services/payments.service.js';
import * as salesOrders from '../services/salesOrders.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roles.middleware.js';

const router = Router();
router.use(requireAuth);

// Customer payment status for a sales order — scoped to the SO owner (or admin).
router.get('/sales-order/:id', async (req, res, next) => {
  try {
    const so = await salesOrders.findById(req.params.id, req.user); // null if sales-exec is not owner
    if (!so) return res.status(404).json({ success: false, error: 'Not found' });
    const data = await payments.forSalesOrder(Number(req.params.id));
    res.json({ success: true, data: { ...data, order_total: Number(so.total_amount), balance: Number(so.total_amount) - data.paid } });
  } catch (e) { next(e); }
});

// ── Everything below is admin-only ──────────────────────────
router.use(requireAdmin);

router.get('/customer', async (req, res, next) => {
  try { res.json({ success: true, data: await payments.listCustomerPayments(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/supplier', async (req, res, next) => {
  try { res.json({ success: true, data: await payments.listSupplierPayments(req.query || {}) }); } catch (e) { next(e); }
});

router.get('/supplier-summary', async (req, res, next) => {
  try { res.json({ success: true, data: await payments.supplierSummary() }); } catch (e) { next(e); }
});

router.get('/supplier/:id', async (req, res, next) => {
  try { res.json({ success: true, data: await payments.forSupplier(Number(req.params.id)) }); } catch (e) { next(e); }
});

router.post('/customer', async (req, res, next) => {
  try {
    const row = await payments.createCustomerPayment(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'payment.create', entityType: 'payment', entityId: row.id, metadata: { code: row.payment_code, amount: row.amount, so: row.sales_order_id } , req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/supplier', async (req, res, next) => {
  try {
    const row = await payments.createSupplierPayment(req.body || {}, req.user);
    audit.record({ actor: req.user, action: 'payment.supplier_create', entityType: 'payment', entityId: row.id, metadata: { code: row.payment_code, amount: row.amount, supplier: row.supplier_id }, req });
    res.status(201).json({ success: true, data: row });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
