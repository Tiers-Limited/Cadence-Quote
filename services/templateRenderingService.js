// services/templateRenderingService.js
/**
 * Template Rendering Service for Quote Output
 * **Feature: cadence-quote-builder-update, Task 8.4**
 * **Validates: Requirements 7.4**
 */

/**
 * Template Rendering Service
 * Handles applying template formatting to quote output
 */
class TemplateRenderingService {
  constructor() {
    this.templates = {
      professional: {
        name: 'Professional',
        layout: 'business-focused',
        features: ['company-branding', 'detailed-scope', 'gbb-pricing', 'warranty-terms'],
        styling: {
          primaryColor: '#1890ff',
          fontFamily: 'Arial, sans-serif',
          headerStyle: 'formal',
          sectionSpacing: 'standard'
        }
      },
      modern: {
        name: 'Modern',
        layout: 'contemporary',
        features: ['visual-hierarchy', 'color-accents', 'streamlined-layout', 'photo-gallery'],
        styling: {
          primaryColor: '#52c41a',
          fontFamily: 'Helvetica, sans-serif',
          headerStyle: 'contemporary',
          sectionSpacing: 'compact'
        }
      },
      classic: {
        name: 'Classic',
        layout: 'traditional',
        features: ['formal-layout', 'comprehensive-terms', 'traditional-styling', 'legal-emphasis'],
        styling: {
          primaryColor: '#722ed1',
          fontFamily: 'Times New Roman, serif',
          headerStyle: 'traditional',
          sectionSpacing: 'generous'
        }
      },
      minimal: {
        name: 'Minimal',
        layout: 'simple',
        features: ['clean-design', 'essential-info-only', 'quick-overview', 'mobile-friendly'],
        styling: {
          primaryColor: '#595959',
          fontFamily: 'Roboto, sans-serif',
          headerStyle: 'minimal',
          sectionSpacing: 'tight'
        }
      }
    };

    this.colorSchemes = {
      blue: { primary: '#1890ff', secondary: '#69c0ff', accent: '#f0f9ff' },
      green: { primary: '#52c41a', secondary: '#95de64', accent: '#f6ffed' },
      orange: { primary: '#fa8c16', secondary: '#ffc069', accent: '#fff7e6' },
      purple: { primary: '#722ed1', secondary: '#b37feb', accent: '#f9f0ff' },
      gray: { primary: '#595959', secondary: '#8c8c8c', accent: '#fafafa' }
    };
  }

  /**
   * Render quote with applied template
   * @param {object} quoteData - Quote data
   * @param {object} templateConfig - Template configuration
   * @param {object} contractorInfo - Contractor information
   * @returns {object} - Rendered quote with template formatting
   */
  renderQuote(quoteData, templateConfig, contractorInfo = {}) {
    const { selectedProposalTemplate, proposalTemplateSettings } = templateConfig;
    
    // Get template definition
    const template = this.templates[selectedProposalTemplate] || this.templates.professional;
    
    // Get color scheme
    const colorScheme = this.colorSchemes[proposalTemplateSettings.colorScheme] || this.colorSchemes.blue;
    
    // Build sections based on template settings
    const sections = this.buildSections(quoteData, proposalTemplateSettings, contractorInfo);
    
    // Apply template-specific styling
    const styling = this.applyTemplateStyles(template, colorScheme, proposalTemplateSettings);
    
    // Generate formatted output
    const formattedOutput = this.generateFormattedOutput(sections, styling, template);
    
    return {
      templateId: selectedProposalTemplate,
      templateName: template.name,
      sections,
      styling,
      formattedOutput,
      metadata: {
        generatedAt: new Date().toISOString(),
        templateVersion: '1.0',
        quoteId: quoteData.id,
        customerId: quoteData.customerId
      }
    };
  }

  /**
   * Build sections based on template settings
   * @param {object} quoteData - Quote data
   * @param {object} settings - Template settings
   * @param {object} contractorInfo - Contractor information
   * @returns {object} - Sections object
   */
  buildSections(quoteData, settings, contractorInfo) {
    const sections = {
      header: this.buildHeaderSection(quoteData, contractorInfo, settings),
      customerInfo: this.buildCustomerSection(quoteData),
      quoteDetails: this.buildQuoteDetailsSection(quoteData)
    };

    // Conditional sections based on settings
    if (settings.showCompanyLogo && contractorInfo.logoUrl) {
      sections.companyLogo = this.buildLogoSection(contractorInfo);
    }

    if (settings.showAreaBreakdown && quoteData.areas && quoteData.areas.length > 0) {
      sections.areaBreakdown = this.buildAreaBreakdownSection(quoteData.areas);
    }

    if (settings.showProductDetails && quoteData.productSets) {
      sections.productDetails = this.buildProductDetailsSection(quoteData.productSets);
    }

    if (settings.showWarrantySection) {
      sections.warranty = this.buildWarrantySection(contractorInfo);
    }

    // Always include pricing summary
    sections.pricingSummary = this.buildPricingSummarySection(quoteData);

    // Footer with terms and contact info
    sections.footer = this.buildFooterSection(contractorInfo);

    return sections;
  }

  /**
   * Build header section
   */
  buildHeaderSection(quoteData, contractorInfo, settings) {
    return {
      type: 'header',
      content: {
        title: 'Painting Proposal',
        quoteNumber: quoteData.quoteNumber,
        date: new Date().toLocaleDateString(),
        validUntil: quoteData.validUntil ? new Date(quoteData.validUntil).toLocaleDateString() : null,
        contractorName: contractorInfo.businessName || contractorInfo.name,
        contractorContact: {
          phone: contractorInfo.phone,
          email: contractorInfo.email,
          address: contractorInfo.address
        }
      }
    };
  }

  /**
   * Build customer section
   */
  buildCustomerSection(quoteData) {
    return {
      type: 'customer',
      content: {
        name: quoteData.customerName,
        email: quoteData.customerEmail,
        phone: quoteData.customerPhone,
        address: {
          street: quoteData.street,
          city: quoteData.city,
          state: quoteData.state,
          zipCode: quoteData.zipCode
        }
      }
    };
  }

  /**
   * Build quote details section
   */
  buildQuoteDetailsSection(quoteData) {
    return {
      type: 'quoteDetails',
      content: {
        jobType: quoteData.jobType,
        jobScope: quoteData.jobScope,
        homeSqft: quoteData.homeSqft,
        paintersOnSite: quoteData.paintersOnSite,
        laborOnly: quoteData.laborOnly,
        propertyCondition: quoteData.propertyCondition,
        notes: quoteData.notes
      }
    };
  }

  /**
   * Build logo section
   */
  buildLogoSection(contractorInfo) {
    return {
      type: 'logo',
      content: {
        logoUrl: contractorInfo.logoUrl,
        companyName: contractorInfo.businessName || contractorInfo.name,
        tagline: contractorInfo.tagline
      }
    };
  }

  /**
   * Build area breakdown section
   */
  buildAreaBreakdownSection(areas) {
    return {
      type: 'areaBreakdown',
      content: {
        areas: areas.map(area => ({
          name: area.name,
          items: area.items ? area.items.map(item => ({
            category: item.categoryName,
            quantity: item.quantity,
            unit: item.measurementUnit,
            selected: item.selected
          })) : []
        }))
      }
    };
  }

  /**
   * Build product details section
   */
  buildProductDetailsSection(productSets) {
    return {
      type: 'productDetails',
      content: {
        productSelections: Object.entries(productSets).map(([areaId, areaData]) => ({
          areaId,
          areaName: areaData.areaName,
          surfaces: Object.entries(areaData.surfaces || {}).map(([surfaceType, surfaceData]) => ({
            surfaceType,
            products: surfaceData.products,
            quantity: surfaceData.quantity,
            unit: surfaceData.unit
          }))
        }))
      }
    };
  }

  /**
   * Build warranty section
   */
  buildWarrantySection(contractorInfo) {
    return {
      type: 'warranty',
      content: {
        warrantyTerms: contractorInfo.warrantyTerms || 'Standard 2-year warranty on all labor and materials.',
        laborWarranty: '2 years',
        materialWarranty: '2 years',
        conditions: [
          'Warranty covers defects in workmanship and materials',
          'Normal wear and tear is not covered',
          'Customer must maintain proper ventilation and humidity levels',
          'Warranty is void if unauthorized repairs are made'
        ]
      }
    };
  }

  /**
   * Build pricing summary section
   */
  buildPricingSummarySection(quoteData) {
    return {
      type: 'pricingSummary',
      content: {
        laborTotal: quoteData.laborTotal || 0,
        materialTotal: quoteData.materialTotal || 0,
        subtotal: quoteData.subtotal || 0,
        markup: quoteData.markup || 0,
        markupPercent: quoteData.markupPercent || 0,
        tax: quoteData.tax || 0,
        taxPercent: quoteData.taxPercent || 0,
        total: quoteData.total || 0,
        depositAmount: quoteData.depositAmount || (quoteData.total * 0.5),
        balanceAmount: (quoteData.total || 0) - (quoteData.depositAmount || (quoteData.total * 0.5))
      }
    };
  }

  /**
   * Build footer section
   */
  buildFooterSection(contractorInfo) {
    return {
      type: 'footer',
      content: {
        terms: contractorInfo.generalTerms || 'Standard terms and conditions apply.',
        paymentTerms: contractorInfo.paymentTerms || '50% deposit required, balance due upon completion.',
        contactInfo: {
          businessName: contractorInfo.businessName,
          phone: contractorInfo.phone,
          email: contractorInfo.email,
          website: contractorInfo.website,
          license: contractorInfo.licenseNumber
        }
      }
    };
  }

  /**
   * Apply template-specific styling
   */
  applyTemplateStyles(template, colorScheme, settings) {
    return {
      template: template.name,
      layout: template.layout,
      colors: {
        primary: colorScheme.primary,
        secondary: colorScheme.secondary,
        accent: colorScheme.accent
      },
      typography: {
        fontFamily: template.styling.fontFamily,
        headerStyle: template.styling.headerStyle,
        bodySize: '14px',
        headerSize: '18px',
        titleSize: '24px'
      },
      spacing: {
        sectionSpacing: template.styling.sectionSpacing,
        marginTop: template.styling.sectionSpacing === 'generous' ? '24px' : 
                   template.styling.sectionSpacing === 'standard' ? '16px' : '12px',
        marginBottom: template.styling.sectionSpacing === 'generous' ? '24px' : 
                     template.styling.sectionSpacing === 'standard' ? '16px' : '12px'
      },
      features: template.features
    };
  }

  /**
   * Generate formatted output (HTML/CSS)
   */
  generateFormattedOutput(sections, styling, template) {
    const html = this.generateHTML(sections, styling);
    const css = this.generateCSS(styling);
    
    return {
      html,
      css,
      format: 'html',
      templateLayout: template.layout,
      responsive: template.features.includes('mobile-friendly')
    };
  }

  /**
   * Generate HTML structure
   */
  generateHTML(sections, styling) {
    let html = `
      <div class="quote-template ${styling.template.toLowerCase()}">
        <div class="quote-container">
    `;

    // Add sections in order
    const sectionOrder = ['companyLogo', 'header', 'customerInfo', 'quoteDetails', 'areaBreakdown', 'productDetails', 'pricingSummary', 'warranty', 'footer'];
    
    sectionOrder.forEach(sectionKey => {
      if (sections[sectionKey]) {
        html += this.renderSectionHTML(sections[sectionKey], styling);
      }
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render individual section HTML
   */
  renderSectionHTML(section, styling) {
    switch (section.type) {
      case 'header':
        return `
          <div class="section header-section">
            <h1 class="quote-title">${section.content.title}</h1>
            <div class="quote-meta">
              <div class="quote-number">Quote #${section.content.quoteNumber}</div>
              <div class="quote-date">Date: ${section.content.date}</div>
              ${section.content.validUntil ? `<div class="valid-until">Valid Until: ${section.content.validUntil}</div>` : ''}
            </div>
            <div class="contractor-info">
              <h3>${section.content.contractorName}</h3>
              <div class="contact-details">
                ${section.content.contractorContact.phone ? `<div>Phone: ${section.content.contractorContact.phone}</div>` : ''}
                ${section.content.contractorContact.email ? `<div>Email: ${section.content.contractorContact.email}</div>` : ''}
              </div>
            </div>
          </div>
        `;

      case 'customer':
        return `
          <div class="section customer-section">
            <h3>Customer Information</h3>
            <div class="customer-details">
              <div class="customer-name">${section.content.name}</div>
              ${section.content.email ? `<div>Email: ${section.content.email}</div>` : ''}
              ${section.content.phone ? `<div>Phone: ${section.content.phone}</div>` : ''}
              <div class="customer-address">
                ${section.content.address.street ? `<div>${section.content.address.street}</div>` : ''}
                ${section.content.address.city ? `<div>${section.content.address.city}, ${section.content.address.state} ${section.content.address.zipCode}</div>` : ''}
              </div>
            </div>
          </div>
        `;

      case 'pricingSummary':
        return `
          <div class="section pricing-section">
            <h3>Pricing Summary</h3>
            <div class="pricing-table">
              <div class="pricing-row">
                <span>Labor Total:</span>
                <span>$${section.content.laborTotal.toFixed(2)}</span>
              </div>
              <div class="pricing-row">
                <span>Material Total:</span>
                <span>$${section.content.materialTotal.toFixed(2)}</span>
              </div>
              <div class="pricing-row subtotal">
                <span>Subtotal:</span>
                <span>$${section.content.subtotal.toFixed(2)}</span>
              </div>
              ${section.content.tax > 0 ? `
                <div class="pricing-row">
                  <span>Tax (${section.content.taxPercent}%):</span>
                  <span>$${section.content.tax.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="pricing-row total">
                <span><strong>Total:</strong></span>
                <span><strong>$${section.content.total.toFixed(2)}</strong></span>
              </div>
              <div class="pricing-row deposit">
                <span>Deposit Required:</span>
                <span>$${section.content.depositAmount.toFixed(2)}</span>
              </div>
              <div class="pricing-row">
                <span>Balance Due:</span>
                <span>$${section.content.balanceAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        `;

      default:
        return `<div class="section ${section.type}-section">${JSON.stringify(section.content)}</div>`;
    }
  }

  /**
   * Generate CSS styles
   */
  generateCSS(styling) {
    return `
      .quote-template {
        font-family: ${styling.typography.fontFamily};
        color: #333;
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }

      .quote-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
      }

      .section {
        padding: ${styling.spacing.marginTop} 20px;
        border-bottom: 1px solid #f0f0f0;
      }

      .section:last-child {
        border-bottom: none;
      }

      .header-section {
        background: ${styling.colors.primary};
        color: white;
        text-align: center;
      }

      .quote-title {
        font-size: ${styling.typography.titleSize};
        margin: 0 0 10px 0;
        font-weight: bold;
      }

      .quote-meta {
        margin-bottom: 20px;
      }

      .contractor-info h3 {
        margin: 0 0 10px 0;
        font-size: ${styling.typography.headerSize};
      }

      .customer-section h3,
      .pricing-section h3 {
        color: ${styling.colors.primary};
        font-size: ${styling.typography.headerSize};
        margin: 0 0 15px 0;
        border-bottom: 2px solid ${styling.colors.accent};
        padding-bottom: 5px;
      }

      .pricing-table {
        background: ${styling.colors.accent};
        padding: 15px;
        border-radius: 4px;
      }

      .pricing-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .pricing-row:last-child {
        border-bottom: none;
      }

      .pricing-row.subtotal,
      .pricing-row.total {
        font-weight: bold;
        border-top: 2px solid ${styling.colors.primary};
        margin-top: 10px;
        padding-top: 10px;
      }

      .pricing-row.total {
        font-size: 1.1em;
        color: ${styling.colors.primary};
      }

      .pricing-row.deposit {
        background: ${styling.colors.secondary};
        margin: 10px -15px 0 -15px;
        padding: 10px 15px;
        color: white;
      }

      @media print {
        .quote-template {
          box-shadow: none;
          max-width: none;
        }
      }

      @media (max-width: 600px) {
        .quote-template {
          padding: 10px;
        }
        
        .section {
          padding: 15px 10px;
        }
      }
    `;
  }
}

// Create singleton instance
const templateRenderingService = new TemplateRenderingService();

module.exports = templateRenderingService;