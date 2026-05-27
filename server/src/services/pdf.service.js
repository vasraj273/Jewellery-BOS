import puppeteer from 'puppeteer';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      // Sandbox flags required on Render / most container hosts.
      // disable-dev-shm-usage avoids crashes on hosts with a tiny /dev/shm.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }
  return browserPromise;
}

export async function generatePdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // A4 portrait at 96 DPI ≈ 794 × 1123 px. Matching the viewport to the
    // page size keeps layout calculations identical between on-screen render
    // and PDF render, so the template's 210 mm .page fills the sheet
    // edge-to-edge with no asymmetric whitespace.
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });
    // Puppeteer v22+ returns Uint8Array. Wrap as Buffer so Express sends raw bytes.
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closePdfEngine() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
