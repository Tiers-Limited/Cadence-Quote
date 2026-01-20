// services/invoiceTemplateService.js
// Invoice Template System - Updated to match professional template design
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
   * Generate Single Item Invoice HTML - Updated to match template design
   */
  generateSingleItemInvoiceHTML({ style, invoiceData, contractorInfo }) {
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
      ? `<div class="logo-container">
           <img src="${contractorInfo.logo}" alt="Logo" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'logo-placeholder\\'>LOGO</div>';" />
         </div>`
      : `<div class="logo-container">
           <div class="logo-placeholder">LOGO</div>
         </div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getNewCommonStyles()}
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              ${logoBox}
            </div>
            <div class="title-section">
              <h1>INVOICE</h1>
            </div>
            <div class="invoice-details">
              <div class="detail-line"><strong>Invoice #:</strong> ${invoiceNumber}</div>
              <div class="detail-line"><strong>Issue Date:</strong> ${issueDate || new Date().toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
              <div class="detail-line"><strong>Due Date:</strong> ${dueDate || new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>

          <div class="content">
            <!-- Project & Customer Information -->
            <div class="info-row">
              <div class="info-section">
                <h3 class="section-title">Project</h3>
                <div class="info-content">
                  <div class="project-name">${projectName || 'Painting Project'}</div>
                  <div class="project-address">${projectAddress || ''}</div>
                </div>
              </div>
              <div style="flex: 1; text-align: right;">
                <h3 style="margin: 0 0 10px 0; color: #1fb6cc;">Customer</h3>
                <div>${customerName}</div>
                ${customerPhone ? `<div>${customerPhone}</div>` : ''}
                ${customerEmail ? `<div>${customerEmail}</div>` : ''}
              </div>
            </div>

            ${welcomeMessage ? `
              <div class="section">
                <h3 class="section-header">Welcome Message</h3>
                <div class="section-content">
                  <p>${welcomeMessage}</p>
                </div>
              </div>
            ` : ''}

            <!-- Scope of Work -->
            <div class="section">
              <h3 class="section-header">Scope of Work</h3>
              <div class="section-content">
                <ul class="work-list">
                  ${scopeOfWork.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            </div>

            <!-- Materials / Selections -->
            ${materialsSelections.length > 0 ? `
              <div class="section">
                <h3 class="section-header">Materials / Selections</h3>
                <div class="section-content">
                  <ul class="materials-list">
                    ${materialsSelections.map(item => `<li>${item}</li>`).join('-')}
                  </ul>
                </div>
              </div>
            ` : ''}

            <!-- Estimated Schedule -->
            ${estimatedDuration || estimatedStartDate ? `
              <div class="section">
                <h3 class="section-header">Estimated Schedule</h3>
                <div class="section-content">
                  ${estimatedDuration ? `<div class="schedule-item">Estimated duration: ${estimatedDuration}</div>` : ''}
                  ${estimatedStartDate ? `<div class="schedule-item">Estimated start date: ${estimatedStartDate}</div>` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Pricing Section (Single Item) -->
            <div class="section">
              <h3 class="section-header">Pricing</h3>
              <div class="section-content">
                <table class="pricing-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pricingItems.map(item => `
                      <tr>
                        <td>${item.name}</td>
                        <td>${item.qty || ''}</td>
                        <td>${item.rate ? `$${parseFloat(item.rate).toFixed(2)}` : ''}</td>
                        <td>$${parseFloat(item.amount).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <!-- Project Investment Highlight -->
                <div class="investment-highlight">
                  <div class="investment-label">Project Investment</div>
                  <div class="investment-amount">$${parseFloat(projectInvestment).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  ${deposit ? `
                    <div class="investment-details">
                      <div>Deposit: $${parseFloat(deposit).toFixed(2)}</div>
                      <div>Balance: $${parseFloat(balance).toFixed(2)}</div>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Project Terms -->
            ${projectTerms.length > 0 ? `
              <div class="section">
                <h3 class="section-header">Project Terms</h3>
                <div class="section-content">
                  <ul class="terms-list">
                    ${projectTerms.map(term => `<li>${term}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}

            <!-- Invoice Acknowledgement -->
            <div class="section">
              <h3 class="section-header">Invoice Acknowledgement</h3>
              <div class="acknowledgement-table">
                <div class="ack-row">
                  <div class="ack-label">Signature</div>
                  <div class="ack-line"></div>
                </div>
                <div class="ack-row">
                  <div class="ack-label">Date</div>
                  <div class="ack-line"></div>
                </div>
              </div>
            </div>

            <!-- Payment Options -->
            <div class="section">
              <h3 class="section-header">Payment Options</h3>
              <div class="section-content">
                <p>Secure payment link, QR code, or manual payment instructions appear here.</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate Good/Better/Best Invoice HTML - Updated to match template design
   */
  generateGBBInvoiceHTML({ style, invoiceData, contractorInfo }) {
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
      gbbOptions = {}, // Legacy format
      tiers = {}, // New format: { good: {total, deposit}, better: {total, deposit}, best: {total, deposit} }
      selectedTier = null,
      projectTerms = [],
    } = invoiceData;

    // Use tiers data if available, fallback to gbbOptions for backward compatibility
    const tierData = Object.keys(tiers).length > 0 ? tiers : gbbOptions;

    const logoBox = contractorInfo.logo 
      ? `<div class="logo-container">
           <img src="${contractorInfo.logo}" alt="Logo" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'logo-placeholder\\'>LOGO</div>';" />
         </div>`
      : `<div class="logo-container">
           <div class="logo-placeholder">LOGO</div>
         </div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getNewCommonStyles()}
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              ${logoBox}
            </div>
            <div class="title-section">
              <h1>INVOICE</h1>
            </div>
            <div class="invoice-details">
              <div class="detail-line"><strong>Invoice #:</strong> ${invoiceNumber}</div>
              <div class="detail-line"><strong>Issue Date:</strong> ${issueDate || new Date().toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
              <div class="detail-line"><strong>Due Date:</strong> ${dueDate || new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>

          <div class="content">
            <!-- Project & Customer Information -->
            <div class="info-row">
              <div class="info-section">
                <h3 class="section-title">Project</h3>
                <div class="info-content">
                  <div class="project-name">${projectName || 'Painting Project'}</div>
                  <div class="project-address">${projectAddress || ''}</div>
                </div>
              </div>
              <div class="info-section customer-section">
                <h3 class="section-title">Customer</h3>
                <div class="info-content">
                  <div class="customer-name">${customerName}</div>
                  ${customerPhone ? `<div class="customer-phone">${customerPhone}</div>` : ''}
                  ${customerEmail ? `<div class="customer-email">${customerEmail}</div>` : ''}
                </div>
              </div>
            </div>

            ${welcomeMessage ? `
              <div class="section">
                <h3 class="section-header">Welcome Message</h3>
                <div class="section-content">
                  <p>${welcomeMessage}</p>
                </div>
              </div>
            ` : ''}

            <!-- Scope of Work -->
            <div class="section">
              <h3 class="section-header">Scope of Work</h3>
              <div class="section-content">
                <ul class="work-list">
                  ${scopeOfWork.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            </div>

            <!-- Materials / Selections -->
            ${materialsSelections.length > 0 ? `
              <div class="section">
                <h3 class="section-header">Materials / Selections</h3>
                <div class="section-content">
                  <ul class="materials-list">
                    ${materialsSelections.map(item => `<li>${item}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}

            <!-- Estimated Schedule -->
            ${estimatedDuration || estimatedStartDate ? `
              <div class="section">
                <h3 class="section-header">Estimated Schedule</h3>
                <div class="section-content">
                  ${estimatedDuration ? `<div class="schedule-item">Estimated duration: ${estimatedDuration}</div>` : ''}
                  ${estimatedStartDate ? `<div class="schedule-item">Estimated start date: ${estimatedStartDate}</div>` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Project Options (GBB) -->
            <div class="section">
              <h3 class="section-header">Project Options</h3>
              <div class="options-container">
                ${this.renderNewGBBOption('GOOD', tierData.good, false, selectedTier === 'good')}
                ${this.renderNewGBBOption('BETTER', tierData.better, true, selectedTier === 'better')}
                ${this.renderNewGBBOption('BEST', tierData.best, false, selectedTier === 'best')}
              </div>
              ${selectedTier ? `
                <div class="selected-option">
                  <div class="selected-title">Selected Option: ${selectedTier.toUpperCase()}</div>
                  ${tierData[selectedTier] ? `
                    <div class="selected-details">
                      <div class="selected-total">Total: <strong>$${parseFloat(tierData[selectedTier].total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                      <div class="selected-deposit">Deposit: $${parseFloat(tierData[selectedTier].deposit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>

            <!-- Project Terms -->
            ${projectTerms.length > 0 ? `
              <div class="section">
                <h3 class="section-header">Project Terms</h3>
                <div class="section-content">
                  <ul class="terms-list">
                    ${projectTerms.map(term => `<li>${term}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}

            <!-- Invoice Acknowledgement -->
            <div class="section">
              <h3 class="section-header">Invoice Acknowledgement</h3>
              <div class="acknowledgement-table">
                <div class="ack-row">
                  <div class="ack-label">Selected Option</div>
                  <div class="ack-checkboxes">
                    <label class="checkbox-label">
                      <input type="checkbox" ${selectedTier === 'good' ? 'checked' : ''} /> GOOD
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" ${selectedTier === 'better' ? 'checked' : ''} /> BETTER
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" ${selectedTier === 'best' ? 'checked' : ''} /> BEST
                    </label>
                  </div>
                </div>
                <div class="ack-row">
                  <div class="ack-label">Signature</div>
                  <div class="ack-line"></div>
                </div>
                <div class="ack-row">
                  <div class="ack-label">Date</div>
                  <div class="ack-line"></div>
                </div>
              </div>
            </div>

            <!-- Payment Options -->
            <div class="section">
              <h3 class="section-header">Payment Options</h3>
              <div class="section-content">
                <p>Secure payment link, QR code, or manual payment instructions appear here.</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render New GBB Option Card - Updated to match template design
   */
  renderNewGBBOption(tier, option, isPopular, isSelected = false) {
    if (!option || typeof option !== 'object') return '';

    // Handle both legacy format (option.price) and new format (option.total)
    const price = option.total !== undefined ? parseFloat(option.total) : 
                  (option.price !== undefined && option.price !== null) ? parseFloat(option.price) : null;
    const deposit = option.deposit !== undefined ? parseFloat(option.deposit) : null;

    const features = Array.isArray(option.features) ? option.features : [];
    
    // Determine card styling
    let cardClass = 'option-card';
    let badgeHtml = '';
    
    if (isPopular) {
      cardClass += ' popular';
      badgeHtml = '<div class="popular-badge">Most Popular</div>';
    }
    
    if (isSelected) {
      cardClass += ' selected';
      badgeHtml += '<div class="selected-badge">SELECTED</div>';
    }

    return `
      <div class="${cardClass}">
        ${badgeHtml}
        <div class="tier-name">${tier}</div>
        ${isPopular && !isSelected ? '<div class="tier-subtitle">(Most Popular)</div>' : ''}
        <div class="tier-price">
          ${price ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Price TBD'}
        </div>
        ${deposit ? `
          <div class="tier-deposit">Deposit: $${deposit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        ` : ''}
      </div>
    `;
  }

  /**
   * New Common CSS styles to match template design
   */
  getNewCommonStyles() {
    return `
      * { 
        margin: 0; 
        padding: 0; 
        box-sizing: border-box; 
      }
      
      body { 
        font-family: 'Arial', 'Helvetica', sans-serif; 
        color: #333; 
        line-height: 1.5; 
        background: #fff; 
        font-size: 14px;
      }
      
      .container { 
        max-width: 8.5in; 
        margin: 0 auto; 
        background: white; 
      }
      
      /* Header Styles */
      .header {
        background: #1fb6cc;
        color: white;
        padding: 30px 35px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0;
        min-height: 120px;
      }
      
      .logo-section {
        flex: 0 0 auto;
        margin-right: 30px;
      }
      
      .logo-section {
        flex: 0 0 auto;
        margin-right: 30px;
      }
      
      .logo-section .logo-container {
        background: transparent;
        padding: 20px 25px;
        border-radius: 8px;
        min-width: 140px;
        min-height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .logo-section img {
        max-height: 70px !important;
        max-width: 130px !important;
        width: auto !important;
        height: auto !important;
        object-fit: contain !important;
        display: block !important;
      }
      
      .logo-section .logo-placeholder {
        color: rgba(255,255,255,0.7);
        font-size: 11px;
        text-align: center;
        font-weight: 500;
      }
      
      .title-section {
        flex: 1;
        text-align: center;
      }
      
      .title-section h1 {
        font-size: 48px;
        font-weight: 700;
        letter-spacing: 3px;
        margin: 0;
        color: white;
        text-transform: uppercase;
      }
      
      .invoice-details {
        background: transparent;
        padding: 18px 22px;
        border-radius: 8px;
        min-width: 220px;
        text-align: left;
      }
      
      .detail-line {
        font-size: 13px;
        margin: 6px 0;
        line-height: 1.3;
        color: white;
      }
      
      .detail-line strong {
        font-weight: 600;
        margin-right: 8px;
      }
      
      /* Content Styles */
      .content {
        padding: 30px;
      }
      
      /* Info Row */
      .info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 35px;
        gap: 40px;
      }
      
      .info-section {
        flex: 1;
      }
      
      .customer-section {
        text-align: right;
      }
      
      .section-title {
        color: #1fb6cc;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 12px;
        border-bottom: none;
      }
      
      .info-content {
        color: #555;
      }
      
      .project-name, .customer-name {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 5px;
      }
      
      .project-address, .customer-phone, .customer-email {
        color: #666;
        font-size: 14px;
        margin-bottom: 3px;
      }
      
      /* Section Styles */
      .section {
        margin-bottom: 30px;
        page-break-inside: avoid;
      }
      
      .section-header {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e9ecef;
      }
      
      .section-content {
        color: #555;
      }
      
      /* Lists */
      .work-list, .materials-list, .terms-list {
        margin-left: 20px;
        margin-top: 10px;
      }
      
      .work-list li, .materials-list li, .terms-list li {
        margin-bottom: 8px;
        line-height: 1.6;
      }
      
      .schedule-item {
        margin-bottom: 8px;
      }
      
      /* Pricing Table */
      .pricing-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      
      .pricing-table th {
        background: #f8f9fa;
        padding: 12px;
        text-align: left;
        font-weight: 600;
        border-bottom: 2px solid #dee2e6;
        color: #495057;
      }
      
      .pricing-table th:nth-child(2),
      .pricing-table th:nth-child(3),
      .pricing-table th:nth-child(4) {
        text-align: right;
      }
      
      .pricing-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #dee2e6;
      }
      
      .pricing-table td:nth-child(2),
      .pricing-table td:nth-child(3),
      .pricing-table td:nth-child(4) {
        text-align: right;
      }
      
      /* Investment Highlight */
      .investment-highlight {
        margin-top: 25px;
        padding: 20px;
        background: linear-gradient(135deg, #e8f8f5 0%, #d1ecf1 100%);
        border: 2px solid #17a2b8;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .investment-label {
        font-size: 18px;
        font-weight: 600;
        color: #1fb6cc;
      }
      
      .investment-amount {
        font-size: 32px;
        font-weight: 700;
        color: #1fb6cc;
        text-align: center;
        flex: 1;
      }
      
      .investment-details {
        text-align: right;
        font-size: 13px;
        color: #666;
      }
      
      .investment-details div {
        margin: 3px 0;
      }
      
      /* GBB Options */
      .options-container {
        display: flex;
        gap: 20px;
        margin-top: 20px;
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .option-card {
        flex: 1;
        min-width: 180px;
        max-width: 220px;
        border: 2px solid #dee2e6;
        border-radius: 12px;
        padding: 20px;
        padding-top:25px;
        text-align: center;
        position: relative;
        background: white;
        transition: all 0.3s ease;
      }
      
      .option-card.popular {
        border-color: #17a2b8;
        transform: scale(1.05);
      }
      
      .option-card.selected {
        border-color: #17a2b8;
        background: #f0f9ff;
      }
      
      .popular-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: #17a2b8;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        width:max-content;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .selected-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: #17a2b8;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .tier-name {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 8px;
        color: #333;
      }
      
      .tier-subtitle {
        font-size: 11px;
        color: #666;
        margin-bottom: 12px;
      }
      
      .tier-price {
        font-size: 24px;
        font-weight: 700;
        color: #17a2b8;
        margin-bottom: 8px;
      }
      
      .tier-deposit {
        font-size: 12px;
        color: #666;
      }
      
      /* Selected Option */
      .selected-option {
        margin-top: 25px;
        padding: 20px;
        background: linear-gradient(135deg, #e8f8f5 0%, #d1ecf1 100%);
        border: 2px solid #17a2b8;
        border-radius: 8px;
        text-align: center;
      }
      
      .selected-title {
        font-size: 18px;
        font-weight: 600;
        color: #17a2b8;
        margin-bottom: 10px;
      }
      
      .selected-details {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-top: 10px;
      }
      
      .selected-total {
        font-size: 18px;
        color: #17a2b8;
      }
      
      .selected-deposit {
        font-size: 14px;
        color: #666;
      }
      
      /* Acknowledgement */
      .acknowledgement-table {
        margin-top: 20px;
      }
      
      .ack-row {
        display: flex;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #dee2e6;
      }
      
      .ack-row:last-child {
        border-bottom: none;
      }
      
      .ack-label {
        width: 150px;
        font-weight: 600;
        color: #333;
      }
      
      .ack-line {
        flex: 1;
        border-bottom: 2px solid #333;
        height: 20px;
        margin-left: 20px;
      }
      
      .ack-checkboxes {
        display: flex;
        gap: 20px;
        margin-left: 20px;
      }
      
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 14px;
        font-weight: 500;
      }
      
      .checkbox-label input[type="checkbox"] {
        margin: 0;
        transform: scale(1.2);
      }
      
      /* Print Styles */
      @media print {
        .container {
          max-width: none;
          margin: 0;
        }
        
        .content {
          padding: 20px;
        }
        
        .section {
          page-break-inside: avoid;
        }
        
        .option-card.popular {
          transform: none;
        }
      }
    `;
  }

  /**
   * Legacy methods for backward compatibility
   */
  renderGBBOption(tier, option, isPopular, isSelected = false) {
    return this.renderNewGBBOption(tier, option, isPopular, isSelected);
  }

  getStyleColors(style) {
    // Return consistent colors for the new design
    return {
      headerBg: '#1fb6cc',
      headerText: '#ffffff',
      primary: '#1fb6cc',
      highlightBg: '#e8f8f5',
      highlightBorder: '#1fb6cc',
      logoBoxBg: 'rgba(0, 0, 0, 0.1)',
    };
  }

  getCommonStyles(style = 'light') {
    return this.getNewCommonStyles();
  }
}

module.exports = new InvoiceTemplateService();