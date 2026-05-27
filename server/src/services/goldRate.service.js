import { getDatabase } from '../database/connection.js';
import { getGoldProvider, getSupportedLocations } from './providers/goldProvider.js';
import { applyMarkup, getMarkupConfig } from './indiaMarkup.service.js';

/**
 * GoldRateService — location-aware single source of truth.
 *
 * Resolution order for (location, purity):
 *   1. Active manual override (is_override = 1)            ← admin wins
 *   2. Latest live rate (most recent updated_at)
 *
 * Frozen snapshot: quotations stamp rate at creation time. Future refreshes
 * never mutate historic rows.
 */

export async function refresh() {
  const provider = getGoldProvider();
  const db = getDatabase();
  try {
    const raw = await provider.fetchRates();
    const adjusted = applyMarkup(raw.rates, raw.source);

    const stmt = db.prepare(`
      INSERT INTO gold_rates (location, purity, rate_per_gram, source, is_override, effective_date, updated_at)
      VALUES (?, ?, ?, ?, 0, date('now'), datetime('now'))
    `);
    const tx = db.transaction((rows) => {
      for (const r of rows) stmt.run(r.location || 'Mumbai', r.purity, r.rate_per_gram, adjusted.source);
    });
    tx(adjusted.rates);

    console.log(`[GoldRate] Refreshed ${adjusted.rates.length} rates (${adjusted.source}${adjusted.applied ? ` +${adjusted.pct}%` : ''})`);
    return { ok: true, source: adjusted.source, markup_pct: adjusted.pct, count: adjusted.rates.length };
  } catch (err) {
    console.warn(`[GoldRate] Refresh failed — keeping existing DB rates. ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** Public read of current markup config (for frontend transparency). */
export function getConfig() {
  const m = getMarkupConfig();
  return {
    provider: (process.env.GOLD_PROVIDER || 'mock').toLowerCase(),
    markup_enabled: m.enabled,
    markup_pct: m.pct
  };
}

/** All locations with at least one rate (DB-derived) merged with provider-supported list. */
export function listLocations() {
  const fromDb = getDatabase()
    .prepare(`SELECT DISTINCT location FROM gold_rates ORDER BY location`)
    .all()
    .map((r) => r.location);
  const merged = new Set([...getSupportedLocations(), ...fromDb]);
  return [...merged].sort();
}

/** Latest effective rate per (location, purity) — override wins, else newest. */
export function getLatest(location) {
  const db = getDatabase();
  if (location) {
    return db.prepare(`
      SELECT location, purity, rate_per_gram, source, is_override, updated_at
      FROM gold_rates AS g
      WHERE location = ?
        AND id = (
          SELECT id FROM gold_rates
          WHERE location = g.location AND purity = g.purity
          ORDER BY is_override DESC, updated_at DESC, id DESC
          LIMIT 1
        )
      ORDER BY purity
    `).all(location);
  }
  return db.prepare(`
    SELECT location, purity, rate_per_gram, source, is_override, updated_at
    FROM gold_rates AS g
    WHERE id = (
      SELECT id FROM gold_rates
      WHERE location = g.location AND purity = g.purity
      ORDER BY is_override DESC, updated_at DESC, id DESC
      LIMIT 1
    )
    ORDER BY location, purity
  `).all();
}

export function getLatestForPurity(purity, location) {
  return getDatabase().prepare(`
    SELECT location, purity, rate_per_gram, source, is_override, updated_at
    FROM gold_rates
    WHERE purity = ? AND location = ?
    ORDER BY is_override DESC, updated_at DESC, id DESC
    LIMIT 1
  `).get(purity, location);
}

/** Insert manual override (or "use live" toggle that just clears overrides). */
export function manualUpsert({ location, purity, rate_per_gram, is_override = 1 }) {
  if (!location || !purity || !(rate_per_gram > 0)) {
    const err = new Error('location, purity and rate_per_gram > 0 required');
    err.status = 400;
    throw err;
  }
  return getDatabase().prepare(`
    INSERT INTO gold_rates (location, purity, rate_per_gram, source, is_override, effective_date, updated_at)
    VALUES (?, ?, ?, 'manual', ?, date('now'), datetime('now'))
  `).run(location, purity, rate_per_gram, is_override ? 1 : 0);
}

/** "Use live rate" toggle — soft-disables existing overrides for (location, purity). */
export function clearOverride({ location, purity }) {
  if (!location || !purity) {
    const err = new Error('location and purity required');
    err.status = 400;
    throw err;
  }
  return getDatabase()
    .prepare(`UPDATE gold_rates SET is_override = 0 WHERE location = ? AND purity = ? AND is_override = 1`)
    .run(location, purity);
}
