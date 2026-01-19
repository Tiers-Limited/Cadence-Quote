// controllers/quoteController.js
// Professional Quote Builder APIs - Optimized for performance and data efficiency

const { ProductConfig, GlobalProduct, GlobalColor, Brand, PricingScheme, ContractorSettings, Quote, User, Client } = require('../models');
const { Op } = require('sequelize');
const { getFormFields, calculateSurfaceArea, validateDimensions } = require('../utils/surfaceDimensions');

/**
 * GET /api/quotes/products/minimal
 * Returns comprehensive product data for quote builder (pagination supported)
 * Includes: id, name, brand, category, tier, available sheens, price range
 */
exports.getMinimalProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, jobType, search, tier } = req.query;
    const offset = (page - 1) * limit;
    const tenantId = req.user.tenantId;

    const where = {
      tenantId,
      isActive: true
    };

    // Build filter conditions
    const productWhere = {
      isActive: true
    };

    if (jobType) {
      productWhere.category = jobType === 'interior' ? 'Interior' : 'Exterior';
    }

    if (search) {
      productWhere.name = {
        [Op.iLike]: `%${search}%`
      };
    }

    if (tier && ['Good', 'Better', 'Best'].includes(tier)) {
      productWhere.tier = tier;
    }

    const { count, rows } = await ProductConfig.findAndCountAll({
      where,
      include: [{
        model: GlobalProduct,
        as: 'globalProduct',
        where: productWhere,
        attributes: ['id', 'name', 'category', 'tier', 'sheenOptions', 'notes'],
        include: [{
          model: Brand,
          as: 'brand',
          attributes: ['id', 'name']
        }]
      }],
      attributes: ['id', 'globalProductId', 'sheens', 'laborRates', 'defaultMarkup', 'productMarkups', 'taxRate'],
      limit: parseInt(limit),
      offset,
      order: [
        [{ model: GlobalProduct, as: 'globalProduct' }, 'tier', 'ASC'],
        [{ model: GlobalProduct, as: 'globalProduct' }, 'name', 'ASC']
      ]
    });

    return res.json({
      success: true,
      data: rows.map(config => {
        const product = config.globalProduct;
        const sheens = config.sheens || [];
        
        // Calculate price range from sheens
        const prices = sheens.map(s => parseFloat(s.price));
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        
        // Get specific markup for this product or use default
        const productMarkup = config.productMarkups && config.productMarkups[config.globalProductId]
          ? parseFloat(config.productMarkups[config.globalProductId])
          : parseFloat(config.defaultMarkup);

        return {
          id: config.id,
          globalProductId: config.globalProductId,
          name: product.name,
          category: product.category,
          tier: product.tier,
          brand: {
            id: product.brand.id,
            name: product.brand.name
          },
          sheenOptions: product.sheenOptions,
          availableSheens: sheens,
          priceRange: {
            min: minPrice,
            max: maxPrice,
            currency: 'USD'
          },
          coverage: sheens.length > 0 ? sheens[0].coverage : 350,
          markup: productMarkup,
          taxRate: parseFloat(config.taxRate),
          notes: product.notes,
          
          // Include labor rates summary for quick reference
          laborRates: {
            interior: config.laborRates?.interior || [],
            exterior: config.laborRates?.exterior || []
          }
        };
      }),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      },
      meta: {
        jobType: jobType || 'all',
        tier: tier || 'all',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

/**
 * GET /api/quotes/products/:id/details
 * Returns complete product details for selected product
 * Includes: sheens with pricing, labor rates, markup, tax
 */
exports.getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const config = await ProductConfig.findOne({
      where: {
        id,
        tenantId,
        isActive: true
      },
      include: [{
        model: GlobalProduct,
        as: 'globalProduct',
        attributes: ['id', 'name', 'category', 'tier', 'sheenOptions'],
        include: [{
          model: Brand,
          as: 'brand',
          attributes: ['id', 'name']
        }]
      }],
      attributes: ['id', 'sheens', 'laborRates', 'defaultMarkup', 'taxRate']
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Product configuration not found'
      });
    }

    return res.json({
      success: true,
      data: {
        id: config.id,
        globalProductId: config.globalProductId,
        product: {
          id: config.globalProduct.id,
          name: config.globalProduct.name,
          category: config.globalProduct.category,
          tier: config.globalProduct.tier,
          brand: config.globalProduct.brand
        },
        sheens: config.sheens.map(s => ({
          sheen: s.sheen,
          price: parseFloat(s.price),
          coverage: parseFloat(s.coverage),
          unit: 'gallon'
        })),
        laborRates: {
          interior: (config.laborRates?.interior || []).map(r => ({
            category: r.category,
            rate: parseFloat(r.rate),
            unit: r.unit || 'sq ft'
          })),
          exterior: (config.laborRates?.exterior || []).map(r => ({
            category: r.category,
            rate: parseFloat(r.rate),
            unit: r.unit || 'sq ft'
          }))
        },
        markup: config.productMarkups && config.productMarkups[config.globalProductId]
          ? parseFloat(config.productMarkups[config.globalProductId])
          : parseFloat(config.defaultMarkup),
        taxRate: parseFloat(config.taxRate),
        calculationHelpers: {
          averageCoverage: config.sheens.length > 0 
            ? config.sheens.reduce((sum, s) => sum + parseFloat(s.coverage), 0) / config.sheens.length 
            : 350,
          priceRange: {
            min: config.sheens.length > 0 ? Math.min(...config.sheens.map(s => parseFloat(s.price))) : 0,
            max: config.sheens.length > 0 ? Math.max(...config.sheens.map(s => parseFloat(s.price))) : 0
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
};

/**
 * GET /api/quotes/colors/minimal
 * Returns minimal color data for dropdowns (pagination supported)
 * Only includes: id, name, code, hex, brandId
 */
exports.getMinimalColors = async (req, res) => {
  try {
    const { page = 1, limit = 50, brandId, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      isActive: true
    };

    if (brandId) {
      where.brandId = brandId;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await GlobalColor.findAndCountAll({
      where,
      attributes: ['id', 'name', 'code', 'hexValue', 'brandId'],
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']]
    });

    return res.json({
      success: true,
      data: rows.map(color => ({
        id: color.id,
        name: color.name,
        code: color.code,
        hexValue: color.hexValue,
        brandId: color.brandId
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching minimal colors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch colors',
      error: error.message
    });
  }
};

/**
 * GET /api/quotes/pricing-schemes
 * Returns active pricing schemes for contractor
 */
exports.getPricingSchemes = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const schemes = await PricingScheme.findAll({
      where: {
        tenantId,
        isActive: true
      },
      attributes: ['id', 'name', 'type', 'description', 'isDefault', 'pricingRules'],
      order: [['isDefault', 'DESC'], ['name', 'ASC']]
    });

    return res.json({
      success: true,
      data: schemes
    });
  } catch (error) {
    console.error('Error fetching pricing schemes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing schemes',
      error: error.message
    });
  }
};

/**
 * GET /api/quotes/surface-dimensions/:surfaceType
 * Returns dimension configuration for a specific surface type
 * Helps frontend know which dimension fields to show
 */
exports.getSurfaceDimensions = async (req, res) => {
  try {
    const { surfaceType } = req.params;
    
    if (!surfaceType) {
      return res.status(400).json({
        success: false,
        message: 'Surface type is required'
      });
    }

    const config = getFormFields(surfaceType);
    
    return res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching surface dimensions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch surface dimension configuration',
      error: error.message
    });
  }
};

/**
 * GET /api/quotes/contractor-settings
 * Returns contractor settings (markup, tax, etc.)
 */
exports.getContractorSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const settings = await ContractorSettings.findOne({
      where: { tenantId },
      attributes: [
        'defaultMarkupPercentage',
        'taxRatePercentage',
        'depositPercentage',
        'paymentTerms',
        'warrantyTerms',
        'generalTerms',
        'businessHours',
        'quoteValidityDays'
      ]
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Contractor settings not found'
      });
    }

    return res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching contractor settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contractor settings',
      error: error.message
    });
  }
};

/**
 * POST /api/quotes/calculate
 * Calculate quote based on selected products, areas, and pricing scheme
 */
exports.calculateQuote = async (req, res) => {
  try {
    const { areas, pricingSchemeId, applyZipMarkup, zipMarkupPercent } = req.body;
    const tenantId = req.user.tenantId;

    // Validate input
    if (!areas || !Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Areas array is required'
      });
    }

    if (!pricingSchemeId) {
      return res.status(400).json({
        success: false,
        message: 'Pricing scheme ID is required'
      });
    }

    // Fetch pricing scheme
    const pricingScheme = await PricingScheme.findOne({
      where: {
        id: pricingSchemeId,
        tenantId,
        isActive: true
      }
    });

    if (!pricingScheme) {
      return res.status(404).json({
        success: false,
        message: 'Pricing scheme not found'
      });
    }

    // Fetch contractor settings for default markup/tax
    const settings = await ContractorSettings.findOne({
      where: { tenantId }
    });

    const defaultMarkup = settings ? parseFloat(settings.defaultMarkupPercentage) : 15;
    const defaultTax = settings ? parseFloat(settings.taxRatePercentage) : 0;

    // Calculate costs for each surface
    let totalLaborCost = 0;
    let totalMaterialCost = 0;
    const areaBreakdown = [];

    for (const area of areas) {
      const areaData = {
        areaId: area.id,
        areaName: area.name,
        surfaces: []
      };

      for (const surface of area.surfaces) {
        if (!surface.selected || !surface.selectedProduct || !surface.selectedSheen) {
          continue;
        }

        // Fetch product config
        const config = await ProductConfig.findOne({
          where: {
            id: surface.selectedProduct,
            tenantId,
            isActive: true
          }
        });

        if (!config) {
          continue;
        }

        // Find selected sheen pricing
        const selectedSheen = config.sheens.find(s => s.sheen === surface.selectedSheen);
        if (!selectedSheen) {
          continue;
        }

        const sqft = parseFloat(surface.sqft) || 0;
        const laborRate = getLaborRate(config.laborRates, surface.type, area.jobType);
        const markup = parseFloat(config.defaultMarkup) || defaultMarkup;
        const taxRate = parseFloat(config.taxRate) || defaultTax;

        // Calculate based on pricing scheme type
        const costs = calculateSurfaceCost({
          sqft,
          laborRate,
          sheenPrice: selectedSheen.price,
          sheenCoverage: selectedSheen.coverage,
          pricingScheme,
          surfaceType: surface.type
        });

        totalLaborCost += costs.laborCost;
        totalMaterialCost += costs.materialCost;

        areaData.surfaces.push({
          surfaceType: surface.type,
          sqft,
          sheen: surface.selectedSheen,
          laborCost: costs.laborCost,
          materialCost: costs.materialCost,
          subtotal: costs.total
        });
      }

      if (areaData.surfaces.length > 0) {
        areaBreakdown.push(areaData);
      }
    }

    // Calculate totals
    const subtotal = totalLaborCost + totalMaterialCost;
    const markup = subtotal * (defaultMarkup / 100);
    const zipMarkup = (applyZipMarkup && zipMarkupPercent) 
      ? (subtotal + markup) * (zipMarkupPercent / 100) 
      : 0;
    const subtotalWithMarkups = subtotal + markup + zipMarkup;
    const tax = subtotalWithMarkups * (defaultTax / 100);
    const total = subtotalWithMarkups + tax;

    return res.json({
      success: true,
      data: {
        breakdown: areaBreakdown,
        summary: {
          laborTotal: totalLaborCost,
          materialTotal: totalMaterialCost,
          subtotal,
          markup,
          markupPercent: defaultMarkup,
          zipMarkup,
          zipMarkupPercent: zipMarkupPercent || 0,
          tax,
          taxPercent: defaultTax,
          total
        },
        pricingScheme: {
          id: pricingScheme.id,
          name: pricingScheme.name,
          type: pricingScheme.type
        }
      }
    });
  } catch (error) {
    console.error('Error calculating quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate quote',
      error: error.message
    });
  }
};

// Helper function to get labor rate for surface type
function getLaborRate(laborRates, surfaceType, jobType = 'interior') {
  const rates = jobType === 'interior' ? laborRates.interior : laborRates.exterior;
  if (!rates || rates.length === 0) return 0;

  const surfaceLower = surfaceType.toLowerCase();
  let category = 'Walls';
  
  if (surfaceLower.includes('ceiling')) category = 'Ceilings';
  else if (surfaceLower.includes('trim') || surfaceLower.includes('door') || surfaceLower.includes('window')) category = 'Trim';
  else if (surfaceLower.includes('cabinet')) category = 'Cabinets';

  const rateEntry = rates.find(r => r.category === category);
  return rateEntry ? parseFloat(rateEntry.rate) : (rates[0] ? parseFloat(rates[0].rate) : 0);
}

// Helper function to calculate surface cost based on pricing scheme
function calculateSurfaceCost({ sqft, laborRate, sheenPrice, sheenCoverage, pricingScheme, surfaceType }) {
  const rules = pricingScheme.pricingRules || {};

  switch (pricingScheme.type) {
    case 'sqft_turnkey': {
      // All-inclusive rate per sqft
      const surfaceKey = surfaceType.toLowerCase().includes('wall') ? 'walls' :
                        surfaceType.toLowerCase().includes('ceiling') ? 'ceilings' :
                        surfaceType.toLowerCase().includes('trim') ? 'trim' : 'walls';
      const ratePerSqFt = rules[surfaceKey]?.price || 2;
      const total = sqft * ratePerSqFt;
      return {
        laborCost: total * 0.6,
        materialCost: total * 0.4,
        total
      };
    }

    case 'sqft_labor_paint': {
      // Separated labor and paint costs
      const laborCost = sqft * (laborRate || rules.labor_rate?.price || 0.55);
      const gallonsNeeded = sqft / (sheenCoverage || 350);
      const materialCost = gallonsNeeded * (sheenPrice || 0);
      return {
        laborCost,
        materialCost,
        total: laborCost + materialCost
      };
    }

    case 'hourly_time_materials': {
      // Hourly rate with material markup
      const hourlyRate = rules.hourly_rate?.price || 50;
      const estimatedHours = sqft / 100; // Estimate: 100 sqft per hour
      const laborCost = estimatedHours * hourlyRate;
      const gallonsNeeded = sqft / (sheenCoverage || 350);
      const materialBase = gallonsNeeded * (sheenPrice || 0);
      const materialMarkup = rules.material_markup?.value || 20;
      const materialCost = materialBase * (1 + materialMarkup / 100);
      return {
        laborCost,
        materialCost,
        total: laborCost + materialCost
      };
    }

    case 'unit_pricing': {
      // Unit-based pricing
      const unitType = surfaceType.toLowerCase().includes('door') ? 'door' :
                      surfaceType.toLowerCase().includes('window') ? 'window' :
                      surfaceType.toLowerCase().includes('trim') ? 'trim' : 'sqft';
      const unitRate = rules[unitType]?.price || laborRate || 5;
      const total = sqft * unitRate;
      return {
        laborCost: total * 0.7,
        materialCost: total * 0.3,
        total
      };
    }

    case 'room_flat_rate': {
      // Flat rate per room (proportional to surface)
      const flatRate = rules['medium_room']?.price || 500;
      const total = flatRate * 0.2; // Assume surface is ~20% of room cost
      return {
        laborCost: total * 0.65,
        materialCost: total * 0.35,
        total
      };
    }

    default:
      return { laborCost: 0, materialCost: 0, total: 0 };
  }
}

/**
 * POST /api/v1/quotes/save
 * Save/Create a new quote
 */
exports.saveQuote = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      propertyAddress,
      zipCode,
      jobType,
      jobCategory,
      areas,
      pricingSchemeId,
      notes,
      clientNotes,
      breakdown,
      summary,
      status = 'draft'
    } = req.body;

    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    // Generate quote number
    const quoteNumber = await Quote.generateQuoteNumber(tenantId);

    // Calculate totals from summary
    const {
      laborTotal = 0,
      materialTotal = 0,
      subtotal = 0,
      markup = 0,
      markupPercent = 0,
      zipMarkup = 0,
      zipMarkupPercent = 0,
      tax = 0,
      taxPercent = 0,
      total = 0
    } = summary || {};

    // Calculate total square footage
    let totalSqft = 0;
    if (areas && Array.isArray(areas)) {
      areas.forEach(area => {
        area.surfaces?.forEach(surface => {
          if (surface.selected && surface.sqft) {
            totalSqft += parseFloat(surface.sqft);
          }
        });
      });
    }

    // Set quote validity (default 30 days from now)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const quote = await Quote.create({
      quoteNumber,
      tenantId,
      userId,
      pricingSchemeId,
      customerName,
      customerEmail,
      customerPhone,
      // Map legacy propertyAddress to street if provided
      street: propertyAddress || null,
      city: null,
      state: null,
      zipCode,
      jobType,
      jobCategory,
      areas,
      subtotal,
      laborTotal,
      materialTotal,
      markup,
      markupPercent,
      zipMarkup,
      zipMarkupPercent,
      tax,
      taxPercent,
      total,
      totalSqft,
      status,
      notes,
      clientNotes,
      breakdown,
      validUntil,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Quote created successfully',
      data: quote
    });
  } catch (error) {
    console.error('Error saving quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save quote',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/quotes
 * Get all quotes for contractor with filters
 */
exports.getQuotes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      jobType,
      jobCategory,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const tenantId = req.user.tenantId;

    const where = {
      tenantId,
      isActive: true,
      status: { [Op.notIn]: ['accepted', 'deposit_paid'] } // Exclude accepted and deposit_paid quotes - they should appear in Jobs section
    };

    // Apply filters
    if (status && status !== 'all') {
      // If filtering by specific status, override the exclusion
      where.status = status;
    }

    if (jobType && jobType !== 'all') {
      where.jobType = jobType;
    }

    if (jobCategory && jobCategory !== 'all') {
      where.jobCategory = jobCategory;
    }

    if (search) {
      where[Op.or] = [
        { quoteNumber: { [Op.iLike]: `%${search}%` } },
        { customerName: { [Op.iLike]: `%${search}%` } },
        { customerEmail: { [Op.iLike]: `%${search}%` } },
        { customerPhone: { [Op.iLike]: `%${search}%` } },
        { street: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
        { zipCode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (dateFrom) {
      where.createdAt = { [Op.gte]: new Date(dateFrom) };
    }

    if (dateTo) {
      where.createdAt = { ...where.createdAt, [Op.lte]: new Date(dateTo) };
    }

    const { count, rows } = await Quote.findAndCountAll({
      where,
      attributes: { exclude: ['useContractorDiscount', 'bookingRequest'] },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email']
        },
        {
          model: PricingScheme,
          as: 'pricingScheme',
          attributes: ['id', 'name', 'type']
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone', 'hasPortalAccess', 'portalInvitedAt', 'portalActivatedAt'],
          required: false
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]]
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch quotes',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/quotes/:id
 * Get single quote by ID
 */
exports.getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const quote = await Quote.findOne({
      where: {
        id,
        tenantId,
        isActive: true
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email']
        },
        {
          model: PricingScheme,
          as: 'pricingScheme',
          attributes: ['id', 'name', 'type', 'description', 'pricingRules']
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone', 'hasPortalAccess', 'portalInvitedAt', 'portalActivatedAt'],
          required: false
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    return res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch quote',
      error: error.message
    });
  }
};

/**
 * PUT /api/v1/quotes/:id
 * Update existing quote
 */
exports.updateQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const updateData = req.body;

    const quote = await Quote.findOne({
      where: {
        id,
        tenantId,
        isActive: true
      }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Update quote
    await quote.update(updateData);

    return res.json({
      success: true,
      message: 'Quote updated successfully',
      data: quote
    });
  } catch (error) {
    console.error('Error updating quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update quote',
      error: error.message
    });
  }
};

/**
 * PUT /api/v1/quotes/:id/status
 * Update quote status (send, approve, decline, archive)
 */
exports.updateQuoteStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const quote = await Quote.findOne({
      where: {
        id,
        tenantId,
        isActive: true
      },
      include: [
        {
          model: PricingScheme,
          as: 'pricingScheme'
        }
      ]
    });

    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    const oldStatus = quote.status;
    const emailService = require('../services/emailService');
    const User = require('../models/User');
    const ContractorSettings = require('../models/ContractorSettings');
    
    // Get contractor info for emails
    const contractor = await User.findByPk(userId, {
      include: [{ model: ContractorSettings, as: 'contractorSettings' }]
    });

    // Update status using instance methods and send notifications
    switch (status) {
      case 'draft':
        quote.status = 'draft';
        await quote.save({ transaction });
        break;
        
      case 'sent':
        await quote.markAsSent({ transaction });
        
        // Send quote email to customer
        try {
          const calculation = await calculateQuoteData(quote);
          await emailService.sendQuoteToCustomer({
            to: quote.customerEmail,
            customerName: quote.customerName,
            quote: quote.toJSON(),
            calculation,
            contractor: {
              name: contractor.fullName,
              email: contractor.email,
              phone: contractor.contractorSettings?.phone,
              companyName: contractor.contractorSettings?.businessName || 'Our Painting Team'
            },
            quoteViewUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/quote/${quote.id}`
          });
        } catch (emailError) {
          console.error('Error sending quote email:', emailError);
        }
        break;
        
      case 'accepted':
        await quote.approve({ transaction });
        quote.status = 'accepted';
        quote.acceptedAt = new Date();
        await quote.save({ transaction });
        
        // Send acceptance confirmation to customer
        try {
          await emailService.sendEmail({
            to: quote.customerEmail,
            subject: `Quote Accepted - ${quote.quoteNumber}`,
            html: getStatusChangeEmailTemplate({
              customerName: quote.customerName,
              quoteNumber: quote.quoteNumber,
              status: 'accepted',
              message: 'Thank you for accepting our quote! We\'ll be in touch shortly to schedule your project.',
              contractor
            })
          });
        } catch (emailError) {
          console.error('Error sending acceptance email:', emailError);
        }
        break;
        
      case 'scheduled':
        quote.status = 'scheduled';
        await quote.save({ transaction });
        
        // Send scheduling confirmation
        try {
          await emailService.sendEmail({
            to: quote.customerEmail,
            subject: `Project Scheduled - ${quote.quoteNumber}`,
            html: getStatusChangeEmailTemplate({
              customerName: quote.customerName,
              quoteNumber: quote.quoteNumber,
              status: 'scheduled',
              message: 'Great news! Your painting project has been scheduled. We\'ll send you the details shortly.',
              contractor
            })
          });
        } catch (emailError) {
          console.error('Error sending scheduling email:', emailError);
        }
        break;
        
      case 'declined':
        await quote.decline({ transaction });
        quote.status = 'declined';
        await quote.save({ transaction });
        
        // Send decline acknowledgment
        try {
          await emailService.sendEmail({
            to: quote.customerEmail,
            subject: `Quote Status Update - ${quote.quoteNumber}`,
            html: getStatusChangeEmailTemplate({
              customerName: quote.customerName,
              quoteNumber: quote.quoteNumber,
              status: 'declined',
              message: 'We appreciate you considering us for your project. If you change your mind or need any adjustments, please don\'t hesitate to reach out.',
              contractor
            })
          });
        } catch (emailError) {
          console.error('Error sending decline email:', emailError);
        }
        break;
        
      case 'archived':
        await quote.archive({ transaction });
        break;
        
      default:
        quote.status = status;
        await quote.save({ transaction });
    }

    // Create audit log
    await createAuditLog({
      userId,
      tenantId,
      action: 'quote_status_updated',
      category: 'quote',
      resourceType: 'quote',
      resourceId: quote.id,
      details: {
        oldStatus,
        newStatus: status,
        quoteNumber: quote.quoteNumber
      },
      req
    });

    await transaction.commit();

    return res.json({
      success: true,
      message: `Quote ${status} successfully`,
      data: quote
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating quote status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update quote status',
      error: error.message
    });
  }
};

// Helper function for status change email template
function getStatusChangeEmailTemplate({ customerName, quoteNumber, status, message, contractor }) {
  const statusColors = {
    accepted: '#10b981',
    scheduled: '#8b5cf6',
    declined: '#ef4444'
  };
  
  const statusIcons = {
    accepted: '✅',
    scheduled: '📅',
    declined: '❌'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: ${statusColors[status] || '#3b82f6'}; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">${statusIcons[status]} Quote ${status.charAt(0).toUpperCase() + status.slice(1)}</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Quote #${quoteNumber}</p>
        </div>
        
        <div style="padding: 30px;">
          <h2 style="color: #1f2937; margin: 0 0 16px 0;">Hi ${customerName},</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            ${message}
          </p>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Quote Number:</strong> ${quoteNumber}</p>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}</p>
          </div>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">Questions? Contact us:</p>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">
            📧 ${contractor.email}
            ${contractor.contractorSettings?.phone ? `<br>📱 ${contractor.contractorSettings.phone}` : ''}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to calculate quote data
async function calculateQuoteData(quote) {
  const { areas, productSets } = quote;
  let laborTotal = 0;
  let materialTotal = 0;

  for (const area of areas || []) {
    if (area.laborItems) {
      for (const item of area.laborItems || []) {
        if (!item.selected) continue;
        const quantity = parseFloat(item.quantity) || 0;
        if (!quantity) continue;
        
        laborTotal += quantity * (parseFloat(item.laborRate) || 0);
        materialTotal += (item.gallons || 0) * 35;
      }
    }
  }

  const total = laborTotal + materialTotal;
  
  return {
    laborTotal: parseFloat(laborTotal.toFixed(2)),
    materialTotal: parseFloat(materialTotal.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    breakdown: []
  };
}

/**
 * DELETE /api/v1/quotes/:id
 * Soft delete quote (set isActive to false)
 */
exports.deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const quote = await Quote.findOne({
      where: {
        id,
        tenantId,
        isActive: true
      }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    await quote.update({ isActive: false });

    return res.json({
      success: true,
      message: 'Quote deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete quote',
      error: error.message
    });
  }
};

/**
 * POST /api/v1/quotes/:id/duplicate
 * Duplicate an existing quote
 */
exports.duplicateQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const originalQuote = await Quote.findOne({
      where: {
        id,
        tenantId,
        isActive: true
      }
    });

    if (!originalQuote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Generate new quote number
    const quoteNumber = await Quote.generateQuoteNumber(tenantId);

    // Create duplicate with new quote number
    const duplicateData = {
      ...originalQuote.toJSON(),
      id: undefined,
      quoteNumber,
      userId,
      status: 'draft',
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newQuote = await Quote.create(duplicateData);

    return res.status(201).json({
      success: true,
      message: 'Quote duplicated successfully',
      data: newQuote
    });
  } catch (error) {
    console.error('Error duplicating quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to duplicate quote',
      error: error.message
    });
  }
};

module.exports = exports;
