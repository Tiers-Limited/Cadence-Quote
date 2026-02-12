// controllers/quoteController.js
// Professional Quote Builder APIs - Optimized for performance and data efficiency

const sequelize = require('../config/database');
const { ProductConfig, GlobalProduct, GlobalColor, Brand, PricingScheme, ContractorSettings, Quote, User, Client } = require('../models');
const { Op } = require('sequelize');
const { getFormFields, calculateSurfaceArea, validateDimensions } = require('../utils/surfaceDimensions');
const { recordQuoteToAnalytics } = require('../utils/pricingCalculator');
const { validateSchemeCompatibility, migrateQuoteData, createRollbackData } = require('../utils/schemeDataMigration');
const templateRenderingService = require('../services/templateRenderingService');
const performanceOptimizationService = require('../services/performanceOptimizationService');
const dataRecoveryService = require('../services/dataRecoveryService');



/**
 * GET /api/quotes/products/minimal
 * Returns comprehensive product data for quote builder (pagination supported)
 * Includes: id, name, brand, category, tier, available sheens, price range
 * OPTIMIZED: Implements caching, N+1 elimination, and batch loading
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

        // OPTIMIZATION: Use eager loading to eliminate N+1 queries
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
            attributes: ['id', 'globalProductId', 'sheens',],
            limit: parseInt(limit),
            offset,
            order: [
                [{ model: GlobalProduct, as: 'globalProduct' }, 'tier', 'ASC'],
                [{ model: GlobalProduct, as: 'globalProduct' }, 'name', 'ASC']
            ]
        });

        // OPTIMIZATION: Process data efficiently with minimal iterations
        const processedData = rows.map(config => {
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
        });

        const result = {
            success: true,
            data: processedData,
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
        };



        return res.json(result);
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
 * OPTIMIZED: Implements caching for individual product details
 */
exports.getProductDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;



        // OPTIMIZATION: Use eager loading to eliminate N+1 queries
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
            attributes: ['id', 'globalProductId', 'sheens',]
        });

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Product configuration not found'
            });
        }

        // OPTIMIZATION: Process data efficiently
        const result = {
            success: true,
            data: {
                id: config.id,
                globalProductId: config.globalProductId,
                isCustom: config.isCustom || false,
                product: config.isCustom && config.customProduct ? {
                    id: null,
                    name: config.customProduct.name || 'Custom Product',
                    category: config.customProduct.category || 'Unknown',
                    tier: config.customProduct.tier || 'custom',
                    brand: {
                        id: null,
                        name: config.customProduct.brandName || 'Custom'
                    }
                } : config.globalProduct ? {
                    id: config.globalProduct.id,
                    name: config.globalProduct.name,
                    category: config.globalProduct.category,
                    tier: config.globalProduct.tier,
                    brand: config.globalProduct.brand
                } : null,
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
        };



        return res.json(result);
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
 * OPTIMIZED: Implements caching for color catalog
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

        // OPTIMIZATION: Use raw query for better performance on large color datasets
        const { count, rows } = await GlobalColor.findAndCountAll({
            where,
            attributes: ['id', 'name', 'code', 'hexValue', 'brandId'],
            limit: parseInt(limit),
            offset,
            order: [['name', 'ASC']],
            raw: true // Use raw queries for better performance
        });

        const result = {
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
        };



        return res.json(result);
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
 * OPTIMIZED: Implements caching for pricing schemes
 */
exports.getPricingSchemes = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;


        // OPTIMIZATION: Use raw query for better performance
        const schemes = await PricingScheme.findAll({
            where: {
                tenantId,
                isActive: true
            },
            attributes: ['id', 'name', 'type', 'description', 'isDefault', 'pricingRules'],
            order: [['isDefault', 'DESC'], ['name', 'ASC']],
            raw: true
        });

        const result = {
            success: true,
            data: schemes
        };



        return res.json(result);
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
 * OPTIMIZED: Implements caching for contractor settings
 */
exports.getContractorSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;


        // OPTIMIZATION: Use raw query for better performance
        const settings = await ContractorSettings.findOne({
            where: { tenantId },
            attributes: [
                'defaultMarkupPercentage',
                'taxRatePercentage',

                'paymentTerms',
                'warrantyTerms',
                'generalTerms',
                'businessHours',
                'quoteValidityDays'
            ],
            raw: true
        });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Contractor settings not found'
            });
        }

        const result = {
            success: true,
            data: settings
        };



        return res.json(result);
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
 * OPTIMIZED: Implements batch loading and efficient calculation processing
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

        // OPTIMIZATION: Batch load all required data in parallel
        const [pricingScheme, settings, productConfigs] = await Promise.all([
            // Fetch pricing scheme
            PricingScheme.findOne({
                where: {
                    id: pricingSchemeId,
                    tenantId,
                    isActive: true
                },
                raw: true
            }),

            // Fetch contractor settings
            ContractorSettings.findOne({
                where: { tenantId },
                raw: true
            }),

            // OPTIMIZATION: Batch load all product configs needed for calculation
            (async () => {
                const productIds = new Set();
                areas.forEach(area => {
                    area.surfaces?.forEach(surface => {
                        if (surface.selected && surface.selectedProduct) {
                            productIds.add(surface.selectedProduct);
                        }
                    });
                });

                if (productIds.size === 0) return new Map();

                const configs = await ProductConfig.findAll({
                    where: {
                        id: Array.from(productIds),
                        tenantId,
                        isActive: true
                    },
                    attributes: ['id', 'sheens',],
                    raw: true
                });

                // Create a Map for O(1) lookup
                const configMap = new Map();
                configs.forEach(config => {
                    configMap.set(config.id, config);
                });
                return configMap;
            })()
        ]);

        if (!pricingScheme) {
            return res.status(404).json({
                success: false,
                message: 'Pricing scheme not found'
            });
        }

        const defaultMarkup = settings ? parseFloat(settings.defaultMarkupPercentage) : 15;
        const defaultTax = settings ? parseFloat(settings.taxRatePercentage) : 0;

        // OPTIMIZATION: Process calculations efficiently with minimal iterations
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

                // OPTIMIZATION: Use Map lookup instead of database query
                const config = productConfigs.get(surface.selectedProduct);
                if (!config) {
                    continue;
                }

                // Find selected sheen pricing
                const selectedSheen = config.sheens?.find(s => s.sheen === surface.selectedSheen);
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

        // Tax should only be applied to markup amounts, not full subtotal
        const totalMarkupAmount = markup + zipMarkup;
        const tax = totalMarkupAmount * (defaultTax / 100);
        const total = subtotal + totalMarkupAmount + tax;

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
            status = 'draft',
            productSets // New field for pricing scheme-specific products
        } = req.body;

        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Validate pricing scheme if productSets is provided
        let pricingScheme = null;
        if (pricingSchemeId) {
            pricingScheme = await PricingScheme.findOne({
                where: {
                    id: pricingSchemeId,
                    tenantId,
                    isActive: true
                }
            });

            if (!pricingScheme) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid pricing scheme ID'
                });
            }
        }

        // Validate and process productSets if provided
        let validatedProductSets = null;
        if (productSets && typeof productSets === 'object') {
            // Validate structure based on pricing scheme
            const validation = validateProductSets(productSets, pricingScheme?.type);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product configuration',
                    errors: validation.errors,
                    warnings: validation.warnings
                });
            }

            validatedProductSets = productSets;

            // Ensure scheme identifier is set
            if (!validatedProductSets.scheme && pricingScheme) {
                validatedProductSets.scheme = mapPricingSchemeType(pricingScheme.type);
            }
        }

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
            productSets: validatedProductSets, // Store pricing scheme-specific products
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

        // Record quote to Job Analytics (async, non-blocking)
        if (status === 'finalized' || status === 'sent') {
            const analyticsData = {
                quoteId: quote.id,
                tenantId,
                userId,
                customerId: null, // Could be added if customer ID is available
                total,
                subtotal,
                tax,
                deposit: total * 0.5, // Assuming 50% deposit, could be configurable
                balance: total * 0.5,
                pricingModel: breakdown?.model || 'unknown',
                status,
                createdAt: quote.createdAt,
                timestamp: new Date().toISOString()
            };

            // Record asynchronously without blocking the response
            recordQuoteToAnalytics(analyticsData).catch(error => {
                console.warn('Failed to record quote to analytics:', error.message);
            });
        }

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
 * OPTIMIZED: Implements efficient filtering and eager loading
 */
exports.getQuotes = async (req, res) => {
    const startTime = Date.now();

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

        // Check concurrent user limits
        if (!performanceOptimizationService.checkConcurrentUserLimits(tenantId)) {
            return res.status(429).json({
                success: false,
                message: 'Too many concurrent users. Please try again later.',
                retryAfter: 60
            });
        }

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

        // Prepare query options
        let queryOptions = {
            where,
            attributes: [
                'id', 'quoteNumber', 'customerName', 'customerEmail', 'customerPhone',
                'total', 'status', 'jobType', 'jobCategory', 'createdAt', 'updatedAt',
                'street', 'city', 'zipCode', 'validUntil', 'sentAt', 'viewedAt', 'acceptedAt'
            ],
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
                    attributes: ['id', 'name', 'email', 'phone'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset,
            order: [[sortBy, sortOrder.toUpperCase()]],
            distinct: true
        };

        // Apply performance optimization
        queryOptions = performanceOptimizationService.optimizeQuoteQuery(queryOptions, 50);

        // OPTIMIZATION: Use a transaction for connection sharing and split findAndCountAll
        const { rows, count } = await sequelize.transaction(async (t) => {
            queryOptions.transaction = t;
            queryOptions.raw = true;
            queryOptions.nest = true;

            const [data, totalCount] = await Promise.all([
                Quote.findAll(queryOptions),
                Quote.count({ where: queryOptions.where, transaction: t })
            ]);

            return { rows: data, count: totalCount };
        });

        // Record performance metrics
        const executionTime = Date.now() - startTime;
        performanceOptimizationService.recordQueryMetrics('getQuotes', executionTime, rows.length);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            },
            performance: {
                executionTime: `${executionTime}ms`,
                resultCount: rows.length
            }
        });
    } catch (error) {
        console.error('Error fetching quotes:', error);

        // Record error metrics
        const executionTime = Date.now() - startTime;
        performanceOptimizationService.recordQueryMetrics('getQuotes_error', executionTime, 0);

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
 * OPTIMIZED: Uses eager loading to eliminate N+1 queries
 */
exports.getQuoteById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // OPTIMIZATION: Use eager loading to eliminate N+1 queries
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
            },
            include: [{
                model: PricingScheme,
                as: 'pricingScheme'
            }]
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        // Check if pricing scheme is changing
        const isSchemeChanging = updateData.pricingSchemeId &&
            updateData.pricingSchemeId !== quote.pricingSchemeId;

        let migrationResult = null;
        let rollbackData = null;

        if (isSchemeChanging) {
            // Get the new pricing scheme
            const newScheme = await PricingScheme.findByPk(updateData.pricingSchemeId);
            if (!newScheme) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid pricing scheme'
                });
            }

            const currentSchemeType = quote.pricingScheme?.type || 'turnkey';
            const newSchemeType = newScheme.type;

            // Validate compatibility
            const compatibility = validateSchemeCompatibility(
                quote.toJSON(),
                currentSchemeType,
                newSchemeType
            );

            // Create rollback data before migration
            rollbackData = createRollbackData(quote.toJSON(), currentSchemeType);

            // Perform data migration if needed
            if (compatibility.migrations.length > 0 || !compatibility.isCompatible) {
                migrationResult = migrateQuoteData(
                    quote.toJSON(),
                    currentSchemeType,
                    newSchemeType
                );

                // Merge migrated data with update data
                Object.assign(updateData, migrationResult.data);
            }

            // Add compatibility info to response
            updateData._schemeChangeInfo = {
                compatibility,
                migrationLog: migrationResult?.migrationLog || [],
                rollbackAvailable: true
            };
        }

        // Update quote with optimistic locking
        const currentVersion = quote.autoSaveVersion;
        updateData.autoSaveVersion = currentVersion + 1;
        updateData.lastModified = new Date();

        // Check for concurrent modifications
        if (updateData.expectedVersion && updateData.expectedVersion !== currentVersion) {
            return res.status(409).json({
                success: false,
                message: 'Quote has been modified by another user',
                currentVersion,
                expectedVersion: updateData.expectedVersion,
                conflictResolution: true
            });
        }

        // Update quote
        await quote.update(updateData);

        const response = {
            success: true,
            message: 'Quote updated successfully',
            data: quote
        };

        // Add scheme change information to response
        if (isSchemeChanging && updateData._schemeChangeInfo) {
            response.schemeChangeInfo = updateData._schemeChangeInfo;
            response.rollbackData = rollbackData;
        }

        return res.json(response);
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

/**
 * POST /api/quotes/recalculate-production-based
 * Recalculate all production-based quotes when production rates change
 * Ensures all affected quotes reflect updated production rates and labor costs
 */
exports.recalculateProductionBasedQuotes = async (req, res) => {
    try {
        const { productionRates, billableLaborRates } = req.body;
        const tenantId = req.user.tenantId;
        const startTime = performance.now();

        // Validate input
        if (!productionRates || !billableLaborRates) {
            return res.status(400).json({
                success: false,
                message: 'Production rates and billable labor rates are required'
            });
        }

        // Find all production-based quotes for this tenant
        const productionBasedQuotes = await Quote.findAll({
            where: {
                tenantId,
                status: ['draft', 'pending', 'approved'], // Only active quotes
                pricingScheme: {
                    [Op.or]: ['production_based', 'hourly_time_materials']
                }
            },
            attributes: ['id', 'areas', 'pricingScheme', 'crewSize', 'lastModified']
        });

        let affectedQuotes = 0;
        const updatePromises = [];

        for (const quote of productionBasedQuotes) {
            try {
                // Recalculate quote with new production rates
                const updatedCalculation = await recalculateQuoteWithProductionRates(
                    quote,
                    productionRates,
                    billableLaborRates
                );

                if (updatedCalculation) {
                    updatePromises.push(
                        Quote.update(
                            {
                                calculatedTotals: updatedCalculation.totals,
                                lastModified: new Date(),
                                // Add flag to indicate this was auto-updated
                                autoUpdatedAt: new Date(),
                                autoUpdateReason: 'production_rates_changed'
                            },
                            {
                                where: { id: quote.id }
                            }
                        )
                    );
                    affectedQuotes++;
                }
            } catch (quoteError) {
                console.warn(`Failed to recalculate quote ${quote.id}:`, quoteError);
                // Continue with other quotes even if one fails
            }
        }

        // Execute all updates in parallel for better performance
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log performance metrics
        console.log(`Production-based quote recalculation completed in ${duration.toFixed(2)}ms`);
        console.log(`Affected quotes: ${affectedQuotes}/${productionBasedQuotes.length}`);

        // Check if operation completed within 500ms target
        if (duration > 500) {
            console.warn(`Quote recalculation took ${duration.toFixed(2)}ms - exceeds 500ms target`);
        }

        return res.json({
            success: true,
            data: {
                affectedQuotes,
                totalQuotes: productionBasedQuotes.length,
                processingTime: Math.round(duration),
                withinTarget: duration <= 500
            },
            message: `Successfully recalculated ${affectedQuotes} production-based quotes`
        });

    } catch (error) {
        console.error('Error recalculating production-based quotes:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to recalculate production-based quotes',
            error: error.message
        });
    }
};

/**
 * Helper function to recalculate a quote with new production rates
 * @param {Object} quote - The quote to recalculate
 * @param {Object} productionRates - New production rates
 * @param {Object} billableLaborRates - New billable labor rates
 * @returns {Object|null} Updated calculation or null if no changes needed
 */
async function recalculateQuoteWithProductionRates(quote, productionRates, billableLaborRates) {
    try {
        const areas = quote.areas || [];
        if (areas.length === 0) return null;

        let totalLaborHours = 0;
        let totalLaborCost = 0;
        let totalMaterialCost = 0;

        // Calculate crew average rate
        const crewSize = quote.crewSize || Object.keys(billableLaborRates).length || 1;
        const averageLaborRate = Object.values(billableLaborRates).reduce((sum, rate) => sum + rate, 0) / Object.keys(billableLaborRates).length;

        for (const area of areas) {
            for (const surface of area.surfaces || []) {
                if (!surface.selected || !surface.sqft) continue;

                const sqft = parseFloat(surface.sqft) || 0;
                const surfaceType = surface.type?.toLowerCase() || 'walls';

                // Get production rate for this surface type
                let productionRate = productionRates.interiorWalls || 300; // Default fallback

                if (surfaceType.includes('ceiling')) {
                    productionRate = productionRates.interiorCeilings || 250;
                } else if (surfaceType.includes('trim')) {
                    productionRate = productionRates.interiorTrim || 150;
                } else if (surfaceType.includes('door')) {
                    productionRate = productionRates.doors || 2;
                } else if (surfaceType.includes('cabinet')) {
                    productionRate = productionRates.cabinets || 1.5;
                } else if (area.jobType === 'exterior') {
                    if (surfaceType.includes('wall')) {
                        productionRate = productionRates.exteriorWalls || 250;
                    } else if (surfaceType.includes('trim')) {
                        productionRate = productionRates.exteriorTrim || 120;
                    } else if (surfaceType.includes('soffit') || surfaceType.includes('fascia')) {
                        productionRate = productionRates.soffitFascia || 100;
                    }
                }

                // Calculate labor hours based on production rate and crew size
                const laborHours = sqft / productionRate / crewSize;
                const laborCost = laborHours * averageLaborRate;

                totalLaborHours += laborHours;
                totalLaborCost += laborCost;

                // Material cost calculation (if applicable)
                if (surface.selectedProduct && surface.selectedSheen) {
                    // This would need to fetch product pricing, but for now use a simple estimate
                    const estimatedMaterialCost = sqft * 0.15; // $0.15 per sqft estimate
                    totalMaterialCost += estimatedMaterialCost;
                }
            }
        }

        // Apply markup and tax (use defaults if not specified)
        const subtotal = totalLaborCost + totalMaterialCost;
        const markup = subtotal * 0.15; // 15% default markup

        // Tax should only be applied to markup, not full subtotal
        const tax = markup * 0.08; // 8% default tax on markup only
        const total = subtotal + markup + tax;

        return {
            totals: {
                laborHours: Math.round(totalLaborHours * 100) / 100,
                laborCost: Math.round(totalLaborCost * 100) / 100,
                materialCost: Math.round(totalMaterialCost * 100) / 100,
                subtotal: Math.round(subtotal * 100) / 100,
                markup: Math.round(markup * 100) / 100,
                tax: Math.round(tax * 100) / 100,
                total: Math.round(total * 100) / 100
            },
            metadata: {
                recalculatedAt: new Date(),
                productionRatesUsed: productionRates,
                averageLaborRate,
                crewSize
            }
        };

    } catch (error) {
        console.error('Error in recalculateQuoteWithProductionRates:', error);
        return null;
    }
}

/**
 * GET /api/quotes/:id/render
 * Render quote with applied template formatting
 */
exports.renderQuoteWithTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Fetch quote with related data
        const quote = await Quote.findOne({
            where: {
                id,
                tenantId,
                isActive: true
            },
            include: [{
                model: PricingScheme,
                as: 'pricingScheme'
            }]
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        // Fetch contractor settings for template configuration
        const contractorSettings = await ContractorSettings.findOne({
            where: { tenantId }
        });

        if (!contractorSettings) {
            return res.status(404).json({
                success: false,
                message: 'Contractor settings not found'
            });
        }

        // Prepare template configuration
        const templateConfig = {
            selectedProposalTemplate: contractorSettings.selectedProposalTemplate || 'professional',
            proposalTemplateSettings: contractorSettings.proposalTemplateSettings || {
                showCompanyLogo: true,
                showAreaBreakdown: true,
                showProductDetails: true,
                showWarrantySection: true,
                colorScheme: 'blue'
            }
        };

        // Prepare contractor information
        const contractorInfo = {
            businessName: contractorSettings.businessName,
            name: req.user.fullName,
            phone: contractorSettings.phone,
            email: req.user.email,
            address: contractorSettings.businessAddress,
            logoUrl: contractorSettings.logoUrl,
            warrantyTerms: contractorSettings.warrantyTerms,
            generalTerms: contractorSettings.generalTerms,
            paymentTerms: contractorSettings.paymentTerms,
            licenseNumber: contractorSettings.licenseNumber,
            website: contractorSettings.website
        };

        // Render quote with template
        const renderedQuote = templateRenderingService.renderQuote(
            quote.toJSON(),
            templateConfig,
            contractorInfo
        );

        return res.json({
            success: true,
            data: renderedQuote
        });
    } catch (error) {
        console.error('Error rendering quote with template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to render quote with template',
            error: error.message
        });
    }
};

/**
 * POST /api/quotes/:id/rollback
 * Rollback quote data to previous state after failed scheme change
 */
exports.rollbackQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const { rollbackData } = req.body;
        const tenantId = req.user.tenantId;

        if (!rollbackData || !rollbackData.rollbackAvailable) {
            return res.status(400).json({
                success: false,
                message: 'No rollback data available'
            });
        }

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

        // Import rollback function
        const { rollbackQuoteData } = require('../utils/schemeDataMigration');

        // Perform rollback
        const rollbackResult = rollbackQuoteData(rollbackData);

        // Update quote with rollback data
        await quote.update({
            ...rollbackResult.data,
            lastModified: new Date(),
            autoSaveVersion: quote.autoSaveVersion + 1
        });

        return res.json({
            success: true,
            message: 'Quote data rolled back successfully',
            data: quote,
            rollbackInfo: {
                restoredAt: rollbackResult.restoredAt,
                originalScheme: rollbackResult.scheme
            }
        });
    } catch (error) {
        console.error('Error rolling back quote:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to rollback quote',
            error: error.message
        });
    }
};

/**
 * POST /api/quotes/:id/create-checkpoint
 * Create a recovery checkpoint for unsaved changes
 */
exports.createRecoveryCheckpoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { sessionId, quoteData } = req.body;
        const userId = req.user.id;
        const tenantId = req.user.tenantId;

        // Verify quote exists and user has access
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

        // Create recovery checkpoint
        const result = await dataRecoveryService.createRecoveryCheckpoint(
            quoteData || quote.toJSON(),
            sessionId,
            userId
        );

        return res.json({
            success: result.success,
            message: result.success ? 'Recovery checkpoint created' : 'Failed to create checkpoint',
            data: result.success ? {
                checkpointId: result.checkpointId,
                timestamp: result.timestamp,
                version: result.version
            } : null,
            error: result.error
        });
    } catch (error) {
        console.error('Error creating recovery checkpoint:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create recovery checkpoint',
            error: error.message
        });
    }
};

/**
 * GET /api/quotes/recovery/:sessionId
 * Get available recovery data for a session
 */
exports.getRecoveryData = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { quoteId } = req.query;
        const userId = req.user.id;

        const recoveryData = await dataRecoveryService.getRecoveryData(sessionId, quoteId);

        return res.json({
            success: true,
            data: recoveryData,
            message: recoveryData.length > 0 ?
                `Found ${recoveryData.length} recovery checkpoint(s)` :
                'No recovery data available'
        });
    } catch (error) {
        console.error('Error getting recovery data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve recovery data',
            error: error.message
        });
    }
};

/**
 * POST /api/quotes/recovery/restore
 * Restore quote data from a recovery checkpoint
 */
exports.restoreFromCheckpoint = async (req, res) => {
    try {
        const { checkpointId } = req.body;
        const userId = req.user.id;

        const result = await dataRecoveryService.restoreFromCheckpoint(checkpointId, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || 'Failed to restore from checkpoint'
            });
        }

        return res.json({
            success: true,
            message: 'Data restored from checkpoint',
            data: result.data,
            restoredAt: result.restoredAt,
            originalTimestamp: result.timestamp,
            version: result.version
        });
    } catch (error) {
        console.error('Error restoring from checkpoint:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to restore from checkpoint',
            error: error.message
        });
    }
};

/**
 * POST /api/quotes/:id/resolve-conflicts
 * Detect and resolve conflicts between local and server data
 */
exports.resolveConflicts = async (req, res) => {
    try {
        const { id } = req.params;
        const { localData, resolutionStrategy } = req.body;
        const tenantId = req.user.tenantId;

        // Get current server data
        const serverQuote = await Quote.findOne({
            where: {
                id,
                tenantId,
                isActive: true
            }
        });

        if (!serverQuote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        const serverData = serverQuote.toJSON();

        // Detect conflicts
        const conflictResult = await dataRecoveryService.detectAndResolveConflicts(localData, serverData);

        // If user provided a resolution strategy, apply it
        if (resolutionStrategy && conflictResult.hasConflicts) {
            conflictResult.mergedData = dataRecoveryService.createMergedData(
                localData,
                serverData,
                resolutionStrategy
            );
            conflictResult.appliedStrategy = resolutionStrategy;
        }

        return res.json({
            success: true,
            hasConflicts: conflictResult.hasConflicts,
            conflicts: conflictResult.conflicts,
            suggestedResolution: conflictResult.suggestedResolution,
            mergedData: conflictResult.mergedData,
            appliedStrategy: conflictResult.appliedStrategy,
            message: conflictResult.hasConflicts ?
                `Found ${conflictResult.conflicts.length} conflict(s)` :
                'No conflicts detected'
        });
    } catch (error) {
        console.error('Error resolving conflicts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resolve conflicts',
            error: error.message
        });
    }
};

/**
 * GET /api/quotes/recovery/stats
 * Get recovery system statistics
 */
exports.getRecoveryStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await dataRecoveryService.getRecoveryStats(userId);

        return res.json({
            success: true,
            data: stats,
            message: 'Recovery statistics retrieved'
        });
    } catch (error) {
        console.error('Error getting recovery stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get recovery statistics',
            error: error.message
        });
    }
};

/**
 * GET /api/quotes/performance-metrics
 * Get performance metrics for monitoring
 */
exports.getPerformanceMetrics = async (req, res) => {
    try {
        const metrics = performanceOptimizationService.getPerformanceMetrics();

        return res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch performance metrics',
            error: error.message
        });
    }
};

/**
 * Helper function to validate productSets structure based on pricing scheme
 * @param {Object} productSets - The product configuration object
 * @param {String} schemeType - The pricing scheme type
 * @returns {Object} - Validation result with valid flag, errors, and warnings
 */
function validateProductSets(productSets, schemeType) {
    const errors = [];
    const warnings = [];

    if (!productSets || typeof productSets !== 'object') {
        errors.push({
            code: 'INVALID_STRUCTURE',
            message: 'productSets must be an object'
        });
        return { valid: false, errors, warnings };
    }

    // Map legacy scheme types to new types
    const mappedScheme = mapPricingSchemeType(schemeType);

    // Validate based on pricing scheme type
    switch (mappedScheme) {
        case 'turnkey':
            // Validate turnkey structure: should have global surface types
            if (!productSets.global || typeof productSets.global !== 'object') {
                errors.push({
                    code: 'INVALID_STRUCTURE',
                    category: 'global',
                    message: 'Turnkey pricing requires global surface type configuration'
                });
            } else {
                // Validate each surface type has required fields
                Object.entries(productSets.global).forEach(([surfaceType, product]) => {
                    if (!product || typeof product !== 'object') {
                        errors.push({
                            code: 'INVALID_PRODUCT',
                            category: surfaceType,
                            message: `Invalid product configuration for ${surfaceType}`
                        });
                    } else {
                        validateProductObject(product, surfaceType, errors, warnings);
                    }
                });
            }
            break;

        case 'flat_rate_unit':
            // Validate flat rate structure: should have interior and/or exterior categories
            if (!productSets.interior && !productSets.exterior) {
                errors.push({
                    code: 'INVALID_STRUCTURE',
                    message: 'Flat Rate Unit pricing requires interior or exterior category configuration'
                });
            }

            // Validate interior units if present
            if (productSets.interior && typeof productSets.interior === 'object') {
                Object.entries(productSets.interior).forEach(([unitType, unitData]) => {
                    if (!unitData || typeof unitData !== 'object') {
                        errors.push({
                            code: 'INVALID_UNIT',
                            category: 'interior',
                            unitType,
                            message: `Invalid unit configuration for interior ${unitType}`
                        });
                    } else if (!unitData.products || !Array.isArray(unitData.products)) {
                        errors.push({
                            code: 'MISSING_PRODUCTS',
                            category: 'interior',
                            unitType,
                            message: `Products array required for interior ${unitType}`
                        });
                    } else {
                        // Validate each product in the array
                        unitData.products.forEach((product, index) => {
                            validateProductObject(product, `interior.${unitType}[${index}]`, errors, warnings);
                        });
                    }
                });
            }

            // Validate exterior units if present
            if (productSets.exterior && typeof productSets.exterior === 'object') {
                Object.entries(productSets.exterior).forEach(([unitType, unitData]) => {
                    if (!unitData || typeof unitData !== 'object') {
                        errors.push({
                            code: 'INVALID_UNIT',
                            category: 'exterior',
                            unitType,
                            message: `Invalid unit configuration for exterior ${unitType}`
                        });
                    } else if (!unitData.products || !Array.isArray(unitData.products)) {
                        errors.push({
                            code: 'MISSING_PRODUCTS',
                            category: 'exterior',
                            unitType,
                            message: `Products array required for exterior ${unitType}`
                        });
                    } else {
                        // Validate each product in the array
                        unitData.products.forEach((product, index) => {
                            validateProductObject(product, `exterior.${unitType}[${index}]`, errors, warnings);
                        });
                    }
                });
            }
            break;

        case 'unit_pricing':
        case 'production_based':
        case 'rate_based':
            // Validate unit pricing structure: should have areas
            if (!productSets.areas || typeof productSets.areas !== 'object') {
                errors.push({
                    code: 'INVALID_STRUCTURE',
                    message: 'Unit Pricing requires area-based configuration'
                });
            } else {
                // Validate each area
                Object.entries(productSets.areas).forEach(([areaId, areaData]) => {
                    if (!areaData || typeof areaData !== 'object') {
                        errors.push({
                            code: 'INVALID_AREA',
                            areaId,
                            message: `Invalid area configuration for ${areaId}`
                        });
                    } else if (!areaData.surfaces || typeof areaData.surfaces !== 'object') {
                        errors.push({
                            code: 'MISSING_SURFACES',
                            areaId,
                            message: `Surfaces configuration required for area ${areaId}`
                        });
                    } else {
                        // Validate each surface in the area
                        Object.entries(areaData.surfaces).forEach(([surfaceType, surfaceData]) => {
                            if (!surfaceData || typeof surfaceData !== 'object') {
                                errors.push({
                                    code: 'INVALID_SURFACE',
                                    areaId,
                                    surfaceType,
                                    message: `Invalid surface configuration for ${surfaceType} in area ${areaId}`
                                });
                            } else {
                                // Validate tier-based products (good, better, best)
                                ['good', 'better', 'best', 'single'].forEach(tier => {
                                    if (surfaceData[tier]) {
                                        validateProductObject(
                                            surfaceData[tier],
                                            `${areaId}.${surfaceType}.${tier}`,
                                            errors,
                                            warnings
                                        );
                                    }
                                });
                            }
                        });
                    }
                });
            }
            break;

        case 'hourly':
            // Validate hourly structure: should have items array
            if (!productSets.items || !Array.isArray(productSets.items)) {
                errors.push({
                    code: 'INVALID_STRUCTURE',
                    message: 'Hourly pricing requires items array configuration'
                });
            } else {
                // Validate each item
                productSets.items.forEach((item, index) => {
                    if (!item || typeof item !== 'object') {
                        errors.push({
                            code: 'INVALID_ITEM',
                            index,
                            message: `Invalid item configuration at index ${index}`
                        });
                    } else {
                        if (!item.description) {
                            warnings.push({
                                code: 'MISSING_DESCRIPTION',
                                index,
                                message: `Item at index ${index} is missing description`
                            });
                        }
                        if (item.products && Array.isArray(item.products)) {
                            item.products.forEach((product, pIndex) => {
                                validateProductObject(product, `items[${index}].products[${pIndex}]`, errors, warnings);
                            });
                        }
                    }
                });
            }
            break;

        default:
            warnings.push({
                code: 'UNKNOWN_SCHEME',
                message: `Unknown pricing scheme: ${schemeType}. Validation skipped.`
            });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Helper function to validate individual product object
 * @param {Object} product - The product object to validate
 * @param {String} location - Location identifier for error messages
 * @param {Array} errors - Array to collect errors
 * @param {Array} warnings - Array to collect warnings
 */
function validateProductObject(product, location, errors, warnings) {
    if (!product.productId && !product.globalProductId) {
        errors.push({
            code: 'MISSING_PRODUCT_ID',
            location,
            message: `Product ID required at ${location}`
        });
    }

    if (product.productId && (typeof product.productId !== 'number' || product.productId <= 0)) {
        errors.push({
            code: 'INVALID_PRODUCT_ID',
            location,
            productId: product.productId,
            message: `Invalid product ID at ${location}`
        });
    }

    if (product.quantity !== undefined) {
        const qty = parseFloat(product.quantity);
        if (isNaN(qty) || qty < 0) {
            errors.push({
                code: 'INVALID_QUANTITY',
                location,
                quantity: product.quantity,
                message: `Invalid quantity at ${location}`
            });
        }
    }

    if (product.cost !== undefined) {
        const cost = parseFloat(product.cost);
        if (isNaN(cost) || cost < 0) {
            warnings.push({
                code: 'INVALID_COST',
                location,
                cost: product.cost,
                message: `Invalid cost at ${location}`
            });
        }
    }
}

/**
 * Helper function to map pricing scheme types to standardized names
 * Maps both legacy and new scheme types to the design document's naming convention
 * @param {String} schemeType - The pricing scheme type from database
 * @returns {String} - Standardized scheme name
 */
function mapPricingSchemeType(schemeType) {
    if (!schemeType) return 'unknown';

    const mapping = {
        // New types (already standardized)
        'turnkey': 'turnkey',
        'flat_rate_unit': 'flat_rate_unit',
        'production_based': 'unit_pricing', // Maps to unit pricing in design
        'rate_based_sqft': 'unit_pricing',  // Maps to unit pricing in design

        // Legacy types (need mapping)
        'sqft_turnkey': 'turnkey',
        'unit_pricing': 'unit_pricing',
        'room_flat_rate': 'flat_rate_unit',
        'sqft_labor_paint': 'unit_pricing',
        'hourly_time_materials': 'hourly'
    };

    return mapping[schemeType] || schemeType;
}

/**
 * PUT /api/quotes/:quoteId/product-configuration
 * Save product configuration for a quote
 * Validates structure, saves to database, and triggers pricing recalculation
 */
exports.updateProductConfiguration = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { productSets, autoSaveVersion } = req.body;
        const tenantId = req.user.tenantId;

        // Validate input
        if (!productSets || typeof productSets !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'productSets is required and must be an object',
                errors: [{
                    code: 'MISSING_PRODUCT_SETS',
                    message: 'productSets field is required'
                }]
            });
        }

        // Load quote with productSets and pricing scheme
        const quote = await Quote.findOne({
            where: {
                id: quoteId,
                tenantId,
                isActive: true
            },
            include: [{
                model: PricingScheme,
                as: 'pricingScheme',
                attributes: ['id', 'name', 'type', 'description', 'pricingRules']
            }],
            attributes: [
                'id', 'quoteNumber', 'productSets', 'pricingSchemeId',
                'customerName', 'status', 'jobType', 'updatedAt', 'areas',
                'homeSqft', 'flatRateItems', 'includeMaterials', 'coverage',
                'applicationMethod', 'coats'
            ]
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        // Check for pricing scheme
        if (!quote.pricingScheme) {
            return res.status(400).json({
                success: false,
                message: 'Quote does not have a pricing scheme assigned'
            });
        }

        // Handle auto-save version conflicts
        if (autoSaveVersion !== undefined) {
            const currentVersion = new Date(quote.updatedAt).getTime();
            if (autoSaveVersion < currentVersion) {
                return res.status(409).json({
                    success: false,
                    message: 'Quote has been modified by another user. Please refresh and try again.',
                    code: 'VERSION_CONFLICT',
                    currentVersion: currentVersion,
                    attemptedVersion: autoSaveVersion
                });
            }
        }

        const schemeType = mapPricingSchemeType(quote.pricingScheme.type);

        // Validate productSets structure for pricing scheme
        const validation = validateProductSets(productSets, quote.pricingScheme.type);

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Product configuration validation failed',
                errors: validation.errors,
                warnings: validation.warnings
            });
        }

        // Extract all product IDs from productSets for validation
        const productIds = extractProductIds(productSets, schemeType);

        // Validate that all product IDs exist and belong to tenant
        if (productIds.length > 0) {
            const validProducts = await ProductConfig.findAll({
                where: {
                    id: productIds,
                    tenantId,
                    isActive: true
                },
                attributes: ['id']
            });

            const validProductIds = validProducts.map(p => p.id);
            const invalidProductIds = productIds.filter(id => !validProductIds.includes(id));

            if (invalidProductIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product IDs detected',
                    errors: [{
                        code: 'INVALID_PRODUCT_IDS',
                        message: `The following product IDs do not exist or are not active: ${invalidProductIds.join(', ')}`,
                        invalidIds: invalidProductIds
                    }]
                });
            }
        }

        // Validate quantities are positive
        const quantityErrors = validateQuantities(productSets, schemeType);
        if (quantityErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid quantities detected',
                errors: quantityErrors
            });
        }

        // Save productSets to quote
        await quote.update({
            productSets: productSets
        });

        // Trigger pricing recalculation
        let updatedPricing = null;
        try {
            // Import calculateQuotePricing function
            const { calculateQuotePricing } = require('./quoteBuilderController');

            // Recalculate pricing with new product configuration
            updatedPricing = await calculateQuotePricing(quote, tenantId);

            // Update quote with new pricing
            await quote.update({
                subtotal: updatedPricing.subtotal,
                laborTotal: updatedPricing.laborTotal,
                materialTotal: updatedPricing.materialTotal,
                laborMarkupPercent: updatedPricing.laborMarkupPercent || 0,
                materialMarkupPercent: updatedPricing.materialMarkupPercent || 0,
                overheadPercent: updatedPricing.overheadPercent || 0,
                profitMarginPercent: updatedPricing.profitMarginPercent || 0,
                taxRatePercentage: updatedPricing.taxRatePercentage || 0,
                total: updatedPricing.total
            });
        } catch (pricingError) {
            console.error('Error recalculating pricing:', pricingError);
            // Continue even if pricing calculation fails - product config is saved
            // Return warning in response
            validation.warnings.push({
                code: 'PRICING_CALCULATION_FAILED',
                message: 'Product configuration saved but pricing recalculation failed. Please review pricing manually.',
                details: pricingError.message
            });
        }

        // Reload quote to get updated data
        await quote.reload();

        // Return updated productSets and pricing breakdown
        return res.json({
            success: true,
            message: 'Product configuration saved successfully',
            data: {
                quoteId: quote.id,
                productSets: quote.productSets,
                updatedPricing: updatedPricing ? {
                    subtotal: updatedPricing.subtotal,
                    laborTotal: updatedPricing.laborTotal,
                    materialTotal: updatedPricing.materialTotal,
                    total: updatedPricing.total,
                    laborMarkupPercent: updatedPricing.laborMarkupPercent,
                    materialMarkupPercent: updatedPricing.materialMarkupPercent,
                    overheadPercent: updatedPricing.overheadPercent,
                    profitMarginPercent: updatedPricing.profitMarginPercent,
                    taxRatePercentage: updatedPricing.taxRatePercentage
                } : null,
                version: new Date(quote.updatedAt).getTime()
            },
            warnings: validation.warnings
        });

    } catch (error) {
        console.error('Error updating product configuration:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update product configuration',
            error: error.message
        });
    }
};

/**
 * Helper function to extract all product IDs from productSets
 * @param {Object} productSets - The product configuration object
 * @param {String} schemeType - The pricing scheme type
 * @returns {Array} - Array of product IDs
 */
function extractProductIds(productSets, schemeType) {
    const productIds = [];

    try {
        switch (schemeType) {
            case 'turnkey':
                // Extract from global surface types
                if (productSets.global) {
                    Object.values(productSets.global).forEach(product => {
                        if (product && product.productId) {
                            productIds.push(product.productId);
                        }
                    });
                }
                break;

            case 'flat_rate_unit':
                // Extract from interior units
                if (productSets.interior) {
                    Object.values(productSets.interior).forEach(unitData => {
                        if (unitData && unitData.products && Array.isArray(unitData.products)) {
                            unitData.products.forEach(product => {
                                if (product && product.productId) {
                                    productIds.push(product.productId);
                                }
                            });
                        }
                    });
                }
                // Extract from exterior units
                if (productSets.exterior) {
                    Object.values(productSets.exterior).forEach(unitData => {
                        if (unitData && unitData.products && Array.isArray(unitData.products)) {
                            unitData.products.forEach(product => {
                                if (product && product.productId) {
                                    productIds.push(product.productId);
                                }
                            });
                        }
                    });
                }
                break;

            case 'unit_pricing':
                // Extract from areas
                if (productSets.areas) {
                    Object.values(productSets.areas).forEach(areaData => {
                        if (areaData && areaData.surfaces) {
                            Object.values(areaData.surfaces).forEach(surfaceData => {
                                if (surfaceData) {
                                    // Check all tiers
                                    ['good', 'better', 'best', 'single'].forEach(tier => {
                                        if (surfaceData[tier] && surfaceData[tier].productId) {
                                            productIds.push(surfaceData[tier].productId);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
                break;

            case 'hourly':
                // Extract from items
                if (productSets.items && Array.isArray(productSets.items)) {
                    productSets.items.forEach(item => {
                        if (item && item.products && Array.isArray(item.products)) {
                            item.products.forEach(product => {
                                if (product && product.productId) {
                                    productIds.push(product.productId);
                                }
                            });
                        }
                    });
                }
                break;
        }
    } catch (error) {
        console.error('Error extracting product IDs:', error);
    }

    return productIds;
}

/**
 * Helper function to validate quantities are positive
 * @param {Object} productSets - The product configuration object
 * @param {String} schemeType - The pricing scheme type
 * @returns {Array} - Array of validation errors
 */
function validateQuantities(productSets, schemeType) {
    const errors = [];

    try {
        switch (schemeType) {
            case 'turnkey':
                // Validate global surface type quantities
                if (productSets.global) {
                    Object.entries(productSets.global).forEach(([surfaceType, product]) => {
                        if (product && product.quantity !== undefined) {
                            const qty = parseFloat(product.quantity);
                            if (isNaN(qty) || qty <= 0) {
                                errors.push({
                                    code: 'INVALID_QUANTITY',
                                    location: `global.${surfaceType}`,
                                    quantity: product.quantity,
                                    message: `Quantity must be a positive number for ${surfaceType}`
                                });
                            }
                        }
                    });
                }
                break;

            case 'flat_rate_unit':
                // Validate interior unit quantities
                if (productSets.interior) {
                    Object.entries(productSets.interior).forEach(([unitType, unitData]) => {
                        if (unitData && unitData.products && Array.isArray(unitData.products)) {
                            unitData.products.forEach((product, index) => {
                                if (product && product.quantity !== undefined) {
                                    const qty = parseFloat(product.quantity);
                                    if (isNaN(qty) || qty <= 0) {
                                        errors.push({
                                            code: 'INVALID_QUANTITY',
                                            location: `interior.${unitType}.products[${index}]`,
                                            quantity: product.quantity,
                                            message: `Quantity must be a positive number for interior ${unitType}`
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
                // Validate exterior unit quantities
                if (productSets.exterior) {
                    Object.entries(productSets.exterior).forEach(([unitType, unitData]) => {
                        if (unitData && unitData.products && Array.isArray(unitData.products)) {
                            unitData.products.forEach((product, index) => {
                                if (product && product.quantity !== undefined) {
                                    const qty = parseFloat(product.quantity);
                                    if (isNaN(qty) || qty <= 0) {
                                        errors.push({
                                            code: 'INVALID_QUANTITY',
                                            location: `exterior.${unitType}.products[${index}]`,
                                            quantity: product.quantity,
                                            message: `Quantity must be a positive number for exterior ${unitType}`
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
                break;

            case 'unit_pricing':
                // Validate area quantities
                if (productSets.areas) {
                    Object.entries(productSets.areas).forEach(([areaId, areaData]) => {
                        if (areaData && areaData.surfaces) {
                            Object.entries(areaData.surfaces).forEach(([surfaceType, surfaceData]) => {
                                if (surfaceData) {
                                    ['good', 'better', 'best', 'single'].forEach(tier => {
                                        if (surfaceData[tier] && surfaceData[tier].quantity !== undefined) {
                                            const qty = parseFloat(surfaceData[tier].quantity);
                                            if (isNaN(qty) || qty <= 0) {
                                                errors.push({
                                                    code: 'INVALID_QUANTITY',
                                                    location: `areas.${areaId}.${surfaceType}.${tier}`,
                                                    quantity: surfaceData[tier].quantity,
                                                    message: `Quantity must be a positive number for ${surfaceType} in area ${areaId}`
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
                break;

            case 'hourly':
                // Validate item quantities
                if (productSets.items && Array.isArray(productSets.items)) {
                    productSets.items.forEach((item, itemIndex) => {
                        if (item && item.products && Array.isArray(item.products)) {
                            item.products.forEach((product, productIndex) => {
                                if (product && product.quantity !== undefined) {
                                    const qty = parseFloat(product.quantity);
                                    if (isNaN(qty) || qty <= 0) {
                                        errors.push({
                                            code: 'INVALID_QUANTITY',
                                            location: `items[${itemIndex}].products[${productIndex}]`,
                                            quantity: product.quantity,
                                            message: `Quantity must be a positive number for item ${itemIndex}`
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
                break;
        }
    } catch (error) {
        console.error('Error validating quantities:', error);
        errors.push({
            code: 'VALIDATION_ERROR',
            message: 'Error occurred during quantity validation',
            details: error.message
        });
    }

    return errors;
}

/**
 * POST /api/quotes/:quoteId/product-configuration/apply-to-all
 * Apply a product to all specified categories
 * Respects interior/exterior boundaries for flat_rate_unit scheme
 */
exports.applyProductToAll = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { productId, targetCategories, scheme, categoryType } = req.body;
        const tenantId = req.user.tenantId;

        // Validate input
        if (!productId || typeof productId !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'productId is required and must be a number',
                errors: [{
                    code: 'MISSING_PRODUCT_ID',
                    message: 'productId field is required'
                }]
            });
        }

        if (!targetCategories || !Array.isArray(targetCategories) || targetCategories.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'targetCategories is required and must be a non-empty array',
                errors: [{
                    code: 'MISSING_TARGET_CATEGORIES',
                    message: 'targetCategories field is required'
                }]
            });
        }

        // Load quote with productSets and pricing scheme
        const quote = await Quote.findOne({
            where: {
                id: quoteId,
                tenantId,
                isActive: true
            },
            include: [{
                model: PricingScheme,
                as: 'pricingScheme',
                attributes: ['id', 'name', 'type', 'description']
            }],
            attributes: [
                'id', 'quoteNumber', 'productSets', 'pricingSchemeId',
                'customerName', 'status', 'areas', 'flatRateItems'
            ]
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        // Validate contractor access (already validated by middleware, but double-check)
        if (quote.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check for pricing scheme
        if (!quote.pricingScheme) {
            return res.status(400).json({
                success: false,
                message: 'Quote does not have a pricing scheme assigned'
            });
        }

        const schemeType = mapPricingSchemeType(quote.pricingScheme.type);

        // Validate that the product exists and belongs to tenant
        const product = await ProductConfig.findOne({
            where: {
                id: productId,
                tenantId,
                isActive: true
            },
            include: [{
                model: GlobalProduct,
                as: 'globalProduct',
                attributes: ['id', 'name', 'category', 'tier']
            }]
        });

        if (!product) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID',
                errors: [{
                    code: 'INVALID_PRODUCT_ID',
                    message: `Product ID ${productId} does not exist or is not active`
                }]
            });
        }

        // Initialize productSets if it doesn't exist
        let productSets = quote.productSets || {};

        // Get product name (support both custom and global products)
        const productName = product.isCustom && product.customProduct
            ? product.customProduct.name
            : product.globalProduct?.name || 'Unknown Product';

        // Apply product to all target categories based on scheme type
        switch (schemeType) {
            case 'turnkey':
                // For turnkey, apply to global surface types
                if (!productSets.global) {
                    productSets.global = {};
                }
                targetCategories.forEach(category => {
                    productSets.global[category] = {
                        productId: productId,
                        productName: productName,
                        quantity: productSets.global[category]?.quantity || 1,
                        unit: 'gallons',
                        cost: 0 // Will be calculated during pricing
                    };
                });
                break;

            case 'flat_rate_unit':
                // For flat_rate_unit, respect interior/exterior boundaries
                if (categoryType === 'interior') {
                    if (!productSets.interior) {
                        productSets.interior = {};
                    }
                    targetCategories.forEach(category => {
                        productSets.interior[category] = {
                            products: [{
                                productId: productId,
                                productName: productName,
                                pricePerUnit: 0, // Will be calculated
                                includedInUnitPrice: true
                            }],
                            unitCount: productSets.interior[category]?.unitCount || 0,
                            totalCost: 0
                        };
                    });
                } else if (categoryType === 'exterior') {
                    if (!productSets.exterior) {
                        productSets.exterior = {};
                    }
                    targetCategories.forEach(category => {
                        const existingData = productSets.exterior[category] || {};
                        productSets.exterior[category] = {
                            products: [{
                                productId: productId,
                                productName: productName,
                                pricePerUnit: 0,
                                includedInUnitPrice: true
                            }],
                            unitCount: existingData.unitCount || 0,
                            totalCost: 0,
                            // Preserve multiplier for garage doors
                            ...(category.startsWith('garageDoor') && existingData.multiplier !== undefined
                                ? { multiplier: existingData.multiplier }
                                : {})
                        };
                    });
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'categoryType (interior/exterior) is required for flat_rate_unit scheme',
                        errors: [{
                            code: 'MISSING_CATEGORY_TYPE',
                            message: 'categoryType must be specified as "interior" or "exterior" for flat_rate_unit'
                        }]
                    });
                }
                break;

            case 'unit_pricing':
                // For unit_pricing, apply to surface types across all areas
                if (!productSets.areas) {
                    productSets.areas = {};
                }

                // Get all area IDs from the quote
                const areaIds = quote.areas ? Object.keys(quote.areas) : [];

                areaIds.forEach(areaId => {
                    if (!productSets.areas[areaId]) {
                        productSets.areas[areaId] = {
                            areaName: quote.areas[areaId]?.name || areaId,
                            surfaces: {}
                        };
                    }

                    targetCategories.forEach(surfaceType => {
                        if (!productSets.areas[areaId].surfaces[surfaceType]) {
                            productSets.areas[areaId].surfaces[surfaceType] = {};
                        }

                        // Apply to all tiers or single tier
                        ['good', 'better', 'best', 'single'].forEach(tier => {
                            productSets.areas[areaId].surfaces[surfaceType][tier] = {
                                productId: productId,
                                productName: productName,
                                quantity: productSets.areas[areaId].surfaces[surfaceType][tier]?.quantity || 1,
                                unit: 'gallons',
                                cost: 0
                            };
                        });
                    });
                });
                break;

            case 'hourly':
                // For hourly, apply to all items
                if (!productSets.items) {
                    productSets.items = [];
                }

                // If no items exist, create a default one
                if (productSets.items.length === 0) {
                    productSets.items.push({
                        id: 'item-1',
                        description: 'Default item',
                        products: [],
                        estimatedHours: 0,
                        laborRate: 0,
                        laborCost: 0,
                        materialCost: 0,
                        totalCost: 0
                    });
                }

                // Apply product to all items
                productSets.items.forEach(item => {
                    if (!item.products) {
                        item.products = [];
                    }
                    // Replace or add the product
                    const existingIndex = item.products.findIndex(p => p.productId === productId);
                    const productData = {
                        productId: productId,
                        productName: productName,
                        quantity: 1,
                        unit: 'gallons',
                        cost: 0
                    };

                    if (existingIndex >= 0) {
                        item.products[existingIndex] = productData;
                    } else {
                        item.products.push(productData);
                    }
                });
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: `Unsupported pricing scheme: ${schemeType}`
                });
        }

        // Save updated productSets
        await quote.update({
            productSets: productSets
        });

        // Return updated productSets
        return res.json({
            success: true,
            message: 'Product applied to all specified categories successfully',
            data: {
                quoteId: quote.id,
                productSets: productSets,
                appliedProduct: {
                    id: productId,
                    name: productName,
                    category: product.isCustom && product.customProduct
                        ? product.customProduct.category
                        : product.globalProduct?.category || 'Unknown',
                    tier: product.isCustom && product.customProduct
                        ? product.customProduct.tier
                        : product.globalProduct?.tier || 'custom'
                },
                targetCategories: targetCategories,
                categoryType: categoryType
            }
        });

    } catch (error) {
        console.error('Error applying product to all categories:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to apply product to all categories',
            error: error.message
        });
    }
};

/**
 * POST /api/quotes/:quoteId/product-configuration/validate
 * Validate product configuration for a quote
 * Checks structure, required categories, and scheme-specific requirements
 */
exports.validateProductConfiguration = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { productSets, scheme } = req.body;
        const tenantId = req.user.tenantId;

        // Validate input
        if (!productSets || typeof productSets !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'productSets is required and must be an object',
                errors: [{
                    code: 'MISSING_PRODUCT_SETS',
                    message: 'productSets field is required'
                }]
            });
        }

        // Load quote to get pricing scheme if not provided
        const quote = await Quote.findOne({
            where: {
                id: quoteId,
                tenantId,
                isActive: true
            },
            include: [{
                model: PricingScheme,
                as: 'pricingScheme',
                attributes: ['id', 'name', 'type', 'description']
            }],
            attributes: ['id', 'pricingSchemeId', 'areas', 'flatRateItems']
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        // Determine scheme type
        const schemeType = scheme || (quote.pricingScheme ? mapPricingSchemeType(quote.pricingScheme.type) : null);

        if (!schemeType) {
            return res.status(400).json({
                success: false,
                message: 'Pricing scheme could not be determined',
                errors: [{
                    code: 'MISSING_SCHEME',
                    message: 'Quote does not have a pricing scheme assigned'
                }]
            });
        }

        const errors = [];
        const warnings = [];

        // Validate structure using existing validation function
        const structureValidation = validateProductSets(productSets, schemeType);
        errors.push(...structureValidation.errors);
        warnings.push(...structureValidation.warnings);

        // Additional scheme-specific validations
        switch (schemeType) {
            case 'turnkey':
                // Check that all common surface types have products
                const requiredSurfaces = ['walls', 'ceilings', 'trim', 'doors'];
                const missingSurfaces = requiredSurfaces.filter(surface =>
                    !productSets.global || !productSets.global[surface] || !productSets.global[surface].productId
                );

                if (missingSurfaces.length > 0) {
                    warnings.push({
                        code: 'INCOMPLETE_SURFACE_COVERAGE',
                        message: `Some common surface types are missing products: ${missingSurfaces.join(', ')}`,
                        missingSurfaces: missingSurfaces,
                        severity: 'warning'
                    });
                }
                break;

            case 'flat_rate_unit':
                // Check interior categories
                const requiredInteriorCategories = ['door', 'smallRoom', 'mediumRoom', 'largeRoom', 'closet', 'accentWall'];
                const missingInterior = requiredInteriorCategories.filter(cat =>
                    !productSets.interior || !productSets.interior[cat] ||
                    !productSets.interior[cat].products || productSets.interior[cat].products.length === 0
                );

                if (missingInterior.length > 0) {
                    warnings.push({
                        code: 'INCOMPLETE_INTERIOR_CATEGORIES',
                        message: `Some interior categories are missing products: ${missingInterior.join(', ')}`,
                        missingCategories: missingInterior,
                        severity: 'warning'
                    });
                }

                // Check exterior categories
                const requiredExteriorCategories = ['doors', 'windows'];
                const missingExterior = requiredExteriorCategories.filter(cat =>
                    !productSets.exterior || !productSets.exterior[cat] ||
                    !productSets.exterior[cat].products || productSets.exterior[cat].products.length === 0
                );

                if (missingExterior.length > 0) {
                    warnings.push({
                        code: 'INCOMPLETE_EXTERIOR_CATEGORIES',
                        message: `Some exterior categories are missing products: ${missingExterior.join(', ')}`,
                        missingCategories: missingExterior,
                        severity: 'warning'
                    });
                }

                // Validate garage door multipliers
                const garageDoorCategories = ['garageDoor1Car', 'garageDoor2Car', 'garageDoor3Car'];
                const expectedMultipliers = { garageDoor1Car: 0.5, garageDoor2Car: 1.0, garageDoor3Car: 1.5 };

                garageDoorCategories.forEach(category => {
                    if (productSets.exterior && productSets.exterior[category]) {
                        const multiplier = productSets.exterior[category].multiplier;
                        const expected = expectedMultipliers[category];

                        if (multiplier !== undefined && multiplier !== expected) {
                            warnings.push({
                                code: 'INVALID_GARAGE_DOOR_MULTIPLIER',
                                category: category,
                                currentMultiplier: multiplier,
                                expectedMultiplier: expected,
                                message: `Garage door multiplier for ${category} should be ${expected}x but is ${multiplier}x`,
                                severity: 'warning'
                            });
                        }
                    }
                });

                // Check cabinet subcategory completeness
                const hasCabinetsFace = productSets.interior?.cabinetsFace?.products?.length > 0;
                const hasCabinetsDoors = productSets.interior?.cabinetsDoors?.products?.length > 0;

                if (hasCabinetsFace && !hasCabinetsDoors) {
                    errors.push({
                        code: 'MISSING_CABINET_SUBCATEGORY',
                        category: 'cabinets',
                        subcategory: 'doors',
                        message: 'Cabinet doors product required when cabinet face is configured',
                        severity: 'error'
                    });
                }

                if (hasCabinetsDoors && !hasCabinetsFace) {
                    errors.push({
                        code: 'MISSING_CABINET_SUBCATEGORY',
                        category: 'cabinets',
                        subcategory: 'face',
                        message: 'Cabinet face product required when cabinet doors are configured',
                        severity: 'error'
                    });
                }
                break;

            case 'unit_pricing':
                // Check that all areas have at least some surface products
                if (productSets.areas && quote.areas) {
                    const quoteAreaIds = Object.keys(quote.areas);
                    const configuredAreaIds = Object.keys(productSets.areas);

                    const missingAreas = quoteAreaIds.filter(areaId => !configuredAreaIds.includes(areaId));

                    if (missingAreas.length > 0) {
                        warnings.push({
                            code: 'INCOMPLETE_AREA_COVERAGE',
                            message: `Some areas are missing product configuration: ${missingAreas.join(', ')}`,
                            missingAreas: missingAreas,
                            severity: 'warning'
                        });
                    }

                    // Check each configured area has at least one surface with products
                    configuredAreaIds.forEach(areaId => {
                        const areaData = productSets.areas[areaId];
                        if (!areaData.surfaces || Object.keys(areaData.surfaces).length === 0) {
                            warnings.push({
                                code: 'AREA_NO_SURFACES',
                                areaId: areaId,
                                message: `Area ${areaId} has no surface products configured`,
                                severity: 'warning'
                            });
                        }
                    });
                }
                break;

            case 'hourly':
                // Check that items have products
                if (!productSets.items || productSets.items.length === 0) {
                    warnings.push({
                        code: 'NO_ITEMS',
                        message: 'No items configured for hourly pricing',
                        severity: 'warning'
                    });
                } else {
                    productSets.items.forEach((item, index) => {
                        if (!item.products || item.products.length === 0) {
                            warnings.push({
                                code: 'ITEM_NO_PRODUCTS',
                                itemIndex: index,
                                message: `Item ${index} has no products configured`,
                                severity: 'warning'
                            });
                        }
                    });
                }
                break;
        }

        // Extract all product IDs and validate they exist
        const productIds = extractProductIds(productSets, schemeType);

        if (productIds.length > 0) {
            const validProducts = await ProductConfig.findAll({
                where: {
                    id: productIds,
                    tenantId,
                    isActive: true
                },
                attributes: ['id']
            });

            const validProductIds = validProducts.map(p => p.id);
            const invalidProductIds = productIds.filter(id => !validProductIds.includes(id));

            if (invalidProductIds.length > 0) {
                errors.push({
                    code: 'INVALID_PRODUCT_IDS',
                    message: `The following product IDs do not exist or are not active: ${invalidProductIds.join(', ')}`,
                    invalidIds: invalidProductIds,
                    severity: 'error'
                });
            }
        }

        // Validate quantities
        const quantityErrors = validateQuantities(productSets, schemeType);
        errors.push(...quantityErrors);

        // Return validation results
        return res.json({
            success: true,
            valid: errors.length === 0,
            data: {
                quoteId: quote.id,
                scheme: schemeType,
                errors: errors,
                warnings: warnings,
                summary: {
                    totalErrors: errors.length,
                    totalWarnings: warnings.length,
                    isValid: errors.length === 0,
                    hasWarnings: warnings.length > 0
                }
            }
        });

    } catch (error) {
        console.error('Error validating product configuration:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to validate product configuration',
            error: error.message
        });
    }
};

module.exports = exports;
/**
 * POST /api/quotes/:id/complete-job
 * Mark a quote's job as complete and set up for analytics
 */
exports.completeJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { finalInvoiceAmount, actualMaterialCost, actualLaborCost } = req.body;
        const tenantId = req.user.tenantId;

        // Validate input
        if (!finalInvoiceAmount || finalInvoiceAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Final invoice amount is required and must be greater than zero'
            });
        }

        // Find the quote
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

        // Check if job is already completed
        if (quote.isJobComplete()) {
            return res.status(400).json({
                success: false,
                message: 'Job is already marked as complete',
                data: {
                    completedAt: quote.jobCompletedAt,
                    finalInvoiceAmount: quote.finalInvoiceAmount
                }
            });
        }

        // Mark job as complete
        await quote.markJobComplete(finalInvoiceAmount, actualMaterialCost, actualLaborCost);

        // AUTOMATICALLY CALCULATE JOB ANALYTICS if overhead is configured
        let analyticsCalculated = false;
        let analyticsData = null;

        try {
            const ContractorSettings = require('../models/ContractorSettings');
            const settings = await ContractorSettings.findOne({
                where: { tenantId }
            });

            if (settings && settings.overheadPercent !== null && settings.overheadPercent !== undefined) {
                // Calculate analytics automatically
                const CostAllocationService = require('../services/CostAllocationService');
                const JobAnalytics = require('../models/JobAnalytics');

                const allocation = CostAllocationService.calculateAllocation(
                    parseFloat(finalInvoiceAmount),
                    actualMaterialCost ? parseFloat(actualMaterialCost) : null,
                    actualLaborCost ? parseFloat(actualLaborCost) : null,
                    parseFloat(settings.overheadPercent),
                    settings.netProfitPercent ? parseFloat(settings.netProfitPercent) : null
                );

                // Delete existing analytics if they exist
                await JobAnalytics.destroy({
                    where: { quoteId: quote.id }
                });

                // Create new analytics record
                const analytics = await JobAnalytics.create({
                    quoteId: quote.id,
                    tenantId: tenantId,
                    jobPrice: allocation.jobPrice,
                    actualMaterialCost: allocation.breakdown.materials.source === 'actual' ? allocation.breakdown.materials.amount : null,
                    actualLaborCost: allocation.breakdown.labor.source === 'actual' ? allocation.breakdown.labor.amount : null,
                    allocatedOverhead: allocation.breakdown.overhead.amount,
                    netProfit: allocation.breakdown.profit.amount,
                    materialPercentage: allocation.breakdown.materials.percentage,
                    laborPercentage: allocation.breakdown.labor.percentage,
                    overheadPercentage: allocation.breakdown.overhead.percentage,
                    profitPercentage: allocation.breakdown.profit.percentage,
                    materialSource: allocation.breakdown.materials.source,
                    laborSource: allocation.breakdown.labor.source,
                    calculatedAt: new Date()
                });

                // Mark quote as having analytics calculated
                await quote.markAnalyticsCalculated();

                analyticsCalculated = true;
                analyticsData = {
                    materialPercentage: parseFloat(analytics.materialPercentage),
                    laborPercentage: parseFloat(analytics.laborPercentage),
                    overheadPercentage: parseFloat(analytics.overheadPercentage),
                    profitPercentage: parseFloat(analytics.profitPercentage),
                    healthStatus: analytics.getHealthStatus(),
                };
            }
        } catch (analyticsError) {
            console.error('Error calculating analytics:', analyticsError);
            // Don't fail the request if analytics calculation fails
        }

        return res.json({
            success: true,
            message: 'Job marked as complete successfully',
            data: {
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber,
                customerName: quote.customerName,
                jobCompletedAt: quote.jobCompletedAt,
                finalInvoiceAmount: quote.finalInvoiceAmount,
                actualMaterialCost: quote.actualMaterialCost,
                actualLaborCost: quote.actualLaborCost,
                canCalculateAnalytics: quote.canCalculateAnalytics(),
                analyticsCalculated,
                analytics: analyticsData,
            }
        });

    } catch (error) {
        console.error('Error completing job:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to complete job',
            error: error.message
        });
    }
};

/**
 * GET /api/quotes/:id/job-status
 * Get job completion status for a quote
 */
exports.getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const quote = await Quote.findOne({
            where: {
                id,
                tenantId,
                isActive: true
            },
            attributes: [
                'id', 'quoteNumber', 'customerName', 'status',
                'jobCompletedAt', 'finalInvoiceAmount', 'actualMaterialCost',
                'actualLaborCost', 'analyticsCalculated', 'total'
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
            data: {
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber,
                customerName: quote.customerName,
                status: quote.status,
                isJobComplete: quote.isJobComplete(),
                jobCompletedAt: quote.jobCompletedAt,
                finalInvoiceAmount: quote.finalInvoiceAmount,
                originalTotal: quote.total,
                actualMaterialCost: quote.actualMaterialCost,
                actualLaborCost: quote.actualLaborCost,
                analyticsCalculated: quote.analyticsCalculated,
                canCalculateAnalytics: quote.canCalculateAnalytics()
            }
        });

    } catch (error) {
        console.error('Error getting job status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get job status',
            error: error.message
        });
    }
};

/**
 * GET /api/quotes/:quoteId/product-configuration
 * Get product configuration for a quote with available products
 * Returns scheme-specific structure with available products for tenant
 */
exports.getProductConfiguration = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const tenantId = req.user.tenantId;

        // Load quote with productSets and pricing scheme
        const quote = await Quote.findOne({
            where: {
                id: quoteId,
                tenantId,
                isActive: true
            },
            include: [{
                model: PricingScheme,
                as: 'pricingScheme',
                attributes: ['id', 'name', 'type', 'description', 'pricingRules']
            }],
            attributes: [
                'id', 'quoteNumber', 'productSets', 'pricingSchemeId',
                'customerName', 'status', 'jobType'
            ]
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        // Determine pricing scheme
        if (!quote.pricingScheme) {
            return res.status(400).json({
                success: false,
                message: 'Quote does not have a pricing scheme assigned'
            });
        }

        const schemeType = mapPricingSchemeType(quote.pricingScheme.type);

        // Fetch available products for tenant
        // OPTIMIZATION: Use eager loading to eliminate N+1 queries
        const availableProducts = await ProductConfig.findAll({
            where: {
                tenantId,
                isActive: true
            },
            include: [{
                model: GlobalProduct,
                as: 'globalProduct',
                where: {
                    isActive: true
                },
                attributes: ['id', 'name', 'category', 'tier', 'sheenOptions', 'notes'],
                include: [{
                    model: Brand,
                    as: 'brand',
                    attributes: ['id', 'name']
                }]
            }],
            attributes: [
                'id', 'globalProductId', 'sheens',

            ],
            order: [
                [{ model: GlobalProduct, as: 'globalProduct' }, 'tier', 'ASC'],
                [{ model: GlobalProduct, as: 'globalProduct' }, 'name', 'ASC']
            ]
        });

        // Process available products into a simplified format
        const processedProducts = availableProducts.map(config => {
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
                notes: product.notes
            };
        });

        // Return scheme-specific structure with available products
        return res.json({
            success: true,
            data: {
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber,
                customerName: quote.customerName,
                status: quote.status,
                jobType: quote.jobType,
                scheme: schemeType,
                pricingScheme: {
                    id: quote.pricingScheme.id,
                    name: quote.pricingScheme.name,
                    type: quote.pricingScheme.type,
                    description: quote.pricingScheme.description
                },
                productSets: quote.productSets || {},
                availableProducts: processedProducts,
                meta: {
                    totalProducts: processedProducts.length,
                    timestamp: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('Error fetching product configuration:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch product configuration',
            error: error.message
        });
    }
};


/**
 * POST /api/quotes/:quoteId/generate-proposal
 * Generate proposal PDF for a quote
 */
exports.generateProposalPDF = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const tenantId = req.user.tenantId;

        console.log(`[QuoteController] Generating proposal PDF for quote ${quoteId}`);

        // Import document generation service
        const documentGenerationService = require('../services/documentGenerationService');

        // Generate proposal PDF
        const result = await documentGenerationService.generateProposalPDF(quoteId, tenantId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                errorType: result.errorType,
                message: result.userMessage,
                missingFields: result.missingFields
            });
        }

        res.json({
            success: true,
            pdfUrl: result.pdfUrl,
            filename: result.filename,
            message: 'Proposal PDF generated successfully'
        });

    } catch (error) {
        console.error('[QuoteController] Error generating proposal PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to generate proposal PDF'
        });
    }
};

/**
 * POST /api/quotes/:quoteId/regenerate-proposal
 * Regenerate proposal PDF with latest quote data
 */
exports.regenerateProposalPDF = async (req, res) => {
    try {
        const { quoteId } = req.params;

        console.log(`[QuoteController] Regenerating proposal PDF for quote ${quoteId}`);

        // Import document generation service
        const documentGenerationService = require('../services/documentGenerationService');

        // Regenerate proposal PDF
        const result = await documentGenerationService.regenerateProposalPDF(quoteId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                errorType: result.errorType,
                message: result.userMessage
            });
        }

        res.json({
            success: true,
            pdfUrl: result.pdfUrl,
            filename: result.filename,
            message: 'Proposal PDF regenerated successfully'
        });

    } catch (error) {
        console.error('[QuoteController] Error regenerating proposal PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to regenerate proposal PDF'
        });
    }
};
