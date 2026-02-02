// utils/pdfGenerator.js
const htmlPdf = require('html-pdf-node');

/**
 * Professional PDF Generator using html-pdf-node
 * Generates high-quality PDFs from HTML templates
 * Switched from Puppeteer for better deployment compatibility
 */
class PDFGenerator {
  /**
   * Generate quote PDF
   * @param {Object} options - Quote data and settings
   * @returns {Promise<Buffer>} PDF file as buffer
   */
  static async generateQuotePDF({ quote, calculation, contractor, settings }) {
    try {
      const html = this.getQuoteHTML({ quote, calculation, contractor, settings });
      
      // Configure html-pdf-node
      const file = { content: html };
      const options = {
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        },
        preferCSSPageSize: false
      };

      const launchOptions = {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process'
        ]
      };

      // Generate PDF
      const pdfBuffer = await htmlPdf.generatePdf(file, options, launchOptions);
      
      return pdfBuffer;
      
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  /**
   * Generate HTML for quote proposal
   */
  static getQuoteHTML({ quote, calculation, contractor, settings }) {
    const today = new Date().toISOString().split('T')[0];
    
    const areasHTML = (quote.areas || []).map(area => {
      const items = (area.laborItems || []).filter(i => i.selected);
      if (items.length === 0) return '';
      
      const itemsHTML = items.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.categoryName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity} ${item.measurementUnit}</td>
        </tr>
      `).join('');
      
      return `
        <div style="margin-bottom: 20px;">
          <h4 style="color: #1890ff; margin-bottom: 10px;">${area.name}</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 10px 8px; text-align: left;">Surface</th>
                <th style="padding: 10px 8px; text-align: right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Proposal - ${quote.customerName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          h1, h2, h3, h4 { margin-top: 0; }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #1890ff;
            padding-bottom: 20px;
          }
          .header-box {
            background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
            padding: 20px;
            border-radius: 8px;
            color: white;
            margin-bottom: 20px;
          }
          .logo {
            width: 80px;
            height: 80px;
            background-color: #fff;
            border-radius: 50%;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
          }
          .customer-info {
            background: #f0f5ff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }
          .section h3 {
            color: #1f2937;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .investment {
            background: #f0f5ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .total {
            font-size: 32px;
            color: #52c41a;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #d9d9d9;
            color: #8c8c8c;
            font-size: 12px;
          }
          ul { padding-left: 20px; }
          li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="header-box">
            <div class="logo">📋</div>
            <h1 style="margin: 0; font-size: 32px;">${contractor.companyName || 'Professional Painting Co.'}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">The rhythm behind every great quote</p>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="customer-info">
          <table width="100%">
            <tr>
              <td width="50%"><strong>Prepared for:</strong><br>${quote.customerName}</td>
              <td width="50%" align="right"><strong>Date:</strong><br>${today}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 10px;">
                <strong>Property:</strong> ${quote.street}, ${quote.city}, ${quote.state} ${quote.zipCode}
              </td>
            </tr>
          </table>
        </div>

        <!-- Opening Message -->
        <div class="section">
          <p>Dear ${quote.customerName},</p>
          <p>Thank you for the opportunity to provide this proposal. Using Cadence Quote, we've tailored a professional painting solution designed to meet your specific needs.</p>
          <p><strong>We don't just paint walls — we deliver a professional experience that protects your investment and enhances your home.</strong></p>
        </div>

        <!-- Scope of Work -->
        <div class="section">
          <h3>Scope of Work</h3>
          ${areasHTML}
        </div>

        <!-- Investment Breakdown -->
        <div class="section">
          <h3>Investment Breakdown</h3>
          <div class="investment">
            <p style="color: #595959; font-size: 13px; margin: 0 0 15px 0; font-style: italic;">
              Our pricing follows US industry standards: (Materials + Labor + Overhead) × (1 + Profit Margin) + Tax
            </p>
            <table width="100%" style="margin-bottom: 15px;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0;"><strong>Labor</strong></td>
                <td align="right" style="padding: 8px 0;">$${calculation.laborTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; padding-left: 15px; color: #595959;">Materials (Raw Cost)</td>
                <td align="right" style="padding: 8px 0; color: #595959;">$${calculation.materialCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; padding-left: 15px; color: #595959;">Material Markup (${calculation.materialMarkupPercent}%)</td>
                <td align="right" style="padding: 8px 0; color: #595959;">+$${calculation.materialMarkupAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0;"><strong>Materials Total</strong></td>
                <td align="right" style="padding: 8px 0;"><strong>$${calculation.materialTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
              </tr>
              ${calculation.overhead && calculation.overhead > 0 ? `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0;"><strong>Overhead (${calculation.overheadPercent}%)</strong><br>
                  <span style="font-size: 11px; color: #595959;">Transportation, equipment, insurance</span>
                </td>
                <td align="right" style="padding: 8px 0;">$${calculation.overhead.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 2px solid #bfbfbf;">
                <td style="padding: 8px 0; color: #595959;"><em>Subtotal before profit</em></td>
                <td align="right" style="padding: 8px 0; color: #595959;"><em>$${calculation.subtotalBeforeProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</em></td>
              </tr>
              ${calculation.profitAmount && calculation.profitAmount > 0 ? `
              <tr style="border-bottom: 2px solid #1890ff;">
                <td style="padding: 8px 0;"><strong>Profit Margin (${calculation.profitMarginPercent}%)</strong></td>
                <td align="right" style="padding: 8px 0;"><strong>$${calculation.profitAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 2px solid #1890ff;">
                <td style="padding: 10px 0;"><strong style="font-size: 16px;">Subtotal</strong></td>
                <td align="right" style="padding: 10px 0;"><strong style="font-size: 16px;">$${calculation.subtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
              </tr>
              <tr style="border-bottom: 2px solid #1890ff;">
                <td style="padding: 8px 0;">Sales Tax (${calculation.taxPercent}%)</td>
                <td align="right" style="padding: 8px 0;">$${calculation.tax.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </table>
            
            <table width="100%" style="background: #e6f7ff; padding: 15px; border-radius: 8px;">
              <tr>
                <td><h2 style="margin: 0; color: #1890ff;">Total Investment</h2></td>
                <td align="right">
                  <div style="font-size: 36px; color: #52c41a; font-weight: bold; margin: 0;">
                    $${calculation.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </div>
                </td>
              </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background: #f0f5ff; border-radius: 8px; border-left: 4px solid #1890ff;">
              <p style="margin: 0 0 8px 0;"><strong>Payment Schedule:</strong></p>
              <table width="100%">
                <tr>
                  <td>Deposit (${calculation.depositPercent}%) - Due at signing:</td>
                  <td align="right"><strong>$${calculation.deposit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                </tr>
                <tr>
                  <td>Balance - Due at completion:</td>
                  <td align="right"><strong>$${calculation.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                </tr>
              </table>
            </div>
          </div>
        </div>

        <!-- Warranty -->
        <div class="section">
          <h3>Warranty</h3>
          <ul>
            <li><strong>Workmanship Warranty:</strong> ${settings?.warrantyTerms || '2 years standard'}</li>
            <li>Manufacturer warranties apply</li>
          </ul>
        </div>

        <!-- Payment Terms -->
        <div class="section">
          <h3>Payment Terms</h3>
          <p>${settings?.paymentTerms || 'Standard payment terms apply'}</p>
          <ul>
            <li><strong>Accepted Methods:</strong> Cash, Check, Credit Card, ACH Transfer, CashApp, Venmo, Zelle</li>
            <li>All payments are processed securely through Cadence Quote</li>
          </ul>
        </div>

        <!-- Acceptance -->
        <div class="section" style="background: #fffbe6; border-color: #faad14;">
          <h3>Acceptance</h3>
          <p>By signing below, you agree to the scope, products, colors, investment, terms, and warranty described in this proposal.</p>
          <div style="margin-top: 30px;">
            <table width="100%">
              <tr>
                <td width="50%">
                  <div style="border-bottom: 2px solid #000; padding-bottom: 5px;">Customer Signature & Date</div>
                </td>
                <td width="50%">
                  <div style="border-bottom: 2px solid #000; padding-bottom: 5px;">Contractor Signature & Date</div>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          ${contractor.email || 'contact@company.com'} | 
          ${contractor.phone || ''} | 
          Licensed & Insured
          <br>
          <small>Powered by Cadence Quote • www.cadencequote.com</small>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = PDFGenerator;
