// services/templateService.js
// Manages proposal templates and renders template-specific content

const { ContractorSettings } = require('../models');
const { renderProposalHtml } = require('./proposalTemplate');

/**
 * Template Service
 * Manages four proposal templates and provides rendering logic
 */
class TemplateService {
  constructor() {
    // Define available templates
    this.templates = [
      {
        id: 'classic-professional',
        name: 'Classic/Professional',
        description: 'Traditional layout with formal typography and structured sections (Current Default)'
      },
      {
        id: 'modern-minimal',
        name: 'Modern/Minimal',
        description: 'Clean layout with ample whitespace and contemporary design elements'
      },
      {
        id: 'detailed-comprehensive',
        name: 'Detailed/Comprehensive',
        description: 'Expanded sections for specifications, terms, and detailed breakdowns'
      },
      {
        id: 'simple-budget',
        name: 'Simple/Budget-friendly',
        description: 'Concise layout focusing on essential pricing and product information'
      }
    ];

    this.defaultTemplate = 'classic-professional';
  }

  /**
   * Get contractor's selected template or default
   * @param {string} tenantId - Tenant identifier
   * @returns {Promise<string>} Template identifier
   */
  async getContractorTemplate(tenantId) {
    try {
      const settings = await ContractorSettings.findOne({
        where: { tenantId }
      });

      if (settings && settings.selectedProposalTemplate) {
        // Validate that the template exists
        const templateExists = this.templates.some(t => t.id === settings.selectedProposalTemplate);
        if (templateExists) {
          return settings.selectedProposalTemplate;
        }
      }

      // Return default template if none selected or invalid
      return this.defaultTemplate;
    } catch (error) {
      console.error('[TemplateService] Error getting contractor template:', error);
      return this.defaultTemplate;
    }
  }

  /**
   * Render proposal HTML using specified template
   * @param {string} templateId - Template identifier
   * @param {Object} quoteData - Complete quote data
   * @returns {Promise<string>} Rendered HTML
   */
  async renderProposal(templateId, quoteData) {
    try {
      // Validate template ID
      if (!this.validateTemplateSupport(templateId, quoteData.pricingScheme?.type)) {
        console.warn(`[TemplateService] Template ${templateId} not supported, falling back to default`);
        templateId = this.defaultTemplate;
      }

      let html;

      // Render based on template type
      switch (templateId) {
        case 'classic-professional':
          // Use existing proposalTemplate.js (already implemented)
          html = renderProposalHtml(quoteData);
          break;

        case 'modern-minimal':
          html = this._renderModernMinimal(quoteData);
          break;

        case 'detailed-comprehensive':
          html = this._renderDetailedComprehensive(quoteData);
          break;

        case 'simple-budget':
          html = this._renderSimpleBudget(quoteData);
          break;

        default:
          // Fallback to classic
          html = renderProposalHtml(quoteData);
      }

      return html;
    } catch (error) {
      console.error('[TemplateService] Error rendering proposal:', error);
      throw error;
    }
  }

  /**
   * Render Modern/Minimal template
   * @private
   */
  _renderModernMinimal(data) {
    const company = data.company || {};
    const proposal = data.proposal || {};
    const gbb = data.gbb || {};
    const rows = gbb.rows || [];
    const investment = gbb.investment || {};
    const areaBreakdown = data.areaBreakdown || [];

    return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 32px; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Helvetica Neue', Arial, sans-serif; 
            color: #2c3e50; 
            line-height: 1.8;
            font-size: 14px;
          }
          .container { max-width: 100%; }
          .header { 
            text-align: center; 
            padding: 40px 0; 
            border-bottom: 1px solid #ecf0f1;
            margin-bottom: 40px;
          }
          .logo { max-width: 120px; margin-bottom: 20px; }
          .company-name { 
            font-size: 24px; 
            font-weight: 300; 
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #34495e;
          }
          .title { 
            font-size: 36px; 
            font-weight: 100; 
            color: #2c3e50;
            margin: 60px 0 40px;
            text-align: center;
            letter-spacing: 4px;
          }
          .section { margin-bottom: 50px; }
          .section-title { 
            font-size: 14px; 
            font-weight: 600; 
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #7f8c8d;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ecf0f1;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 40px;
            margin-bottom: 40px;
          }
          .info-item { margin-bottom: 15px; }
          .info-label { 
            font-size: 11px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
            color: #95a5a6;
            margin-bottom: 5px;
          }
          .info-value { font-size: 14px; color: #2c3e50; }
          .product-table { 
            width: 100%; 
            border-collapse: collapse;
            margin: 30px 0;
          }
          .product-table th { 
            background: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #7f8c8d;
          }
          .product-table td { 
            padding: 15px;
            border-bottom: 1px solid #ecf0f1;
          }
          .investment-box {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            margin: 40px 0;
          }
          .investment-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #7f8c8d;
            margin-bottom: 10px;
          }
          .investment-amount {
            font-size: 42px;
            font-weight: 100;
            color: #2c3e50;
          }
          .footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 1px solid #ecf0f1;
            text-align: center;
            font-size: 11px;
            color: #95a5a6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" />` : ''}
            <div class="company-name">${company.name || 'Contractor Company'}</div>
          </div>

          <div class="title">PROPOSAL</div>

          <div class="info-grid">
            <div>
              <div class="info-item">
                <div class="info-label">Proposal Number</div>
                <div class="info-value">${proposal.invoiceNumber || ''}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date</div>
                <div class="info-value">${proposal.date || ''}</div>
              </div>
            </div>
            <div>
              <div class="info-item">
                <div class="info-label">Customer</div>
                <div class="info-value">${proposal.customerName || ''}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Project Address</div>
                <div class="info-value">${proposal.projectAddress || ''}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Scope of Work</div>
            ${areaBreakdown.map(area => `<div style="margin-bottom: 8px;">• ${area}</div>`).join('')}
          </div>

          <div class="section">
            <div class="section-title">Product Selection</div>
            <table class="product-table">
              <thead>
                <tr>
                  <th>Surface</th>
                  <th>Good</th>
                  <th>Better</th>
                  <th>Best</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td>${r.label || ''}</td>
                    <td>${r.good || '-'}</td>
                    <td>${r.better || '-'}</td>
                    <td>${r.best || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="investment-box">
            <div class="investment-label">Total Investment</div>
            <div class="investment-amount">${this._formatCurrency(proposal.totalInvestment || 0)}</div>
          </div>

          <div class="footer">
            ${company.name || ''} • ${company.phone || ''} • ${company.email || ''}
          </div>
        </div>
      </body>
    </html>
    `;
  }

  /**
   * Render Detailed/Comprehensive template
   * @private
   */
  _renderDetailedComprehensive(data) {
    const company = data.company || {};
    const proposal = data.proposal || {};
    const gbb = data.gbb || {};
    const rows = gbb.rows || [];
    const investment = gbb.investment || {};
    const areaBreakdown = data.areaBreakdown || [];
    const introduction = data.introduction || {};
    const scope = data.scope || {};
    const warranty = data.warranty || {};
    const policies = data.policies || {};

    return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 20px; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Georgia, 'Times New Roman', serif; 
            color: #333; 
            line-height: 1.6;
            font-size: 12px;
          }
          .header { 
            background: #1a1a1a;
            color: white;
            padding: 25px;
            margin-bottom: 20px;
          }
          .company-name { font-size: 22px; font-weight: bold; margin-bottom: 5px; }
          .title { 
            font-size: 28px; 
            font-weight: bold; 
            color: #1a1a1a;
            margin: 20px 0;
            padding: 15px;
            background: #f5f5f5;
            border-left: 5px solid #1a1a1a;
          }
          .section { 
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid #e0e0e0;
          }
          .section-title { 
            font-size: 16px; 
            font-weight: bold; 
            color: #1a1a1a;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #1a1a1a;
          }
          .subsection-title {
            font-size: 13px;
            font-weight: bold;
            color: #444;
            margin: 15px 0 8px;
          }
          .detail-table { 
            width: 100%; 
            border-collapse: collapse;
            margin: 15px 0;
          }
          .detail-table th { 
            background: #1a1a1a;
            color: white;
            padding: 10px;
            text-align: left;
            font-size: 11px;
          }
          .detail-table td { 
            padding: 10px;
            border: 1px solid #e0e0e0;
            font-size: 11px;
          }
          .info-box {
            background: #f9f9f9;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #1a1a1a;
          }
          .price-summary {
            background: #1a1a1a;
            color: white;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .price-label { font-size: 14px; margin-bottom: 10px; }
          .price-amount { font-size: 32px; font-weight: bold; }
          .terms-list { 
            list-style: none;
            padding-left: 0;
          }
          .terms-list li {
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .terms-list li:before {
            content: "▪ ";
            font-weight: bold;
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${company.name || 'Contractor Company'}</div>
          <div>${company.phone || ''} | ${company.email || ''}</div>
          <div>${company.addressLine1 || ''}</div>
        </div>

        <div class="title">COMPREHENSIVE PROJECT PROPOSAL</div>

        <div class="section">
          <div class="section-title">Project Information</div>
          <div class="info-box">
            <div><strong>Proposal #:</strong> ${proposal.invoiceNumber || ''}</div>
            <div><strong>Date:</strong> ${proposal.date || ''}</div>
            <div><strong>Customer:</strong> ${proposal.customerName || ''}</div>
            <div><strong>Project Address:</strong> ${proposal.projectAddress || ''}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Introduction</div>
          <p>${introduction.welcomeMessage || ''}</p>
          ${introduction.aboutUsSummary ? `<p style="margin-top: 10px;">${introduction.aboutUsSummary}</p>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Detailed Scope of Work</div>
          ${scope.interiorProcess ? `
            <div class="subsection-title">Interior Process</div>
            <p>${scope.interiorProcess}</p>
          ` : ''}
          ${scope.exteriorProcess ? `
            <div class="subsection-title">Exterior Process</div>
            <p>${scope.exteriorProcess}</p>
          ` : ''}
          ${scope.trimProcess ? `
            <div class="subsection-title">Trim Process</div>
            <p>${scope.trimProcess}</p>
          ` : ''}
          <div class="subsection-title">Areas Included</div>
          <ul>
            ${areaBreakdown.map(area => `<li>${area}</li>`).join('')}
          </ul>
        </div>

        <div class="section">
          <div class="section-title">Product Specifications</div>
          <table class="detail-table">
            <thead>
              <tr>
                <th>Surface/Area</th>
                <th>Good Option</th>
                <th>Better Option</th>
                <th>Best Option</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${r.label || ''}</strong></td>
                  <td>${r.good || '-'}</td>
                  <td>${r.better || '-'}</td>
                  <td>${r.best || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="price-summary">
          <div class="price-label">Total Project Investment</div>
          <div class="price-amount">${this._formatCurrency(proposal.totalInvestment || 0)}</div>
          <div style="margin-top: 10px; font-size: 14px;">
            Deposit: ${this._formatCurrency(proposal.depositAmount || 0)}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Warranty Information</div>
          ${warranty.standard ? `<p>${warranty.standard}</p>` : ''}
          ${warranty.premium ? `<p style="margin-top: 10px;">${warranty.premium}</p>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Terms & Conditions</div>
          <ul class="terms-list">
            ${policies.touchUpPolicy ? `<li>${policies.touchUpPolicy}</li>` : ''}
            ${policies.changeOrderPolicy ? `<li>${policies.changeOrderPolicy}</li>` : ''}
            ${policies.colorDisclaimer ? `<li>${policies.colorDisclaimer}</li>` : ''}
          </ul>
        </div>
      </body>
    </html>
    `;
  }

  /**
   * Render Simple/Budget template
   * @private
   */
  _renderSimpleBudget(data) {
    const company = data.company || {};
    const proposal = data.proposal || {};
    const gbb = data.gbb || {};
    const rows = gbb.rows || [];
    const investment = gbb.investment || {};
    const areaBreakdown = data.areaBreakdown || [];

    return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 25px; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            color: #000; 
            line-height: 1.5;
            font-size: 13px;
          }
          .header { 
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .company-name { font-size: 20px; font-weight: bold; }
          .title { 
            font-size: 24px; 
            font-weight: bold; 
            margin: 20px 0;
          }
          .info-row { 
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
          }
          .section { margin-bottom: 20px; }
          .section-title { 
            font-size: 14px; 
            font-weight: bold; 
            margin-bottom: 10px;
            padding: 8px;
            background: #000;
            color: white;
          }
          .simple-table { 
            width: 100%; 
            border-collapse: collapse;
            margin: 10px 0;
          }
          .simple-table th { 
            background: #e0e0e0;
            padding: 8px;
            text-align: left;
            font-size: 12px;
            border: 1px solid #ccc;
          }
          .simple-table td { 
            padding: 8px;
            border: 1px solid #ccc;
            font-size: 12px;
          }
          .total-box {
            background: #000;
            color: white;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .total-label { font-size: 14px; }
          .total-amount { font-size: 36px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${company.name || 'Contractor Company'}</div>
          <div>${company.phone || ''} | ${company.email || ''}</div>
        </div>

        <div class="title">PROPOSAL</div>

        <div class="info-row">
          <div>
            <div><strong>Proposal #:</strong> ${proposal.invoiceNumber || ''}</div>
            <div><strong>Date:</strong> ${proposal.date || ''}</div>
          </div>
          <div>
            <div><strong>Customer:</strong> ${proposal.customerName || ''}</div>
            <div><strong>Address:</strong> ${proposal.projectAddress || ''}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Work Areas</div>
          ${areaBreakdown.map(area => `<div>• ${area}</div>`).join('')}
        </div>

        <div class="section">
          <div class="section-title">Products</div>
          <table class="simple-table">
            <thead>
              <tr>
                <th>Surface</th>
                <th>Good</th>
                <th>Better</th>
                <th>Best</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.label || ''}</td>
                  <td>${r.good || '-'}</td>
                  <td>${r.better || '-'}</td>
                  <td>${r.best || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="total-box">
          <div class="total-label">TOTAL PRICE</div>
          <div class="total-amount">${this._formatCurrency(proposal.totalInvestment || 0)}</div>
          <div>Deposit: ${this._formatCurrency(proposal.depositAmount || 0)}</div>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #000;">
          <div style="margin-bottom: 30px;">
            <div>Customer Signature: _________________________________</div>
          </div>
          <div>
            <div>Date: _________________________________</div>
          </div>
        </div>
      </body>
    </html>
    `;
  }

  /**
   * Helper: Format currency
   * @private
   */
  _formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  /**
   * Get available templates
   * @returns {Array<{id: string, name: string, description: string}>}
   */
  getAvailableTemplates() {
    return this.templates;
  }

  /**
   * Validate template supports pricing scheme
   * @param {string} templateId - Template identifier
   * @param {string} pricingScheme - Pricing scheme type
   * @returns {boolean}
   */
  validateTemplateSupport(templateId, pricingScheme) {
    // Check if template exists
    const templateExists = this.templates.some(t => t.id === templateId);
    if (!templateExists) {
      return false;
    }

    // All templates support all pricing schemes
    // This is a design requirement (Requirement 4.5)
    const supportedSchemes = [
      'turnkey',
      'flat_rate',
      'production_based',
      'rate_based_sqft'
    ];

    // If no pricing scheme provided, assume valid
    if (!pricingScheme) {
      return true;
    }

    return supportedSchemes.includes(pricingScheme);
  }

  /**
   * Save contractor template preference
   * @param {string} tenantId - Tenant identifier
   * @param {string} templateId - Template identifier
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async saveContractorTemplate(tenantId, templateId) {
    try {
      // Validate template ID
      const templateExists = this.templates.some(t => t.id === templateId);
      if (!templateExists) {
        return {
          success: false,
          error: 'Invalid template ID'
        };
      }

      // Update contractor settings
      const [settings, created] = await ContractorSettings.findOrCreate({
        where: { tenantId },
        defaults: { 
          tenantId,
          selectedProposalTemplate: templateId 
        }
      });

      if (!created) {
        await settings.update({ selectedProposalTemplate: templateId });
      }

      console.log(`[TemplateService] Saved template preference for tenant ${tenantId}: ${templateId}`);

      return {
        success: true
      };
    } catch (error) {
      console.error('[TemplateService] Error saving contractor template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new TemplateService();
