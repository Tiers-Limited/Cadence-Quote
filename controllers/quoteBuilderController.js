// controllers/quoteBuilderController.js
// Enhanced Quote Builder Controller with complete business logic

const Quote = require('../models/Quote');
const Client = require('../models/Client');
const PricingScheme = require('../models/PricingScheme');
const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');
const { createAuditLog } = require('./auditLogController');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

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

      // Update client if data changed
      if (client && (customerName || customerPhone || street || city || state || zipCode)) {
        await client.update({
          name: customerName || client.name,
          phone: customerPhone || client.phone,
          street: street || client.street,
          city: city || client.city,
          state: state || client.state,
          zip: zipCode || client.zip,
        }, { transaction });
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
      const quoteNumber = await Quote.generateQuoteNumber(tenantId);

      quote = await Quote.create({
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
        pricingSchemeId: pricingSchemeId || null,
        jobType: jobType || null,
        productStrategy: productStrategy || 'GBB',
        allowCustomerProductChoice: allowCustomerProductChoice !== undefined ? allowCustomerProductChoice : false,
        areas: areas || [],
        productSets: productSets || {},
        status: 'draft',
      }, { transaction });
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

    if (Object.keys(updateData).length > 0) {
      await quote.update(updateData, { transaction });
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
    await transaction.rollback();
    console.error('Save draft error:', error);
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
 * Calculate quote totals
 * POST /api/quote-builder/calculate
 */
exports.calculateQuote = async (req, res) => {
  try {
    const { areas, productSets, pricingSchemeId } = req.body;
    const tenantId = req.user.tenantId;

    // Get pricing scheme
    const pricingScheme = await PricingScheme.findOne({
      where: { id: pricingSchemeId, tenantId },
    });

    if (!pricingScheme) {
      return res.status(404).json({
        success: false,
        message: 'Pricing scheme not found',
      });
    }

    let laborTotal = 0;
    let materialTotal = 0;
    const breakdown = [];

    // Calculate for each area
    for (const area of areas || []) {
      const areaBreakdown = {
        areaId: area.id,
        areaName: area.name,
        surfaces: [],
      };

      for (const surface of area.surfaces || []) {
        if (!surface.selected || !surface.sqft) continue;

        const surfaceBreakdown = {
          type: surface.type,
          sqft: parseFloat(surface.sqft) || 0,
          laborCost: 0,
          materialCost: 0,
        };

        // Get product config for this surface type
        const productSet = productSets?.[surface.type];
        if (productSet) {
          const product = productSet.good || productSet.single;
          if (product) {
            // Calculate material cost
            const coats = product.default_coats || 2;
            const coverage = product.coverage_sqft_per_gal || 350;
            const costPerGallon = product.cost_per_gallon || 0;

            const gallons = Math.ceil((surfaceBreakdown.sqft * coats) / coverage * 4) / 4; // Round to nearest 0.25
            surfaceBreakdown.gallons = gallons;
            surfaceBreakdown.materialCost = gallons * costPerGallon;
          }
        }

        // Calculate labor cost based on pricing scheme
        const pricingRules = pricingScheme.pricingRules || {};
        const surfaceRule = pricingRules[surface.type.toLowerCase()] || pricingRules.walls || {};

        if (pricingScheme.type === 'sqft_turnkey' || pricingScheme.type === 'sqft_labor_paint') {
          const rate = parseFloat(surfaceRule.price || 0);
          surfaceBreakdown.laborCost = surfaceBreakdown.sqft * rate;
        }

        materialTotal += surfaceBreakdown.materialCost;
        laborTotal += surfaceBreakdown.laborCost;

        areaBreakdown.surfaces.push(surfaceBreakdown);
      }

      breakdown.push(areaBreakdown);
    }

    const subtotal = laborTotal + materialTotal;
    const total = subtotal;

    res.json({
      success: true,
      calculation: {
        laborTotal: parseFloat(laborTotal.toFixed(2)),
        materialTotal: parseFloat(materialTotal.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        breakdown,
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

    await transaction.commit();

    // TODO: Send email notification

    res.json({
      success: true,
      message: 'Quote sent successfully',
      quote,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Send quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send quote',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
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
