// controllers/productConfigController.js
// NEW FEATURE: Controller for contractor product configurations
// Handles CRUD operations for tenant-specific product pricing and labor rates

const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');
const ContractorSettings = require('../models/ContractorSettings');
const CacheManager = require('../optimization/cache/CacheManager');
const { DEFAULT_LABOR_RATES } = require('../utils/laborDefaults');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Initialize cache manager
const cache = new CacheManager();
cache.initialize();

/**
 * Get all product configurations for the authenticated contractor
 * GET /api/v1/contractor/product-configs
 * Query params: brandId, search, page, limit, sortBy, sortOrder
 */
const getAllProductConfigs = async (req, res) => {
  try {
    // Support both contractor auth (req.user) and customer session auth (req.customerTenantId)
    const tenantId = req.user?.tenantId || req.customerTenantId;
    
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant ID not found in request'
      });
    }
    
    const {
      brandId,
      jobType,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    // Create cache key based on all parameters
    const cacheKey = `product-configs:tenant:${tenantId}:${JSON.stringify({ brandId, jobType, search, page, limit, sortBy, sortOrder })}`;
    
    // Use cache wrapper for the query
    const result = await cache.cacheQuery(
      cacheKey,
      async () => {
        // Build where clause
        const where = {
          tenantId,
          isActive: true,
        };
        console.log('🔍 Fetching product configs with filters:', { brandId, jobType, search, page, limit, sortBy, sortOrder });
        
        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        // Build include configuration with optimized attributes
        // NOTE: not required because we support contractor-created custom products without a globalProduct
        const globalProductInclude = {
          model: GlobalProduct,
          as: 'globalProduct',
          required: false, // Keep this false so custom products without globalProduct are included
          attributes: ['id', 'name', 'category', 'brandId'], // Only select needed fields
          include: [
            {
              model: Brand,
              as: 'brand',
              attributes: ['id', 'name'],
            },
          ],
        };

        // If we have filters, we need to apply them differently to support both custom and global products
        // We'll fetch all configs first, then filter in memory to support custom products
        let configs;
        let count;

        if (brandId || jobType || search) {
          // Fetch all configs for this tenant (we'll filter in memory)
          const allConfigs = await ProductConfig.findAll({
            where,
            attributes: ['id', 'tenantId', 'userId', 'globalProductId', 'isCustom', 'customProduct', 'sheens', 'isActive', 'createdAt', 'updatedAt'],
            include: [globalProductInclude],
            order: [[sortBy, sortOrder.toUpperCase()]],
          });

          // Filter configs based on criteria (supports both custom and global products)
          let filteredConfigs = allConfigs.filter(config => {
            // For custom products, check customProduct fields
            if (config.isCustom && config.customProduct) {
              let matches = true;

              // Brand filter
              if (brandId && config.customProduct.brandName) {
                const brandMatch = config.customProduct.brandName.toLowerCase().includes(brandId.toString().toLowerCase());
                if (!brandMatch) matches = false;
              } else if (brandId && !config.customProduct.brandName) {
                matches = false;
              }

              // Category/jobType filter
              if (jobType && config.customProduct.category) {
                const targetCategory = jobType.toLowerCase() === 'interior' ? 'Interior' : 'Exterior';
                if (config.customProduct.category !== targetCategory) matches = false;
              } else if (jobType && !config.customProduct.category) {
                matches = false;
              }

              // Search filter
              if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = config.customProduct.name?.toLowerCase().includes(searchLower);
                const brandMatch = config.customProduct.brandName?.toLowerCase().includes(searchLower);
                const descMatch = config.customProduct.description?.toLowerCase().includes(searchLower);
                
                if (!nameMatch && !brandMatch && !descMatch) matches = false;
              }

              return matches;
            }

            // For global products, check globalProduct fields
            if (!config.isCustom && config.globalProduct) {
              let matches = true;

              // Brand filter
              if (brandId && config.globalProduct.brandId !== parseInt(brandId)) {
                matches = false;
              }

              // Category/jobType filter
              if (jobType) {
                const targetCategory = jobType.toLowerCase() === 'interior' ? 'Interior' : 'Exterior';
                if (config.globalProduct.category !== targetCategory) matches = false;
              }

              // Search filter
              if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = config.globalProduct.name?.toLowerCase().includes(searchLower);
                const brandMatch = config.globalProduct.brand?.name?.toLowerCase().includes(searchLower);
                
                if (!nameMatch && !brandMatch) matches = false;
              }

              return matches;
            }

            // If neither custom nor has globalProduct, exclude
            return false;
          });

          count = filteredConfigs.length;
          
          // Apply pagination
          configs = filteredConfigs.slice(offset, offset + limitNum);
        } else {
          // No filters, use standard query
          [count, configs] = await Promise.all([
            ProductConfig.count({
              where,
            }),
            ProductConfig.findAll({
              where,
              attributes: ['id', 'tenantId', 'userId', 'globalProductId', 'isCustom', 'customProduct', 'sheens', 'isActive', 'createdAt', 'updatedAt'],
              include: [globalProductInclude],
              limit: limitNum,
              offset,
              order: [[sortBy, sortOrder.toUpperCase()]],
            }),
          ]);
        }

        return {
          success: true,
          data: configs,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        };
      },
      300, // 5 minutes TTL
      ['product-configs', `tenant:${tenantId}`] // Cache tags for invalidation
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Get all product configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product configurations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get a single product configuration by ID
 * GET /api/v1/contractor/product-configs/:id
 */
const getProductConfigById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const config = await ProductConfig.findOne({
      where: {
        id,
        tenantId,
        isActive: true,
      },
      attributes: ['id', 'tenantId', 'userId', 'globalProductId', 'isCustom', 'customProduct', 'sheens', 'isActive', 'createdAt', 'updatedAt'],
      include: [
        {
          model: GlobalProduct,
          as: 'globalProduct',
          required: false,
          include: [
            {
              model: Brand,
              as: 'brand',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Product configuration not found',
      });
    }

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get product config by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create a new product configuration
 * POST /api/v1/contractor/product-configs
 */
const createProductConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const {
      globalProductId,
      sheens,
      isCustom,
      customProduct,
    } = req.body;
    console.log('🆕 Creating product config with data:', req.body);
    // Validation: either a globalProductId OR a customProduct payload must be provided
    if (!globalProductId && !customProduct) {
      return res.status(400).json({
        success: false,
        message: 'Provide either a globalProductId or a customProduct payload',
      });
    }

    if (!sheens || !Array.isArray(sheens) || sheens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one sheen configuration is required',
      });
    }

    // Validate sheen structure
    for (let i = 0; i < sheens.length; i++) {
      const sheen = sheens[i];
      if (!sheen.sheen || typeof sheen.price !== 'number' || sheen.price < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid sheen configuration at index ${i}`,
        });
      }
      if (typeof sheen.coverage !== 'number' || sheen.coverage <= 0) {
        return res.status(400).json({
          success: false,
          message: `Coverage must be a positive number for sheen at index ${i}`,
        });
      }
    }

    let configPayload = {
      tenantId,
      userId,
      sheens,
      isActive: true,
    };

    if (customProduct) {
      // Validate basic customProduct shape
      if (!customProduct.name || typeof customProduct.name !== 'string') {
        return res.status(400).json({ success: false, message: 'Custom product must include a name' });
      }

      configPayload.isCustom = true;
      configPayload.customProduct = customProduct;
      // Do not include globalProductId when creating a custom product

      // Note: we intentionally do not perform strict JSONB duplicate checks here.
      // Contractors can create custom products with similar names; duplicates can be managed in the UI if needed.
    } else {
      // global product flow
      const globalProduct = await GlobalProduct.findByPk(globalProductId);
      if (!globalProduct) {
        return res.status(404).json({
          success: false,
          message: 'Global product not found',
        });
      }

      // Check for duplicate configuration (tenant + globalProduct)
      const existingConfig = await ProductConfig.findOne({
        where: {
          tenantId,
          globalProductId,
          isActive: true,
        },
      });

      if (existingConfig) {
        return res.status(409).json({
          success: false,
          message: 'A configuration for this product already exists. Please edit the existing configuration.',
        });
      }

      configPayload.globalProductId = globalProductId;
    }

   
    console.log('📝 Creating product config with payload ', configPayload)

    // Create product configuration (no explicit transaction to avoid pool-level aborted-transaction issues)
    const config = await ProductConfig.create(configPayload);
    console.log('✅ Created product config:', config);

    // Invalidate product configs cache for this tenant
    await cache.invalidateByTags(['product-configs', `tenant:${tenantId}`]);

    // Fetch created config with includes (after commit to avoid transaction issues)
    const createdConfig = await ProductConfig.findByPk(config.id, {
      attributes: ['id', 'tenantId', 'userId', 'globalProductId', 'isCustom', 'customProduct', 'sheens', 'isActive', 'createdAt', 'updatedAt'],
      include: [
        {
          model: GlobalProduct,
          as: 'globalProduct',
          include: [
            {
              model: Brand,
              as: 'brand',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Product configuration created successfully',
      data: createdConfig,
    });
  } catch (error) {
    // No explicit transaction to rollback here; just log the error
    console.error('Create product config error:', error);

    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({ field: e.path, message: e.message })),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create product configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update an existing product configuration
 * PUT /api/v1/contractor/product-configs/:id
 */
const updateProductConfig = async (req, res) => {
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const {
      sheens,
      laborRates,
      defaultMarkup,
      productMarkups,
      taxRate,
      isCustom,
      customProduct,
    } = req.body;

    // Find config (outside transaction to avoid locks)
    const config = await ProductConfig.findOne({
      where: {
        id,
        tenantId,
        isActive: true,
      },
    });

    if (!config) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Product configuration not found',
      });
    }

    // Validate sheens if provided
    if (sheens) {
      if (!Array.isArray(sheens) || sheens.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'At least one sheen configuration is required',
        });
      }

      for (let i = 0; i < sheens.length; i++) {
        const sheen = sheens[i];
        if (!sheen.sheen || typeof sheen.price !== 'number' || sheen.price < 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Invalid sheen configuration at index ${i}`,
          });
        }
        if (typeof sheen.coverage !== 'number' || sheen.coverage <= 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Coverage must be a positive number for sheen at index ${i}`,
          });
        }
      }
    }

    // Update fields (partial update)
    const updates = {};
    if (sheens !== undefined) updates.sheens = sheens;
    if (laborRates !== undefined) updates.laborRates = laborRates;
    if (defaultMarkup !== undefined) updates.defaultMarkup = defaultMarkup;
    if (productMarkups !== undefined) updates.productMarkups = productMarkups;
    if (taxRate !== undefined) updates.taxRate = taxRate;
    // Allow updating custom product data for contractor-created products
    if (customProduct !== undefined && config.isCustom) {
      updates.customProduct = customProduct;
    }

    await config.update(updates, { transaction });

    await transaction.commit();

    // Invalidate product configs cache for this tenant
    await cache.invalidateByTags(['product-configs', `tenant:${tenantId}`]);

    // Fetch updated config with includes (after commit)
    const updatedConfig = await ProductConfig.findByPk(config.id, {
      attributes: ['id', 'tenantId', 'userId', 'globalProductId', 'isCustom', 'customProduct', 'sheens', 'isActive', 'createdAt', 'updatedAt'],
      include: [
        {
          model: GlobalProduct,
          as: 'globalProduct',
          include: [
            {
              model: Brand,
              as: 'brand',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: 'Product configuration updated successfully',
      data: updatedConfig,
    });
  } catch (error) {
    // Safely rollback transaction if it exists and hasn't been committed
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback error:', rollbackError);
      }
    }
    
    console.error('Update product config error:', error);

    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({ field: e.path, message: e.message })),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update product configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Delete a product configuration (soft delete)
 * DELETE /api/v1/contractor/product-configs/:id
 */
const deleteProductConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const config = await ProductConfig.findOne({
      where: {
        id,
        tenantId,
        isActive: true,
      },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Product configuration not found',
      });
    }

    // Soft delete
    await config.update({ isActive: false });

    res.status(200).json({
      success: true,
      message: 'Product configuration deleted successfully',
    });
  } catch (error) {
    console.error('Delete product config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get default labor rates and other defaults
 * GET /api/v1/contractor/product-configs/defaults
 */
/**
 * Get default values for product configurations
 * GET /api/v1/contractor/product-configs/defaults
 */
const getDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Create cache key for this tenant's defaults
    const cacheKey = `product-config-defaults:tenant:${tenantId}`;
    
    // Use cache wrapper for the query
    const result = await cache.cacheQuery(
      cacheKey,
      async () => {
        // Get contractor settings for this tenant
        let settings = await ContractorSettings.findOne({
          where: { tenantId },
          attributes: [
            'productConfigLaborRates', 'productConfigDefaultMarkup', 'productConfigDefaultTaxRate',
            'defaultBillableLaborRate', 'laborMarkupPercent', 'materialMarkupPercent', 'overheadPercent', 'netProfitPercent',
            'depositPercentage', 'quoteValidityDays', 'turnkeyInteriorRate', 'turnkeyExteriorRate',
            'prepRepairHourlyRate', 'finishCabinetHourlyRate', 'productionInteriorWalls', 'productionInteriorCeilings',
            'productionInteriorTrim', 'productionExteriorWalls', 'productionExteriorTrim', 'productionSoffitFascia',
            'productionGutters', 'productionDoors', 'productionCabinets', 'flatRateUnitPrices',
            'includeMaterials', 'coverage', 'applicationMethod', 'coats', 'crewSize'
          ]
        });
        
        // If no settings exist, create default settings
        if (!settings) {
          settings = await ContractorSettings.create({ tenantId });
        }
        
        return {
          success: true,
          data: {
            laborRates: settings.productConfigLaborRates || DEFAULT_LABOR_RATES,
            defaultMarkup: Number(settings.productConfigDefaultMarkup) || 15,
            defaultTaxRate: Number(settings.productConfigDefaultTaxRate) || 0,
            defaultCoverage: 350,
            // Global Pricing & Metrics
            defaultBillableLaborRate: Number(settings.defaultBillableLaborRate) || 0,
            laborMarkupPercent: Number(settings.laborMarkupPercent) || 0,
            materialMarkupPercent: Number(settings.materialMarkupPercent) || 0,
            overheadPercent: Number(settings.overheadPercent) || 0,
            netProfitPercent: Number(settings.netProfitPercent) || 0,
            // Quote Settings
            depositPercentage: Number(settings.depositPercentage) || 50,
            quoteValidityDays: Number(settings.quoteValidityDays) || 30,
            // Turnkey Square Foot Rates
            turnkeyInteriorRate: Number(settings.turnkeyInteriorRate) || 0,
            turnkeyExteriorRate: Number(settings.turnkeyExteriorRate) || 0,
            // Additional Hourly Labor Rates
            prepRepairHourlyRate: Number(settings.prepRepairHourlyRate) || 0,
            finishCabinetHourlyRate: Number(settings.finishCabinetHourlyRate) || 0,
            // Production Rates - Interior
            productionInteriorWalls: Number(settings.productionInteriorWalls) || 0,
            productionInteriorCeilings: Number(settings.productionInteriorCeilings) || 0,
            productionInteriorTrim: Number(settings.productionInteriorTrim) || 0,
            // Production Rates - Exterior
            productionExteriorWalls: Number(settings.productionExteriorWalls) || 0,
            productionExteriorTrim: Number(settings.productionExteriorTrim) || 0,
            productionSoffitFascia: Number(settings.productionSoffitFascia) || 0,
            productionGutters: Number(settings.productionGutters) || 0,
            // Production Rates - Optional
            productionDoors: Number(settings.productionDoors) || 0,
            productionCabinets: Number(settings.productionCabinets) || 0,
            // Flat Rate Unit Prices
            flatRateUnitPrices: {
              // Interior surfaces
              walls: settings.flatRateUnitPrices?.walls || 2.5,
              ceilings: settings.flatRateUnitPrices?.ceilings || 2.0,
              interior_trim: settings.flatRateUnitPrices?.interior_trim || settings.flatRateUnitPrices?.trim || 1.5,
              // Exterior surfaces
              siding: settings.flatRateUnitPrices?.siding || 3.0,
              exterior_trim: settings.flatRateUnitPrices?.exterior_trim || settings.flatRateUnitPrices?.trim || 1.8,
              soffit_fascia: settings.flatRateUnitPrices?.soffit_fascia || 2.0,
              gutters: settings.flatRateUnitPrices?.gutters || 4.0,
              deck: settings.flatRateUnitPrices?.deck || 2.5,
              // Items
              door: settings.flatRateUnitPrices?.door || 85,
              window: settings.flatRateUnitPrices?.window || 75,
              cabinet: settings.flatRateUnitPrices?.cabinet || 125,
              // Rooms
              room_small: settings.flatRateUnitPrices?.room_small || 350,
              room_medium: settings.flatRateUnitPrices?.room_medium || 450,
              room_large: settings.flatRateUnitPrices?.room_large || 600,
            },
            // Material Settings
            includeMaterials: settings.includeMaterials !== undefined ? settings.includeMaterials : true,
            coverage: Number(settings.coverage) || 350,
            applicationMethod: settings.applicationMethod || 'roll',
            coats: Number(settings.coats) || 2,
            // Crew Size
            crewSize: Number(settings.crewSize) || 1,
          },
        };
      },
      600, // 10 minutes TTL (defaults don't change often)
      ['product-config-defaults', `tenant:${tenantId}`] // Cache tags for invalidation
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Get defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch defaults',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update default values for product configurations
 * PUT /api/v1/contractor/product-configs/defaults
 */
const updateDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { 
      laborRates, defaultMarkup, defaultTaxRate, defaultBillableLaborRate, 
      laborMarkupPercent, materialMarkupPercent, overheadPercent, netProfitPercent,
      depositPercentage, quoteValidityDays,
      turnkeyInteriorRate, turnkeyExteriorRate,
      prepRepairHourlyRate, finishCabinetHourlyRate,
      productionInteriorWalls, productionInteriorCeilings, productionInteriorTrim,
      productionExteriorWalls, productionExteriorTrim, productionSoffitFascia, productionGutters,
      productionDoors, productionCabinets,
      flatRateUnitPrices,
      includeMaterials, coverage, applicationMethod, coats, crewSize
    } = req.body;
    
    // Get or create contractor settings
    let settings = await ContractorSettings.findOne({
      where: { tenantId },
    });
    
    if (!settings) {
      settings = await ContractorSettings.create({ tenantId });
    }
    
    // Update fields if provided
    const updates = {};
    if (laborRates !== undefined) {
      updates.productConfigLaborRates = laborRates;
    }
    if (defaultMarkup !== undefined) {
      updates.productConfigDefaultMarkup = defaultMarkup;
    }
    if (defaultTaxRate !== undefined) {
      updates.productConfigDefaultTaxRate = defaultTaxRate;
    }
    if (defaultBillableLaborRate !== undefined) {
      updates.defaultBillableLaborRate = defaultBillableLaborRate;
    }
    if (laborMarkupPercent !== undefined) {
      updates.laborMarkupPercent = laborMarkupPercent;
    }
    if (materialMarkupPercent !== undefined) {
      updates.materialMarkupPercent = materialMarkupPercent;
    }
    if (overheadPercent !== undefined) {
      updates.overheadPercent = overheadPercent;
    }
    if (netProfitPercent !== undefined) {
      updates.netProfitPercent = netProfitPercent;
    }
    // Quote Settings
    if (depositPercentage !== undefined) {
      updates.depositPercentage = depositPercentage;
    }
    if (quoteValidityDays !== undefined) {
      updates.quoteValidityDays = quoteValidityDays;
    }
    // Turnkey Rates
    if (turnkeyInteriorRate !== undefined) {
      updates.turnkeyInteriorRate = turnkeyInteriorRate;
    }
    if (turnkeyExteriorRate !== undefined) {
      updates.turnkeyExteriorRate = turnkeyExteriorRate;
    }
    // Hourly Rates
    if (prepRepairHourlyRate !== undefined) {
      updates.prepRepairHourlyRate = prepRepairHourlyRate;
    }
    if (finishCabinetHourlyRate !== undefined) {
      updates.finishCabinetHourlyRate = finishCabinetHourlyRate;
    }
    // Production Rates - Interior
    if (productionInteriorWalls !== undefined) {
      updates.productionInteriorWalls = productionInteriorWalls;
    }
    if (productionInteriorCeilings !== undefined) {
      updates.productionInteriorCeilings = productionInteriorCeilings;
    }
    if (productionInteriorTrim !== undefined) {
      updates.productionInteriorTrim = productionInteriorTrim;
    }
    // Production Rates - Exterior
    if (productionExteriorWalls !== undefined) {
      updates.productionExteriorWalls = productionExteriorWalls;
    }
    if (productionExteriorTrim !== undefined) {
      updates.productionExteriorTrim = productionExteriorTrim;
    }
    if (productionSoffitFascia !== undefined) {
      updates.productionSoffitFascia = productionSoffitFascia;
    }
    if (productionGutters !== undefined) {
      updates.productionGutters = productionGutters;
    }
    // Production Rates - Optional
    if (productionDoors !== undefined) {
      updates.productionDoors = productionDoors;
    }
    if (productionCabinets !== undefined) {
      updates.productionCabinets = productionCabinets;
    }
    // Flat Rate Unit Prices
    if (flatRateUnitPrices !== undefined) {
      updates.flatRateUnitPrices = flatRateUnitPrices;
    }
    // Material Settings
    if (includeMaterials !== undefined) {
      updates.includeMaterials = includeMaterials;
    }
    if (coverage !== undefined) {
      updates.coverage = coverage;
    }
    if (applicationMethod !== undefined) {
      updates.applicationMethod = applicationMethod;
    }
    if (coats !== undefined) {
      updates.coats = coats;
    }
    // Crew Size
    if (crewSize !== undefined) {
      updates.crewSize = crewSize;
    }
    
    await settings.update(updates);
    
    // Invalidate product config defaults cache for this tenant
    await cache.invalidateByTags(['product-config-defaults', `tenant:${tenantId}`]);
    
    res.status(200).json({
      success: true,
      message: 'Defaults updated successfully',
      data: {
        laborRates: settings.productConfigLaborRates,
        defaultMarkup: Number(settings.productConfigDefaultMarkup),
        defaultTaxRate: Number(settings.productConfigDefaultTaxRate),
        defaultBillableLaborRate: Number(settings.defaultBillableLaborRate) || 0,
        laborMarkupPercent: Number(settings.laborMarkupPercent) || 0,
        materialMarkupPercent: Number(settings.materialMarkupPercent) || 0,
        overheadPercent: Number(settings.overheadPercent) || 0,
        netProfitPercent: Number(settings.netProfitPercent) || 0,
        depositPercentage: Number(settings.depositPercentage) || 50,
        quoteValidityDays: Number(settings.quoteValidityDays) || 30,
        turnkeyInteriorRate: Number(settings.turnkeyInteriorRate) || 0,
        turnkeyExteriorRate: Number(settings.turnkeyExteriorRate) || 0,
        prepRepairHourlyRate: Number(settings.prepRepairHourlyRate) || 0,
        finishCabinetHourlyRate: Number(settings.finishCabinetHourlyRate) || 0,
        productionInteriorWalls: Number(settings.productionInteriorWalls) || 0,
        productionInteriorCeilings: Number(settings.productionInteriorCeilings) || 0,
        productionInteriorTrim: Number(settings.productionInteriorTrim) || 0,
        productionExteriorWalls: Number(settings.productionExteriorWalls) || 0,
        productionExteriorTrim: Number(settings.productionExteriorTrim) || 0,
        productionSoffitFascia: Number(settings.productionSoffitFascia) || 0,
        productionGutters: Number(settings.productionGutters) || 0,
        productionDoors: Number(settings.productionDoors) || 0,
        productionCabinets: Number(settings.productionCabinets) || 0,
        flatRateUnitPrices: {
          // Interior surfaces
          walls: settings.flatRateUnitPrices?.walls || 2.5,
          ceilings: settings.flatRateUnitPrices?.ceilings || 2.0,
          interior_trim: settings.flatRateUnitPrices?.interior_trim || settings.flatRateUnitPrices?.trim || 1.5,
          // Exterior surfaces
          siding: settings.flatRateUnitPrices?.siding || 3.0,
          exterior_trim: settings.flatRateUnitPrices?.exterior_trim || settings.flatRateUnitPrices?.trim || 1.8,
          soffit_fascia: settings.flatRateUnitPrices?.soffit_fascia || 2.0,
          gutters: settings.flatRateUnitPrices?.gutters || 4.0,
          deck: settings.flatRateUnitPrices?.deck || 2.5,
          // Items
          door: settings.flatRateUnitPrices?.door || 85,
          window: settings.flatRateUnitPrices?.window || 75,
          cabinet: settings.flatRateUnitPrices?.cabinet || 125,
          // Rooms
          room_small: settings.flatRateUnitPrices?.room_small || 350,
          room_medium: settings.flatRateUnitPrices?.room_medium || 450,
          room_large: settings.flatRateUnitPrices?.room_large || 600,
        },
        includeMaterials: settings.includeMaterials !== undefined ? settings.includeMaterials : true,
        coverage: Number(settings.coverage) || 350,
        applicationMethod: settings.applicationMethod || 'roll',
        coats: Number(settings.coats) || 2,
        crewSize: Number(settings.crewSize) || 1,
      },
    });
  } catch (error) {
    console.error('Update defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update defaults',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllProductConfigs,
  getProductConfigById,
  createProductConfig,
  updateProductConfig,
  deleteProductConfig,
  getDefaults,
  updateDefaults,
};
