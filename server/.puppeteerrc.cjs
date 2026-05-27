const { join } = require('path');

/**
 * Project-local Chrome cache.
 *
 * Render (and similar PaaS) clears the default ~/.cache/puppeteer between the
 * build phase and runtime. Storing Chrome under server/.cache/puppeteer keeps
 * the binary inside the deploy artifact, so puppeteer.launch() finds it at
 * runtime without re-downloading.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer')
};
