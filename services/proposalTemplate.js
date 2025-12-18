// services/proposalTemplate.js
// Renders HTML for the proposal PDF based on a structured data model

function formatCurrency(n) {
  const num = Number.parseFloat(n || 0);
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function safe(val, fallback = '') {
  return (val !== undefined && val !== null) ? val : fallback;
}

// rows: [{ label: 'Walls', good: '...', better: '...', best: '...' }]
function renderGBBTable(rows = [], investment = {}) {
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

function renderProposalHtml(data) {
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

  return `
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
        .title { font-size: 22px; font-weight: 700; color: #1f4fb2; margin: 8px 0 12px; }
        .section-title { font-size: 18px; font-weight: 700; color: #1f4fb2; margin: 20px 0 8px; }
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
        .gbb .head { background: #1f4fb2; color: #fff; text-align: left; padding: 8px; font-weight: 600; font-size: 13px; }
        .gbb .cell { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; vertical-align: top; }
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
}

module.exports = { renderProposalHtml };
