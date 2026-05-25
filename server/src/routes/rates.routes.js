import { Router } from 'express';
import * as ctrl from '../controllers/rates.controller.js';

const router = Router();

router.get('/gold',                ctrl.listGold);
router.get('/gold/latest',         ctrl.latestGold);             // ?location=Mumbai (optional)
router.get('/gold/locations',      ctrl.listGoldLocations);
router.post('/gold/refresh',       ctrl.refreshGold);
router.post('/gold/manual',        ctrl.upsertGoldManual);       // { location, purity, rate_per_gram, is_override }
router.post('/gold/clear-override',ctrl.clearGoldOverride);      // { location, purity }
router.get('/diamond',             ctrl.listDiamond);
router.get('/gemstone',            ctrl.listGemstone);
router.get('/making',              ctrl.listMaking);

export default router;
