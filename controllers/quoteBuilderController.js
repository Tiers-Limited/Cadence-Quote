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
 * Calculate quote totals with comprehensive pricing engine
 * POST /api/quote-builder/calculate
 */
exports.calculateQuote = async (req, res) => {
  try {
    const { areas, productSets, pricingSchemeId, jobType, serviceArea } = req.body;
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

    const markup = settings?.defaultMarkupPercentage || 30;
    const taxRate = settings?.taxRatePercentage || 0;

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

          // Calculate material cost if gallons are provided
          if (item.gallons && item.gallons > 0) {
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
          }

          // Accumulate totals
          laborTotal += itemBreakdown.laborCost;
          materialTotal += itemBreakdown.materialCost;

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
          let coats = 2;
          let coverage = 350;

          if (productSet) {
            // Determine which tier product to use
            const tierProduct = productSet.good || productSet.better || productSet.best || productSet.single;
            
            if (tierProduct) {
              product = tierProduct;
              pricePerGallon = parseFloat(tierProduct.price_per_gallon || tierProduct.cost_per_gallon || 35);
              coats = parseInt(tierProduct.default_coats || 2);
              coverage = parseInt(tierProduct.coverage_sqft_per_gal || 350);
            }
          }

        // Calculate material cost
        const wasteFactor = 1.10; // 10% waste
        const gallons = Math.ceil((sqft * coats / coverage * wasteFactor) * 4) / 4; // Round to nearest 0.25
        surfaceBreakdown.gallons = gallons;
        surfaceBreakdown.materialCost = gallons * pricePerGallon;

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

    const overhead = travelCost + cleanupCost;

    // Subtotal before markup
    const subtotalBeforeMarkup = laborTotal + materialTotal + prepTotal + addOnsTotal + overhead;

    // Apply markup
    const markupAmount = (materialTotal + prepTotal) * (markup / 100);

    // Subtotal after markup
    const subtotal = subtotalBeforeMarkup + markupAmount;

    // Calculate tax (typically only on materials)
    const taxableAmount = materialTotal + markupAmount;
    const taxAmount = taxableAmount * (taxRate / 100);

    // Final total
    const total = subtotal + taxAmount;

    res.json({
      success: true,
      calculation: {
        laborTotal: parseFloat(laborTotal.toFixed(2)),
        materialTotal: parseFloat(materialTotal.toFixed(2)),
        prepTotal: parseFloat(prepTotal.toFixed(2)),
        addOnsTotal: parseFloat(addOnsTotal.toFixed(2)),
        overhead: parseFloat(overhead.toFixed(2)),
        subtotalBeforeMarkup: parseFloat(subtotalBeforeMarkup.toFixed(2)),
        markupAmount: parseFloat(markupAmount.toFixed(2)),
        markupPercent: parseFloat(markup),
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        taxRate: parseFloat(taxRate),
        total: parseFloat(total.toFixed(2)),
        breakdown,
        travelCost: parseFloat(travelCost.toFixed(2)),
        cleanupCost: parseFloat(cleanupCost.toFixed(2))
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
