// services/invoiceTemplateService.js
// Invoice Template System - Light/Dark, Single Item/GBB variants
// Implements professional invoice generation based on attached templates

const { htmlToPdfBuffer } = require('./pdfService');

class InvoiceTemplateService {
  /**
   * Generate invoice PDF based on template type and style
   * @param {Object} params
   * @param {string} params.templateType - 'single' or 'gbb'
   * @param {string} params.style - 'light' or 'dark'
   * @param {Object} params.invoiceData - Invoice data including quote info
   * @param {Object} params.contractorInfo - Contractor branding
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateInvoice({ templateType, style, invoiceData, contractorInfo }) {
    const html = templateType === 'gbb'
      ? this.generateGBBInvoiceHTML({ style, invoiceData, contractorInfo })
      : this.generateSingleItemInvoiceHTML({ style, invoiceData, contractorInfo });

    try {
      const pdfBuffer = await htmlToPdfBuffer(html);
      if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        console.error('InvoiceTemplateService: htmlToPdfBuffer returned non-buffer', {
          templateType,
          style,
          htmlLength: typeof html === 'string' ? html.length : null,
          pdfType: pdfBuffer === null ? 'null' : typeof pdfBuffer,
        });
        throw new Error('Invalid PDF buffer returned from htmlToPdfBuffer');
      }
      return pdfBuffer;
    } catch (err) {
      // Log snippet of HTML (first 1000 chars) to assist debugging without huge logs
      const snippet = typeof html === 'string' ? html.substring(0, 1000) : String(html);
      console.error('InvoiceTemplateService.generateInvoice error:', { message: err.message, templateType, style, htmlSnippet: snippet });
      throw err;
    }
  }

  /**
   * Generate Single Item Invoice HTML
   */
  generateSingleItemInvoiceHTML({ style, invoiceData, contractorInfo }) {
    const colors = this.getStyleColors(style);
    const {
      invoiceNumber,
      issueDate,
      dueDate,
      projectName,
      projectAddress,
      customerName,
      customerPhone,
      customerEmail,
      welcomeMessage,
      scopeOfWork = [],
      materialsSelections = [],
      estimatedDuration,
      estimatedStartDate,
      pricingItems = [],
      projectInvestment,
      deposit,
      balance,
      projectTerms = [],
    } = invoiceData;

    const logoBox = contractorInfo.logo 
      ? `<img src="${contractorInfo.logo}" alt="Logo" style="max-height: 60px;" />`
      : `<div style="padding: 20px; font-size: 12px; color: ${colors.headerText}; opacity: 0.7;">LOGO PLACEHOLDER</div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getCommonStyles(style)}
          .header { background: ${colors.headerBg}; color: ${colors.headerText}; padding: 30px 25px; display: flex; justify-content: space-between; align-items: center; }
          .logo-box { background-color: ${colors.logoBoxBg}; padding: 15px 20px; border-radius: 4px; min-width: 140px; display: flex; align-items: center; justify-content: center; }
          .header-center { flex: 1; text-align: center; }
          .header-center h1 { margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 1px; }
          .header-right-box { background-color: ${colors.logoBoxBg}; padding: 15px 20px; border-radius: 4px; min-width: 180px; text-align: left; }
          .header-right-box div { font-size: 12px; margin: 4px 0; line-height: 1.4; }
          .highlight-box { background-color: ${colors.highlightBg}; border: 2px solid ${colors.highlightBorder}; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-box">
              ${logoBox}
            </div>
            <div class="header-center">
              <h1>INVOICE</h1>
            </div>
            <div class="header-right-box">
              <div><strong>Invoice #:</strong> ${invoiceNumber}</div>
              <div><strong>Issue Date:</strong> ${issueDate || new Date().toLocaleDateString("en-US",{
        month: '2-digit', day: '2-digit', year: 'numeric'
      })}</div>
              <div><strong>Due Date:</strong> ${dueDate || 'MM/DD/YYYY'}</div>
            </div>
          </div>

          <div class="content">
            <!-- Project & Customer Information -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 10px 0; color: ${colors.primary};">Project</h3>
                <div>${projectName || 'Painting Project'}</div>
                <div style="color: #666;">${projectAddress || ''}</div>
              </div>
              <div style="flex: 1; text-align: right;">
                <h3 style="margin: 0 0 10px 0; color: ${colors.primary};">Customer</h3>
                <div>${customerName}</div>
                ${customerPhone ? `<div>${customerPhone}</div>` : ''}
                ${customerEmail ? `<div>${customerEmail}</div>` : ''}
              </div>
            </div>

            ${welcomeMessage ? `
              <div class="section">
                <h3>Welcome Message</h3>
                <p>${welcomeMessage}</p>
              </div>
            ` : ''}

            <!-- Scope of Work -->
            <div class="section">
              <h3>Scope of Work</h3>
              <ul>
                ${scopeOfWork.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>

            <!-- Materials / Selections -->
            ${materialsSelections.length > 0 ? `
              <div class="section">
                <h3>Materials / Selections</h3>
                <ul>
                  ${materialsSelections.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Estimated Schedule -->
            ${estimatedDuration || estimatedStartDate ? `
              <div class="section">
                <h3>Estimated Schedule</h3>
                ${estimatedDuration ? `<p>Estimated duration: ${estimatedDuration}</p>` : ''}
                ${estimatedStartDate ? `<p>Estimated start date: ${estimatedStartDate}</p>` : ''}
              </div>
            ` : ''}

            <!-- Pricing Section (Single Item) -->
            <div class="section">
              <h3>Pricing</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb;">Item</th>
                    <th style="text-align: center; padding: 12px; border-bottom: 2px solid #e5e7eb;">Qty</th>
                    <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e5e7eb;">Rate</th>
                    <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${pricingItems.map(item => `
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
                      <td style="text-align: center; padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.qty || ''}</td>
                      <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e5e7eb;">
                        ${item.rate ? `$${parseFloat(item.rate).toFixed(2)}` : ''}
                      </td>
                      <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e5e7eb;">
                        $${parseFloat(item.amount).toFixed(2)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <!-- Project Investment Highlight -->
              <div class="highlight-box" style="margin-top: 30px; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 18px; font-weight: 700; color: ${colors.primary};">Project Investment</div>
                <div style="text-align: center; flex: 1;">
                  <div style="font-size: 36px; font-weight: 700; color: ${colors.primary};">
                    $${parseFloat(projectInvestment).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                ${deposit ? `
                  <div style="text-align: right; font-size: 13px;">
                    <div style="margin: 3px 0;">Deposit: $${parseFloat(deposit).toFixed(2)}</div>
                    <div style="margin: 3px 0;">Balance: $${parseFloat(balance).toFixed(2)}</div>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Project Terms -->
            ${projectTerms.length > 0 ? `
              <div class="section">
                <h3>Project Terms</h3>
                <ul>
                  ${projectTerms.map(term => `<li>${term}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Invoice Acknowledgement -->
            <div class="section">
              <h3>Invoice Acknowledgement</h3>
              <div style="margin-top: 20px;">
                <div style="margin-bottom: 15px;">
                  <strong>Signature:</strong> <span style="border-bottom: 2px solid #000; display: inline-block; min-width: 300px; margin-left: 10px;"></span>
                </div>
                <div>
                  <strong>Date:</strong> <span style="border-bottom: 2px solid #000; display: inline-block; min-width: 300px; margin-left: 10px;"></span>
                </div>
              </div>
            </div>

            <!-- Payment Options -->
            <div class="section">
              <h3>Payment Options</h3>
              <p>Secure payment link, QR code, or manual payment instructions appear here.</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <div>${contractorInfo.companyName}</div>
            <div>${contractorInfo.address || ''}</div>
            <div>${contractorInfo.phone || ''} • ${contractorInfo.email || ''}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate Good/Better/Best Invoice HTML
   */
  generateGBBInvoiceHTML({ style, invoiceData, contractorInfo }) {
    const colors = this.getStyleColors(style);
    const {
      invoiceNumber,
      issueDate,
      dueDate,
      projectName,
      projectAddress,
      customerName,
      customerPhone,
      customerEmail,
      welcomeMessage,
      scopeOfWork = [],
      materialsSelections = [],
      estimatedDuration,
      estimatedStartDate,
      gbbOptions = {}, // { good, better, best }
      projectTerms = [],
    } = invoiceData;

    const logoBox = contractorInfo.logo 
      ? `<img src="${contractorInfo.logo}" alt="Logo" style="max-height: 60px;" />`
      : `<div style="padding: 20px; font-size: 12px; color: ${colors.headerText}; opacity: 0.7;">LOGO PLACEHOLDER</div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getCommonStyles(style)}
          .header { background: ${colors.headerBg}; color: ${colors.headerText}; padding: 30px 25px; display: flex; justify-content: space-between; align-items: center; }
          .logo-box { background-color: ${colors.logoBoxBg}; padding: 15px 20px; border-radius: 4px; min-width: 140px; display: flex; align-items: center; justify-content: center; }
          .header-center { flex: 1; text-align: center; }
          .header-center h1 { margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 1px; }
          .header-right-box { background-color: ${colors.logoBoxBg}; padding: 15px 20px; border-radius: 4px; min-width: 180px; text-align: left; }
          .header-right-box div { font-size: 12px; margin: 4px 0; line-height: 1.4; }
          .option-card { border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; position: relative; }
          .option-card.popular { border-color: ${colors.primary}; }
          .option-card.popular::before { content: 'Most Popular'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: ${colors.primary}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-box">
              ${logoBox}
            </div>
            <div class="header-center">
              <h1>INVOICE</h1>
            </div>
            <div class="header-right-box">
              <div><strong>Invoice #:</strong> ${invoiceNumber}</div>
              <div><strong>Issue Date:</strong> ${issueDate || new Date().toLocaleDateString("en-US",{
        month: '2-digit', day: '2-digit', year: 'numeric'
      })}</div>
              <div><strong>Due Date:</strong> ${dueDate || 'MM/DD/YYYY'}</div>
            </div>
          </div>

          <div class="content">
            <!-- Project & Customer Information -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 10px 0; color: ${colors.primary};">Project</h3>
                <div>${projectName || 'Painting Project'}</div>
                <div style="color: #666;">${projectAddress || ''}</div>
              </div>
              <div style="flex: 1; text-align: right;">
                <h3 style="margin: 0 0 10px 0; color: ${colors.primary};">Customer</h3>
                <div>${customerName}</div>
                ${customerPhone ? `<div>${customerPhone}</div>` : ''}
                ${customerEmail ? `<div>${customerEmail}</div>` : ''}
              </div>
            </div>

            ${welcomeMessage ? `
              <div class="section">
                <h3>Welcome Message</h3>
                <p>${welcomeMessage}</p>
              </div>
            ` : ''}

            <!-- Scope of Work -->
            <div class="section">
              <h3>Scope of Work</h3>
              <ul>
                ${scopeOfWork.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>

            <!-- Materials / Selections -->
            ${materialsSelections.length > 0 ? `
              <div class="section">
                <h3>Materials / Selections</h3>
                <ul>
                  ${materialsSelections.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Estimated Schedule -->
            ${estimatedDuration || estimatedStartDate ? `
              <div class="section">
                <h3>Estimated Schedule</h3>
                ${estimatedDuration ? `<p>Estimated duration: ${estimatedDuration}</p>` : ''}
                ${estimatedStartDate ? `<p>Estimated start date: ${estimatedStartDate}</p>` : ''}
              </div>
            ` : ''}

            <!-- Project Options (GBB) -->
            <div class="section">
              <h3>Project Options</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
                ${this.renderGBBOption('GOOD', gbbOptions.good, false)}
                ${this.renderGBBOption('BETTER', gbbOptions.better, true)}
                ${this.renderGBBOption('BEST', gbbOptions.best, false)}
              </div>
            </div>

            <!-- Project Terms -->
            ${projectTerms.length > 0 ? `
              <div class="section">
                <h3>Project Terms</h3>
                <ul>
                  ${projectTerms.map(term => `<li>${term}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Invoice Acknowledgement -->
            <div class="section">
              <h3>Invoice Acknowledgement</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr>
                  <td style="padding: 10px; border: 1px solid #e5e7eb; width: 30%;"><strong>Selected Option</strong></td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">
                    <label style="display: inline-flex; align-items: center; margin-right: 20px;">
                      <input type="checkbox" style="margin-right: 5px;" /> GOOD
                    </label>
                    <label style="display: inline-flex; align-items: center; margin-right: 20px;">
                      <input type="checkbox" style="margin-right: 5px;" /> BETTER
                    </label>
                    <label style="display: inline-flex; align-items: center;">
                      <input type="checkbox" style="margin-right: 5px;" /> BEST
                    </label>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Signature</strong></td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">
                    <div style="border-bottom: 2px solid #000; padding-bottom: 5px; min-height: 20px;"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Date</strong></td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">
                    <div style="border-bottom: 2px solid #000; padding-bottom: 5px; min-height: 20px;"></div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Payment Options -->
            <div class="section">
              <h3>Payment Options</h3>
              <p>Secure payment link, QR code, or manual payment instructions appear here.</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <div>${contractorInfo.companyName}</div>
            <div>${contractorInfo.address || ''}</div>
            <div>${contractorInfo.phone || ''} • ${contractorInfo.email || ''}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render GBB Option Card
   */
  renderGBBOption(tier, option, isPopular) {
    if (!option || typeof option !== 'object') return '';

    const price = (option.price !== undefined && option.price !== null) ? parseFloat(option.price) : null;
    const priceHtml = price ? `\n        <div style="font-size: 32px; font-weight: 700; color: #06b6d4; margin-bottom: 15px;">\n          $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n        </div>` : '';

    const features = Array.isArray(option.features) ? option.features : [];

    return `
      <div class="option-card ${isPopular ? 'popular' : ''}">
        <h4 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 700;">${tier}</h4>
        ${isPopular ? '<div style="font-size: 12px; color: #666; margin-bottom: 10px;">(Most Popular)</div>' : ''}
        ${priceHtml}
        <ul style="text-align: left; padding-left: 20px; font-size: 14px; line-height: 1.8; margin-top: 15px;">
          ${features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Get style-specific colors
   */
  getStyleColors(style) {
    if (style === 'dark') {
      return {
        headerBg: '#1e3a8a',
        headerText: '#ffffff',
        primary: '#2563eb',
        highlightBg: '#dbeafe',
        highlightBorder: '#3b82f6',
        logoBoxBg: 'rgba(255, 255, 255, 0.15)',
      };
    }
    // Light style (default)
    return {
      headerBg: '#06b6d4',
      headerText: '#ffffff',
      primary: '#06b6d4',
      highlightBg: '#cffafe',
      highlightBorder: '#06b6d4',
      logoBoxBg: 'rgba(255, 255, 255, 0.2)',
    };
  }

  /**
   * Common CSS styles
   */
  getCommonStyles(style = 'light') {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Arial', 'Helvetica', sans-serif; color: #1f2937; line-height: 1.6; background: #fff; }
      .container { max-width: 800px; margin: 0 auto; background: white; }
      .content { padding: 30px; }
      .section { margin-bottom: 30px; }
      .section h3 { font-size: 20px; font-weight: 600; margin-bottom: 15px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
      .section p { margin: 8px 0; }
      .section ul { margin-left: 20px; }
      .section li { margin: 5px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px; text-align: left; }
    `;
  }
}

module.exports = new InvoiceTemplateService();
