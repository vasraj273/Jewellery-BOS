/**
 * Gold rate providers — pluggable via env GOLD_PROVIDER.
 *
 * Each provider exposes:
 *   async fetchRates() → { source: string, rates: [{ location, purity, rate_per_gram }] }
 *
 * Indian jewellery rates vary by city. Mock simulates per-city drift on a base.
 */

const SUPPORTED_LOCATIONS = (process.env.JBOS_LOCATIONS ||
  'Mumbai,Ahmedabad,Delhi,Bengaluru,Chennai,Kolkata,Hyderabad,Jaipur').split(',').map((s) => s.trim());

// Per-city offset (₹/gm) applied on top of a national rate.
// Reflects realistic local premium / making variance across Indian markets.
const CITY_OFFSET = {
  Mumbai:    0,
  Ahmedabad: -25,
  Delhi:     +15,
  Bengaluru: +20,
  Chennai:   +30,
  Kolkata:   -10,
  Hyderabad: +10,
  Jaipur:    -15
};

export function getSupportedLocations() { return [...SUPPORTED_LOCATIONS]; }

function fanOutToCities(perKarat) {
  // perKarat = { '24Kt': 9XXX, '22Kt': ..., '18Kt': ..., '14Kt': ... }
  const out = [];
  for (const loc of SUPPORTED_LOCATIONS) {
    const off = CITY_OFFSET[loc] ?? 0;
    for (const [purity, rate] of Object.entries(perKarat)) {
      out.push({ location: loc, purity, rate_per_gram: Math.round(rate + off) });
    }
  }
  return out;
}

const mockProvider = {
  name: 'mock',
  async fetchRates() {
    const basePurity = { '24Kt': 7800, '22Kt': 7150, '18Kt': 5850, '14Kt': 4550 };
    const drift = () => 1 + (Math.random() * 0.02 - 0.01); // ±1%
    const drifted = Object.fromEntries(
      Object.entries(basePurity).map(([k, v]) => [k, v * drift()])
    );
    return { source: 'mock', rates: fanOutToCities(drifted) };
  }
};

/**
 * goldapi.io provider — single national INR rate fanned across cities.
 *   GET https://www.goldapi.io/api/{symbol}/{currency}
 *   Header: x-access-token: <GOLD_API_KEY>
 *   Response includes price_gram_24k, price_gram_22k, price_gram_18k, price_gram_14k
 */
const goldApiProvider = {
  name: 'goldapi',
  async fetchRates() {
    const key = process.env.GOLD_API_KEY;
    if (!key) throw new Error('GOLD_API_KEY not set');
    const symbol   = process.env.GOLD_API_SYMBOL   || 'XAU';
    const currency = process.env.GOLD_API_CURRENCY || 'INR';

    const url = `https://www.goldapi.io/api/${symbol}/${currency}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-access-token': key, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`goldapi ${res.status}: ${body.slice(0, 160)}`);
    }
    const j = await res.json();

    const perKarat = {};
    if (Number.isFinite(j.price_gram_24k)) perKarat['24Kt'] = j.price_gram_24k;
    if (Number.isFinite(j.price_gram_22k)) perKarat['22Kt'] = j.price_gram_22k;
    if (Number.isFinite(j.price_gram_18k)) perKarat['18Kt'] = j.price_gram_18k;
    if (Number.isFinite(j.price_gram_14k)) perKarat['14Kt'] = j.price_gram_14k;
    if (Object.keys(perKarat).length === 0) throw new Error('goldapi response missing price_gram_* fields');

    return { source: 'goldapi', rates: fanOutToCities(perKarat) };
  }
};

/** HTTP stub — wire when real per-city API is configured. */
const httpProvider = {
  name: 'http',
  async fetchRates() {
    const url = process.env.GOLD_API_URL;
    const key = process.env.GOLD_API_KEY;
    if (!url) throw new Error('GOLD_API_URL not set');

    const fullUrl = key ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : url;
    const res = await fetch(fullUrl, { method: 'GET' });
    if (!res.ok) throw new Error(`Gold API ${res.status}`);
    const json = await res.json();
    // Expected shape:
    //   { rates: [{ location, purity, rate_per_gram }] }
    //   OR { rates: { Mumbai: { '22Kt': 7150 }, ... } }
    let rates = [];
    if (Array.isArray(json.rates)) {
      rates = json.rates;
    } else if (json.rates && typeof json.rates === 'object') {
      for (const [location, map] of Object.entries(json.rates)) {
        for (const [purity, rate] of Object.entries(map)) {
          if (Number.isFinite(+rate)) rates.push({ location, purity, rate_per_gram: +rate });
        }
      }
    }
    return { source: process.env.GOLD_PROVIDER_NAME || 'http', rates };
  }
};

const PROVIDERS = { mock: mockProvider, goldapi: goldApiProvider, http: httpProvider };

export function getGoldProvider() {
  const key = (process.env.GOLD_PROVIDER || 'mock').toLowerCase();
  return PROVIDERS[key] || mockProvider;
}
