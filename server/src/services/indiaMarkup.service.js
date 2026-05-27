/**
 * IndiaMarkupService — optional retail-rate adjustment layer.
 *
 * Sits between the gold provider (e.g. goldapi.io spot) and the DB. Accounts
 * for India-specific costs the international spot doesn't include:
 *   import duty (BCD + AIDC) + GST + jeweller margin.
 *
 * This layer is TEMPORARY by design. When a true India-side provider
 * (IBJA / mcxindia / paid feed) is wired in, set GOLD_USE_MARKUP=false and the
 * markup becomes a no-op — no code changes elsewhere.
 *
 * Pure function; no DB access. Source label is mutated so DB tells the truth
 * about how each rate was derived.
 */

export function getMarkupConfig() {
  const enabled = (process.env.GOLD_USE_MARKUP || 'false').toLowerCase() === 'true';
  const pct = Number(process.env.GOLD_INDIA_MARKUP_PCT) || 0;
  return { enabled, pct: enabled ? pct : 0 };
}

/**
 * @param {Array<{location,purity,rate_per_gram}>} rates  raw provider rates
 * @param {string} sourceLabel  provider name (e.g. 'goldapi')
 * @returns {{ rates: Array, source: string, applied: boolean, pct: number }}
 */
export function applyMarkup(rates, sourceLabel) {
  const { enabled, pct } = getMarkupConfig();

  if (!enabled || pct <= 0) {
    return { rates, source: sourceLabel, applied: false, pct: 0 };
  }

  const factor = 1 + pct / 100;
  const adjusted = rates.map((r) => ({
    ...r,
    rate_per_gram: Math.round(r.rate_per_gram * factor)
  }));

  return {
    rates: adjusted,
    source: `${sourceLabel}+markup`,
    applied: true,
    pct
  };
}
