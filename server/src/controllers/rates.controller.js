import * as rates from '../services/rates.service.js';
import * as goldSvc from '../services/goldRate.service.js';

export async function listGold(_req, res, next) {
  try { res.json({ success: true, data: await rates.getGold() }); } catch (e) { next(e); }
}

export async function latestGold(req, res, next) {
  try { res.json({ success: true, data: await goldSvc.getLatest(req.query.location) }); } catch (e) { next(e); }
}

export async function listGoldLocations(_req, res, next) {
  try { res.json({ success: true, data: await goldSvc.listLocations() }); } catch (e) { next(e); }
}

export function goldConfig(_req, res, next) {
  try { res.json({ success: true, data: goldSvc.getConfig() }); } catch (e) { next(e); }
}

export async function refreshGold(_req, res, next) {
  try { res.json({ success: true, data: await goldSvc.refresh() }); } catch (e) { next(e); }
}

export async function upsertGoldManual(req, res, next) {
  try {
    await goldSvc.manualUpsert(req.body || {});
    res.json({ success: true, data: await goldSvc.getLatest(req.body?.location) });
  } catch (e) { next(e); }
}

export async function clearGoldOverride(req, res, next) {
  try {
    await goldSvc.clearOverride(req.body || {});
    res.json({ success: true, data: await goldSvc.getLatest(req.body?.location) });
  } catch (e) { next(e); }
}
export async function listDiamond(_req, res, next) {
  try { res.json({ success: true, data: await rates.getDiamond() }); } catch (e) { next(e); }
}
export async function listGemstone(_req, res, next) {
  try { res.json({ success: true, data: await rates.getGemstone() }); } catch (e) { next(e); }
}
export async function listMaking(_req, res, next) {
  try { res.json({ success: true, data: await rates.getMaking() }); } catch (e) { next(e); }
}
