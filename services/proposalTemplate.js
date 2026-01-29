// services/proposalTemplate.js
// Renders HTML for the proposal PDF based on a structured data model

// ===== COLOR SCHEME MAPPING =====
const COLOR_SCHEMES = {
  blue: '#1890ff',      // Professional Blue
  green: '#52c41a',     // Success Green
  orange: '#fa8c16',    // Warm Orange
  purple: '#722ed1',    // Creative Purple
  gray: '#595959'       // Neutral Gray
};

// ===== STATIC SAMPLE DATA FOR PREVIEWS =====
const SAMPLE_PREVIEW_DATA = {
  company: {
    name: 'Sample Painting Company',
    phone: '(555) 123-4567',
    email: 'info@samplepainting.com',
    addressLine1: '123 Main Street',
    addressLine2: 'Suite 100, Sample City, ST 12345',
    logoUrl: null
  },
  proposal: {
    invoiceNumber: 'PROP-2024-001',
    date: '2024-01-15',
    customerName: 'John Smith',
    projectAddress: '456 Oak Avenue, Sample City, ST 12345',
    selectedOption: 'Better',
    totalInvestment: 4500,
    depositAmount: 2250
  },
  gbb: {
    rows: [
      { label: 'Living Room Walls', good: 'Sherwin Williams ProMar 200', better: 'Sherwin Williams ProClassic', best: 'Sherwin Williams Emerald' },
      { label: 'Kitchen Cabinets', good: 'ProClassic Semi-Gloss', better: 'Emerald Urethane', best: 'ProClassic Alkyd' },
      { label: 'Exterior Siding', good: 'Duration Exterior', better: 'Emerald Exterior', best: 'Resilience Exterior' }
    ],
    investment: {
      good: 3200,
      better: 4500,
      best: 6800
    }
  },
  areaBreakdown: ['Living Room', 'Kitchen', 'Master Bedroom', 'Guest Bathroom', 'Exterior Siding'],
  introduction: {
    welcomeMessage: 'Thank you for choosing Sample Painting Company. We are committed to delivering exceptional quality and service.',
    aboutUsSummary: 'We are a licensed and insured painting contractor with over 10 years of experience serving the local community.'
  },
  scope: {
    interiorProcess: 'All interior surfaces will be properly prepared, primed as needed, and painted with two coats of premium paint.',
    exteriorProcess: 'Exterior surfaces will be pressure washed, scraped, primed, and painted with weather-resistant coatings.',
    trimProcess: 'All trim and millwork will be carefully prepared, caulked, and painted with high-quality enamel.',
    cabinetProcess: 'Cabinets will be cleaned, sanded, primed, and painted with durable cabinet-grade paint.',
    drywallRepairProcess: 'Minor drywall repairs will be patched, sanded smooth, and primed before painting.'
  },
  warranty: {
    standard: '2-year warranty on all interior work covering peeling, cracking, and fading under normal conditions.',
    premium: '3-year premium warranty with extended coverage for high-traffic areas.',
    exterior: '5-year warranty on exterior work with proper maintenance.'
  },
  responsibilities: {
    client: 'Move furniture and personal items, provide access to work areas, ensure pets are secured.',
    contractor: 'Protect floors and furniture, clean up daily, complete work per specifications, maintain professional conduct.'
  },
  acceptance: {
    acknowledgement: 'By signing below, you acknowledge that you have read, understood, and agree to all terms and conditions outlined in this proposal.',
    signatureStatement: 'This proposal is valid for 30 days from the date above.'
  },
  payment: {
    paymentTermsText: '50% deposit required to begin work. Remaining balance due upon completion and final walkthrough.',
    paymentMethods: 'We accept cash, check, credit card, and bank transfer.',
    latePaymentPolicy: 'Late payments may incur a 1.5% monthly finance charge.'
  },
  policies: {
    touchUpPolicy: 'Free touch-ups within 30 days of completion for normal wear and tear.',
    finalWalkthroughPolicy: 'A final walkthrough will be scheduled to ensure your complete satisfaction.',
    changeOrderPolicy: 'Any changes to the original scope must be documented and approved in writing.',
    colorDisclaimer: 'Colors may appear different under various lighting conditions. We recommend testing samples in your space.',
    surfaceConditionDisclaimer: 'Pre-existing surface conditions may affect final appearance. Additional prep work may be required.',
    paintFailureDisclaimer: 'Paint failure due to moisture, structural issues, or improper surface preparation is not covered.',
    generalProposalDisclaimer: 'This proposal is subject to acceptance within 30 days. Prices may change after this period.'
  }
};

/**
 * Generate preview data by merging contractor's actual company info with sample data
 * @param {Object} contractorSettings - Contractor's settings including company info
 * @returns {Object} Complete preview data object
 */
function generatePreviewData(contractorSettings = {}) {
  const company = contractorSettings.company || {};
  
  return {
    ...SAMPLE_PREVIEW_DATA,
    company: {
      name: company.name || SAMPLE_PREVIEW_DATA.company.name,
      phone: company.phone || SAMPLE_PREVIEW_DATA.company.phone,
      email: company.email || SAMPLE_PREVIEW_DATA.company.email,
      addressLine1: company.addressLine1 || SAMPLE_PREVIEW_DATA.company.addressLine1,
      addressLine2: company.addressLine2 || SAMPLE_PREVIEW_DATA.company.addressLine2,
      logoUrl: company.logoUrl || SAMPLE_PREVIEW_DATA.company.logoUrl
    }
  };
}

/**
 * Get color scheme hex value by ID
 * @param {string} colorId - Color scheme identifier
 * @returns {string} Hex color value
 */
function getColorScheme(colorId) {
  // Whitelist of valid color schemes
  const VALID_COLOR_SCHEMES = ['blue', 'green', 'orange', 'purple', 'gray'];
  
  // Validate color scheme
  if (!VALID_COLOR_SCHEMES.includes(colorId)) {
    console.warn(`Invalid color scheme: ${colorId}, falling back to blue`);
    return COLOR_SCHEMES.blue;
  }
  
  return COLOR_SCHEMES[colorId] || COLOR_SCHEMES.blue;
}

/**
 * Apply color scheme to HTML by replacing color placeholders
 * @param {string} html - HTML string with {{PRIMARY_COLOR}} placeholders
 * @param {string} colorScheme - Hex color value
 * @returns {string} HTML with colors applied
 */
function applyColorToStyles(html, colorScheme) {
  return html.replace(/{{PRIMARY_COLOR}}/g, colorScheme);
}

function formatCurrency(n) {
  const num = Number.parseFloat(n || 0);
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function safe(val, fallback = '') {
  return (val !== undefined && val !== null) ? val : fallback;
}

// rows: [{ label: 'Walls', good: '...', better: '...', best: '...', area: 'Living Room' (optional), category: 'Interior' (optional for flat rate) }]
function renderGBBTable(rows = [], investment = {}) {
  // Check if rows have flat rate structure (category field)
  const isFlatRate = rows.some(r => r.category);
  
  if (isFlatRate) {
    // Group by category for flat rate
    const interiorItems = rows.filter(r => r.category === 'Interior');
    const exteriorItems = rows.filter(r => r.category === 'Exterior');
    
    const renderFlatRateSection = (items, categoryName, bgColor) => {
      if (items.length === 0) return '';
      
      return `
        <div class="flat-rate-section">
          <div class="category-header" style="background: ${bgColor};">${categoryName}</div>
          ${items.map(item => `
            <div class="flat-rate-item">
              <div class="item-type-header">${safe(item.label)}</div>
              <div class="products-list">
                ${item.good ? `<div class="product-row"><span class="tier-badge tier-good">Good</span> ${safe(item.good)}</div>` : ''}
                ${item.better ? `<div class="product-row"><span class="tier-badge tier-better">Better</span> ${safe(item.better)}</div>` : ''}
                ${item.best ? `<div class="product-row"><span class="tier-badge tier-best">Best</span> ${safe(item.best)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };
    
    return `
      ${renderFlatRateSection(interiorItems, 'Interior', '#e6f7ff')}
      ${renderFlatRateSection(exteriorItems, 'Exterior', '#fff7e6')}
    `;
  }
  
  // Check if rows have area grouping
  const hasAreas = rows.some(r => r.area);
  
  if (hasAreas) {
    // Group by area
    const areaGroups = {};
    rows.forEach(r => {
      const areaName = r.area || 'General';
      if (!areaGroups[areaName]) {
        areaGroups[areaName] = [];
      }
      areaGroups[areaName].push(r);
    });
    
    // Render area-grouped products
    const areaHtml = Object.entries(areaGroups).map(([areaName, areaRows]) => `
      <div class="area-group">
        <div class="area-header">${areaName}</div>
        <table class="gbb-area">
          <thead>
            <tr>
              <th class="head-area">Surface</th>
              <th class="head-area">Good</th>
              <th class="head-area">Better</th>
              <th class="head-area">Best</th>
            </tr>
          </thead>
          <tbody>
            ${areaRows.map(r => `
              <tr>
                <td class="cell label">${safe(r.label)}</td>
                <td class="cell">${safe(r.good, '-')}</td>
                <td class="cell">${safe(r.better, '-')}</td>
                <td class="cell">${safe(r.best, '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');
    
    // Calculate product summary
    const productSummary = {};
    rows.forEach(r => {
      if (r.good) {
        productSummary[r.good] = (productSummary[r.good] || 0) + 1;
      }
      if (r.better) {
        productSummary[r.better] = (productSummary[r.better] || 0) + 1;
      }
      if (r.best) {
        productSummary[r.best] = (productSummary[r.best] || 0) + 1;
      }
    });
    
    
    
    return areaHtml ;
  }
  
  // Original global table for turnkey pricing
  const rowHtml = rows.map(r => `
    <tr>
      <td class="cell label">${safe(r.label)}</td>
      <td class="cell">${safe(r.good, '-')}</td>
      <td class="cell">${safe(r.better, '-')}</td>
      <td class="cell">${safe(r.best, '-')}</td>
    </tr>
  `).join('');
  const investRow = `
    <tr>
      <td class="cell label">Investment</td>
      <td class="cell">${investment.good ? formatCurrency(investment.good) : '-'}</td>
      <td class="cell">${investment.better ? formatCurrency(investment.better) : '-'}</td>
      <td class="cell">${investment.best ? formatCurrency(investment.best) : '-'}</td>
    </tr>
  `;
  return `
    <table class="gbb">
      <thead>
        <tr>
          <th class="head">Surface</th>
          <th class="head">Good</th>
          <th class="head">Better</th>
          <th class="head">Best</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml}
        ${investRow}
      </tbody>
    </table>
  `;
}

function renderList(items = []) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `<ul class="list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
}

/**
 * Classic/Professional Template - Traditional 2-column layout
 * @param {Object} data - Proposal data
 * @param {string} colorScheme - Hex color value
 * @returns {string} HTML string
 */
function renderClassicTemplate(data, colorScheme) {
  const company = data.company || {};
  const proposal = data.proposal || {};
  const gbb = data.gbb || {};
  const rows = gbb.rows || [];
  const investment = gbb.investment || {};
  const areaBreakdown = data.areaBreakdown || [];
  const introduction = data.introduction || {};
  const scope = data.scope || {};
  const warranty = data.warranty || {};
  const responsibilities = data.responsibilities || {};
  const acceptance = data.acceptance || {};
  const payment = data.payment || {};
  const policies = data.policies || {};

  const selectedOption = safe(proposal.selectedOption, '');
  const totalInvestment = safe(proposal.totalInvestment, 0);
  const depositAmount = safe(proposal.depositAmount, 0);

  const headerAddress = [safe(company.addressLine1), safe(company.addressLine2)].filter(Boolean).join(', ');

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4; margin: 24px; }
        body { font-family: Arial, Helvetica, sans-serif; color: #222; }
        .page { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .muted { color: #666; }
        .title { font-size: 22px; font-weight: 700; color: {{PRIMARY_COLOR}}; margin: 8px 0 12px; }
        .section-title { font-size: 18px; font-weight: 700; color: {{PRIMARY_COLOR}}; margin: 20px 0 8px; }
        .label { font-weight: 600; }
        .small { font-size: 12px; }
        .pre { white-space: pre-line; }
        .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
        .row { display: flex; gap: 12px; align-items: center; }
        .space { height: 8px; }
        .header {
          display: grid; grid-template-columns: 64px 1fr; gap: 12px;
          align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px;
        }
        .logo { width: 64px; height: 64px; object-fit: contain; border: 1px solid #eee; }
        .gbb { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .gbb .head { background: {{PRIMARY_COLOR}}; color: #fff; text-align: left; padding: 8px; font-weight: 600; font-size: 13px; }
        .gbb .cell { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; vertical-align: top; }
        .area-group { margin-bottom: 20px; page-break-inside: avoid; }
        .area-header { 
          font-size: 15px; font-weight: 700; color: {{PRIMARY_COLOR}}; 
          padding: 8px 12px; background: #e6f7ff; border-radius: 4px; margin-bottom: 8px;
        }
        .gbb-area { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .gbb-area .head-area { background: #91d5ff; color: #003a8c; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 12px; }
        .gbb-area .cell { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; vertical-align: top; }
        .flat-rate-section { margin-bottom: 20px; page-break-inside: avoid; }
        .category-header { 
          font-size: 16px; font-weight: 700; color: {{PRIMARY_COLOR}}; 
          padding: 10px 14px; border-radius: 4px; margin-bottom: 12px;
        }
        .flat-rate-item { 
          margin-bottom: 12px; padding: 12px; background: #fff; 
          border: 1px solid #d9d9d9; border-radius: 4px; page-break-inside: avoid;
        }
        .item-type-header { 
          font-size: 14px; font-weight: 600; color: #333; 
          margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb;
        }
        .products-list { margin-top: 8px; }
        .product-row { 
          padding: 6px 10px; margin-bottom: 4px; background: #fafafa; 
          border-radius: 3px; font-size: 12px; display: flex; align-items: center;
        }
        .tier-badge { 
          display: inline-block; padding: 2px 8px; border-radius: 3px; 
          font-size: 10px; font-weight: 600; margin-right: 8px; color: #fff;
        }
        .tier-good { background: #1890ff; }
        .tier-better { background: #13c2c2; }
        .tier-best { background: #52c41a; }
        .product-summary {
          margin-top: 24px; padding: 16px; background: #f0f5ff; border: 1px solid #adc6ff; border-radius: 6px;
          page-break-inside: avoid;
        }
        .summary-title { font-size: 16px; font-weight: 700; color: {{PRIMARY_COLOR}}; margin-bottom: 12px; }
        .summary-item { 
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 12px; margin-bottom: 6px; background: #fff; border: 1px solid #d9d9d9; border-radius: 4px;
        }
        .summary-product { font-weight: 600; font-size: 13px; }
        .summary-count { font-size: 12px; color: #666; }
        .list { margin: 6px 0 6px 18px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sig { margin-top: 24px; }
        .sig .line { height: 1px; background: #222; width: 240px; margin: 24px 0 4px; }
        .kv { margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="page">
        <div>
          <div class="header">
            ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" />` : '<div class="logo"></div>'}
            <div>
              <div style="font-size:18px; font-weight:700;">${safe(company.name, 'Contractor Company')}</div>
              <div class="small muted">Phone: ${safe(company.phone, '')} • Email: ${safe(company.email, '')}</div>
              <div class="small muted">${headerAddress}</div>
            </div>
          </div>

          <div class="title">Project Proposal</div>
          <div class="kv small"><span class="label">Invoice:</span> ${safe(proposal.invoiceNumber, '')}</div>
          <div class="kv small"><span class="label">Date:</span> ${safe(proposal.date, '')}</div>
          <div class="kv small"><span class="label">Customer:</span> ${safe(proposal.customerName, '')}</div>
          <div class="kv small"><span class="label">Project Address:</span> ${safe(proposal.projectAddress, '')}</div>

          <div class="section-title">Introduction</div>
          <div class="small pre">${safe(introduction.welcomeMessage, `Thank you for choosing ${safe(company.name, 'our company')}. We are committed to delivering exceptional quality and service.`)}</div>
          ${introduction.aboutUsSummary ? `<div class="small pre muted" style="margin-top:6px;">${introduction.aboutUsSummary}</div>` : ''}

          <div class="section-title">Scope of Work</div>
          ${scope.interiorProcess ? `<div class="small label">Interior Process</div><div class="small pre">${scope.interiorProcess}</div>` : ''}
          ${scope.drywallRepairProcess ? `<div class="small label" style="margin-top:6px;">Drywall Repair</div><div class="small pre">${scope.drywallRepairProcess}</div>` : ''}
          ${scope.exteriorProcess ? `<div class="small label" style="margin-top:6px;">Exterior Process</div><div class="small pre">${scope.exteriorProcess}</div>` : ''}
          ${scope.trimProcess ? `<div class="small label" style="margin-top:6px;">Trim Process</div><div class="small pre">${scope.trimProcess}</div>` : ''}
          ${scope.cabinetProcess ? `<div class="small label" style="margin-top:6px;">Cabinet Process</div><div class="small pre">${scope.cabinetProcess}</div>` : ''}

          <div class="section-title">Area Breakdown</div>
          ${renderList(areaBreakdown)}

          <div class="section-title">Product Selection (GBB)</div>
        </div>

        <div>
          ${renderGBBTable(rows, investment)}

          <div class="card small">
            <div class="kv"><span class="label">Selected Option:</span> ${selectedOption}</div>
            <div class="kv"><span class="label">Total Investment:</span> ${formatCurrency(totalInvestment)}</div>
            <div class="kv"><span class="label">Deposit:</span> ${formatCurrency(depositAmount)}</div>
          </div>

        
            <div>
              <div class="section-title">Warranty</div>
              ${warranty.standard ? `<div class="small pre">${warranty.standard}</div>` : ''}
              ${warranty.premium ? `<div class="small pre" style="margin-top:6px;">${warranty.premium}</div>` : ''}
              ${warranty.exterior ? `<div class="small pre" style="margin-top:6px;">${warranty.exterior}</div>` : ''}
            </div>
            <div>
              <div class="section-title">Responsibilities</div>
              ${responsibilities.client ? `<div class="small pre"><span class="label">Client:</span> ${responsibilities.client}</div>` : ''}
              ${responsibilities.contractor ? `<div class="small pre" style="margin-top:6px;"><span class="label">Contractor:</span> ${responsibilities.contractor}</div>` : ''}
            </div>
        

          <div class="section-title">Policies</div>
          ${policies.touchUpPolicy ? `<div class="small pre"><span class="label">Touch-Up Policy</span>\n${policies.touchUpPolicy}</div>` : ''}
          ${policies.finalWalkthroughPolicy ? `<div class="small pre" style="margin-top:6px;"><span class="label">Final Walkthrough</span>\n${policies.finalWalkthroughPolicy}</div>` : ''}
          ${policies.changeOrderPolicy ? `<div class="small pre" style="margin-top:6px;"><span class="label">Change Orders</span>\n${policies.changeOrderPolicy}</div>` : ''}
          ${policies.colorDisclaimer ? `<div class="small pre muted" style="margin-top:6px;">${policies.colorDisclaimer}</div>` : ''}
          ${policies.surfaceConditionDisclaimer ? `<div class="small pre muted" style="margin-top:6px;">${policies.surfaceConditionDisclaimer}</div>` : ''}
          ${policies.paintFailureDisclaimer ? `<div class="small pre muted" style="margin-top:6px;">${policies.paintFailureDisclaimer}</div>` : ''}
          ${policies.generalProposalDisclaimer ? `<div class="small pre muted" style="margin-top:6px;">${policies.generalProposalDisclaimer}</div>` : ''}

          <div class="section-title">Acceptance</div>
          <div class="small pre">${safe(acceptance.acknowledgement, 'By signing below, you agree to the terms and conditions of this proposal.')}</div>
          ${acceptance.signatureStatement ? `<div class="small pre muted" style="margin-top:6px;">${acceptance.signatureStatement}</div>` : ''}
          ${payment.paymentTermsText ? `<div class="small pre" style="margin-top:10px;"><span class="label">Payment Terms</span>\n${payment.paymentTermsText}</div>` : ''}
          ${payment.paymentMethods ? `<div class="small pre muted" style="margin-top:6px;">${payment.paymentMethods}</div>` : ''}
          ${payment.latePaymentPolicy ? `<div class="small pre muted" style="margin-top:6px;">${payment.latePaymentPolicy}</div>` : ''}
          <div class="sig">
            <div class="line"></div>
            <div class="small muted">Client Signature</div>
            <div class="small muted">Date</div>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
  
  // Apply color scheme to HTML
  return applyColorToStyles(html, colorScheme);
}

/**
 * Detailed/Comprehensive Template - Multi-section layout with expanded terms
 * @param {Object} data - Proposal data
 * @param {string} colorScheme - Hex color value
 * @returns {string} HTML string
 */
function renderDetailedTemplate(data, colorScheme) {
  const company = data.company || {};
  const proposal = data.proposal || {};
  const gbb = data.gbb || {};
  const rows = gbb.rows || [];
  const investment = gbb.investment || {};
  const areaBreakdown = data.areaBreakdown || [];
  const introduction = data.introduction || {};
  const scope = data.scope || {};
  const warranty = data.warranty || {};
  const responsibilities = data.responsibilities || {};
  const acceptance = data.acceptance || {};
  const payment = data.payment || {};
  const policies = data.policies || {};

  const selectedOption = safe(proposal.selectedOption, '');
  const totalInvestment = safe(proposal.totalInvestment, 0);
  const depositAmount = safe(proposal.depositAmount, 0);

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4; margin: 20px; }
        body { font-family: 'Times New Roman', Times, serif; color: #1a1a1a; font-size: 11px; line-height: 1.5; }
        .container { max-width: 100%; }
        .header { background: {{PRIMARY_COLOR}}; color: #fff; padding: 20px; margin-bottom: 20px; }
        .header-grid { display: grid; grid-template-columns: 80px 1fr; gap: 16px; align-items: center; }
        .logo { width: 80px; height: 80px; object-fit: contain; background: #fff; padding: 4px; }
        .company-name { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
        .company-details { font-size: 11px; opacity: 0.95; }
        .title { font-size: 26px; font-weight: bold; color: {{PRIMARY_COLOR}}; text-align: center; margin: 24px 0; padding: 12px; border-top: 3px solid {{PRIMARY_COLOR}}; border-bottom: 3px solid {{PRIMARY_COLOR}}; }
        .section-box { border: 2px solid {{PRIMARY_COLOR}}; border-radius: 8px; padding: 16px; margin: 16px 0; page-break-inside: avoid; }
        .section-title { font-size: 16px; font-weight: bold; color: {{PRIMARY_COLOR}}; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid {{PRIMARY_COLOR}}; }
        .subsection-title { font-size: 13px; font-weight: bold; color: #333; margin: 12px 0 6px; }
        .content { margin-bottom: 10px; text-align: justify; }
        .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .info-table td { padding: 8px; border: 1px solid #ddd; }
        .info-table .label-cell { background: #f5f5f5; font-weight: bold; width: 30%; }
        .gbb-detailed { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .gbb-detailed thead th { background: {{PRIMARY_COLOR}}; color: #fff; padding: 10px; text-align: left; font-weight: bold; border: 1px solid {{PRIMARY_COLOR}}; }
        .gbb-detailed tbody td { padding: 10px; border: 1px solid #ddd; }
        .gbb-detailed tbody tr:nth-child(even) { background: #f9f9f9; }
        .gbb-detailed tbody tr:last-child { background: #e6f7ff; font-weight: bold; }
        .pricing-summary { background: #f0f5ff; border: 3px solid {{PRIMARY_COLOR}}; padding: 20px; margin: 20px 0; }
        .pricing-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
        .pricing-row.total { font-size: 18px; font-weight: bold; color: {{PRIMARY_COLOR}}; border-top: 3px solid {{PRIMARY_COLOR}}; border-bottom: none; margin-top: 8px; }
        .list-detailed { margin: 8px 0 8px 20px; }
        .list-detailed li { margin: 6px 0; }
        .disclaimer-box { background: #fff9e6; border-left: 4px solid #faad14; padding: 12px; margin: 12px 0; font-size: 10px; }
        .signature-section { margin-top: 40px; padding: 20px; border: 2px solid {{PRIMARY_COLOR}}; }
        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
        .signature-box { text-align: center; }
        .signature-line { border-bottom: 2px solid #333; margin: 40px 0 8px; }
        .signature-label { font-size: 10px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-grid">
            ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" />` : '<div class="logo"></div>'}
            <div>
              <div class="company-name">${safe(company.name, 'Contractor Company')}</div>
              <div class="company-details">
                ${safe(company.phone, '')} | ${safe(company.email, '')}<br/>
                ${[safe(company.addressLine1), safe(company.addressLine2)].filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        </div>

        <div class="title">COMPREHENSIVE PROJECT PROPOSAL</div>

        <div class="section-box">
          <div class="section-title">Proposal Information</div>
          <table class="info-table">
            <tr>
              <td class="label-cell">Proposal Number</td>
              <td>${safe(proposal.invoiceNumber, '')}</td>
              <td class="label-cell">Date</td>
              <td>${safe(proposal.date, '')}</td>
            </tr>
            <tr>
              <td class="label-cell">Customer Name</td>
              <td>${safe(proposal.customerName, '')}</td>
              <td class="label-cell">Project Address</td>
              <td>${safe(proposal.projectAddress, '')}</td>
            </tr>
          </table>
        </div>

        ${introduction.welcomeMessage || introduction.aboutUsSummary ? `
        <div class="section-box">
          <div class="section-title">Introduction</div>
          ${introduction.welcomeMessage ? `<div class="content">${introduction.welcomeMessage}</div>` : ''}
          ${introduction.aboutUsSummary ? `<div class="content">${introduction.aboutUsSummary}</div>` : ''}
        </div>
        ` : ''}

        ${scope.interiorProcess || scope.exteriorProcess || scope.trimProcess || scope.cabinetProcess || scope.drywallRepairProcess ? `
        <div class="section-box">
          <div class="section-title">Detailed Scope of Work</div>
          ${scope.interiorProcess ? `<div class="subsection-title">Interior Painting Process</div><div class="content">${scope.interiorProcess}</div>` : ''}
          ${scope.exteriorProcess ? `<div class="subsection-title">Exterior Painting Process</div><div class="content">${scope.exteriorProcess}</div>` : ''}
          ${scope.trimProcess ? `<div class="subsection-title">Trim & Millwork Process</div><div class="content">${scope.trimProcess}</div>` : ''}
          ${scope.cabinetProcess ? `<div class="subsection-title">Cabinet Refinishing Process</div><div class="content">${scope.cabinetProcess}</div>` : ''}
          ${scope.drywallRepairProcess ? `<div class="subsection-title">Drywall Repair Process</div><div class="content">${scope.drywallRepairProcess}</div>` : ''}
        </div>
        ` : ''}

        ${areaBreakdown.length > 0 ? `
        <div class="section-box">
          <div class="section-title">Project Areas Included</div>
          <ul class="list-detailed">
            ${areaBreakdown.map(area => `<li>${area}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${rows.length > 0 ? `
        <div class="section-box">
          <div class="section-title">Product Specifications & Pricing Tiers</div>
          ${renderGBBTable(rows, investment)}
        </div>
        ` : ''}

        <div class="pricing-summary">
          <div class="section-title">Investment Summary</div>
          <div class="pricing-row">
            <span>Selected Tier:</span>
            <span><strong>${selectedOption}</strong></span>
          </div>
          <div class="pricing-row total">
            <span>Total Project Investment:</span>
            <span>${formatCurrency(totalInvestment)}</span>
          </div>
          <div class="pricing-row">
            <span>Required Deposit (50%):</span>
            <span>${formatCurrency(depositAmount)}</span>
          </div>
        </div>

        ${warranty.standard || warranty.premium || warranty.exterior ? `
        <div class="section-box">
          <div class="section-title">Warranty Coverage</div>
          ${warranty.standard ? `<div class="subsection-title">Standard Warranty</div><div class="content">${warranty.standard}</div>` : ''}
          ${warranty.premium ? `<div class="subsection-title">Premium Warranty</div><div class="content">${warranty.premium}</div>` : ''}
          ${warranty.exterior ? `<div class="subsection-title">Exterior Warranty</div><div class="content">${warranty.exterior}</div>` : ''}
        </div>
        ` : ''}

        ${responsibilities.client || responsibilities.contractor ? `
        <div class="section-box">
          <div class="section-title">Responsibilities & Obligations</div>
          ${responsibilities.client ? `<div class="subsection-title">Client Responsibilities</div><div class="content">${responsibilities.client}</div>` : ''}
          ${responsibilities.contractor ? `<div class="subsection-title">Contractor Responsibilities</div><div class="content">${responsibilities.contractor}</div>` : ''}
        </div>
        ` : ''}

        ${payment.paymentTermsText || payment.paymentMethods || payment.latePaymentPolicy ? `
        <div class="section-box">
          <div class="section-title">Payment Terms & Conditions</div>
          ${payment.paymentTermsText ? `<div class="subsection-title">Payment Schedule</div><div class="content">${payment.paymentTermsText}</div>` : ''}
          ${payment.paymentMethods ? `<div class="subsection-title">Accepted Payment Methods</div><div class="content">${payment.paymentMethods}</div>` : ''}
          ${payment.latePaymentPolicy ? `<div class="subsection-title">Late Payment Policy</div><div class="content">${payment.latePaymentPolicy}</div>` : ''}
        </div>
        ` : ''}

        ${policies.touchUpPolicy || policies.finalWalkthroughPolicy || policies.changeOrderPolicy ? `
        <div class="section-box">
          <div class="section-title">Project Policies</div>
          ${policies.touchUpPolicy ? `<div class="subsection-title">Touch-Up Policy</div><div class="content">${policies.touchUpPolicy}</div>` : ''}
          ${policies.finalWalkthroughPolicy ? `<div class="subsection-title">Final Walkthrough</div><div class="content">${policies.finalWalkthroughPolicy}</div>` : ''}
          ${policies.changeOrderPolicy ? `<div class="subsection-title">Change Order Policy</div><div class="content">${policies.changeOrderPolicy}</div>` : ''}
        </div>
        ` : ''}

        ${policies.colorDisclaimer || policies.surfaceConditionDisclaimer || policies.paintFailureDisclaimer || policies.generalProposalDisclaimer ? `
        <div class="section-box">
          <div class="section-title">Important Disclaimers</div>
          ${policies.colorDisclaimer ? `<div class="disclaimer-box">${policies.colorDisclaimer}</div>` : ''}
          ${policies.surfaceConditionDisclaimer ? `<div class="disclaimer-box">${policies.surfaceConditionDisclaimer}</div>` : ''}
          ${policies.paintFailureDisclaimer ? `<div class="disclaimer-box">${policies.paintFailureDisclaimer}</div>` : ''}
          ${policies.generalProposalDisclaimer ? `<div class="disclaimer-box">${policies.generalProposalDisclaimer}</div>` : ''}
        </div>
        ` : ''}

        <div class="signature-section">
          <div class="section-title">Proposal Acceptance</div>
          <div class="content">${safe(acceptance.acknowledgement, 'By signing below, you acknowledge that you have read, understood, and agree to all terms and conditions outlined in this comprehensive proposal.')}</div>
          ${acceptance.signatureStatement ? `<div class="content" style="font-size: 10px; color: #666;">${acceptance.signatureStatement}</div>` : ''}
          <div class="signature-grid">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">CLIENT SIGNATURE</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">DATE</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">CONTRACTOR SIGNATURE</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">DATE</div>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
  
  return applyColorToStyles(html, colorScheme);
}

/**
 * Modern/Minimal Template - Clean single-column layout
 * @param {Object} data - Proposal data
 * @param {string} colorScheme - Hex color value
 * @returns {string} HTML string
 */
function renderModernTemplate(data, colorScheme) {
  const company = data.company || {};
  const proposal = data.proposal || {};
  const gbb = data.gbb || {};
  const rows = gbb.rows || [];
  const investment = gbb.investment || {};
  const areaBreakdown = data.areaBreakdown || [];
  const introduction = data.introduction || {};
  const scope = data.scope || {};
  const warranty = data.warranty || {};
  const responsibilities = data.responsibilities || {};
  const acceptance = data.acceptance || {};
  const payment = data.payment || {};
  const policies = data.policies || {};

  const selectedOption = safe(proposal.selectedOption, '');
  const totalInvestment = safe(proposal.totalInvestment, 0);
  const depositAmount = safe(proposal.depositAmount, 0);

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4; margin: 32px; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 700px; margin: 0 auto; padding: 24px; }
        .header { text-align: center; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 3px solid {{PRIMARY_COLOR}}; }
        .logo { width: 80px; height: 80px; object-fit: contain; margin: 0 auto 16px; }
        .company-name { font-size: 28px; font-weight: 300; color: {{PRIMARY_COLOR}}; margin-bottom: 8px; }
        .company-info { font-size: 13px; color: #666; }
        .title { font-size: 32px; font-weight: 200; color: {{PRIMARY_COLOR}}; margin: 48px 0 24px; text-align: center; letter-spacing: 1px; }
        .section { margin: 40px 0; }
        .section-title { font-size: 20px; font-weight: 300; color: {{PRIMARY_COLOR}}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
        .content { font-size: 13px; color: #555; margin-bottom: 16px; }
        .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 12px; margin: 24px 0; }
        .info-label { font-weight: 500; color: #666; font-size: 12px; }
        .info-value { font-size: 13px; color: #333; }
        .gbb-modern { width: 100%; border-collapse: collapse; margin: 24px 0; }
        .gbb-modern thead th { background: {{PRIMARY_COLOR}}; color: #fff; padding: 12px; text-align: left; font-weight: 400; font-size: 13px; }
        .gbb-modern tbody td { padding: 12px; border-bottom: 1px solid #e0e0e0; font-size: 12px; }
        .gbb-modern tbody tr:last-child td { border-bottom: 2px solid {{PRIMARY_COLOR}}; font-weight: 500; }
        .highlight-box { background: #f9f9f9; border-left: 4px solid {{PRIMARY_COLOR}}; padding: 20px; margin: 24px 0; }
        .highlight-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .highlight-value { font-size: 24px; font-weight: 300; color: {{PRIMARY_COLOR}}; }
        .list-clean { list-style: none; padding: 0; }
        .list-clean li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
        .list-clean li:before { content: "•"; color: {{PRIMARY_COLOR}}; font-weight: bold; display: inline-block; width: 1em; margin-left: -1em; }
        .signature-area { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e0e0e0; }
        .signature-line { width: 300px; border-bottom: 1px solid #333; margin: 40px 0 8px; }
        .signature-label { font-size: 11px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" />` : ''}
          <div class="company-name">${safe(company.name, 'Contractor Company')}</div>
          <div class="company-info">${safe(company.phone, '')} • ${safe(company.email, '')}</div>
          <div class="company-info">${[safe(company.addressLine1), safe(company.addressLine2)].filter(Boolean).join(', ')}</div>
        </div>

        <div class="title">Project Proposal</div>

        <div class="info-grid">
          <div class="info-label">Proposal Number</div>
          <div class="info-value">${safe(proposal.invoiceNumber, '')}</div>
          <div class="info-label">Date</div>
          <div class="info-value">${safe(proposal.date, '')}</div>
          <div class="info-label">Customer</div>
          <div class="info-value">${safe(proposal.customerName, '')}</div>
          <div class="info-label">Project Address</div>
          <div class="info-value">${safe(proposal.projectAddress, '')}</div>
        </div>

        ${introduction.welcomeMessage ? `
        <div class="section">
          <div class="section-title">Welcome</div>
          <div class="content">${introduction.welcomeMessage}</div>
          ${introduction.aboutUsSummary ? `<div class="content">${introduction.aboutUsSummary}</div>` : ''}
        </div>
        ` : ''}

        ${scope.interiorProcess || scope.exteriorProcess ? `
        <div class="section">
          <div class="section-title">Scope of Work</div>
          ${scope.interiorProcess ? `<div class="content"><strong>Interior:</strong> ${scope.interiorProcess}</div>` : ''}
          ${scope.exteriorProcess ? `<div class="content"><strong>Exterior:</strong> ${scope.exteriorProcess}</div>` : ''}
          ${scope.trimProcess ? `<div class="content"><strong>Trim:</strong> ${scope.trimProcess}</div>` : ''}
          ${scope.cabinetProcess ? `<div class="content"><strong>Cabinets:</strong> ${scope.cabinetProcess}</div>` : ''}
        </div>
        ` : ''}

        ${areaBreakdown.length > 0 ? `
        <div class="section">
          <div class="section-title">Project Areas</div>
          <ul class="list-clean">
            ${areaBreakdown.map(area => `<li>${area}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${rows.length > 0 ? `
        <div class="section">
          <div class="section-title">Product Selection</div>
          ${renderGBBTable(rows, investment)}
        </div>
        ` : ''}

        <div class="highlight-box">
          <div class="highlight-label">Selected Option</div>
          <div class="highlight-value">${selectedOption}</div>
          <div style="margin-top: 16px;">
            <div class="info-label">Total Investment</div>
            <div style="font-size: 20px; font-weight: 400; color: #333;">${formatCurrency(totalInvestment)}</div>
          </div>
          <div style="margin-top: 12px;">
            <div class="info-label">Deposit Required</div>
            <div style="font-size: 16px; color: #666;">${formatCurrency(depositAmount)}</div>
          </div>
        </div>

        ${warranty.standard || warranty.exterior ? `
        <div class="section">
          <div class="section-title">Warranty</div>
          ${warranty.standard ? `<div class="content">${warranty.standard}</div>` : ''}
          ${warranty.exterior ? `<div class="content">${warranty.exterior}</div>` : ''}
        </div>
        ` : ''}

        ${responsibilities.client || responsibilities.contractor ? `
        <div class="section">
          <div class="section-title">Responsibilities</div>
          ${responsibilities.client ? `<div class="content"><strong>Client:</strong> ${responsibilities.client}</div>` : ''}
          ${responsibilities.contractor ? `<div class="content"><strong>Contractor:</strong> ${responsibilities.contractor}</div>` : ''}
        </div>
        ` : ''}

        ${payment.paymentTermsText ? `
        <div class="section">
          <div class="section-title">Payment Terms</div>
          <div class="content">${payment.paymentTermsText}</div>
        </div>
        ` : ''}

        <div class="signature-area">
          <div class="content">${safe(acceptance.acknowledgement, 'By signing below, you agree to the terms and conditions of this proposal.')}</div>
          <div class="signature-line"></div>
          <div class="signature-label">Client Signature & Date</div>
        </div>
      </div>
    </body>
  </html>
  `;
  
  return applyColorToStyles(html, colorScheme);
}

/**
 * Simple/Budget Template - Concise 1-page layout
 * @param {Object} data - Proposal data
 * @param {string} colorScheme - Hex color value
 * @returns {string} HTML string
 */
function renderSimpleTemplate(data, colorScheme) {
  const company = data.company || {};
  const proposal = data.proposal || {};
  const gbb = data.gbb || {};
  const rows = gbb.rows || [];
  const investment = gbb.investment || {};
  const areaBreakdown = data.areaBreakdown || [];
  const introduction = data.introduction || {};
  const scope = data.scope || {};
  const warranty = data.warranty || {};
  const acceptance = data.acceptance || {};
  const payment = data.payment || {};

  const selectedOption = safe(proposal.selectedOption, '');
  const totalInvestment = safe(proposal.totalInvestment, 0);
  const depositAmount = safe(proposal.depositAmount, 0);

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4; margin: 16px; }
        body { font-family: Arial, sans-serif; color: #222; font-size: 10px; line-height: 1.3; }
        .container { max-width: 100%; }
        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 2px solid {{PRIMARY_COLOR}}; margin-bottom: 12px; }
        .header-left { flex: 1; }
        .logo { width: 50px; height: 50px; object-fit: contain; }
        .company-name { font-size: 16px; font-weight: bold; color: {{PRIMARY_COLOR}}; }
        .company-contact { font-size: 9px; color: #666; }
        .title { font-size: 18px; font-weight: bold; color: {{PRIMARY_COLOR}}; text-align: center; margin: 8px 0; }
        .info-row { display: flex; gap: 20px; margin: 4px 0; font-size: 9px; }
        .info-item { display: flex; gap: 4px; }
        .info-label { font-weight: 600; }
        .section { margin: 12px 0; }
        .section-title { font-size: 12px; font-weight: bold; color: {{PRIMARY_COLOR}}; margin-bottom: 6px; padding-bottom: 2px; border-bottom: 1px solid #ddd; }
        .content { font-size: 9px; margin-bottom: 6px; }
        .gbb-simple { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9px; }
        .gbb-simple thead th { background: {{PRIMARY_COLOR}}; color: #fff; padding: 4px; text-align: left; font-weight: 600; }
        .gbb-simple tbody td { padding: 4px; border-bottom: 1px solid #e0e0e0; }
        .gbb-simple tbody tr:last-child { font-weight: 600; background: #f5f5f5; }
        .pricing-box { background: #f9f9f9; border: 2px solid {{PRIMARY_COLOR}}; padding: 10px; margin: 10px 0; display: flex; justify-content: space-between; align-items: center; }
        .pricing-label { font-size: 10px; font-weight: 600; }
        .pricing-value { font-size: 14px; font-weight: bold; color: {{PRIMARY_COLOR}}; }
        .areas-list { display: flex; flex-wrap: wrap; gap: 8px; font-size: 9px; }
        .area-tag { background: #e6f7ff; border: 1px solid {{PRIMARY_COLOR}}; padding: 2px 6px; border-radius: 3px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .signature { margin-top: 16px; }
        .signature-line { width: 200px; border-bottom: 1px solid #333; margin: 20px 0 4px; }
        .signature-label { font-size: 8px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-left">
            <div class="company-name">${safe(company.name, 'Contractor Company')}</div>
            <div class="company-contact">${safe(company.phone, '')} • ${safe(company.email, '')}</div>
          </div>
          ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" />` : ''}
        </div>

        <div class="title">Quick Quote</div>

        <div class="info-row">
          <div class="info-item">
            <span class="info-label">Quote #:</span>
            <span>${safe(proposal.invoiceNumber, '')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Date:</span>
            <span>${safe(proposal.date, '')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Customer:</span>
            <span>${safe(proposal.customerName, '')}</span>
          </div>
        </div>
        <div class="info-row">
          <div class="info-item">
            <span class="info-label">Address:</span>
            <span>${safe(proposal.projectAddress, '')}</span>
          </div>
        </div>

        ${introduction.welcomeMessage ? `
        <div class="section">
          <div class="content">${introduction.welcomeMessage}</div>
        </div>
        ` : ''}

        ${scope.interiorProcess || scope.exteriorProcess ? `
        <div class="section">
          <div class="section-title">Work Summary</div>
          ${scope.interiorProcess ? `<div class="content"><strong>Interior:</strong> ${scope.interiorProcess.substring(0, 150)}${scope.interiorProcess.length > 150 ? '...' : ''}</div>` : ''}
          ${scope.exteriorProcess ? `<div class="content"><strong>Exterior:</strong> ${scope.exteriorProcess.substring(0, 150)}${scope.exteriorProcess.length > 150 ? '...' : ''}</div>` : ''}
        </div>
        ` : ''}

        ${areaBreakdown.length > 0 ? `
        <div class="section">
          <div class="section-title">Areas</div>
          <div class="areas-list">
            ${areaBreakdown.map(area => `<span class="area-tag">${area}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        ${rows.length > 0 ? `
        <div class="section">
          <div class="section-title">Products & Pricing</div>
          ${renderGBBTable(rows, investment)}
        </div>
        ` : ''}

        <div class="pricing-box">
          <div>
            <div class="pricing-label">Selected: ${selectedOption}</div>
            <div class="pricing-label">Deposit: ${formatCurrency(depositAmount)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; color: #666;">Total Investment</div>
            <div class="pricing-value">${formatCurrency(totalInvestment)}</div>
          </div>
        </div>

        <div class="two-col">
          ${warranty.standard ? `
          <div class="section">
            <div class="section-title">Warranty</div>
            <div class="content">${warranty.standard.substring(0, 120)}${warranty.standard.length > 120 ? '...' : ''}</div>
          </div>
          ` : '<div></div>'}
          
          ${payment.paymentTermsText ? `
          <div class="section">
            <div class="section-title">Payment</div>
            <div class="content">${payment.paymentTermsText}</div>
          </div>
          ` : '<div></div>'}
        </div>

        <div class="signature">
          <div class="content">${safe(acceptance.acknowledgement, 'By signing, you agree to the terms of this quote.')}</div>
          <div class="signature-line"></div>
          <div class="signature-label">Client Signature & Date</div>
        </div>
      </div>
    </body>
  </html>
  `;
  
  return applyColorToStyles(html, colorScheme);
}

/**
 * Template Router - Routes to appropriate template renderer
 * @param {Object} data - Proposal data
 * @param {Object} options - Rendering options
 * @param {string} options.templateId - Template identifier (classic-professional, modern-minimal, detailed-comprehensive, simple-budget)
 * @param {string} options.colorScheme - Color scheme identifier (blue, green, orange, purple, gray)
 * @returns {string} Rendered HTML
 */
function renderProposalHtml(data, options = {}) {
  try {
    // Whitelist of valid template IDs
    const VALID_TEMPLATE_IDS = [
      'classic-professional',
      'modern-minimal',
      'detailed-comprehensive',
      'simple-budget'
    ];
    
    const templateId = options.templateId || 'classic-professional';
    const colorSchemeId = options.colorScheme || 'blue';
    
    // Validate template ID
    if (!VALID_TEMPLATE_IDS.includes(templateId)) {
      console.warn(`Invalid template ID: ${templateId}, falling back to classic-professional`);
      const colorHex = getColorScheme(colorSchemeId);
      return renderClassicTemplate(data, colorHex);
    }
    
    const colorHex = getColorScheme(colorSchemeId);
    
    // Route to appropriate template renderer with error handling
    try {
      switch (templateId) {
        case 'classic-professional':
          return renderClassicTemplate(data, colorHex);
        
        case 'modern-minimal':
          return renderModernTemplate(data, colorHex);
        
        case 'detailed-comprehensive':
          return renderDetailedTemplate(data, colorHex);
        
        case 'simple-budget':
          return renderSimpleTemplate(data, colorHex);
        
        default:
          console.warn(`Unknown template ID: ${templateId}, falling back to Classic`);
          return renderClassicTemplate(data, colorHex);
      }
    } catch (templateError) {
      console.error(`Error rendering template ${templateId}:`, templateError);
      console.error('Stack trace:', templateError.stack);
      console.warn('Falling back to classic-professional template');
      
      // Fall back to classic template
      return renderClassicTemplate(data, colorHex);
    }
  } catch (error) {
    console.error('Critical error in renderProposalHtml:', error);
    console.error('Stack trace:', error.stack);
    
    // Return minimal error-safe HTML
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .error { color: #d32f2f; border: 2px solid #d32f2f; padding: 20px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>Error Generating Proposal</h2>
            <p>We encountered an error while generating your proposal. Please contact support.</p>
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = { renderProposalHtml, SAMPLE_PREVIEW_DATA, COLOR_SCHEMES, generatePreviewData };
