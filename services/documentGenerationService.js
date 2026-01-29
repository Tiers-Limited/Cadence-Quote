// services/documentGenerationService.js
// Central orchestrator for all document generation operations

const { Quote, Job, ContractorSettings, ProposalDefaults } = require('../models');
const { htmlToPdfBuffer } = require('./pdfService');
const templateService = require('./templateService');
const path = require('path');
const fs = require('fs').promises;

/**
 * Document Generation Service
 * Orchestrates proposal and job document generation
 */
class DocumentGenerationService {
  /**
   * Generate proposal PDF for a quote
   * @param {string} quoteId - Quote identifier
   * @param {string} tenantId - Tenant identifier
   * @returns {Promise<{success: boolean, pdfUrl: string, error?: string}>}
   */
  async generateProposalPDF(quoteId, tenantId) {
    try {
      console.log(`[DocumentGeneration] Starting proposal PDF generation for quote ${quoteId}`);
      
      // Fetch quote data with all related entities
      const quoteData = await this._fetchQuoteData(quoteId);
      if (!quoteData) {
        return {
          success: false,
          errorType: 'VALIDATION_ERROR',
          error: 'Quote not found',
          userMessage: 'The specified quote could not be found.'
        };
      }

      // Validate quote data completeness
      const validation = await this.validateQuoteData(quoteData);
      if (!validation.valid) {
        return {
          success: false,
          errorType: 'VALIDATION_ERROR',
          error: 'Incomplete quote data',
          missingFields: validation.missingFields,
          userMessage: `Please complete the quote before generating documents. Missing: ${validation.missingFields.join(', ')}`
        };
      }

      // Get contractor settings including template preference
      const contractorSettings = await ContractorSettings.findOne({
        where: { tenantId }
      });

      // Get proposal defaults for content
      const proposalDefaults = await ProposalDefaults.findOne({
        where: { tenantId }
      });

      // Prepare data for template rendering
      const templateData = this._prepareProposalData(quoteData, contractorSettings, proposalDefaults);

      // Get contractor's selected template
      const templateId = await templateService.getContractorTemplate(tenantId);
      console.log(`[DocumentGeneration] Using template: ${templateId}`);

      // Render HTML using selected template
      const html = await templateService.renderProposal(templateId, templateData);

      // Generate PDF
      const pdfBuffer = await htmlToPdfBuffer(html);

      // Save PDF to temp directory (in production, upload to S3/cloud storage)
      const filename = `proposal-${quoteId}-${Date.now()}.pdf`;
      const tempDir = path.join(__dirname, '../temp');
      
      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (err) {
        console.warn('[DocumentGeneration] Temp directory already exists or creation failed:', err.message);
      }

      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, pdfBuffer);

      const pdfUrl = `/temp/${filename}`;

      // Update quote with PDF URL
      await Quote.update(
        {
          proposalPdfUrl: pdfUrl,
          proposalPdfGeneratedAt: new Date(),
          proposalPdfVersion: (quoteData.proposalPdfVersion || 0) + 1
        },
        { where: { id: quoteId } }
      );

      console.log(`[DocumentGeneration] Proposal PDF generated successfully: ${pdfUrl}`);

      return {
        success: true,
        pdfUrl,
        filename
      };

    } catch (error) {
      console.error('[DocumentGeneration] Error generating proposal PDF:', error);
      
      return {
        success: false,
        errorType: 'PDF_GENERATION_ERROR',
        error: error.message,
        userMessage: 'Document generation failed due to a system error. Please try again or contact support.'
      };
    }
  }

  /**
   * Generate all job documents after quote acceptance
   * @param {string} quoteId - Quote identifier
   * @param {string} jobId - Job identifier
   * @returns {Promise<{success: boolean, documents: {materialList, paintOrder, workOrder}, errors?: string[]}>}
   */
  async generateJobDocuments(quoteId, jobId) {
    try {
      console.log(`[DocumentGeneration] Starting job documents generation for job ${jobId}`);

      const errors = [];
      const documents = {};

      // Fetch quote and job data
      const quoteData = await this._fetchQuoteData(quoteId);
      const jobData = await Job.findByPk(jobId);

      if (!quoteData || !jobData) {
        return {
          success: false,
          errorType: 'VALIDATION_ERROR',
          error: 'Quote or job not found',
          userMessage: 'The specified quote or job could not be found.'
        };
      }

      // Generate material list
      try {
        const materialListUrl = await this._generateMaterialList(quoteData, jobData);
        documents.materialList = materialListUrl;
      } catch (error) {
        console.error('[DocumentGeneration] Material list generation failed:', error);
        errors.push(`Material list: ${error.message}`);
      }

      // Generate paint product order
      try {
        const paintOrderUrl = await this._generatePaintProductOrder(quoteData, jobData);
        documents.paintOrder = paintOrderUrl;
      } catch (error) {
        console.error('[DocumentGeneration] Paint order generation failed:', error);
        errors.push(`Paint order: ${error.message}`);
      }

      // Generate work order
      try {
        const workOrderUrl = await this._generateWorkOrder(quoteData, jobData);
        documents.workOrder = workOrderUrl;
      } catch (error) {
        console.error('[DocumentGeneration] Work order generation failed:', error);
        errors.push(`Work order: ${error.message}`);
      }

      // Update job with document URLs
      await Job.update(
        {
          materialListUrl: documents.materialList,
          paintOrderUrl: documents.paintOrder,
          workOrderUrl: documents.workOrder,
          documentsGeneratedAt: new Date()
        },
        { where: { id: jobId } }
      );

      const success = errors.length === 0;
      console.log(`[DocumentGeneration] Job documents generation ${success ? 'completed' : 'completed with errors'}`);

      return {
        success,
        documents,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('[DocumentGeneration] Error generating job documents:', error);
      
      return {
        success: false,
        errorType: 'PDF_GENERATION_ERROR',
        error: error.message,
        userMessage: 'Job document generation failed. Please try again or contact support.'
      };
    }
  }

  /**
   * Regenerate proposal PDF with latest quote data
   * @param {string} quoteId - Quote identifier
   * @returns {Promise<{success: boolean, pdfUrl: string, error?: string}>}
   */
  async regenerateProposalPDF(quoteId) {
    try {
      console.log(`[DocumentGeneration] Regenerating proposal PDF for quote ${quoteId}`);

      const quote = await Quote.findByPk(quoteId);
      if (!quote) {
        return {
          success: false,
          errorType: 'VALIDATION_ERROR',
          error: 'Quote not found',
          userMessage: 'The specified quote could not be found.'
        };
      }

      // Check if quote is already accepted
      if (quote.status === 'accepted' || quote.depositPaid) {
        return {
          success: false,
          errorType: 'ACCESS_DENIED',
          error: 'Cannot regenerate proposal for accepted quote',
          userMessage: 'Proposal cannot be regenerated after quote acceptance. Please contact support if you need to make changes.'
        };
      }

      // Generate new proposal PDF
      return await this.generateProposalPDF(quoteId, quote.tenantId);

    } catch (error) {
      console.error('[DocumentGeneration] Error regenerating proposal PDF:', error);
      
      return {
        success: false,
        errorType: 'PDF_GENERATION_ERROR',
        error: error.message,
        userMessage: 'Document regeneration failed. Please try again or contact support.'
      };
    }
  }

  /**
   * Validate quote data completeness for document generation
   * @param {Object} quoteData - Quote data object
   * @returns {Promise<{valid: boolean, missingFields: string[]}>}
   */
  async validateQuoteData(quoteData) {
    const missingFields = [];

    // Check required customer fields
    if (!quoteData.customerName) missingFields.push('customer name');
    if (!quoteData.customerEmail) missingFields.push('customer email');
    if (!quoteData.projectAddress) missingFields.push('project address');

    // Check pricing scheme
    if (!quoteData.pricingScheme) missingFields.push('pricing scheme');

    // Check if there are areas/surfaces
    if (!quoteData.laborItems || quoteData.laborItems.length === 0) {
      missingFields.push('areas/surfaces');
    }

    // Check if there are product selections
    if (!quoteData.productSets || quoteData.productSets.length === 0) {
      missingFields.push('product selections');
    }

    // Check pricing calculations
    if (!quoteData.totalPrice || quoteData.totalPrice <= 0) {
      missingFields.push('pricing calculations');
    }

    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Fetch complete quote data with all related entities
   * @private
   */
  async _fetchQuoteData(quoteId) {
    try {
      const quote = await Quote.findByPk(quoteId);
      if (!quote) return null;

      // Parse JSON fields
      const quoteData = quote.toJSON();
      
      // Ensure arrays are parsed
      if (typeof quoteData.laborItems === 'string') {
        quoteData.laborItems = JSON.parse(quoteData.laborItems);
      }
      if (typeof quoteData.productSets === 'string') {
        quoteData.productSets = JSON.parse(quoteData.productSets);
      }
      if (typeof quoteData.pricingScheme === 'string') {
        quoteData.pricingScheme = JSON.parse(quoteData.pricingScheme);
      }

      return quoteData;
    } catch (error) {
      console.error('[DocumentGeneration] Error fetching quote data:', error);
      return null;
    }
  }

  /**
   * Prepare data for proposal template rendering
   * @private
   */
  _prepareProposalData(quoteData, contractorSettings, proposalDefaults) {
    // Extract contractor info
    const company = {
      name: contractorSettings?.companyName || 'Contractor Company',
      logoUrl: contractorSettings?.logoUrl || null,
      phone: contractorSettings?.phone || '',
      email: contractorSettings?.email || '',
      addressLine1: contractorSettings?.addressLine1 || '',
      addressLine2: contractorSettings?.addressLine2 || ''
    };

    // Determine selected tier and calculate tier-specific amounts
    const selectedTier = quoteData.gbbSelectedTier || null; // Use correct field name
    const baseTotal = parseFloat(quoteData.total || 0);
    
    // Calculate tier-specific pricing if GBB strategy
    let tierTotal = baseTotal;
    let tierDeposit = quoteData.depositAmount || (baseTotal * 0.5);
    
    if (quoteData.productStrategy === 'GBB' && selectedTier) {
      const tierMultipliers = {
        good: 0.85,
        better: 1.0,
        best: 1.15
      };
      const multiplier = tierMultipliers[selectedTier.toLowerCase()] || 1.0;
      tierTotal = baseTotal * multiplier;
      tierDeposit = quoteData.depositAmount || (tierTotal * 0.5);
    }

    // Extract proposal info
    const proposal = {
      invoiceNumber: quoteData.quoteNumber || `Q-${quoteData.id}`,
      date: new Date().toLocaleDateString('en-US'),
      customerName: quoteData.customerName,
      projectAddress: quoteData.projectAddress,
      selectedOption: selectedTier ? selectedTier.toUpperCase() : '', // Show selected tier
      totalInvestment: tierTotal, // Use tier-specific total
      depositAmount: tierDeposit // Use tier-specific deposit
    };

    // Prepare GBB rows from productSets
    const rows = this._prepareGBBRows(quoteData);

    // Prepare investment breakdown
    const investment = this._prepareInvestment(quoteData);

    // Prepare area breakdown
    const areaBreakdown = this._prepareAreaBreakdown(quoteData);

    // Get proposal defaults content
    const introduction = {
      welcomeMessage: proposalDefaults?.welcomeMessage || `Thank you for choosing ${company.name}. We are committed to delivering exceptional quality and service.`,
      aboutUsSummary: proposalDefaults?.aboutUsSummary || ''
    };

    const scope = {
      scopeOfWork: proposalDefaults?.scopeOfWork || 'Scope: Exterior/interior painting, preparation, priming, and two finish coats as applicable.',
      interiorProcess: proposalDefaults?.interiorProcess || '',
      drywallRepairProcess: proposalDefaults?.drywallRepairProcess || '',
      exteriorProcess: proposalDefaults?.exteriorProcess || '',
      trimProcess: proposalDefaults?.trimProcess || '',
      cabinetProcess: proposalDefaults?.cabinetProcess || ''
    };

    const warranty = {
      standard: proposalDefaults?.standardWarranty || '',
      premium: proposalDefaults?.premiumWarranty || '',
      exterior: proposalDefaults?.exteriorWarranty || ''
    };

    const responsibilities = {
      client: proposalDefaults?.clientResponsibilities || '',
      contractor: proposalDefaults?.contractorResponsibilities || ''
    };

    const acceptance = {
      acknowledgement: proposalDefaults?.acceptanceAcknowledgement || 'By signing below, you agree to the terms and conditions of this proposal.',
      signatureStatement: proposalDefaults?.signatureStatement || ''
    };

    const payment = {
      paymentTermsText: proposalDefaults?.paymentTerms || '',
      paymentMethods: proposalDefaults?.paymentMethods || '',
      latePaymentPolicy: proposalDefaults?.latePaymentPolicy || ''
    };

    const policies = {
      touchUpPolicy: proposalDefaults?.touchUpPolicy || '',
      finalWalkthroughPolicy: proposalDefaults?.finalWalkthroughPolicy || '',
      changeOrderPolicy: proposalDefaults?.changeOrderPolicy || '',
      colorDisclaimer: proposalDefaults?.colorDisclaimer || '',
      surfaceConditionDisclaimer: proposalDefaults?.surfaceConditionDisclaimer || '',
      paintFailureDisclaimer: proposalDefaults?.paintFailureDisclaimer || '',
      generalProposalDisclaimer: proposalDefaults?.generalProposalDisclaimer || ''
    };

    return {
      company,
      proposal,
      gbb: { rows, investment },
      areaBreakdown,
      introduction,
      scope,
      warranty,
      responsibilities,
      acceptance,
      payment,
      policies,
      selectedTier // Include selected tier for template use
    };
  }

  /**
   * Prepare GBB rows from product sets
   * @private
   */
  _prepareGBBRows(quoteData) {
    const rows = [];
    const productSets = quoteData.productSets || [];
    const pricingScheme = quoteData.pricingScheme || {};

    // Determine if this is flat rate pricing
    const isFlatRate = pricingScheme.type === 'flat_rate';

    productSets.forEach(set => {
      const row = {
        label: set.surfaceName || set.itemType || 'Item',
        good: this._getProductName(set.products?.good),
        better: this._getProductName(set.products?.better),
        best: this._getProductName(set.products?.best)
      };

      // Add area grouping for area-based pricing
      if (set.areaName && !isFlatRate) {
        row.area = set.areaName;
      }

      // Add category for flat rate
      if (isFlatRate && set.category) {
        row.category = set.category;
      }

      rows.push(row);
    });

    return rows;
  }

  /**
   * Get product name from product ID or object
   * @private
   */
  _getProductName(product) {
    if (!product) return null;
    if (typeof product === 'string') return product;
    if (typeof product === 'object' && product.name) return product.name;
    return null;
  }

  /**
   * Prepare investment breakdown
   * @private
   */
  _prepareInvestment(quoteData) {
    const investment = {};

    if (quoteData.gbbPricing) {
      investment.good = quoteData.gbbPricing.good?.total || 0;
      investment.better = quoteData.gbbPricing.better?.total || 0;
      investment.best = quoteData.gbbPricing.best?.total || 0;
    }

    return investment;
  }

  /**
   * Prepare area breakdown list
   * @private
   */
  _prepareAreaBreakdown(quoteData) {
    const areas = [];
    const laborItems = quoteData.laborItems || [];

    laborItems.forEach(item => {
      if (item.areaName) {
        areas.push(`${item.areaName} - ${item.surfaceType || 'Surface'} (${item.quantity || 0} sq ft)`);
      }
    });

    return areas;
  }

  /**
   * Generate material list PDF using existing workOrderService
   * @private
   */
  async _generateMaterialList(quoteData, jobData) {
    console.log('[DocumentGeneration] Generating material list...');
    
    try {
      // Use existing workOrderService
      const workOrderService = require('./workOrderService');
      const { ContractorSettings } = require('../models');
      
      // Get contractor info
      const contractorSettings = await ContractorSettings.findOne({
        where: { tenantId: jobData.tenantId }
      });

      const contractorInfo = {
        logo: contractorSettings?.logoUrl,
        companyName: contractorSettings?.companyName,
        phone: contractorSettings?.phone,
        email: contractorSettings?.email,
        address: contractorSettings?.addressLine1
      };

      // Generate PDF using existing service
      const pdfBuffer = await workOrderService.generateMaterialList({
        job: jobData,
        quote: quoteData,
        contractorInfo
      });

      // Save to temp directory
      const filename = `material-list-${jobData.id}-${Date.now()}.pdf`;
      const tempDir = path.join(__dirname, '../temp');
      
      await fs.mkdir(tempDir, { recursive: true });
      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, pdfBuffer);

      return `/temp/${filename}`;
    } catch (error) {
      console.error('[DocumentGeneration] Material list generation error:', error);
      throw error;
    }
  }

  /**
   * Generate paint product order PDF
   * @private
   */
  async _generatePaintProductOrder(quoteData, jobData) {
    console.log('[DocumentGeneration] Generating paint product order...');
    
    try {
      // Use existing documentService for store order (paint product order)
      const documentService = require('./documentService');
      
      // Prepare proposal data structure for documentService
      const proposalData = {
        quoteNumber: quoteData.quoteNumber || `Q-${quoteData.id}`,
        customerName: quoteData.customerName,
        selectedTier: quoteData.gbbSelectedTier || 'N/A',
        areas: [] // Will be populated from quote data
      };
      
      // Convert quote data to areas format expected by documentService
      if (quoteData.productSets && typeof quoteData.productSets === 'object') {
        // Handle different product set structures
        if (quoteData.productSets.areas) {
          // Area-based structure
          Object.entries(quoteData.productSets.areas).forEach(([areaId, area]) => {
            if (area && area.areaName) {
              proposalData.areas.push({
                name: area.areaName,
                sqft: area.totalSqft || 0,
                customerSelections: area.selectedProducts || {}
              });
            }
          });
        }
      }
      
      // Generate PDF using existing service
      const filePath = await documentService.generateStoreOrder(proposalData);
      
      // Convert file path to URL
      const filename = path.basename(filePath);
      return `/temp/${filename}`;
    } catch (error) {
      console.error('[DocumentGeneration] Paint order generation error:', error);
      
      // Fallback to simple HTML if service fails
      const filename = `paint-order-${jobData.id}-${Date.now()}.pdf`;
      const tempDir = path.join(__dirname, '../temp');
      const filepath = path.join(tempDir, filename);

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Paint Product Order</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; }
              h1 { color: #333; }
              .info { margin: 20px 0; }
              .products { margin-top: 30px; }
            </style>
          </head>
          <body>
            <h1>Paint Product Order</h1>
            <div class="info">
              <p><strong>Job ID:</strong> ${jobData.id}</p>
              <p><strong>Customer:</strong> ${quoteData.customerName}</p>
              <p><strong>Address:</strong> ${quoteData.street || ''} ${quoteData.city || ''}, ${quoteData.state || ''} ${quoteData.zipCode || ''}</p>
            </div>
            <div class="products">
              <h2>Products</h2>
              <p>Product list will be generated from quote data...</p>
            </div>
          </body>
        </html>
      `;

      const pdfBuffer = await htmlToPdfBuffer(html);
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, pdfBuffer);

      return `/temp/${filename}`;
    }
  }

  /**
   * Generate work order PDF using existing workOrderService
   * @private
   */
  async _generateWorkOrder(quoteData, jobData) {
    console.log('[DocumentGeneration] Generating work order...');
    
    try {
      // Use existing workOrderService
      const workOrderService = require('./workOrderService');
      const { ContractorSettings } = require('../models');
      
      // Get contractor info
      const contractorSettings = await ContractorSettings.findOne({
        where: { tenantId: jobData.tenantId }
      });

      const contractorInfo = {
        logo: contractorSettings?.logoUrl,
        companyName: contractorSettings?.companyName,
        phone: contractorSettings?.phone,
        email: contractorSettings?.email,
        address: contractorSettings?.addressLine1
      };

      // Generate PDF using existing service
      const pdfBuffer = await workOrderService.generateWorkOrder({
        job: jobData,
        quote: quoteData,
        contractorInfo
      });

      // Save to temp directory
      const filename = `work-order-${jobData.id}-${Date.now()}.pdf`;
      const tempDir = path.join(__dirname, '../temp');
      
      await fs.mkdir(tempDir, { recursive: true });
      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, pdfBuffer);

      return `/temp/${filename}`;
    } catch (error) {
      console.error('[DocumentGeneration] Work order generation error:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new DocumentGenerationService();
