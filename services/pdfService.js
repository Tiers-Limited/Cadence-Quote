// services/pdfService.js
// Generates a PDF buffer from HTML using Puppeteer (already in deps)

const puppeteer = require('puppeteer');

async function htmlToPdfBuffer(html, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      printBackground: true,
      ...options,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdfBuffer };
