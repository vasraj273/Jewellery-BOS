import { Router } from 'express';
import * as ctrl from '../controllers/quotation.controller.js';

const router = Router();

router.get('/',                       ctrl.list);
router.get('/whatsapp/config',        ctrl.whatsappConfig);
router.post('/calculate',             ctrl.calculate);
router.post('/preview-draft',         ctrl.previewDraft);
router.post('/',                      ctrl.create);
router.get('/:quoteId',               ctrl.getOne);
router.get('/:quoteId/preview',       ctrl.preview);
router.get('/:quoteId/pdf',           ctrl.pdf);
router.post('/:quoteId/whatsapp/send',ctrl.sendWhatsApp);
router.patch('/:quoteId/image',       ctrl.updateImage);
router.delete('/:quoteId',            ctrl.remove);

export default router;
