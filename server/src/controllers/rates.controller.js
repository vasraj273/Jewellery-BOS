import * as rates from '../services/rates.service.js';
import * as goldSvc from '../services/goldRate.service.js';

export function listGold(_req, res, next) {
  try { res.json({ success: true, data: rates.getGold() }); } catch (e) { next(e); }
}

export function latestGold(req, res, next) {
  try { res.json({ success: true, data: goldSvc.getLatest(req.query.location) }); } catch (e) { next(e); }
}

export function listGoldLocations(_req, res, next) {
  try { res.json({ success: true, data: goldSvc.listLocations() }); } catch (e) { next(e); }
}

export function goldConfig(_req, res, next) {
  try { res.json({ success: true, data: goldSvc.getConfig() }); } catch (e) { next(e); }
}

export async function refreshGold(_req, res, next) {
  try { res.json({ success: true, data: await goldSvc.refresh() }); } catch (e) { next(e); }
}

export function upsertGoldManual(req, res, next) {
  try {
    goldSvc.manualUpsert(req.body || {});
    res.json({ success: true, data: goldSvc.getLatest(req.body?.location) });
  } catch (e) { next(e); }
}

export function clearGoldOverride(req, res, next) {
  try {
    goldSvc.clearOverride(req.body || {});
    res.json({ success: true, data: goldSvc.getLatest(req.body?.location) });
  } catch (e) { next(e); }
}
export function listDiamond(_req, res, next) {
  try { res.json({ success: true, data: rates.getDiamond() }); } catch (e) { next(e); }
}
export function listGemstone(_req, res, next) {
  try { res.json({ success: true, data: rates.getGemstone() }); } catch (e) { next(e); }
}
export function listMaking(_req, res, next) {
  try { res.json({ success: true, data: rates.getMaking() }); } catch (e) { next(e); }
}
