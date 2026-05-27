/**
 * Forces Puppeteer's bundled Chrome to download into the project-local cache
 * configured in .puppeteerrc.cjs.
 *
 * Runs automatically on `npm install` (server postinstall hook) so Render's
 * build phase populates server/.cache/puppeteer, which then ships with the
 * deployed image. At runtime puppeteer.launch() picks the binary up via the
 * same .puppeteerrc.cjs config — no executablePath wiring required.
 *
 * Opt out by setting PUPPETEER_SKIP_CHROME_DOWNLOAD=true (e.g. local dev where
 * Chrome is already cached, or CI lanes that don't render PDFs).
 */

const { spawnSync } = require('node:child_process');
const fs   = require('node:fs');
const path = require('node:path');

if (process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD === 'true') {
  console.log('[postinstall] PUPPETEER_SKIP_CHROME_DOWNLOAD=true — skipping Chrome install.');
  process.exit(0);
}

const installScript = path.join(__dirname, '..', 'node_modules', 'puppeteer', 'install.mjs');

if (!fs.existsSync(installScript)) {
  console.warn(`[postinstall] ${installScript} not found — Puppeteer may have changed its layout. Skipping.`);
  process.exit(0);
}

console.log('[postinstall] Installing Chrome into project-local cache (.puppeteerrc.cjs)...');
const result = spawnSync(process.execPath, [installScript], { stdio: 'inherit' });

if (result.status === 0) {
  console.log('[postinstall] Chrome install completed.');
} else {
  // Don't fail the whole `npm install`; surface a clear runtime error on first PDF render instead.
  console.warn('[postinstall] Chrome install exited with code', result.status, '— continuing.');
}

process.exit(0);
