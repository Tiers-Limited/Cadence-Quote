// controllers/productConfigController.js
// NEW FEATURE: Controller for contractor product configurations
// Handles CRUD operations for tenant-specific product pricing and labor rates

const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');
const ContractorSettings = require('../models/ContractorSettings');
const { DEFAULT_LABOR_RATES } = require('../utils/laborDefaults');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Get all product configurations for the authenticated contractor
 * GET /api/v1/contractor/product-configs
 * Query params: brandId, search, page, limit, sortBy, sortOrder
 */
const getAllProductConfigs = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      brandId,
      jobType,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    // Build where clause
    const where = {
      tenantId,
      isActive: true,
    };
    console.log('🔍 Fetching product configs with filters:', { brandId, jobType, search, page, limit, sortBy, sortOrder });
    // Include filter for global product's brand and category
    const includeWhere = {};
    if (brandId) {
      includeWhere.brandId = parseInt(brandId);
    }

    // Filter by jobType (interior/exterior) - map to product category
    if (jobType) {
      console.log('🔍 Filtering products by jobType:', jobType);
      if (jobType.toLowerCase() === 'interior') {
        includeWhere.category = 'Interior';
      } else if (jobType.toLowerCase() === 'exterior') {
        includeWhere.category = 'Exterior';
      }
      console.log('📋 Applied category filter:', includeWhere.category);
    }

    // Search in product name
    if (search) {
      includeWhere.name = {
        [Op.iLike]: `%${search}%`,
      };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build include configuration
    const globalProductInclude = {
      model: GlobalProduct,
      as: 'globalProduct',
      required: true,
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'name'],
        },
      ],
    };

    // Apply where clause only if we have filters
    if (Object.keys(includeWhere).length > 0) {
      globalProductInclude.where = includeWhere;
    }

    // Execute queries in parallel for performance
    const [count, configs] = await Promise.all([
      ProductConfig.count({
        where,
        include: [globalProductInclude],
      }),
      ProductConfig.findAll({
        where,
        include: [globalProductInclude],
        limit: limitNum,
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: configs,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
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
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const {
      globalProductId,
      sheens,
      laborRates,
      defaultMarkup,
      productMarkups,
      taxRate,
    } = req.body;

    // Validation
    if (!globalProductId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Global product ID is required',
      });
    }

    if (!sheens || !Array.isArray(sheens) || sheens.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'At least one sheen configuration is required',
      });
    }

    // Validate sheen structure
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

    // Check if global product exists (outside transaction to avoid locks)
    const globalProduct = await GlobalProduct.findByPk(globalProductId);
    if (!globalProduct) {
      await transaction.rollback();
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
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: 'A configuration for this product already exists. Please edit the existing configuration.',
      });
    }

    // Create product configuration
    const config = await ProductConfig.create(
      {
        tenantId,
        userId,
        globalProductId,
        sheens,
        laborRates: laborRates || DEFAULT_LABOR_RATES,
        defaultMarkup: defaultMarkup !== undefined ? defaultMarkup : 15,
        productMarkups: productMarkups || {},
        taxRate: taxRate !== undefined ? taxRate : 0,
        isActive: true,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch created config with includes (after commit to avoid transaction issues)
    const createdConfig = await ProductConfig.findByPk(config.id, {
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
    // Safely rollback transaction if it exists and hasn't been committed
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback error:', rollbackError);
      }
    }
    
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

    await config.update(updates, { transaction });

    await transaction.commit();

    // Fetch updated config with includes (after commit)
    const updatedConfig = await ProductConfig.findByPk(config.id, {
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
    
    // Get contractor settings for this tenant
    let settings = await ContractorSettings.findOne({
      where: { tenantId },
    });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await ContractorSettings.create({ tenantId });
    }
    
    res.status(200).json({
      success: true,
      data: {
        laborRates: settings.productConfigLaborRates || DEFAULT_LABOR_RATES,
        defaultMarkup: Number(settings.productConfigDefaultMarkup) || 15,
        defaultTaxRate: Number(settings.productConfigDefaultTaxRate) || 0,
        defaultCoverage: 350,
        // Global Pricing & Metrics
        defaultLaborHourRate: Number(settings.defaultLaborHourRate) || 0,
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
        // Production Rates - Optional
        productionDoors: Number(settings.productionDoors) || 0,
        productionCabinets: Number(settings.productionCabinets) || 0,
      },
    });
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
      laborRates, defaultMarkup, defaultTaxRate, defaultLaborHourRate, 
      laborMarkupPercent, materialMarkupPercent, overheadPercent, netProfitPercent,
      depositPercentage, quoteValidityDays,
      turnkeyInteriorRate, turnkeyExteriorRate,
      prepRepairHourlyRate, finishCabinetHourlyRate,
      productionInteriorWalls, productionInteriorCeilings, productionInteriorTrim,
      productionExteriorWalls, productionExteriorTrim, productionSoffitFascia,
      productionDoors, productionCabinets
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
    if (defaultLaborHourRate !== undefined) {
      updates.defaultLaborHourRate = defaultLaborHourRate;
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
    // Production Rates - Optional
    if (productionDoors !== undefined) {
      updates.productionDoors = productionDoors;
    }
    if (productionCabinets !== undefined) {
      updates.productionCabinets = productionCabinets;
    }
    
    await settings.update(updates);
    
    res.status(200).json({
      success: true,
      message: 'Defaults updated successfully',
      data: {
        laborRates: settings.productConfigLaborRates,
        defaultMarkup: Number(settings.productConfigDefaultMarkup),
        defaultTaxRate: Number(settings.productConfigDefaultTaxRate),
        defaultLaborHourRate: Number(settings.defaultLaborHourRate) || 0,
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
        productionDoors: Number(settings.productionDoors) || 0,
        productionCabinets: Number(settings.productionCabinets) || 0,
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
