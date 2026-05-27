import { getDb } from '../database/connection.js';
import { getGoldProvider, getSupportedLocations } from './providers/goldProvider.js';
import { applyMarkup, getMarkupConfig } from './indiaMarkup.service.js';

/**
 * GoldRateService — location-aware single source of truth.
 *
 * Resolution order for (location, purity):
 *   1. Active manual override (is_override = true)            ← admin wins
 *   2. Latest live rate (most recent updated_at, then id)
 *
 * Frozen snapshot: quotations stamp rate at creation time. Future refreshes
 * never mutate historic rows.
 */

export async function refresh() {
  const provider = getGoldProvider();
  const sql = getDb();
  try {
    const raw = await provider.fetchRates();
    const adjusted = applyMarkup(raw.rates, raw.source);

    await sql.begin(async (tx) => {
      for (const r of adjusted.rates) {
        await tx`
          INSERT INTO gold_rates (location, purity, rate_per_gram, source, is_override, effective_date, updated_at)
          VALUES (${r.location || 'Mumbai'}, ${r.purity}, ${r.rate_per_gram}, ${adjusted.source}, false, current_date, now())
        `;
      }
    });

    console.log(`[GoldRate] Refreshed ${adjusted.rates.length} rates (${adjusted.source}${adjusted.applied ? ` +${adjusted.pct}%` : ''})`);
    return { ok: true, source: adjusted.source, markup_pct: adjusted.pct, count: adjusted.rates.length };
  } catch (err) {
    console.warn(`[GoldRate] Refresh failed — keeping existing DB rates. ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** All locations that have at least one rate, unioned with provider-supported list. */
export async function listLocations() {
  const sql = getDb();
  const rows = await sql`SELECT DISTINCT location FROM gold_rates ORDER BY location`;
  const fromDb = rows.map((r) => r.location);
  const merged = new Set([...getSupportedLocations(), ...fromDb]);
  return [...merged].sort();
}

/** Latest effective rate per (location, purity) — override wins, else newest. */
export async function getLatest(location) {
  const sql = getDb();
  if (location) {
    return sql`
      SELECT location, purity, rate_per_gram, source, is_override, updated_at
      FROM gold_rates g
      WHERE location = ${location}
        AND id = (
          SELECT id FROM gold_rates
          WHERE location = g.location AND purity = g.purity
          ORDER BY is_override DESC, updated_at DESC, id DESC
          LIMIT 1
        )
      ORDER BY purity
    `;
  }
  return sql`
    SELECT location, purity, rate_per_gram, source, is_override, updated_at
    FROM gold_rates g
    WHERE id = (
      SELECT id FROM gold_rates
      WHERE location = g.location AND purity = g.purity
      ORDER BY is_override DESC, updated_at DESC, id DESC
      LIMIT 1
    )
    ORDER BY location, purity
  `;
}

export async function getLatestForPurity(purity, location) {
  const sql = getDb();
  const rows = await sql`
    SELECT location, purity, rate_per_gram, source, is_override, updated_at
    FROM gold_rates
    WHERE purity = ${purity} AND location = ${location}
    ORDER BY is_override DESC, updated_at DESC, id DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/** Insert manual override row. is_override defaults to true. */
export async function manualUpsert({ location, purity, rate_per_gram, is_override = true }) {
  if (!location || !purity || !(rate_per_gram > 0)) {
    const err = new Error('location, purity and rate_per_gram > 0 required');
    err.status = 400;
    throw err;
  }
  const sql = getDb();
  await sql`
    INSERT INTO gold_rates (location, purity, rate_per_gram, source, is_override, effective_date, updated_at)
    VALUES (${location}, ${purity}, ${rate_per_gram}, 'manual', ${!!is_override}, current_date, now())
  `;
}

/** Public read of provider + markup config (frontend transparency). */
export function getConfig() {
  const m = getMarkupConfig();
  return {
    provider: (process.env.GOLD_PROVIDER || 'mock').toLowerCase(),
    markup_enabled: m.enabled,
    markup_pct: m.pct
  };
}

/**
 * Drop all manual overrides for (location, purity) so the live provider rate
 * becomes the winning row again.
 *
 * Was: UPDATE … SET is_override = false. That left the manual row in place
 * with its newer updated_at, so getLatest()'s ORDER BY updated_at DESC kept
 * returning the (now non-override) manual price. DELETE removes the row
 * entirely; the most recent provider row wins on the next read.
 */
export async function clearOverride({ location, purity }) {
  if (!location || !purity) {
    const err = new Error('location and purity required');
    err.status = 400;
    throw err;
  }
  const sql = getDb();
  await sql`
    DELETE FROM gold_rates
    WHERE location = ${location} AND purity = ${purity} AND source = 'manual'
  `;
}
