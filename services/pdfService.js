// services/pdfService.js
// Generates a PDF buffer from HTML using Puppeteer (already in deps)

const puppeteer = require('puppeteer');

async function htmlToPdfBuffer(html, options = {}) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (launchErr) {
    console.error('pdfService: puppeteer.launch failed:', launchErr.message);
    throw launchErr;
  }

  try {
    const page = await browser.newPage();
    try {
      const waitUntil = options.waitUntil || 'load'; // Use 'load' by default to avoid blocking on external resources
      await page.setContent(html, { waitUntil });
    } catch (setContentErr) {
      console.error('pdfService: page.setContent failed:', setContentErr.message);
      // Capture small snippet for debugging
      console.error('pdfService: HTML snippet:', typeof html === 'string' ? html.substring(0, 500) : String(html));
      throw setContentErr;
    }

    try {
      let pdf = await page.pdf({
        format: 'A4',
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
        printBackground: true,
        ...options,
      });

      // Coerce ArrayBuffer / TypedArray -> Buffer
      const ctorName = pdf && pdf.constructor ? pdf.constructor.name : typeof pdf;
      const length = pdf && pdf.length ? pdf.length : null;
      if (!pdf || !Buffer.isBuffer(pdf)) {
        try {
          if (pdf && (pdf instanceof Uint8Array || pdf.buffer instanceof ArrayBuffer)) {
            pdf = Buffer.from(pdf);
            console.warn('pdfService: coerced PDF from', ctorName, 'length', length);
          }
        } catch (coerceErr) {
          console.error('pdfService: failed to coerce PDF to Buffer:', coerceErr && coerceErr.message);
        }
      }

      if (!pdf || !Buffer.isBuffer(pdf)) {
        console.error('pdfService: page.pdf returned invalid result', { ctorName, length });
        throw new Error('page.pdf returned invalid result');
      }

      return pdf;
    } catch (pdfErr) {
      console.error('pdfService: page.pdf failed:', pdfErr.message);
      throw pdfErr;
    }
  } finally {
    try { await browser.close(); } catch (e) { console.warn('pdfService: browser close failed', e && e.message); }
  }
}

module.exports = { htmlToPdfBuffer };
