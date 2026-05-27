import cron from 'node-cron';
import { refresh as refreshGold, getLatest } from './goldRate.service.js';

let scheduledTask = null;

/**
 * Boot the scheduler. Default: daily 09:00 IST.
 * Env override: GOLD_FETCH_CRON (any valid 5-field cron string)
 * Disable entirely with GOLD_FETCH_ENABLED=false
 */
export async function startScheduler() {
  if ((process.env.GOLD_FETCH_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[Scheduler] Disabled via GOLD_FETCH_ENABLED=false');
    return;
  }

  const expr = process.env.GOLD_FETCH_CRON || '0 9 * * *';
  if (!cron.validate(expr)) {
    console.warn(`[Scheduler] Invalid GOLD_FETCH_CRON "${expr}" — using default 0 9 * * *`);
  }
  const cronExpr = cron.validate(expr) ? expr : '0 9 * * *';

  scheduledTask = cron.schedule(cronExpr, async () => {
    console.log('[Scheduler] Cron trigger → refreshing gold rates');
    await refreshGold();
  }, { timezone: process.env.TZ || 'Asia/Kolkata' });

  console.log(`[Scheduler] Gold rate cron registered: "${cronExpr}" (${process.env.TZ || 'Asia/Kolkata'})`);

  // One-shot refresh on boot if DB has no rates OR last update is stale (>24h).
  if (await isStale()) {
    console.log('[Scheduler] Boot refresh — DB empty or stale');
    await refreshGold();
  }
}

export function stopScheduler() {
  if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
}

async function isStale() {
  const rows = await getLatest();
  if (rows.length === 0) return true;
  // postgres returns timestamptz as a Date instance; SQLite returned text.
  // new Date(x) handles both shapes.
  const newest = rows.reduce((max, r) => {
    const t = new Date(r.updated_at).getTime();
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);
  if (!newest) return true;
  return Date.now() - newest > 24 * 60 * 60 * 1000;
}
