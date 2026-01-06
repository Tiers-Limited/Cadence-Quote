// controllers/quoteBuilderController.js
// Enhanced Quote Builder Controller with complete business logic

const Quote = require('../models/Quote');
const Client = require('../models/Client');
const PricingScheme = require('../models/PricingScheme');
const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');
const ContractorSettings = require('../models/ContractorSettings');
const ServiceType = require('../models/ServiceType');
const SurfaceType = require('../models/SurfaceType');
const { createAuditLog } = require('./auditLogController');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const emailService = require('../services/emailService');
const PDFGenerator = require('../utils/pdfGenerator');
const ProposalDefaults = require('../models/ProposalDefaults');
const Tenant = require('../models/Tenant');
const { renderProposalHtml } = require('../services/proposalTemplate');
const { htmlToPdfBuffer } = require('../services/pdfService');
const { calculatePricing, applyMarkupsAndTax } = require('../utils/pricingCalculator');

/**
 * Helper function to calculate quote pricing with new unified calculator
 * @param {Object} quote - The quote object
 * @param {Number} tenantId - The tenant ID
 * @returns {Object} - Pricing calculation results
 */
async function calculateQuotePricing(quote, tenantId) {
  try {
    // Get contractor settings for comprehensive pricing configuration
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
    });

    // Get pricing scheme
    const pricingScheme = await PricingScheme.findByPk(quote.pricingSchemeId);
    
    if (!pricingScheme) {
      console.warn('No pricing scheme found, using legacy calculation');
      return calculateQuotePricingLegacy(quote, tenantId);
    }

    const schemeType = pricingScheme.type;
    const rules = pricingScheme.pricingRules || {};
    
    // Map legacy types to new types
    const modelMap = {
      'sqft_turnkey': 'turnkey',
      'sqft_labor_paint': 'rate_based_sqft',
      'hourly_time_materials': 'production_based',
      'unit_pricing': 'flat_rate_unit',
      'room_flat_rate': 'flat_rate_unit',
    };
    
    const model = modelMap[schemeType] || schemeType;
    
    // Merge material calculation overrides from quote data
    const mergedRules = {
      ...rules,
      includeMaterials: quote.includeMaterials ?? rules.includeMaterials ?? true,
      coverage: quote.coverage || rules.coverage || 350,
      applicationMethod: quote.applicationMethod || rules.applicationMethod || 'roll',
      coats: quote.coats || rules.coats || 2,
      costPerGallon: rules.costPerGallon || 40,
    };
    
    // Prepare calculation parameters
    const params = {
      model,
      rules: mergedRules,
      areas: quote.areas || [],
      homeSqft: quote.homeSqft || 0,
      jobScope: quote.jobType || 'interior',
    };
    
    // Calculate base pricing using unified calculator
    const basePricing = calculatePricing(params);
    
    // Apply markups, overhead, profit, and tax
    const finalPricing = applyMarkupsAndTax(basePricing, {
      laborMarkupPercent: parseFloat(settings?.laborMarkupPercent) || 0,
      materialMarkupPercent: parseFloat(settings?.materialMarkupPercent) || 25,
      overheadPercent: parseFloat(settings?.overheadPercent) || 0,
      profitMarginPercent: parseFloat(settings?.netProfitPercent) || 0,
      taxRatePercentage: parseFloat(settings?.taxRatePercentage) || 8.25,
      depositPercent: parseFloat(settings?.depositPercent) || 50,
    });
    
    // Add quote validity and material calculation settings
    finalPricing.quoteValidityDays = parseInt(settings?.quoteValidityDays) || 30;
    finalPricing.includeMaterials = mergedRules.includeMaterials;
    finalPricing.coverage = mergedRules.coverage;
    finalPricing.applicationMethod = mergedRules.applicationMethod;
    finalPricing.coats = mergedRules.coats;
    
    return finalPricing;
  } catch (error) {
    console.error('Calculate quote pricing error:', error);
    // Fallback to legacy calculation
    return calculateQuotePricingLegacy(quote, tenantId);
  }
}

/**
 * Legacy pricing calculation for backward compatibility
 * @param {Object} quote - The quote object
 * @param {Number} tenantId - The tenant ID
 * @returns {Object} - Pricing calculation results
 */
async function calculateQuotePricingLegacy(quote, tenantId) {
  try {
    // Get contractor settings for comprehensive pricing configuration
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
    });

    // Get Pricing Engine metrics - Ensure all values are numbers
    const laborMarkupPercent = parseFloat(settings?.laborMarkupPercent) || 0;
    const materialMarkupPercent = parseFloat(settings?.materialMarkupPercent) || 25;
    const overheadPercent = parseFloat(settings?.overheadPercent) || 0;
    const netProfitPercent = parseFloat(settings?.netProfitPercent) || 0;
    const taxRate = parseFloat(settings?.taxRatePercentage) || 8.25;
    const quoteValidityDays = parseInt(settings?.quoteValidityDays) || 30;
    const depositPercent = parseFloat(settings?.depositPercent) || 50;

    // Initialize pricing totals
    let laborTotal = 0;
    let materialTotal = 0;
    let totalSqft = 0;
    const breakdown = [];

    const areas = quote.areas || [];
    const productSets = quote.productSets || [];

    // Process each area
    for (const area of areas) {
      const areaBreakdown = {
        areaName: area.name,
        items: [],
        totalLabor: 0,
        totalMaterial: 0,
      };

      // Process labor items (new structure)
      if (area.laborItems && Array.isArray(area.laborItems)) {
        for (const item of area.laborItems) {
          if (!item.selected) continue;

          let quantity = item.quantity || 0;
          
          // Calculate quantity from dimensions if provided
          if (item.dimensions && item.dimensions.width && item.dimensions.height) {
            if (item.measurementUnit === 'sqft') {
              quantity = item.dimensions.width * item.dimensions.height * (item.dimensions.length || 1);
            } else if (item.measurementUnit === 'linear_foot') {
              quantity = (item.dimensions.width + item.dimensions.height) * 2;
            }
          }

          const laborCost = quantity * (item.laborRate || 0) * (item.numberOfCoats || 1);
          
          // Find product set for this surface type
          const productSet = productSets.find(ps => 
            ps.surfaceType === item.categoryName
          );

          let materialCost = 0;
          if (productSet && productSet.prices) {
            // Use the middle tier (better) as default
            const productPrice = parseFloat(productSet.prices.better || productSet.prices.good || productSet.prices.best || 0);
            const gallons = item.gallons || (quantity / 350); // ~350 sqft per gallon coverage
            materialCost = gallons * productPrice * (item.numberOfCoats || 1);
          }

          laborTotal += laborCost;
          materialTotal += materialCost;
          totalSqft += quantity;

          areaBreakdown.items.push({
            category: item.categoryName,
            quantity,
            unit: item.measurementUnit,
            laborRate: item.laborRate,
            coats: item.numberOfCoats,
            laborCost,
            materialCost,
          });

          areaBreakdown.totalLabor += laborCost;
          areaBreakdown.totalMaterial += materialCost;
        }
      }

      if (areaBreakdown.items.length > 0) {
        breakdown.push(areaBreakdown);
      }
    }

    // Step 1: Base costs
    const baseMaterialCost = materialTotal;
    const baseLaborCost = laborTotal;

    // Step 2: Apply markups
    const materialMarkupAmount = baseMaterialCost * (materialMarkupPercent / 100);
    const materialCostWithMarkup = baseMaterialCost + materialMarkupAmount;
    
    const laborMarkupAmount = baseLaborCost * (laborMarkupPercent / 100);
    const laborCostWithMarkup = baseLaborCost + laborMarkupAmount;

    // Step 3: Subtotal before overhead and profit
    const subtotalBeforeOverhead = materialCostWithMarkup + laborCostWithMarkup;

    // Step 4: Apply overhead
    const overheadAmount = subtotalBeforeOverhead * (overheadPercent / 100);
    const subtotalBeforeProfit = subtotalBeforeOverhead + overheadAmount;

    // Step 5: Apply net profit
    const profitAmount = subtotalBeforeProfit * (netProfitPercent / 100);
    const subtotal = subtotalBeforeProfit + profitAmount;

    // Step 6: Calculate tax
    const taxAmount = subtotal * (taxRate / 100);

    // Final total
    const total = subtotal + taxAmount;
    
    // Calculate deposit and balance
    const deposit = total * (depositPercent / 100);
    const balance = total - deposit;

    // Helper to safely format numbers
    const safeFormat = (value) => {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(2));
    };

    return {
      // Base costs
      laborTotal: safeFormat(baseLaborCost),
      materialTotal: safeFormat(baseMaterialCost),
      materialCost: safeFormat(baseMaterialCost), // For compatibility
      
      // Markup details
      laborMarkupPercent: safeFormat(laborMarkupPercent),
      laborMarkupAmount: safeFormat(laborMarkupAmount),
      laborCostWithMarkup: safeFormat(laborCostWithMarkup),
      
      materialMarkupPercent: safeFormat(materialMarkupPercent),
      materialMarkupAmount: safeFormat(materialMarkupAmount),
      materialCostWithMarkup: safeFormat(materialCostWithMarkup),
      
      // Overhead and profit
      overheadPercent: safeFormat(overheadPercent),
      overhead: safeFormat(overheadAmount),
      subtotalBeforeProfit: safeFormat(subtotalBeforeProfit),
      
      profitMarginPercent: safeFormat(netProfitPercent),
      profitAmount: safeFormat(profitAmount),
      
      // Final totals
      subtotal: safeFormat(subtotal),
      taxPercent: safeFormat(taxRate),
      taxRate: safeFormat(taxRate), // For compatibility
      tax: safeFormat(taxAmount),
      taxAmount: safeFormat(taxAmount), // For compatibility
      total: safeFormat(total),
      
      // Payment terms
      depositPercent: safeFormat(depositPercent),
      deposit: safeFormat(deposit),
      balance: safeFormat(balance),
      
      // Quote validity
      quoteValidityDays: parseInt(quoteValidityDays) || 30,
      
      // Additional info
      totalSqft: safeFormat(totalSqft),
      breakdown,
      
      // Legacy fields for backward compatibility
      markupPercent: safeFormat(materialMarkupPercent),
      markupAmount: safeFormat(materialMarkupAmount),
    };
  } catch (error) {
    console.error('Calculate quote pricing error:', error);
    // Return zeros if calculation fails
    return {
      laborTotal: 0,
      materialTotal: 0,
      subtotal: 0,
      markupAmount: 0,
      markupPercent: 0,
      taxAmount: 0,
      taxRate: 0,
      total: 0,
      totalSqft: null,
      breakdown: [],
    };
  }
}

/**
 * Detect existing client by email or phone
 * POST /api/quote-builder/detect-client
 */
exports.detectExistingClient = async (req, res) => {
  try {
    const { email, phone } = req.body;
    const tenantId = req.user.tenantId;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone required for client detection',
      });
    }

    const where = {
      tenantId,
      isActive: true,
      [Op.or]: [],
    };

    if (email) where[Op.or].push({ email: email.toLowerCase() });
    if (phone) where[Op.or].push({ phone });

    const existingClient = await Client.findOne({
      where,
      include: [{
        model: Quote,
        as: 'quotes',
        limit: 5,
        order: [['createdAt', 'DESC']],
      }],
    });

    res.json({
      success: true,
      exists: !!existingClient,
      client: existingClient || null,
    });
  } catch (error) {
    console.error('Detect client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect existing client',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create or update quote (auto-save functionality)
 * POST /api/quote-builder/save-draft
 */
exports.saveDraft = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  // Capture any transaction errors
  let transactionError = null;
  transaction.afterCommit(() => console.log('✅ Transaction committed successfully'));
  
  // Hook to catch transaction errors
  const originalRollback = transaction.rollback.bind(transaction);
  transaction.rollback = async function() {
    console.log('🚨 Transaction rollback called');
    return originalRollback();
  };

  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const {
      quoteId,
      customerName,
      customerEmail,
      customerPhone,
      street,
      city,
      state,
      zipCode,
      pricingSchemeId,
      jobType,
      areas,
      productSets,
      productStrategy,
      allowCustomerProductChoice,
      notes,
    } = req.body;

    let quote;
    let client;
    let isNewQuote = false;

    // Find or create client if we have email
    if (customerEmail) {
      try {
        console.log('🔍 Attempting client findOrCreate with:', {
          email: customerEmail.toLowerCase(),
          tenantId,
          name: customerName,
          phone: customerPhone,
          state: state,
          zip: zipCode
        });
        
        [client] = await Client.findOrCreate({
          where: {
            email: customerEmail.toLowerCase(),
            tenantId,
          },
          defaults: {
            tenantId,
            name: customerName,
            email: customerEmail.toLowerCase(),
            phone: customerPhone || '',
            street: street || '',
            city: city || '',
            state: state || '',
            zip: zipCode || '',
          },
          transaction,
        });
        console.log('✅ Client findOrCreate successful:', client.id);
      } catch (clientError) {
        console.error('❌ CLIENT FIND/CREATE FAILED — ROOT CAUSE:', {
          name: clientError.name,
          message: clientError.message,
          errors: clientError.errors,
          validationErrors: clientError.errors?.map(e => ({
            field: e.path,
            message: e.message,
            type: e.type,
            value: e.value
          })),
          sql: clientError.sql,
          parent: clientError.parent?.message,
          parentCode: clientError.parent?.code,
          fields: clientError.fields
        });
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `Failed to find/create client: ${clientError.message}`,
        });
      }

      // Update client if data changed - only update fields with valid values
      if (client && (customerName || customerPhone || street || city || state || zipCode)) {
        try {
          const clientUpdateData = {};
          
          // Only include fields that have non-empty values
          if (customerName && customerName.trim()) clientUpdateData.name = customerName.trim();
          if (customerPhone && customerPhone.trim()) clientUpdateData.phone = customerPhone.trim();
          if (street && street.trim()) clientUpdateData.street = street.trim();
          if (city && city.trim()) clientUpdateData.city = city.trim();
          if (state && state.trim()) clientUpdateData.state = state.trim();
          if (zipCode && zipCode.trim()) clientUpdateData.zip = zipCode.trim();
          
          console.log('🔍 Attempting client update with:', {
            currentClient: {
              id: client.id,
              name: client.name,
              phone: client.phone,
              state: client.state,
              zip: client.zip
            },
            updateData: clientUpdateData
          });
          
          // Only update if there are fields to update
          if (Object.keys(clientUpdateData).length > 0) {
            await client.update(clientUpdateData, { transaction });
            console.log('✅ Client update successful');
          } else {
            console.log('ℹ️ No client fields to update');
          }
        } catch (updateError) {
          console.error('❌ CLIENT UPDATE FAILED — THIS IS PROBABLY THE ROOT CAUSE:', {
            name: updateError.name,
            message: updateError.message,
            validationErrors: updateError.errors?.map(e => ({
              field: e.path,
              message: e.message,
              type: e.type,
              value: e.value
            })),
            sql: updateError.sql,
            fields: updateError.fields,
            parentCode: updateError.parent?.code,
            parentMessage: updateError.parent?.message,
          });
          await transaction.rollback();
          return res.status(500).json({
            success: false,
            message: `Failed to update client: ${updateError.message}`,
          });
        }
      }
    }

    // Find or create quote
    if (quoteId) {
      quote = await Quote.findOne({
        where: { id: quoteId, tenantId },
        transaction,
      });

      if (!quote) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Quote not found',
        });
      }
    } else {
      isNewQuote = true;
      
      // Generate quote number with error handling (without transaction to avoid aborts)
      // Pass clientId if available for client-specific quote numbering
      let quoteNumber;
      try {
        quoteNumber = await Quote.generateQuoteNumber(tenantId, client?.id || null);
        console.log('✅ Generated quote number:', quoteNumber);
        
        // CRITICAL: Check if this quote number already exists
        const existingQuote = await Quote.findOne({
          where: { quoteNumber, tenantId }
        });
        if (existingQuote) {
          console.error('❌ DUPLICATE QUOTE NUMBER DETECTED:', quoteNumber);
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            message: `Quote number ${quoteNumber} already exists. Please try again.`,
          });
        }
      } catch (genError) {
        console.error('❌ Error generating quote number:', genError);
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `Failed to generate quote number: ${genError.message}`,
        });
      }

      console.log('Creating quote with data:', {
        tenantId,
        userId,
        clientId: client?.id || null,
        quoteNumber,
        pricingSchemeId,
        productSetsType: Array.isArray(productSets) ? 'array' : typeof productSets
      });

      // Validate pricingSchemeId if provided (without transaction to avoid aborts)
      let validatedPricingSchemeId = null;
      if (pricingSchemeId) {
        try {
          const scheme = await PricingScheme.findOne({
            where: { id: pricingSchemeId, tenantId }
            // Removed transaction to prevent silent aborts on FK validation
          });
          if (scheme) {
            validatedPricingSchemeId = pricingSchemeId;
            console.log('✅ Pricing scheme validated:', pricingSchemeId);
          } else {
            console.log('⚠️ Pricing scheme not found, skipping:', pricingSchemeId);
          }
        } catch (schemeError) {
          console.error('❌ Error validating pricing scheme:', schemeError);
          console.error('Scheme error stack:', schemeError.stack);
          await transaction.rollback();
          return res.status(500).json({
            success: false,
            message: `Failed to validate pricing scheme: ${schemeError.message}`,
          });
        }
      }
      
      console.log('✅ Pricing scheme validation complete');
      console.log('🔍 Transaction state after pricing validation:', {
        finished: transaction.finished
      });
      
      // Test if transaction is healthy with a simple query
      try {
        console.log('🧪 Testing transaction health with simple query...');
        await sequelize.query('SELECT 1 as test', { transaction, type: sequelize.QueryTypes.SELECT });
        console.log('✅ Transaction health check passed');
      } catch (healthError) {
        console.error('❌ TRANSACTION HEALTH CHECK FAILED:', {
          name: healthError.name,
          message: healthError.message,
          code: healthError.parent?.code,
          sql: healthError.sql
        });
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `Transaction is in failed state: ${healthError.message}`,
        });
      }
      
      // Final transaction health check right before create
      try {
        console.log('🧪 Final health check right before Quote.create()...');
        await sequelize.query('SELECT 1 as final_test', { transaction, type: sequelize.QueryTypes.SELECT });
        console.log('✅ Final health check passed');
      } catch (finalHealthError) {
        console.error('❌ FINAL HEALTH CHECK FAILED:', {
          name: finalHealthError.name,
          message: finalHealthError.message,
          code: finalHealthError.parent?.code
        });
        // CRITICAL: If health check fails, transaction is aborted - must rollback and return
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `Transaction health check failed: ${finalHealthError.message}`,
        });
      }
      
      try {
        console.log('📝 Attempting to create quote...');
        
       
        
        // Parse stringified JSON fields if needed
        let parsedAreas = areas || [];
        let parsedProductSets = productSets || [];
        
        if (typeof parsedAreas === 'string') {
          console.log('⚠️ areas is a STRING, parsing...');
          try {
            parsedAreas = JSON.parse(parsedAreas);
            console.log('✅ areas parsed successfully:', parsedAreas);
          } catch (e) {
            console.error('❌ Failed to parse areas:', e.message);
            parsedAreas = [];
          }
        }
        
        if (typeof parsedProductSets === 'string') {
          console.log('⚠️ productSets is a STRING, parsing...');
          try {
            parsedProductSets = JSON.parse(parsedProductSets);
            console.log('✅ productSets parsed successfully:', parsedProductSets);
          } catch (e) {
            console.error('❌ Failed to parse productSets:', e.message);
            parsedProductSets = [];
          }
        }
        
     
        
        // CRITICAL: Final validation to ensure JSONB fields are NEVER strings
        if (typeof parsedAreas === 'string') {
          console.error('🚨 BUG DETECTED: areas is still a STRING right before save!');
          throw new Error('JSONB validation failed: areas field is a string instead of array/object');
        }
        if (typeof parsedProductSets === 'string') {
          console.error('🚨 BUG DETECTED: productSets is still a STRING right before save!');
          throw new Error('JSONB validation failed: productSets field is a string instead of array/object');
        }
        
        // Ensure they are proper arrays/objects, not undefined or null
        const safeAreas = Array.isArray(parsedAreas) ? parsedAreas : [];
        const safeProductSets = Array.isArray(parsedProductSets) ? parsedProductSets : [];
        
      
        // Try to build the quote instance first without saving
        console.log('🏗️ Building quote instance...');
        const quoteData = {
          tenantId,
          userId,
          clientId: client?.id || null,
          quoteNumber,
          customerName: customerName || '',
          customerEmail: customerEmail || null,
          customerPhone: customerPhone || null,
          street: street || null,
          city: city || null,
          state: state || null,
          zipCode: zipCode || null,
          pricingSchemeId: validatedPricingSchemeId,
          jobType: jobType || null,
          jobCategory: 'residential',
          productStrategy: productStrategy || 'GBB',
          allowCustomerProductChoice: allowCustomerProductChoice !== undefined ? allowCustomerProductChoice : false,
          areas: safeAreas,
          productSets:  safeProductSets,
          homeSqft: req.body.homeSqft || null,
          jobScope: req.body.jobScope || null,
          numberOfStories: req.body.numberOfStories || null,
          conditionModifier: req.body.conditionModifier || null,
          bookingRequest: null,
          // Financial fields
          subtotal: 0,
          laborTotal: 0,
          materialTotal: 0,
          markup: 0,
          markupPercent: 0,
          zipMarkup: 0,
          zipMarkupPercent: 0,
          tax: 0,
          taxPercent: 0,
          total: 0,
          totalSqft: null,
          // Additional fields
          notes: notes || null,
          clientNotes: null,
          breakdown: null,
          selectedTier: null,
          depositAmount: null,
          depositVerified: false,
          depositVerifiedAt: null,
          depositVerifiedBy: null,
          depositPaymentMethod: null,
          depositTransactionId: null,
          finishStandardsAcknowledged: false,
          finishStandardsAcknowledgedAt: null,
          portalOpen: false,
          portalOpenedAt: null,
          portalClosedAt: null,
          selectionsComplete: false,
          selectionsCompletedAt: null,
          tierChangeRequested: null,
          tierChangeRequestedAt: null,
          tierChangeApproved: null,
          tierChangeApprovedAt: null,
          validUntil: null,
          sentAt: null,
          viewedAt: null,
          acceptedAt: null,
          approvedAt: null,
          declinedAt: null,
          useContractorDiscount: false,
          status: 'draft',
        };
        console.log('✅ Quote instance built:', quoteData);
        
        console.log('✅ Quote instance built successfully');
        console.log('💾 Saving to database...');
        
       quote = await Quote.create(quoteData,  { transaction });
        
        console.log('✅ Quote created successfully:', quote.id);
      } catch (createError) {
        console.error('❌ Error creating quote:', createError);
      // console.error('Create error details:', {
        //   name: createError.name,
        //   message: createError.message,
        //   errors: createError.errors, // Sequelize validation errors
        //   fields: createError.fields,
        //   code: createError.code,
        //   parent: createError.parent?.code,
        //   sql: createError.sql
        // });
        
        // await transaction.rollback();
        
        // Check if it's a unique constraint violation on quote_number
        if (createError.name === 'SequelizeUniqueConstraintError' || 
            (createError.parent && createError.parent.code === '23505')) {
          return res.status(409).json({
            success: false,
            message: `Duplicate quote number detected. This usually means the request was sent multiple times. Please try again.`,
          });
        }
        
        return res.status(500).json({
          success: false,
          message: `Failed to create quote: ${createError.message}`,
        });
      }
    }

    // Update quote with new data
    const updateData = {};
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
    if (street !== undefined) updateData.street = street;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zipCode !== undefined) updateData.zipCode = zipCode;
    if (pricingSchemeId !== undefined) updateData.pricingSchemeId = pricingSchemeId;
    if (jobType !== undefined) updateData.jobType = jobType;
    if (areas !== undefined) updateData.areas = areas;
    if (productSets !== undefined) updateData.productSets = productSets;
    if (productStrategy !== undefined) updateData.productStrategy = productStrategy;
    if (allowCustomerProductChoice !== undefined) updateData.allowCustomerProductChoice = allowCustomerProductChoice;
    if (notes !== undefined) updateData.notes = notes;
    if (client) updateData.clientId = client.id;
    
    // Add turnkey-specific fields
    if (req.body.homeSqft !== undefined) updateData.homeSqft = req.body.homeSqft;
    if (req.body.jobScope !== undefined) updateData.jobScope = req.body.jobScope;
    if (req.body.numberOfStories !== undefined) updateData.numberOfStories = req.body.numberOfStories;
    if (req.body.conditionModifier !== undefined) updateData.conditionModifier = req.body.conditionModifier;

    if (Object.keys(updateData).length > 0) {
      await quote.update(updateData, { transaction });
    }

    // Reload quote to get updated areas and productSets
    await quote.reload({ transaction });

    // Determine pricing scheme type to decide calculation requirements
    let pricingScheme = null;
    if (quote.pricingSchemeId) {
      pricingScheme = await PricingScheme.findByPk(quote.pricingSchemeId);
    }
    
    // Determine if calculation should run based on pricing scheme type
    let shouldCalculate = false;
    let calculationReason = '';
    
    if (pricingScheme) {
      const schemeType = pricingScheme.type;
      
      switch (schemeType) {
        case 'turnkey':
        case 'sqft_turnkey':
          // Turnkey: needs homeSqft
          if (quote.homeSqft && quote.homeSqft > 0) {
            shouldCalculate = true;
            calculationReason = `Turnkey pricing with ${quote.homeSqft} sqft`;
          }
          break;
          
        case 'rate_based_sqft':
          // Rate-based sqft: needs areas with square footage
          if (quote.areas && quote.areas.length > 0) {
            shouldCalculate = true;
            calculationReason = `Rate-based sqft with ${quote.areas.length} areas`;
          }
          break;
          
        case 'production_based':
        case 'flat_rate_unit':
          // Production/flat rate: needs areas and product selections
          if (quote.areas && quote.areas.length > 0 && quote.productSets && 
              (Array.isArray(quote.productSets) ? quote.productSets.length > 0 : Object.keys(quote.productSets).length > 0)) {
            shouldCalculate = true;
            calculationReason = `${schemeType} with ${quote.areas.length} areas and product selections`;
          }
          break;
          
        default:
          // Unknown scheme type - try if we have areas and products
          if (quote.areas && quote.areas.length > 0 && quote.productSets && 
              (Array.isArray(quote.productSets) ? quote.productSets.length > 0 : Object.keys(quote.productSets).length > 0)) {
            shouldCalculate = true;
            calculationReason = `${schemeType} with areas and products`;
          }
      }
    } else if (quote.areas && quote.areas.length > 0 && quote.productSets && 
               (Array.isArray(quote.productSets) ? quote.productSets.length > 0 : Object.keys(quote.productSets).length > 0)) {
      // No pricing scheme but has data - try to calculate anyway
      shouldCalculate = true;
      calculationReason = 'No scheme but has areas and products';
    }
    
    if (shouldCalculate) {
      console.log('💰 Running pricing calculation...', {
        schemeType: pricingScheme?.type,
        reason: calculationReason,
        homeSqft: quote.homeSqft,
        areasLength: quote.areas?.length,
        productSetsLength: Array.isArray(quote.productSets) ? quote.productSets.length : Object.keys(quote.productSets || {}).length
      });
      
      const pricingCalculation = await calculateQuotePricing(quote, tenantId);
      
      // Get contractor settings for validity days and deposit percent
      const settings = await ContractorSettings.findOne({
        where: { tenantId }
      });
      
      const quoteValidityDays = settings?.quoteValidityDays || 30;
      const depositPercent = settings?.depositPercent || 50;
      
      // Calculate validUntil date
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + quoteValidityDays);
      
      // Calculate deposit amount based on total
      const depositAmount = pricingCalculation.total * (depositPercent / 100);
      
      // Update quote with calculated pricing (all pricing engine fields)
      await quote.update({
        subtotal: pricingCalculation.subtotal,
        laborTotal: pricingCalculation.laborTotal,
        materialTotal: pricingCalculation.materialTotal,
        laborMarkupPercent: pricingCalculation.laborMarkupPercent || 0,
        laborMarkupAmount: pricingCalculation.laborMarkupAmount || 0,
        materialMarkupPercent: pricingCalculation.materialMarkupPercent || 0,
        materialMarkupAmount: pricingCalculation.materialMarkupAmount || 0,
        overheadPercent: pricingCalculation.overheadPercent || 0,
        overheadAmount: pricingCalculation.overhead || 0,
        profitMarginPercent: pricingCalculation.profitMarginPercent || 0,
        profitAmount: pricingCalculation.profitAmount || 0,
        markup: pricingCalculation.markupAmount,
        markupPercent: pricingCalculation.markupPercent,
        zipMarkup: pricingCalculation.zipMarkupAmount || 0,
        zipMarkupPercent: pricingCalculation.zipMarkupPercent || 0,
        tax: pricingCalculation.tax || pricingCalculation.taxAmount,
        taxPercent: pricingCalculation.taxPercent || pricingCalculation.taxRate,
        total: pricingCalculation.total,
        totalSqft: pricingCalculation.totalSqft,
        breakdown: pricingCalculation.breakdown,
        validUntil: validUntil,
        depositAmount: depositAmount
      }, { transaction });
    }

    // Create audit log
    await createAuditLog({
      category: 'quote',
      action: isNewQuote ? 'Quote draft created' : 'Quote draft updated',
      userId,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: { quoteNumber: quote.quoteNumber, status: quote.status },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      transaction,
    });

    await transaction.commit();

    // Reload with associations
    const savedQuote = await Quote.findByPk(quote.id, {
      include: [
        { model: Client, as: 'client' },
        { model: PricingScheme, as: 'pricingScheme' },
      ],
    });

    res.json({
      success: true,
      message: isNewQuote ? 'Quote draft created' : 'Quote draft updated',
      quote: savedQuote,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Save draft error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to save quote draft',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get quote by ID
 * GET /api/quote-builder/:id
 */
exports.getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const quote = await Quote.findOne({
      where: { id, tenantId },
      include: [
        { model: Client, as: 'client' },
        { model: PricingScheme, as: 'pricingScheme' },
        { model: User, as: 'user', attributes: ['id', 'fullName', 'email'] },
      ],
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found',
      });
    }

    res.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quote',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Calculate quote totals with comprehensive pricing engine
 * POST /api/quote-builder/calculate
 */
exports.calculateQuote = async (req, res) => {
  try {
    const { 
      areas, 
      productSets, 
      pricingSchemeId, 
      jobType, 
      serviceArea, 
      homeSqft, 
      jobScope, 
      numberOfStories, 
      conditionModifier,
      // NEW: Material calculation options
      includeMaterials = true,
      coverage = 350,
      applicationMethod = 'roll',
      coats = 2
    } = req.body;
    const tenantId = req.user.tenantId;

    // Get pricing scheme (optional - use default if not provided)
    let pricingScheme = null;
    if (pricingSchemeId) {
      pricingScheme = await PricingScheme.findOne({
        where: { id: pricingSchemeId, tenantId },
      });
    }
    
    // If no pricing scheme provided or not found, get the first available one
    if (!pricingScheme) {
      pricingScheme = await PricingScheme.findOne({
        where: { tenantId },
        order: [['createdAt', 'ASC']],
      });
    }

    // Get contractor settings for markup, tax, etc.
    const settings = await ContractorSettings.findOne({
      where: { tenantId }
    });

    // Get pricing rules with material options
    const pricingRules = pricingScheme?.pricingRules || {};
    
    // Material calculation settings (can be overridden by request or scheme rules)
    const finalIncludeMaterials = includeMaterials ?? pricingRules.includeMaterials ?? true;
    let finalCoverage = coverage ?? pricingRules.coverage ?? 350;
    const finalApplicationMethod = applicationMethod ?? pricingRules.applicationMethod ?? 'roll';
    const finalCoats = coats ?? pricingRules.coats ?? 2;
    
    // Adjust coverage for spray method (300 sq ft vs 350 sq ft for roll)
    if (finalApplicationMethod === 'spray' && finalCoverage > 300) {
      finalCoverage = 300; // Reduce coverage for spray to account for overspray
    }
    
    // Validate coverage range (250-450 sq ft per gallon)
    if (finalCoverage < 250) finalCoverage = 250;
    if (finalCoverage > 450) finalCoverage = 450;

    // Check if this is turnkey pricing
    const isTurnkey = pricingScheme && (pricingScheme.type === 'turnkey' || pricingScheme.type === 'sqft_turnkey');

    // If turnkey and homeSqft is provided, use turnkey calculation
    if (isTurnkey && homeSqft && homeSqft > 0) {
      
      // Determine turnkey rate based on job scope
      let turnkeyRate = parseFloat(pricingRules.turnkeyRate) || 3.50;
      if (jobScope === 'interior' && pricingRules.interiorRate) {
        turnkeyRate = parseFloat(pricingRules.interiorRate);
      } else if (jobScope === 'exterior' && pricingRules.exteriorRate) {
        turnkeyRate = parseFloat(pricingRules.exteriorRate);
      }

      // Apply condition modifier
      const conditionMultipliers = {
        excellent: 0.9,
        good: 0.95,
        average: 1.0,
        fair: 1.1,
        poor: 1.25,
      };
      const conditionMultiplier = conditionMultipliers[conditionModifier] || 1.0;
      const adjustedRate = turnkeyRate * conditionMultiplier;

      // Calculate base labor and material (60/40 split for turnkey when materials included)
      const baseTotal = homeSqft * adjustedRate;
      let baseLaborCost, baseMaterialCost;
      
      if (finalIncludeMaterials) {
        // Materials included: 60% labor / 40% materials
        baseLaborCost = baseTotal * 0.60;
        baseMaterialCost = baseTotal * 0.40;
      } else {
        // Labor-only: 100% labor
        baseLaborCost = baseTotal;
        baseMaterialCost = 0;
      }

      // Apply markups and calculate final totals
      const laborMarkupPercent = parseFloat(settings?.laborMarkupPercent) || 35;
      const materialMarkupPercent = parseFloat(settings?.materialMarkupPercent) || 20;
      const overheadPercent = parseFloat(settings?.overheadPercent) || 10;
      const profitMarginPercent = parseFloat(settings?.netProfitPercent) || 5;
      const taxRate = parseFloat(settings?.taxRatePercentage) || 8.25;

      // Step 1: Apply markups
      const laborMarkupAmount = baseLaborCost * (laborMarkupPercent / 100);
      const laborCostWithMarkup = baseLaborCost + laborMarkupAmount;
      
      const materialMarkupAmount = finalIncludeMaterials ? (baseMaterialCost * (materialMarkupPercent / 100)) : 0;
      const materialCostWithMarkup = finalIncludeMaterials ? (baseMaterialCost + materialMarkupAmount) : 0;

      // Step 2: Calculate overhead on subtotal
      const subtotalBeforeOverhead = laborCostWithMarkup + materialCostWithMarkup;
      const overheadAmount = subtotalBeforeOverhead * (overheadPercent / 100);
      const subtotalBeforeProfit = subtotalBeforeOverhead + overheadAmount;

      // Step 3: Calculate profit
      const profitAmount = subtotalBeforeProfit * (profitMarginPercent / 100);
      const subtotal = subtotalBeforeProfit + profitAmount;

      // Step 4: Calculate tax
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      return res.json({
        success: true,
        calculation: {
          // Base costs
          laborTotal: parseFloat(baseLaborCost.toFixed(2)),
          materialTotal: parseFloat(baseMaterialCost.toFixed(2)),
          
          // Markup details
          laborMarkupPercent,
          laborMarkupAmount: parseFloat(laborMarkupAmount.toFixed(2)),
          laborCostWithMarkup: parseFloat(laborCostWithMarkup.toFixed(2)),
          
          materialMarkupPercent,
          materialMarkupAmount: parseFloat(materialMarkupAmount.toFixed(2)),
          materialCostWithMarkup: parseFloat(materialCostWithMarkup.toFixed(2)),
          
          // Overhead and profit
          overheadPercent,
          overhead: parseFloat(overheadAmount.toFixed(2)),
          subtotalBeforeProfit: parseFloat(subtotalBeforeProfit.toFixed(2)),
          
          profitMarginPercent,
          profitAmount: parseFloat(profitAmount.toFixed(2)),
          
          // Final totals
          subtotal: parseFloat(subtotal.toFixed(2)),
          taxPercent: taxRate,
          tax: parseFloat(taxAmount.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          
          // Material calculation settings
          includeMaterials: finalIncludeMaterials,
          coverage: finalCoverage,
          applicationMethod: finalApplicationMethod,
          coats: finalCoats,
          
          // Turnkey-specific details
          homeSqft,
          turnkeyRate: adjustedRate,
          baseRate: turnkeyRate,
          conditionModifier,
          conditionMultiplier,
          jobScope,
          
          // Quote validity
          quoteValidityDays: parseInt(settings?.quoteValidityDays) || 30,
          
          breakdown: [{
            areaName: `${jobScope === 'interior' ? 'Interior' : jobScope === 'exterior' ? 'Exterior' : 'Full Home'} - Turnkey`,
            items: [{
              categoryName: 'Turnkey Pricing',
              quantity: homeSqft,
              measurementUnit: 'sqft',
              rate: adjustedRate,
              laborCost: baseLaborCost,
              materialCost: baseMaterialCost,
            }]
          }]
        },
      });
    }

    // Non-turnkey calculation (existing logic)
    const markup = parseFloat(settings?.defaultMarkupPercentage) || 30;
    const taxRate = parseFloat(settings?.taxRatePercentage) || 0;

    let laborTotal = 0;
    let materialTotal = 0;
    let prepTotal = 0;
    let addOnsTotal = 0;
    const breakdown = [];

    // Calculate for each area - supports both laborItems and surfaces
    for (const area of areas || []) {
      const areaBreakdown = {
        areaId: area.id,
        areaName: area.name,
        items: [],
      };

      // New structure: laborItems
      if (area.laborItems) {
        for (const item of area.laborItems || []) {
          if (!item.selected) continue;

          // Calculate quantity from dimensions if not provided
          let quantity = parseFloat(item.quantity) || 0;
          if (!quantity && item.dimensions) {
            const { length, width, height } = item.dimensions;
            const categoryName = item.categoryName.toLowerCase();
            
            if (categoryName.includes('wall')) {
              // Walls: 2 × (L + W) × H
              quantity = 2 * (parseFloat(length) + parseFloat(width)) * parseFloat(height);
            } else if (categoryName.includes('ceiling')) {
              // Ceiling: L × W
              quantity = parseFloat(length) * parseFloat(width);
            } else if (categoryName.includes('trim')) {
              // Trim: 2 × (L + W)
              quantity = 2 * (parseFloat(length) + parseFloat(width));
            } else {
              // Default: L × W
              quantity = parseFloat(length) * parseFloat(width);
            }
            quantity = Math.ceil(quantity); // Round up
          }
          
          if (!quantity) continue; // Skip if still no quantity
          const itemBreakdown = {
            categoryName: item.categoryName,
            measurementUnit: item.measurementUnit,
            quantity,
            numberOfCoats: item.numberOfCoats || 0,
            laborCost: 0,
            materialCost: 0,
            gallons: item.gallons || 0,
          };

          // Get pricing scheme rules
          const pricingRules = pricingScheme?.pricingRules || {};
          const categoryKey = item.categoryName.toLowerCase().replace(/\s+/g, '_');
          const categoryRule = pricingRules[categoryKey] || pricingRules.walls || {};

          // Calculate labor cost based on pricing scheme type
          if (pricingScheme) {
            switch (pricingScheme.type) {
              case 'sqft_turnkey':
                // All-in price per sqft (labor + materials included)
                const turnkeyRate = parseFloat(categoryRule.price || 1.15);
                if (item.measurementUnit === 'sqft') {
                  itemBreakdown.laborCost = quantity * turnkeyRate;
                } else {
                  // For non-sqft units, use the labor rate from item
                  itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                }
                break;

              case 'sqft_labor_paint':
                // Separate labor per sqft
                const laborPerSqft = parseFloat(categoryRule.price || 0.55);
                if (item.measurementUnit === 'sqft') {
                  itemBreakdown.laborCost = quantity * laborPerSqft;
                } else if (item.measurementUnit === 'linear_foot') {
                  // Linear foot pricing (e.g., trim)
                  const lfRate = parseFloat(pricingRules.trim?.price || 2.50);
                  itemBreakdown.laborCost = quantity * lfRate;
                } else {
                  // For hours or units, use labor rate from item
                  itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                }
                break;

              case 'hourly_time_materials':
                // Calculate based on hourly rate
                const hourlyRate = parseFloat(pricingRules.hourly_rate?.price || 50);
                const crewSize = parseInt(pricingRules.crew_size?.value || 2);
                
                if (item.measurementUnit === 'hour') {
                  // Direct hours
                  itemBreakdown.laborCost = quantity * hourlyRate * crewSize;
                } else if (item.measurementUnit === 'sqft') {
                  // Convert sqft to hours based on productivity
                  const productivity = parseFloat(pricingRules.productivity_rate || 250); // sqft per hour
                  const hours = Math.ceil((quantity / productivity) * 10) / 10;
                  itemBreakdown.hours = hours;
                  itemBreakdown.laborCost = hours * hourlyRate * crewSize;
                } else {
                  // For other units, use labor rate from item
                  itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                }
                break;

              case 'unit_pricing':
                // Price per unit (doors, windows, cabinets, etc.)
                const unitPrice = parseFloat(categoryRule.price || 85);
                if (item.measurementUnit === 'unit') {
                  itemBreakdown.laborCost = quantity * unitPrice;
                } else {
                  // For sqft or linear_foot, use per-unit calculation
                  itemBreakdown.laborCost = quantity * (parseFloat(categoryRule.price) || parseFloat(item.laborRate) || 0);
                }
                break;

              case 'room_flat_rate':
                // Flat rate per room (applies once per area, not per item)
                // Only charge once for the primary surface in the area
                const flatRate = parseFloat(pricingRules.room_flat_rate?.price || 325);
                itemBreakdown.laborCost = flatRate;
                break;

              default:
                // Fallback to labor rate from item
                itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
            }
          } else {
            // No pricing scheme - use labor rate from item
            itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
          }

          // Calculate material cost if gallons are provided AND materials are included
          if (finalIncludeMaterials && item.gallons && item.gallons > 0) {
            // Get product for this surface type
            const productSet = (productSets || []).find(ps => 
              ps.surfaceType === item.categoryName || 
              ps.surfaceType.toLowerCase().includes(item.categoryName.toLowerCase())
            );
            
            let pricePerGallon = 35; // Default price
            
            if (productSet) {
              // Get the selected product ID from the tier
              const selectedProductId = productSet.products?.good || productSet.products?.better || 
                                       productSet.products?.best || productSet.products?.single;
              
              if (selectedProductId) {
                // Fetch actual product price from database
                try {
                  const productConfig = await ProductConfig.findOne({
                    where: { id: selectedProductId, tenantId },
                    include: [{
                      model: GlobalProduct,
                      as: 'globalProduct'
                    }]
                  });
                  
                  if (productConfig && productConfig.sheens && productConfig.sheens.length > 0) {
                    // Use the price from the first sheen (or average)
                    pricePerGallon = parseFloat(productConfig.sheens[0].price || 35);
                  }
                } catch (err) {
                  console.error('Error fetching product price:', err);
                  pricePerGallon = 35; // Fallback
                }
              }
              
              // If productSet has materialCost calculated from frontend, use that
              if (productSet.materialCost) {
                itemBreakdown.materialCost = parseFloat(productSet.materialCost);
              } else {
                itemBreakdown.materialCost = item.gallons * pricePerGallon;
              }
            } else {
              itemBreakdown.materialCost = item.gallons * pricePerGallon;
            }
          } else {
            // Materials not included - set to 0
            itemBreakdown.materialCost = 0;
          }

          // Accumulate totals
          laborTotal += itemBreakdown.laborCost;
          if (finalIncludeMaterials) {
            materialTotal += itemBreakdown.materialCost;
          }

          areaBreakdown.items.push(itemBreakdown);
        }
      }
      // Old structure: surfaces (backward compatibility)
      else if (area.surfaces) {
        for (const surface of area.surfaces || []) {
          if (!surface.selected || !surface.sqft) continue;

          const sqft = parseFloat(surface.sqft) || 0;
          const surfaceBreakdown = {
            type: surface.type,
            sqft,
            laborCost: 0,
            materialCost: 0,
            prepCost: 0,
            addOnCost: 0,
          };

          // Get product for this surface
          const productSet = productSets?.[surface.type];
          let product = null;
          let pricePerGallon = 0;
          let surfaceCoats = finalCoats; // Use final coats from settings
          let surfaceCoverage = finalCoverage; // Use final coverage from settings

          if (productSet) {
            // Determine which tier product to use
            const tierProduct = productSet.good || productSet.better || productSet.best || productSet.single;
            
            if (tierProduct) {
              product = tierProduct;
              pricePerGallon = parseFloat(tierProduct.price_per_gallon || tierProduct.cost_per_gallon || 35);
              surfaceCoats = parseInt(tierProduct.default_coats || finalCoats);
              surfaceCoverage = parseInt(tierProduct.coverage_sqft_per_gal || finalCoverage);
            }
          }

        // Calculate material cost only if materials are included
        if (finalIncludeMaterials) {
          const wasteFactor = 1.10; // 10% waste
          const gallons = Math.ceil((sqft * surfaceCoats / surfaceCoverage * wasteFactor) * 4) / 4; // Round to nearest 0.25
          surfaceBreakdown.gallons = gallons;
          surfaceBreakdown.materialCost = gallons * pricePerGallon;
        } else {
          surfaceBreakdown.gallons = 0;
          surfaceBreakdown.materialCost = 0;
        }

        // Calculate labor cost based on pricing scheme type
        const pricingRules = pricingScheme.pricingRules || {};
        const surfaceKey = surface.type.toLowerCase().replace(/\s+/g, '_');
        const surfaceRule = pricingRules[surfaceKey] || pricingRules.walls || {};

        switch (pricingScheme.type) {
          case 'sqft_turnkey':
            // All-in price per sqft (labor + materials)
            const turnkeyRate = parseFloat(surfaceRule.price || 1.15);
            surfaceBreakdown.laborCost = sqft * turnkeyRate;
            break;

          case 'sqft_labor_paint':
            // Separate labor per sqft
            const laborRate = parseFloat(surfaceRule.price || 0.55);
            surfaceBreakdown.laborCost = sqft * laborRate;
            break;

          case 'hourly_time_materials':
            // Calculate hours based on productivity
            const hourlyRate = parseFloat(pricingRules.hourly_rate?.price || 50);
            const productivity = parseFloat(pricingRules.productivity_rate || 250); // sqft per hour
            const crewSize = parseInt(pricingRules.crew_size?.value || 2);
            const hours = Math.ceil((sqft / productivity) * 10) / 10; // Round to 0.1
            surfaceBreakdown.hours = hours;
            surfaceBreakdown.laborCost = hours * hourlyRate * crewSize;
            break;

          case 'unit_pricing':
            // Price per unit (doors, windows, etc.)
            const unitPrice = parseFloat(surfaceRule.price || 85);
            const units = parseInt(surface.units || 1);
            surfaceBreakdown.units = units;
            surfaceBreakdown.laborCost = units * unitPrice;
            break;

          case 'room_flat_rate':
            // Flat rate per room/area
            const flatRate = parseFloat(surfaceRule.price || 325);
            surfaceBreakdown.laborCost = flatRate;
            break;

          default:
            // Default to sqft labor rate
            const defaultRate = parseFloat(surfaceRule.price || 0.75);
            surfaceBreakdown.laborCost = sqft * defaultRate;
        }

        // Add prep costs if applicable
        if (surface.condition === 'damaged' || surface.needsPrep) {
          const prepRate = parseFloat(surfaceRule.prep_rate || 0.25);
          surfaceBreakdown.prepCost = sqft * prepRate;
        }

        // Add-on costs (texture, height, etc.)
        if (surface.textured) {
          surfaceBreakdown.addOnCost += sqft * 0.10;
        }
        if (surface.highCeiling || surface.vaulted) {
          surfaceBreakdown.addOnCost += sqft * 0.20;
        }

        // Accumulate totals
        laborTotal += surfaceBreakdown.laborCost;
        materialTotal += surfaceBreakdown.materialCost;
        prepTotal += surfaceBreakdown.prepCost;
        addOnsTotal += surfaceBreakdown.addOnCost;

        areaBreakdown.items.push(surfaceBreakdown);
      }
      }

      breakdown.push(areaBreakdown);
    }

    // Calculate overhead (optional travel, cleanup, etc.)
    const travelCost = serviceArea?.distance ? serviceArea.distance * 0.50 : 0;
    const cleanupCost = 100; // Flat cleanup fee

    // Get pricing engine settings from contractor settings
    const laborMarkupPercent = parseFloat(settings?.laborMarkupPercent) || 0;
    const materialMarkupPercent = parseFloat(settings?.materialMarkupPercent) || markup;
    const overheadPercent = parseFloat(settings?.overheadPercent) || 0;
    const netProfitPercent = parseFloat(settings?.netProfitPercent) || 0;
    const quoteValidityDays = parseInt(settings?.quoteValidityDays) || 30;
    const depositPercent = parseFloat(settings?.depositPercentage) || 50;

    // Step 1: Base costs
    const baseLaborCost = laborTotal;
    const baseMaterialCost = materialTotal;

    // Step 2: Apply markup to labor and materials separately (only if materials included)
    const laborMarkupAmount = baseLaborCost * (laborMarkupPercent / 100);
    const laborCostWithMarkup = baseLaborCost + laborMarkupAmount;
    
    const materialMarkupAmount = finalIncludeMaterials ? (baseMaterialCost * (materialMarkupPercent / 100)) : 0;
    const materialCostWithMarkup = finalIncludeMaterials ? (baseMaterialCost + materialMarkupAmount) : 0;

    // Step 3: Subtotal before overhead
    const subtotalBeforeOverhead = laborCostWithMarkup + materialCostWithMarkup + prepTotal + addOnsTotal;

    // Step 4: Apply overhead (fixed amount or percentage of subtotal)
    let overheadAmount = 0;
    if (overheadPercent > 0) {
      overheadAmount = subtotalBeforeOverhead * (overheadPercent / 100);
    } else {
      overheadAmount = travelCost + cleanupCost; // Use fixed costs if no overhead percent
    }
    const subtotalBeforeProfit = subtotalBeforeOverhead + overheadAmount;

    // Step 5: Apply net profit
    const profitAmount = subtotalBeforeProfit * (netProfitPercent / 100);
    const subtotal = subtotalBeforeProfit + profitAmount;

    // Step 6: Calculate tax
    const taxAmount = subtotal * (taxRate / 100);

    // Final total
    const total = subtotal + taxAmount;
    
    // Calculate deposit and balance
    const deposit = total * (depositPercent / 100);
    const balance = total - deposit;

    res.json({
      success: true,
      calculation: {
        // Base costs
        laborTotal: parseFloat(laborTotal?.toFixed(2)),
        materialTotal: parseFloat(materialTotal?.toFixed(2)),
        prepTotal: parseFloat(prepTotal?.toFixed(2)),
        addOnsTotal: parseFloat(addOnsTotal?.toFixed(2)),
        
        // Labor markup
        laborMarkupPercent: parseFloat(laborMarkupPercent?.toFixed(2)),
        laborMarkupAmount: parseFloat(laborMarkupAmount?.toFixed(2)),
        laborCostWithMarkup: parseFloat(laborCostWithMarkup?.toFixed(2)),
        
        // Material markup (0 if materials not included)
        materialMarkupPercent: parseFloat(materialMarkupPercent?.toFixed(2)),
        materialMarkupAmount: parseFloat(materialMarkupAmount?.toFixed(2)),
        materialCostWithMarkup: parseFloat(materialCostWithMarkup?.toFixed(2)),
        
        // Overhead
        overheadPercent: parseFloat(overheadPercent?.toFixed(2)),
        overhead: parseFloat(overheadAmount?.toFixed(2)),
        subtotalBeforeProfit: parseFloat(subtotalBeforeProfit?.toFixed(2)),
        
        // Net profit
        profitMarginPercent: parseFloat(netProfitPercent?.toFixed(2)),
        profitAmount: parseFloat(profitAmount?.toFixed(2)),
        
        // Final totals
        subtotal: parseFloat(subtotal?.toFixed(2)),
        taxPercent: parseFloat(taxRate?.toFixed(2)),
        tax: parseFloat(taxAmount?.toFixed(2)),
        total: parseFloat(total?.toFixed(2)),
        
        // Payment terms
        depositPercent: parseFloat(depositPercent?.toFixed(2)),
        deposit: parseFloat(deposit?.toFixed(2)),
        balance: parseFloat(balance?.toFixed(2)),
        
        // Material calculation settings
        includeMaterials: finalIncludeMaterials,
        coverage: finalCoverage,
        applicationMethod: finalApplicationMethod,
        coats: finalCoats,
        
        // Additional info
        quoteValidityDays: parseInt(quoteValidityDays),
        breakdown,
        travelCost: parseFloat(travelCost?.toFixed(2)),
        cleanupCost: parseFloat(cleanupCost?.toFixed(2)),
        
        // Legacy fields for backward compatibility
        materialCost: parseFloat(materialTotal?.toFixed(2)),
        taxAmount: parseFloat(taxAmount?.toFixed(2)),
        taxRate: parseFloat(taxRate?.toFixed(2)),
        markupAmount: parseFloat(materialMarkupAmount?.toFixed(2)),
        markupPercent: parseFloat(materialMarkupPercent?.toFixed(2))
      },
    });
  } catch (error) {
    console.error('Calculate quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate quote',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Send quote to client
 * POST /api/quote-builder/:id/send
 */
exports.sendQuote = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const quote = await Quote.findOne({
      where: { id, tenantId },
      transaction,
    });

    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Quote not found',
      });
    }

    // Validate quote has required data
    if (!quote.customerEmail) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Customer email is required to send quote',
      });
    }

    // Update quote status
    await quote.markAsSent();

    // Create audit log
    await createAuditLog({
      category: 'quote',
      action: 'Quote sent to client',
      userId,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: { quoteNumber: quote.quoteNumber, customerEmail: quote.customerEmail },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      transaction,
    });

    // Commit transaction before async operations (email, PDF)
    await transaction.commit();

    // Calculate quote totals for email (after commit)
    const calculation = await this.calculateQuoteData(quote);

    // Get contractor info
    const contractor = await User.findByPk(userId);

    // Get contractor settings for PDF
    const settings = await ContractorSettings.findOne({
      where: { tenantId }
    });

    // Generate PDF (new template). Fallback to legacy generator on failure.
    let pdfBuffer = null;
    try {
      const tenant = await Tenant.findByPk(tenantId);
      const pDefaults = await ProposalDefaults.findOne({ where: { tenantId } });

      const projectAddress = [quote.street, quote.city, quote.state, quote.zipCode].filter(Boolean).join(', ');

      // Prepare GBB rows from productSets
      const rows = [];
      const productSets = quote.productSets || {};
      const getName = (obj) => obj ? (obj.name || obj.productName || obj.title || obj.label) : undefined;
      const surfaceSet = new Set();
      (quote.areas || []).forEach(a => {
        a.laborItems?.forEach(li => li?.categoryName && surfaceSet.add(li.categoryName));
        a.surfaces?.forEach(s => s?.type && surfaceSet.add(s.type));
      });
      Array.from(surfaceSet).forEach(label => {
        let set = Array.isArray(productSets) ? (productSets.find(ps => ps.surfaceType === label) || {}) : (productSets[label] || {});
        rows.push({ label, good: getName(set.good), better: getName(set.better), best: getName(set.best) });
      });

      const depositPct = parseFloat(settings?.depositPercentage || 0);
      const total = parseFloat(quote.total || 0);
      const depositAmount = total * (depositPct / 100);

      const templateData = {
        company: {
          name: tenant?.companyName || 'Your Company',
          email: tenant?.email || '',
          phone: tenant?.phoneNumber || '',
          addressLine1: tenant?.businessAddress || '',
          logoUrl: pDefaults?.companyLogo || '',
        },
        proposal: {
          invoiceNumber: quote.quoteNumber,
          date: new Date().toLocaleDateString(),
          customerName: quote.customerName,
          projectAddress,
          selectedOption: quote.productStrategy === 'GBB' ? 'Better' : 'Single',
          totalInvestment: total,
          depositAmount,
        },
        introduction: {
          welcomeMessage: pDefaults?.defaultWelcomeMessage || undefined,
          aboutUsSummary: pDefaults?.aboutUsSummary || undefined,
        },
        scope: {
          interiorProcess: pDefaults?.interiorProcess || undefined,
          drywallRepairProcess: pDefaults?.drywallRepairProcess || undefined,
          exteriorProcess: pDefaults?.exteriorProcess || undefined,
          trimProcess: pDefaults?.trimProcess || undefined,
          cabinetProcess: pDefaults?.cabinetProcess || undefined,
        },
        warranty: {
          standard: pDefaults?.standardWarranty || undefined,
          premium: pDefaults?.premiumWarranty || undefined,
          exterior: pDefaults?.exteriorWarranty || undefined,
        },
        responsibilities: {
          client: pDefaults?.clientResponsibilities || undefined,
          contractor: pDefaults?.contractorResponsibilities || undefined,
        },
        acceptance: {
          acknowledgement: pDefaults?.legalAcknowledgement || undefined,
          signatureStatement: pDefaults?.signatureStatement || undefined,
        },
        payment: {
          paymentTermsText: pDefaults?.paymentTermsText || undefined,
          paymentMethods: pDefaults?.paymentMethods || undefined,
          latePaymentPolicy: pDefaults?.latePaymentPolicy || undefined,
        },
        policies: {
          touchUpPolicy: pDefaults?.touchUpPolicy || undefined,
          finalWalkthroughPolicy: pDefaults?.finalWalkthroughPolicy || undefined,
          changeOrderPolicy: pDefaults?.changeOrderPolicy || undefined,
          colorDisclaimer: pDefaults?.colorDisclaimer || undefined,
          surfaceConditionDisclaimer: pDefaults?.surfaceConditionDisclaimer || undefined,
          paintFailureDisclaimer: pDefaults?.paintFailureDisclaimer || undefined,
          generalProposalDisclaimer: pDefaults?.generalProposalDisclaimer || undefined,
        },
        areaBreakdown: (quote.areas || []).map(a => a.name).filter(Boolean),
        gbb: { rows, investment: {} },
      };

      const html = renderProposalHtml(templateData);
      pdfBuffer = await htmlToPdfBuffer(html);
    } catch (pdfErrorNew) {
      console.error('New template PDF generation failed, falling back:', pdfErrorNew);
      try {
        pdfBuffer = await PDFGenerator.generateQuotePDF({
          quote: quote.toJSON(),
          calculation,
          contractor: {
            name: contractor.fullName,
            email: contractor.email,
            phone: settings?.phone,
            companyName: settings?.businessName || 'Our Painting Team'
          },
          settings
        });
      } catch (pdfErrorLegacy) {
        console.error('Legacy PDF generation also failed:', pdfErrorLegacy);
        // Continue without PDF if generation fails
      }
    }

    // Send email notification
    try {
      await emailService.sendQuoteToCustomer({
        to: quote.customerEmail,
        customerName: quote.customerName,
        quote: quote.toJSON(),
        calculation,
        contractor: {
          name: contractor.fullName,
          email: contractor.email,
          phone: settings?.phone,
          companyName: settings?.businessName || 'Our Painting Team'
        },
        quoteViewUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/quote/${quote.id}`,
        pdfBuffer
      });
    } catch (emailError) {
      console.error('Error sending quote email:', emailError);
      // Don't fail the request if email fails - quote is already marked as sent
    }

    res.json({
      success: true,
      message: 'Quote sent successfully',
      quote,
    });
  } catch (error) {
    // Only rollback if transaction is still pending
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Send quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send quote',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Generate proposal PDF for a quote
 * GET /api/quote-builder/:id/proposal.pdf
 */
exports.getProposalPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // Fetch quote with tenant context
    const quote = await Quote.findOne({
      where: { id, tenantId },
      include: [
        { model: Client, as: 'client' },
        { model: PricingScheme, as: 'pricingScheme' },
      ],
    });

    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    // Load company/tenant and defaults
    const [tenant, settings, pDefaults] = await Promise.all([
      Tenant.findByPk(tenantId),
      ContractorSettings.findOne({ where: { tenantId } }),
      ProposalDefaults.findOne({ where: { tenantId } }),
    ]);

    // Compose address from quote fields
    const projectAddress = [quote.street, quote.city, quote.state, quote.zipCode]
      .filter(Boolean)
      .join(', ');

    // Build GBB table rows from productSets or areas
    const rows = [];
    const productSets = quote.productSets || {};

    // Helper to extract name from possible tier object
    const getName = (obj) => {
      if (!obj) return undefined;
      return obj.name || obj.productName || obj.title || obj.label || undefined;
    };

    // Collect surface types from areas as labels
    const surfaceSet = new Set();
    (quote.areas || []).forEach(a => {
      if (Array.isArray(a.laborItems)) {
        a.laborItems.forEach(li => li?.categoryName && surfaceSet.add(li.categoryName));
      }
      if (Array.isArray(a.surfaces)) {
        a.surfaces.forEach(s => s?.type && surfaceSet.add(s.type));
      }
    });

    const surfaceTypes = Array.from(surfaceSet);

    surfaceTypes.forEach((label) => {
      let good, better, best;

      if (Array.isArray(productSets)) {
        const set = productSets.find(ps => ps.surfaceType === label) || {};
        good = getName(set.good);
        better = getName(set.better);
        best = getName(set.best);
      } else if (productSets && typeof productSets === 'object') {
        const key = label;
        const set = productSets[key] || {};
        good = getName(set.good);
        better = getName(set.better);
        best = getName(set.best);
      }

      rows.push({ label, good, better, best });
    });

    // Compute deposit from settings
    const depositPct = parseFloat(settings?.depositPercentage || 0);
    const total = parseFloat(quote.total || 0);
    const depositAmount = total * (depositPct / 100);

    // Build template data (include ProposalDefaults content)
    const templateData = {
      company: {
        name: tenant?.companyName || 'Your Company',
        email: tenant?.email || '',
        phone: tenant?.phoneNumber || '',
        addressLine1: tenant?.businessAddress || '',
        logoUrl: pDefaults?.companyLogo || '',
      },
      proposal: {
        invoiceNumber: quote.quoteNumber,
        date: new Date().toLocaleDateString(),
        customerName: quote.customerName,
        projectAddress,
        selectedOption: quote.productStrategy === 'GBB' ? 'Better' : 'Single',
        totalInvestment: total,
        depositAmount,
      },
      introduction: {
        welcomeMessage: pDefaults?.defaultWelcomeMessage || undefined,
        aboutUsSummary: pDefaults?.aboutUsSummary || undefined,
      },
      scope: {
        interiorProcess: pDefaults?.interiorProcess || undefined,
        drywallRepairProcess: pDefaults?.drywallRepairProcess || undefined,
        exteriorProcess: pDefaults?.exteriorProcess || undefined,
        trimProcess: pDefaults?.trimProcess || undefined,
        cabinetProcess: pDefaults?.cabinetProcess || undefined,
      },
      warranty: {
        standard: pDefaults?.standardWarranty || undefined,
        premium: pDefaults?.premiumWarranty || undefined,
        exterior: pDefaults?.exteriorWarranty || undefined,
      },
      responsibilities: {
        client: pDefaults?.clientResponsibilities || undefined,
        contractor: pDefaults?.contractorResponsibilities || undefined,
      },
      acceptance: {
        acknowledgement: pDefaults?.legalAcknowledgement || undefined,
        signatureStatement: pDefaults?.signatureStatement || undefined,
      },
      payment: {
        paymentTermsText: pDefaults?.paymentTermsText || undefined,
        paymentMethods: pDefaults?.paymentMethods || undefined,
        latePaymentPolicy: pDefaults?.latePaymentPolicy || undefined,
      },
      policies: {
        touchUpPolicy: pDefaults?.touchUpPolicy || undefined,
        finalWalkthroughPolicy: pDefaults?.finalWalkthroughPolicy || undefined,
        changeOrderPolicy: pDefaults?.changeOrderPolicy || undefined,
        colorDisclaimer: pDefaults?.colorDisclaimer || undefined,
        surfaceConditionDisclaimer: pDefaults?.surfaceConditionDisclaimer || undefined,
        paintFailureDisclaimer: pDefaults?.paintFailureDisclaimer || undefined,
        generalProposalDisclaimer: pDefaults?.generalProposalDisclaimer || undefined,
      },
      areaBreakdown: (quote.areas || []).map(a => a.name).filter(Boolean),
      gbb: {
        rows,
        investment: {}, // Optional if we later add per-tier totals
      },
    };

    const html = renderProposalHtml(templateData);
    const pdf = await htmlToPdfBuffer(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Proposal-${quote.quoteNumber}.pdf`);
    return res.send(pdf);
  } catch (error) {
    console.error('Generate proposal PDF error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate proposal PDF' });
  }
};

/**
 * Professional Quote Calculation Engine - US Industry Standard
 * Formula: Total = ((Materials + Labor + Overhead) × (1 + Profit Margin)) + Tax
 * 
 * Materials: Paint/Primer cost calculated from gallons needed and price per gallon
 * Labor: Cost from selected labor items (typically $/sq ft or hourly rate)
 * Overhead: Business expenses (transportation, equipment, insurance) - typically 10%
 * Profit Margin: Business profit (typically 20-50%)
 * Tax: Sales tax applied to final subtotal
 */
exports.calculateQuoteData = async (quote) => {
  const { areas, productSets, pricingScheme } = quote;
  
  let laborTotal = 0;
  let materialCost = 0; // Raw material cost
  let materialTotal = 0; // Material cost after markup
  const breakdown = [];
  
  // Get contractor settings for pricing parameters
  const settings = await ContractorSettings.findOne({
    where: { tenantId: quote.tenantId }
  });
  
  const markupPercent = parseFloat(settings?.defaultMarkupPercentage || 30);
  const overheadPercent = 10; // Default overhead percentage (use setting when DB column exists)
  const profitMarginPercent = 35; // Default profit margin percentage (use setting when DB column exists)
  const taxPercent = parseFloat(settings?.taxRatePercentage || 8.25);
  
  // 1. Calculate Labor from Areas
  for (const area of areas || []) {
    const areaLabor = {
      areaName: area.name,
      items: [],
      areaTotal: 0
    };
    
    if (area.laborItems) {
      for (const item of area.laborItems || []) {
        if (!item.selected) continue;
        
        const quantity = parseFloat(item.quantity) || 0;
        const laborRate = parseFloat(item.laborRate) || 0;
        const coats = parseInt(item.numberOfCoats) || 1;
        
        if (!quantity) continue;
        
        // Calculate labor cost (quantity could be sq ft, hours, etc.)
        const itemLaborCost = quantity * laborRate;
        laborTotal += itemLaborCost;
        
        areaLabor.items.push({
          name: item.categoryName,
          quantity: quantity,
          unit: item.measurementUnit,
          rate: laborRate,
          coats: coats,
          gallons: item.gallons || 0,
          laborCost: itemLaborCost
        });
        
        areaLabor.areaTotal += itemLaborCost;
      }
    }
    
    if (areaLabor.items.length > 0) {
      breakdown.push(areaLabor);
    }
  }
  
  // 2. Calculate Materials from Product Sets
  const productCosts = {};
  
  for (const set of productSets || []) {
    const productsList = Array.isArray(set.products) ? set.products : [];
    
    for (const product of productsList) {
      if (!product.selected) continue;
      
      const gallons = parseFloat(product.gallonsNeeded) || 0;
      const pricePerGallon = parseFloat(product.pricePerGallon) || 0;
      
      if (!gallons || !pricePerGallon) continue;
      
      // Material cost (raw cost before any markup)
      const productCost = gallons * pricePerGallon;
      materialCost += productCost;
      
      if (!productCosts[product.productId]) {
        productCosts[product.productId] = {
          name: product.name || `Product ${product.productId}`,
          gallons: 0,
          pricePerGallon: pricePerGallon,
          cost: 0
        };
      }
      
      productCosts[product.productId].gallons += gallons;
      productCosts[product.productId].cost += productCost;
    }
  }
  
  // 3. Apply Markup to Materials (to cover material handling, storage, waste)
  materialTotal = materialCost * (1 + markupPercent / 100);
  
  // 4. Calculate Overhead (transportation, equipment rental, insurance)
  const baseAmount = laborTotal + materialTotal;
  const overhead = baseAmount * (overheadPercent / 100);
  
  // 5. Calculate Subtotal Before Profit
  const subtotalBeforeProfit = laborTotal + materialTotal + overhead;
  
  // 6. Apply Profit Margin
  const profitAmount = subtotalBeforeProfit * (profitMarginPercent / 100);
  
  // 7. Calculate Subtotal (before tax)
  const subtotal = subtotalBeforeProfit + profitAmount;
  
  // 8. Calculate Tax (on subtotal including profit)
  const tax = subtotal * (taxPercent / 100);
  
  // 9. Calculate Grand Total
  const total = subtotal + tax;
  
  // 10. Calculate Deposit (typically on total)
  const depositPercent = parseFloat(settings?.depositPercentage || 50);
  const deposit = total * (depositPercent / 100);
  
  return {
    // Labor
    laborTotal: parseFloat(laborTotal?.toFixed(2)),
    
    // Materials
    materialCost: parseFloat(materialCost?.toFixed(2)), // Raw material cost
    materialMarkupPercent: markupPercent,
    materialMarkupAmount: parseFloat((materialTotal - materialCost)?.toFixed(2)),
    materialTotal: parseFloat(materialTotal?.toFixed(2)), // After markup
    
    // Overhead
    overheadPercent: overheadPercent,
    overhead: parseFloat(overhead?.toFixed(2)),
    
    // Profit
    profitMarginPercent: profitMarginPercent,
    profitAmount: parseFloat(profitAmount?.toFixed(2)),
    
    // Products detail
    products: Object.values(productCosts).map(p => ({
      ...p,
      cost: parseFloat(p.cost?.toFixed(2))
    })),
    
    // Totals
    subtotalBeforeProfit: parseFloat(subtotalBeforeProfit?.toFixed(2)),
    subtotal: parseFloat(subtotal?.toFixed(2)),
    taxPercent: taxPercent,
    tax: parseFloat(tax?.toFixed(2)),
    total: parseFloat(total?.toFixed(2)),
    
    // Payment
    depositPercent: depositPercent,
    deposit: parseFloat(deposit?.toFixed(2)),
    balance: parseFloat((total - deposit)?.toFixed(2)),
    
    // Breakdown for detailed view
    breakdown
  };
};

/**
 * Get all drafts for current user
 * GET /api/quote-builder/drafts
 */
exports.getDrafts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { limit = 10 } = req.query;

    const quotes = await Quote.findAll({
      where: {
        tenantId,
        status: 'draft',
        isActive: true,
      },
      include: [
        { model: Client, as: 'client' },
      ],
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      drafts: quotes,
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve drafts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = exports;
