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
const LaborRate = require('../models/LaborRate');
const LaborCategory = require('../models/LaborCategory');

/**
 * Normalize and structure product data based on pricing scheme type
 * Converts between global (turnkey) and area-wise (flat_rate, production_based, rate_based) structures
 * @param {Object} productData - Raw product data from frontend
 * @param {Object} pricingScheme - Pricing scheme object with type property
 * @param {Array} areas - Array of area objects with laborItems
 * @returns {Object} - Normalized product structure
 */
function normalizeProductSets(productData, pricingScheme, areas = []) {
    if (!productData) return [];

    const schemeType = pricingScheme?.type || 'standard';
    const isTurnkey = schemeType === 'turnkey' || schemeType === 'sqft_turnkey';
    const isAreaWise = ['flat_rate_unit', 'production_based', 'rate_based_sqft', 'rate_based'].includes(schemeType);

    // If it's already an array with the correct structure, return as-is
    if (Array.isArray(productData)) {
        // Check if first element has the new structure (areaId, surfaceType, products)
        if (productData.length > 0 && productData[0].areaId !== undefined && productData[0].surfaceType !== undefined) {
            console.log('✅ ProductSets already in correct array format, returning as-is');
            return productData;
        }

        // Check if it's turnkey format (surfaceType without areaId)
        if (isTurnkey && productData.length > 0 && productData[0].surfaceType !== undefined && !productData[0].areaId) {
            console.log('✅ ProductSets in turnkey format, returning as-is');
            return productData;
        }

        console.log('⚠️ ProductSets array in unknown format, returning as-is');
        return productData;
    }

    // If it's an old object structure, convert to array
    if (typeof productData === 'object' && !Array.isArray(productData)) {
        console.log('🔄 Converting legacy object structure to array');
        const converted = [];

        if (isTurnkey) {
            // Convert object with surfaceType keys to array
            Object.entries(productData).forEach(([surfaceType, data]) => {
                converted.push({
                    surfaceType,
                    products: data.products || {},
                    ...data
                });
            });
        } else if (isAreaWise) {
            // Convert nested object structure to flat array
            Object.entries(productData).forEach(([areaId, areaData]) => {
                if (areaData.surfaces && typeof areaData.surfaces === 'object') {
                    Object.entries(areaData.surfaces).forEach(([surfaceType, surfaceData]) => {
                        converted.push({
                            areaId: parseInt(areaId) || areaId,
                            areaName: areaData.areaName || `Area ${areaId}`,
                            surfaceType,
                            surfaceName: surfaceType,
                            products: surfaceData.products || {},
                            quantity: surfaceData.quantity,
                            unit: surfaceData.unit,
                            overridden: surfaceData.overridden || false
                        });
                    });
                }
            });
        }

        return converted;
    }

    // Default: return empty array
    return [];
}

/**
 * Enhance product sets with area and surface information from laborItems
 * Used to validate and enrich product data with area context
 * @param {Array} productSets - Product sets array to enhance
 * @param {Array} areas - Array of area objects
 * @param {String} schemeType - Pricing scheme type
 * @returns {Array} - Enhanced product sets array
 */
function enrichProductSetsWithAreaData(productSets, areas = [], schemeType = 'standard') {
    const isAreaWise = ['flat_rate_unit', 'production_based', 'rate_based_sqft', 'rate_based'].includes(schemeType);

    if (!isAreaWise) {
        return productSets; // No enrichment needed for turnkey
    }

    // If productSets is already an array, return as-is (already in correct format)
    if (Array.isArray(productSets)) {
        console.log('✅ ProductSets is array, skipping enrichment');
        return productSets;
    }

    // Convert old object structure to array if needed (legacy support)
    if (typeof productSets === 'object' && !Array.isArray(productSets)) {
        console.log('🔄 Converting object structure to array in enrichment');
        const enrichedArray = [];

        // For each area, ensure product entries exist for selected surfaces
        areas.forEach((area, areaIndex) => {
            const areaId = area.id || areaIndex;
            const areaData = productSets[areaId];

            if (!areaData) return;

            // For each selected labor item (surface), create array entry
            if (area.laborItems && Array.isArray(area.laborItems)) {
                area.laborItems.forEach(item => {
                    if (!item.selected || !item.categoryName) return;

                    const surfaceData = areaData.surfaces?.[item.categoryName];
                    if (surfaceData) {
                        enrichedArray.push({
                            areaId,
                            areaName: area.name || `Area ${areaId}`,
                            surfaceType: item.categoryName,
                            surfaceName: item.categoryName,
                            products: surfaceData.products || {},
                            quantity: surfaceData.quantity || item.quantity,
                            unit: surfaceData.unit || item.measurementUnit,
                            overridden: surfaceData.overridden || false
                        });
                    }
                });
            }
        });

        return enrichedArray;
    }

    return productSets || [];
}

/**
 * Convert area-wise product structure to flat array for API responses or legacy systems
 * @param {Object} productSets - Area-wise product sets object
 * @returns {Array} - Flat array of product sets
 */
function flattenAreaWiseProducts(productSets) {
    if (Array.isArray(productSets)) {
        return productSets; // Already flat
    }

    if (!productSets || typeof productSets !== 'object') {
        return [];
    }

    const flattened = [];

    // For each area
    Object.entries(productSets).forEach(([areaKey, areaData]) => {
        if (!areaData.surfaces) {
            return; // Skip if not area-wise format
        }

        // For each surface in that area
        Object.entries(areaData.surfaces).forEach(([surfaceType, surfaceData]) => {
            flattened.push({
                areaId: areaData.areaId || areaKey,
                areaName: areaData.areaName,
                surfaceType,
                products: surfaceData.products || {},
                quantity: surfaceData.quantity,
                unit: surfaceData.unit
            });
        });
    });

    return flattened;
}

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
            attributes: [
                'turnkeyInteriorRate', 'turnkeyExteriorRate', 'productionInteriorWalls',
                'productionInteriorCeilings', 'productionInteriorTrim', 'productionExteriorWalls',
                'productionExteriorTrim', 'productionSoffitFascia', 'productionDoors',
                'productionCabinets', 'defaultBillableLaborRate', 'crewSize',
                'flatRateUnitPrices', 'laborMarkupPercent', 'materialMarkupPercent',
                'overheadPercent', 'netProfitPercent', 'taxRatePercentage',
                'depositPercent', 'quoteValidityDays'
            ],
            raw: true
        });

        // Get pricing scheme
        const pricingScheme = await PricingScheme.findByPk(quote.pricingSchemeId, {
            attributes: ['id', 'type', 'pricingRules'],
            raw: true
        });

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
            'flat_rate_unit': "flat_rate_unit",
            'room_flat_rate': 'flat_rate_unit',
        };

        const model = modelMap[schemeType] || schemeType;

        // Fetch labor category rates for rate-based pricing
        const LaborRate = require('../models/LaborRate');
        const LaborCategory = require('../models/LaborCategory');

        const laborCategoryRates = await LaborRate.findAll({
            where: { tenantId, isActive: true },
            attributes: ['rate'],
            include: [{
                model: LaborCategory,
                as: 'category',
                attributes: ['categoryName'],
                where: { isActive: true },
                required: true
            }],
            raw: true,
            nest: true
        });

        // Build labor rates object for rate-based pricing
        const laborRatesMap = {};
        laborCategoryRates.forEach(lcr => {
            const categoryName = lcr.category.categoryName;
            laborRatesMap[categoryName] = parseFloat(lcr.rate);
        });

        // Merge material calculation overrides from quote data
        const mergedRules = {
            ...rules,
            includeMaterials: quote.includeMaterials ?? rules.includeMaterials ?? true,
            coverage: quote.coverage || rules.coverage || 350,
            applicationMethod: quote.applicationMethod || rules.applicationMethod || 'roll',
            coats: quote.coats || rules.coats || 2,
            costPerGallon: rules.costPerGallon || 40,

            // Turnkey rates from contractor settings
            interiorRate: settings?.turnkeyInteriorRate || 3.50,
            exteriorRate: settings?.turnkeyExteriorRate || 3.50,

            // Labor rates for rate-based pricing (from labor_category_rates table)
            laborRates: {
                walls: laborRatesMap['Walls'] || 0.55,
                ceilings: laborRatesMap['Ceilings'] || 0.65,
                trim: laborRatesMap['Trim'] || 2.50,
                doors: laborRatesMap['Doors'] || 45,
                cabinets: laborRatesMap['Cabinets'] || 65,
                'exterior walls': laborRatesMap['Exterior Walls'] || 0.55,
                'exterior trim': laborRatesMap['Exterior Trim'] || 2.50,
                'exterior doors': laborRatesMap['Exterior Doors'] || 45,
                'deck': laborRatesMap['Decks & Railings'] || 2.00,
                'soffit & fascia': laborRatesMap['Soffit & Fascia'] || 2.50,
                'shutters': laborRatesMap['Shutters'] || 50,
            },

            // Production rates from contractor settings (sqft/hour or units/hour)
            productionRates: {
                walls: settings?.productionInteriorWalls || 300,
                ceilings: settings?.productionInteriorCeilings || 250,
                trim: settings?.productionInteriorTrim || 150,
                'exterior walls': settings?.productionExteriorWalls || 250,
                'exterior trim': settings?.productionExteriorTrim || 120,
                'soffit & fascia': settings?.productionSoffitFascia || 100,
                doors: settings?.productionDoors || 2,
                cabinets: settings?.productionCabinets || 1.5,
            },
            billableLaborRate: settings?.defaultBillableLaborRate || 50,
            crewSize: settings?.crewSize || 1,

            // Flat rate unit prices from contractor settings
            flatRateUnitPrices: settings?.flatRateUnitPrices || {
                // Interior items
                door: 85,
                doors: 85,
                smallRoom: 350,
                mediumRoom: 450,
                largeRoom: 600,
                closet: 150,
                accentWall: 200,
                cabinet: 125,
                cabinets: 125,
                cabinetsFace: 300,
                cabinetsDoors: 400,
                // Exterior items
                exteriorDoor: 95,
                exteriorDoors: 95,
                window: 75,
                windows: 75,
                garageDoor: 200,
                garageDoors: 200,
                garageDoor1Car: 150,  // 1-car garage door base price (will be multiplied by 0.5x)
                garageDoor2Car: 200,  // 2-car garage door base price (will be multiplied by 1.0x)
                garageDoor3Car: 250,  // 3-car garage door base price (will be multiplied by 1.5x)
                shutter: 50,
                shutters: 50,
                // Legacy support
                room_small: 350,
                room_medium: 450,
                room_large: 600,
                walls: 2.5,
                ceilings: 2.0,
                trim: 1.5,
            },
        };

        // Transform areas data: convert laborItems to items format expected by calculator
        const transformedAreas = (quote.areas || []).map(area => {
            // Use laborItems if available (new format), otherwise use items (old format)
            const items = area.laborItems || area.items || [];
            const selectedItems = items.filter(item => item.selected);

            return {
                name: area.name || 'Unnamed Area',
                items: selectedItems.map(item => ({
                    categoryName: item.categoryName,
                    quantity: parseFloat(item.quantity) || 0,
                    measurementUnit: item.measurementUnit || 'sqft',
                    laborRate: parseFloat(item.laborRate) || 0,
                    numberOfCoats: parseInt(item.numberOfCoats) || 2,
                }))
            };
        }).filter(area => area.items.length > 0); // Only include areas with selected items

        // Prepare calculation parameters
        const params = {
            model,
            rules: mergedRules,
            areas: transformedAreas,
            flatRateItems: quote.flatRateItems, // Add flat rate items support
            productSets: quote.productSets, // Add product sets for turnkey and other pricing schemes
            homeSqft: quote.homeSqft || 0,
            jobScope: quote.jobType || 'interior',
            conditionModifier: quote.conditionModifier || 'average', // CRITICAL: Pass condition modifier for turnkey
            analytics: {
                tenantId: quote.tenantId,
                userId: quote.userId,
                quoteId: quote.id
            }
        };
        // Include contractor settings so calculators can prefer tenant-specific rates
        params.settings = settings || {};

        // Calculate base pricing using unified calculator
        const basePricing = calculatePricing(params);

        // Apply markups, overhead, profit, and tax
        const finalPricing = applyMarkupsAndTax(basePricing, {
            laborMarkupPercent: parseFloat(settings?.laborMarkupPercent) || 0,
            materialMarkupPercent: parseFloat(settings?.materialMarkupPercent) || 0,
            overheadPercent: parseFloat(settings?.overheadPercent) || 0,
            profitMarginPercent: parseFloat(settings?.netProfitPercent) || 0,
            taxRatePercentage: parseFloat(settings?.taxRatePercentage) || 0,
            depositPercent: parseFloat(settings?.depositPercent) || 0,
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
            attributes: [
                'laborMarkupPercent', 'materialMarkupPercent', 'overheadPercent',
                'netProfitPercent', 'taxRatePercentage', 'quoteValidityDays', 'depositPercent'
            ],
            raw: true
        });

        // Get Pricing Engine metrics - Ensure all values are numbers
        const laborMarkupPercent = parseFloat(settings?.laborMarkupPercent) || 0;
        const materialMarkupPercent = parseFloat(settings?.materialMarkupPercent) || 0;
        const overheadPercent = parseFloat(settings?.overheadPercent) || 0;
        const netProfitPercent = parseFloat(settings?.netProfitPercent) || 0;
        const taxRate = parseFloat(settings?.taxRatePercentage) || 0;
        const quoteValidityDays = parseInt(settings?.quoteValidityDays) || 30;
        const depositPercent = parseFloat(settings?.depositPercent) || 0;

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

        // Step 6: Calculate tax (only on markup amounts, not full subtotal)
        const totalMarkupAmount = laborMarkupAmount + materialMarkupAmount + overheadAmount + profitAmount;
        const taxAmount = totalMarkupAmount * (taxRate / 100);

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
 * Create or update quote (enhanced auto-save functionality with optimistic locking)
 * POST /api/quote-builder/save-draft
 */
exports.saveDraft = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;
        const {
            quoteId,
            lastModified, // Client's last known modification timestamp
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
            flatRateItems,  // CRITICAL: Flat rate items for unit-based pricing
        } = req.body;

        let quote;
        let client;
        let isNewQuote = false;

        // OPTIMISTIC LOCKING: Check for conflicts if updating existing quote
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

            // Check for conflicts using optimistic locking
            if (lastModified) {
                const clientLastModified = new Date(lastModified);
                const serverLastModified = new Date(quote.lastModified);

                // Calculate time difference
                const timeDifferenceMs = serverLastModified - clientLastModified;

                // More lenient conflict detection:
                // 1. Allow updates within 30 seconds (covers auto-save scenarios)
                // 2. Always allow if same user (userId matches)
                const GRACE_PERIOD_MS = 30000; // 30 seconds
                const isSameUser = quote.userId === userId;

                // Only trigger conflict if:
                // - Time difference exceeds grace period AND
                // - It's a different user (multi-user scenario)
                if (timeDifferenceMs > GRACE_PERIOD_MS && !isSameUser) {
                    // Conflict detected - return conflict resolution data
                    await transaction.rollback();

                    // Get the current server data for conflict resolution
                    const conflictQuote = await Quote.findByPk(quoteId, {
                        include: [
                            { model: Client, as: 'client' },
                            { model: PricingScheme, as: 'pricingScheme' },
                        ],
                    });

                    return res.status(409).json({
                        success: false,
                        conflict: true,
                        message: 'Quote has been modified by another user. Please resolve conflicts.',
                        serverData: {
                            quote: conflictQuote,
                            lastModified: conflictQuote.lastModified,
                            autoSaveVersion: conflictQuote.autoSaveVersion
                        },
                        clientData: {
                            lastModified: clientLastModified,
                            // Include the client's data for comparison
                            areas,
                            productSets,
                            notes,
                            customerName,
                            customerEmail,
                            customerPhone
                        }
                    });
                }

                // If same user or within grace period, log but allow the update
                if (timeDifferenceMs > 0) {
                    console.log(`[Auto-save] Allowing update despite timestamp difference: ${timeDifferenceMs}ms (same user: ${isSameUser})`);
                }
            }
        }

        // Find or create client if we have email
        if (customerEmail) {
            try {
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

                // Update client if data changed - only update fields with valid values
                if (client && (customerName || customerPhone || street || city || state || zipCode)) {
                    const clientUpdateData = {};

                    // Only include fields that have non-empty values
                    if (customerName && customerName.trim()) clientUpdateData.name = customerName.trim();
                    if (customerPhone && customerPhone.trim()) clientUpdateData.phone = customerPhone.trim();
                    if (street && street.trim()) clientUpdateData.street = street.trim();
                    if (city && city.trim()) clientUpdateData.city = city.trim();
                    if (state && state.trim()) clientUpdateData.state = state.trim();
                    if (zipCode && zipCode.trim()) clientUpdateData.zip = zipCode.trim();

                    // Only update if there are fields to update
                    if (Object.keys(clientUpdateData).length > 0) {
                        await client.update(clientUpdateData, { transaction });
                    }
                }
            } catch (clientError) {
                console.error('Client find/create failed:', clientError);
                await transaction.rollback();
                return res.status(500).json({
                    success: false,
                    message: `Failed to find/create client: ${clientError.message}`,
                });
            }
        }

        // Create new quote if not updating existing one
        if (!quote) {
            isNewQuote = true;

            // Generate quote number
            let quoteNumber;
            try {
                quoteNumber = await Quote.generateQuoteNumber(tenantId, client?.id || null);

                // Check if this quote number already exists
                const existingQuote = await Quote.findOne({
                    where: { quoteNumber, tenantId }
                });
                if (existingQuote) {
                    await transaction.rollback();
                    return res.status(409).json({
                        success: false,
                        message: `Quote number ${quoteNumber} already exists. Please try again.`,
                    });
                }
            } catch (genError) {
                console.error('Error generating quote number:', genError);
                await transaction.rollback();
                return res.status(500).json({
                    success: false,
                    message: `Failed to generate quote number: ${genError.message}`,
                });
            }

            // Validate pricingSchemeId if provided
            let validatedPricingSchemeId = null;
            if (pricingSchemeId) {
                try {
                    const scheme = await PricingScheme.findOne({
                        where: { id: pricingSchemeId, tenantId }
                    });
                    if (scheme) {
                        validatedPricingSchemeId = pricingSchemeId;
                    }
                } catch (schemeError) {
                    console.error('Error validating pricing scheme:', schemeError);
                    await transaction.rollback();
                    return res.status(500).json({
                        success: false,
                        message: `Failed to validate pricing scheme: ${schemeError.message}`,
                    });
                }
            }

            // Parse and validate JSON fields
            let parsedAreas = areas || [];
            let parsedProductSets = productSets || [];

            if (typeof parsedAreas === 'string') {
                try {
                    parsedAreas = JSON.parse(parsedAreas);
                } catch (e) {
                    parsedAreas = [];
                }
            }

            if (typeof parsedProductSets === 'string') {
                try {
                    parsedProductSets = JSON.parse(parsedProductSets);
                } catch (e) {
                    parsedProductSets = [];
                }
            }

            // Ensure they are proper arrays/objects
            const safeAreas = Array.isArray(parsedAreas) ? parsedAreas : [];
            const safeProductSets = Array.isArray(parsedProductSets) ? parsedProductSets : [];

            // Parse flatRateItems if it's a string
            let parsedFlatRateItems = flatRateItems || {};
            if (typeof parsedFlatRateItems === 'string') {
                try {
                    parsedFlatRateItems = JSON.parse(parsedFlatRateItems);
                } catch (e) {
                    parsedFlatRateItems = {};
                }
            }
            const safeFlatRateItems = parsedFlatRateItems || {};

            // Create quote with auto-save version tracking
            const currentTime = new Date();
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
                productSets: safeProductSets,
                flatRateItems: safeFlatRateItems,  // CRITICAL: Save flat rate items
                homeSqft: req.body.homeSqft || null,
                jobScope: req.body.jobScope || null,
                numberOfStories: req.body.numberOfStories || null,
                conditionModifier: req.body.conditionModifier || null,
                notes: notes || null,
                status: 'draft',
                lastModified: currentTime,
                autoSaveVersion: 1,
                // Initialize financial fields
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
            };

            quote = await Quote.create(quoteData, { transaction });
        } else {
            // Update existing quote with version increment
            const updateData = {
                lastModified: new Date(),
                autoSaveVersion: quote.autoSaveVersion + 1
            };

            // Update fields if provided
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
            if (flatRateItems !== undefined) updateData.flatRateItems = flatRateItems;  // CRITICAL: Update flat rate items
            if (productStrategy !== undefined) updateData.productStrategy = productStrategy;
            if (allowCustomerProductChoice !== undefined) updateData.allowCustomerProductChoice = allowCustomerProductChoice;
            if (notes !== undefined) updateData.notes = notes;
            if (client) updateData.clientId = client.id;

            // Add turnkey-specific fields
            if (req.body.homeSqft !== undefined) updateData.homeSqft = req.body.homeSqft;
            if (req.body.jobScope !== undefined) updateData.jobScope = req.body.jobScope;
            if (req.body.numberOfStories !== undefined) updateData.numberOfStories = req.body.numberOfStories;
            if (req.body.conditionModifier !== undefined) updateData.conditionModifier = req.body.conditionModifier;

            await quote.update(updateData, { transaction });
        }

        // Reload quote to get updated data
        await quote.reload({ transaction });

        // Calculate pricing if we have sufficient data
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
                    // Production-based: needs areas and product selections
                    if (quote.areas && quote.areas.length > 0 && quote.productSets &&
                        (Array.isArray(quote.productSets) ? quote.productSets.length > 0 : Object.keys(quote.productSets).length > 0)) {
                        shouldCalculate = true;
                        calculationReason = `${schemeType} with ${quote.areas.length} areas and product selections`;
                    }
                    break;

                case 'flat_rate_unit':
                    // Flat rate: needs flatRateItems (areas and products are optional)
                    if (quote.flatRateItems && (
                        Object.values(quote.flatRateItems.interior || {}).some(count => count > 0) ||
                        Object.values(quote.flatRateItems.exterior || {}).some(count => count > 0)
                    )) {
                        shouldCalculate = true;
                        const totalItems = Object.values(quote.flatRateItems.interior || {}).reduce((sum, count) => sum + (count || 0), 0) +
                            Object.values(quote.flatRateItems.exterior || {}).reduce((sum, count) => sum + (count || 0), 0);
                        calculationReason = `${schemeType} with ${totalItems} flat rate items`;
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
        }

        if (shouldCalculate) {
            try {
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

                // Update quote with calculated pricing
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
                    depositAmount: depositAmount,
                    lastModified: new Date(), // Update timestamp after calculation
                    autoSaveVersion: quote.autoSaveVersion + 1 // Increment version after calculation
                }, { transaction });
            } catch (calcError) {
                console.error('Pricing calculation error during auto-save:', calcError);
                // Continue without calculation - don't fail the save
            }
        }

        // Create audit log
        await createAuditLog({
            category: 'quote',
            action: isNewQuote ? 'Quote draft created' : 'Quote draft updated',
            userId,
            tenantId,
            entityType: 'Quote',
            entityId: quote.id,
            metadata: {
                quoteNumber: quote.quoteNumber,
                status: quote.status,
                autoSaveVersion: quote.autoSaveVersion,
                hasConflictResolution: !!lastModified
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            transaction,
        });

        await transaction.commit();

        // Reload with associations for response
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
            autoSave: {
                version: savedQuote.autoSaveVersion,
                lastModified: savedQuote.lastModified,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        console.error('Enhanced auto-save error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save quote draft',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Resolve conflict by choosing a version (server or client)
 * POST /api/quote-builder/resolve-conflict
 */
exports.resolveConflict = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;
        const { quoteId, resolution, data } = req.body;

        if (!quoteId || !resolution || !data) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Quote ID, resolution type, and data are required'
            });
        }

        if (!['server', 'client'].includes(resolution)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Resolution must be either "server" or "client"'
            });
        }

        // Find the quote
        const quote = await Quote.findOne({
            where: { id: quoteId, tenantId },
            transaction
        });

        if (!quote) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }

        if (resolution === 'server') {
            // Keep server version - just return current quote
            await transaction.commit();

            const savedQuote = await Quote.findByPk(quote.id, {
                include: [
                    { model: Client, as: 'client' },
                    { model: PricingScheme, as: 'pricingScheme' },
                ],
            });

            return res.json({
                success: true,
                message: 'Conflict resolved - server version kept',
                quote: savedQuote,
                resolution: 'server'
            });
        } else {
            // Use client version - update quote with client data
            const updateData = {
                lastModified: new Date(),
                autoSaveVersion: quote.autoSaveVersion + 1
            };

            // Update with client data
            if (data.customerName !== undefined) updateData.customerName = data.customerName;
            if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail;
            if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
            if (data.street !== undefined) updateData.street = data.street;
            if (data.city !== undefined) updateData.city = data.city;
            if (data.state !== undefined) updateData.state = data.state;
            if (data.zipCode !== undefined) updateData.zipCode = data.zipCode;
            if (data.areas !== undefined) updateData.areas = data.areas;
            if (data.productSets !== undefined) updateData.productSets = data.productSets;
            if (data.notes !== undefined) updateData.notes = data.notes;

            await quote.update(updateData, { transaction });

            // Create audit log for conflict resolution
            await createAuditLog({
                category: 'quote',
                action: 'Quote conflict resolved - client version chosen',
                userId,
                tenantId,
                entityType: 'Quote',
                entityId: quote.id,
                metadata: {
                    quoteNumber: quote.quoteNumber,
                    resolution: 'client',
                    autoSaveVersion: updateData.autoSaveVersion
                },
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                transaction,
            });

            await transaction.commit();

            const savedQuote = await Quote.findByPk(quote.id, {
                include: [
                    { model: Client, as: 'client' },
                    { model: PricingScheme, as: 'pricingScheme' },
                ],
            });

            return res.json({
                success: true,
                message: 'Conflict resolved - client version applied',
                quote: savedQuote,
                resolution: 'client'
            });
        }
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        console.error('Conflict resolution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve conflict',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};
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
            flatRateItems,  // CRITICAL: Flat rate items from frontend
            // NEW: Material calculation options
            includeMaterials = true,
            coverage = 350,
            applicationMethod = 'roll',
            coats = 2,
            selectedTier = 'better'  // NEW: GBB tier selection (good/better/best/single)
        } = req.body;
        const tenantId = req.user.tenantId;

        // =====================================================
        // CONSOLE LOG: START OF CALCULATION
        // =====================================================
        console.log('\n\n');
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║         🧮 QUOTE CALCULATION PROCESS - DETAILED BREAKDOWN       ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('\n');

        // Log input data
        console.log('📥 INPUT DATA RECEIVED:');
        console.log('─────────────────────────────────────────────────────────────────');
        console.log('  • Job Type:', jobType);
        console.log('  • Home Sq Ft:', homeSqft);
        console.log('  • Number of Stories:', numberOfStories);
        console.log('  • Condition Modifier:', conditionModifier);
        console.log('  • Pricing Scheme ID:', pricingSchemeId);
        console.log('  • Selected Tier:', selectedTier);
        console.log('  • Include Materials:', includeMaterials);
        console.log('  • Coverage:', coverage, 'sq ft per gallon');
        console.log('  • Application Method:', applicationMethod);
        console.log('  • Coats:', coats);
        console.log('  • Areas Count:', areas?.length || 0);
        if (areas && areas.length > 0) {
            areas.forEach((area, idx) => {
                const selectedItems = area.laborItems?.filter(i => i.selected) || [];
                console.log(`    └─ Area ${idx + 1}: "${area.name}" (${selectedItems.length} items selected)`);
            });
        }
        console.log('\n');

        // Helper: Get tier-specific value from GBB structure
        const getTierValue = (baseValue, gbbOverrides, tier = selectedTier) => {
            if (!gbbOverrides || !gbbOverrides[tier]) return baseValue;
            return gbbOverrides[tier] ?? baseValue;
        };

        // Helper: Map internal pricing model type to friendly name
        const getPricingModelFriendlyName = (type) => {
            const typeMap = {
                'turnkey': 'Standard Turnkey Pricing',
                'sqft_turnkey': 'Standard Turnkey Pricing',
                'sqft_labor_paint': 'Rate-Based Pricing (Labor + Materials)',
                'rate_based_sqft': 'Rate-Based Pricing (Labor + Materials)',
                'hourly_time_materials': 'Production-Based Pricing (Time & Materials)',
                'production_based': 'Production-Based Pricing (Time & Materials)',
                'unit_pricing': 'Flat Rate Unit Pricing',
                'flat_rate_unit': 'Flat Rate Unit Pricing',
                'room_flat_rate': 'Flat Rate Unit Pricing'
            };
            return typeMap[type] || type;
        };

        // Helper: Round gallons to nearest whole number (1.2-1.9 → 2, 2.1-2.9 → 3)
        const roundGallons = (gallons) => {
            return Math.ceil(gallons);
        };

        // Helper: Get product set for a surface type
        const getProductSetForSurface = (surfaceType) => {
            if (!productSets) return null;
            if (Array.isArray(productSets)) {
                return productSets.find(ps =>
                    ps.surfaceType === surfaceType ||
                    ps.surfaceType?.toLowerCase().includes(surfaceType?.toLowerCase())
                );
            }
            return productSets[surfaceType];
        };

        // Get pricing scheme (optional - use default if not provided)
        let pricingScheme = null;
        if (pricingSchemeId) {
            pricingScheme = await PricingScheme.findOne({
                where: { id: pricingSchemeId, tenantId },
                attributes: ['id', 'name', 'type', 'isDefault', 'pricingRules'],
                raw: true
            });
        }

        // If no pricing scheme provided or not found, get the first available one
        if (!pricingScheme) {
            pricingScheme = await PricingScheme.findOne({
                where: { tenantId },
                order: [['createdAt', 'ASC']],
                attributes: ['id', 'name', 'type', 'isDefault', 'pricingRules'],
                raw: true
            });
        }

        // =====================================================
        // CONSOLE LOG: PRICING SCHEME INFO
        // =====================================================
        console.log('🏷️  PRICING SCHEME SELECTED:');
        console.log('─────────────────────────────────────────────────────────────────');
        if (pricingScheme) {
            console.log('  • Scheme Name:', pricingScheme.name);
            console.log('  • Scheme Type:', pricingScheme.type);
            console.log('  • Friendly Name:', getPricingModelFriendlyName(pricingScheme.type));
            console.log('  • Scheme ID:', pricingScheme.id);
            console.log('  • Is Default:', pricingScheme.isDefault);
            console.log('\n  📋 Pricing Rules:');
            const rules = pricingScheme.pricingRules || {};
            console.log('    ├─ Turnkey Rate:', rules.turnkeyRate);
            console.log('    ├─ Interior Rate:', rules.interiorRate);
            console.log('    ├─ Exterior Rate:', rules.exteriorRate);
            console.log('    ├─ Include Materials:', rules.includeMaterials);
            console.log('    ├─ Coverage (sqft/gal):', rules.coverage);
            console.log('    ├─ Application Method:', rules.applicationMethod);
            console.log('    ├─ Coats:', rules.coats);
            console.log('    └─ Cost Per Gallon:', rules.costPerGallon);
        } else {
            console.log('  ⚠️  No pricing scheme found - using defaults');
        }
        console.log('\n');

        // Get contractor settings for markup, tax, etc.
        const settings = await ContractorSettings.findOne({
            where: { tenantId },
            attributes: [
                'laborMarkupPercent', 'materialMarkupPercent', 'overheadPercent',
                'netProfitPercent', 'taxRatePercentage', 'depositPercent',
                'quoteValidityDays', 'turnkeyInteriorRate', 'turnkeyExteriorRate'
            ],
            raw: true
        });

        // Fetch labor rates from database for rate-based pricing
        const LaborRate = require('../models/LaborRate');
        const LaborCategory = require('../models/LaborCategory');

        const laborCategoryRates = await LaborRate.findAll({
            where: { tenantId, isActive: true },
            attributes: ['rate'],
            include: [{
                model: LaborCategory,
                as: 'category',
                attributes: ['categoryName'],
                where: { isActive: true },
                required: true
            }],
            raw: true,
            nest: true
        });

        // Build labor rates map from database
        const laborRatesMap = {};
        laborCategoryRates.forEach(lcr => {
            const categoryName = lcr.category.categoryName.toLowerCase();
            laborRatesMap[categoryName] = parseFloat(lcr.rate);
        });

        // Get pricing rules with material options (still needed for some settings)
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

        // =====================================================
        // CONSOLE LOG: MATERIAL SETTINGS
        // =====================================================
        console.log('🎨 MATERIAL CALCULATION SETTINGS:');
        console.log('─────────────────────────────────────────────────────────────────');
        console.log('  • Include Materials:', finalIncludeMaterials);
        console.log('  • Coverage Rate:', finalCoverage, 'sq ft per gallon');
        console.log('  • Application Method:', finalApplicationMethod);
        console.log('  • Coats:', finalCoats);
        console.log('\n');

        console.log('⚙️  CONTRACTOR SETTINGS (Pricing Engine):');
        console.log('─────────────────────────────────────────────────────────────────');
        console.log('  • Labor Markup %:', settings?.laborMarkupPercent || 0);
        console.log('  • Material Markup %:', settings?.materialMarkupPercent || 35);
        console.log('  • Overhead %:', settings?.overheadPercent || 10);
        console.log('  • Net Profit %:', settings?.netProfitPercent || 15);
        console.log('  • Tax Rate %:', settings?.taxRatePercentage || 8.25);
        console.log('  • Deposit %:', settings?.depositPercent || 50);
        console.log('  • Quote Validity Days:', settings?.quoteValidityDays || 30);
        console.log('\n');

        // Check if this is turnkey pricing
        const isTurnkey = pricingScheme && (pricingScheme.type === 'turnkey' || pricingScheme.type === 'sqft_turnkey');

        // If turnkey and homeSqft is provided, use turnkey calculation
        if (isTurnkey && homeSqft && homeSqft > 0) {

            // =====================================================
            // CONSOLE LOG: TURNKEY PRICING CALCULATION
            // =====================================================
            console.log('\n╔════════════════════════════════════════════════════════════════╗');
            console.log('║          🏠 TURNKEY PRICING MODEL CALCULATION                   ║');
            console.log('╚════════════════════════════════════════════════════════════════╝\n');

            // Determine turnkey rate based on job type with GBB tier support
            // Prefer contractor settings saved in ContractorSettings, then scheme rules, then fallback
            let baseRate = 3.50;
            if (jobType === 'interior') {
                baseRate = parseFloat(settings?.turnkeyInteriorRate) || parseFloat(pricingRules.interiorRate) || parseFloat(pricingRules.turnkeyRate) || 3.50;
                console.log('  • Using interior turnkey rate preference order: ContractorSettings -> Scheme -> Fallback');
            } else if (jobType === 'exterior') {
                baseRate = parseFloat(settings?.turnkeyExteriorRate) || parseFloat(pricingRules.exteriorRate) || parseFloat(pricingRules.turnkeyRate) || 3.50;
                console.log('  • Using exterior turnkey rate preference order: ContractorSettings -> Scheme -> Fallback');
            } else {
                baseRate = parseFloat(pricingRules.turnkeyRate) || parseFloat(settings?.turnkeyInteriorRate) || 3.50;
            }
            console.log('Step 1: DETERMINE BASE RATE');
            console.log('─────────────────────────────────────────────────────────────────');
            console.log('  • Job Type:', jobType);
            console.log('  • Contractor Settings Interior Rate:', settings?.turnkeyInteriorRate);
            console.log('  • Contractor Settings Exterior Rate:', settings?.turnkeyExteriorRate);
            console.log('  • Scheme Turnkey Rate:', pricingRules.turnkeyRate || 'Not set');
            console.log('  • Final selected base rate:', baseRate, '$/sq ft');
            console.log('\nStep 2: APPLY GBB TIER ADJUSTMENTS');
            console.log('─────────────────────────────────────────────────────────────────');

            // Apply GBB tier adjustments
            let turnkeyRate = baseRate;
            if (pricingRules.gbbRates && selectedTier !== 'single') {
                const originalRate = turnkeyRate;
                turnkeyRate = getTierValue(baseRate, pricingRules.gbbRates, selectedTier);
                console.log('  • GBB Rates Available:', true);
                console.log('  • Selected Tier:', selectedTier);
                console.log('  • Original Rate:', originalRate);
                console.log('  ✓ Adjusted Rate:', turnkeyRate, '$/sq ft');
            } else {
                console.log('  • GBB Rates Available:', !!pricingRules.gbbRates);
                console.log('  • No tier adjustment applied');
            }

            // Apply condition modifier
            console.log('\nStep 3: APPLY CONDITION MODIFIER');
            console.log('─────────────────────────────────────────────────────────────────');
            // Condition multipliers (Cadence-set defaults)
            // Better condition = LOWER multiplier (less prep work needed)
            const conditionMultipliers = {
                excellent: 1.00,  // Best condition - minimal prep
                good: 1.05,       // Light prep work
                average: 1.12,    // Standard prep (default)
                fair: 1.25,       // Significant prep needed
                poor: 1.45,       // Extensive prep and repairs
            };
            const conditionMultiplier = conditionMultipliers[conditionModifier] || 1.12; // Default to average
            const adjustedRate = turnkeyRate * conditionMultiplier;

            console.log('  • Property Condition:', conditionModifier);
            console.log('  • Condition Multiplier:', conditionMultiplier);
            console.log('  • Rate before:', turnkeyRate, '$/sq ft');
            console.log('  ✓ Rate after condition adjustment:', adjustedRate, '$/sq ft');

            // Calculate base labor and material (60/40 split for turnkey when materials included)
            console.log('\nStep 4: CALCULATE BASE TOTAL');
            console.log('─────────────────────────────────────────────────────────────────');
            const baseTotal = homeSqft * adjustedRate;
            console.log('  • Home Sq Ft:', homeSqft);
            console.log('  • Adjusted Rate: $' + adjustedRate + '/sq ft');
            console.log('  ✓ Base Total:', '$' + baseTotal.toFixed(2), '(Home SqFt × Rate)');

            let baseLaborCost, baseMaterialCost;
            console.log('\nStep 5: SPLIT INTO LABOR & MATERIALS');
            console.log('─────────────────────────────────────────────────────────────────');

            if (finalIncludeMaterials) {
                // Materials included: 60% labor / 40% materials
                baseLaborCost = baseTotal * 0.60;
                baseMaterialCost = baseTotal * 0.40;
                console.log('  • Materials INCLUDED in quote');
                console.log('  • Labor Split: 60% = $' + baseLaborCost.toFixed(2));
                console.log('  • Material Split: 40% = $' + baseMaterialCost.toFixed(2));
            } else {
                // Labor-only: 100% labor
                baseLaborCost = baseTotal;
                baseMaterialCost = 0;
                console.log('  • Materials NOT included (labor-only quote)');
                console.log('  • Labor Cost: 100% = $' + baseLaborCost.toFixed(2));
                console.log('  • Material Cost: $0.00');
            }

            // CRITICAL FIX: Turnkey pricing is all-inclusive - NO markups, overhead, profit, or tax
            console.log('\nStep 6: TURNKEY ALL-INCLUSIVE PRICING');
            console.log('─────────────────────────────────────────────────────────────────');
            console.log('  ⚠️  IMPORTANT: Turnkey rate already includes:');
            console.log('      • Labor costs');
            console.log('      • Material costs');
            console.log('      • Overhead');
            console.log('      • Profit margin');
            console.log('      • Sales tax');
            console.log('  ✓ NO additional markups or tax applied');

            const total = baseTotal;

            console.log('\n  FINAL BREAKDOWN:');
            console.log('    Labor (60%): $' + baseLaborCost.toFixed(2));
            console.log('    Materials (40%): $' + baseMaterialCost.toFixed(2));
            console.log('    ─────────────────────────────');
            console.log('    TOTAL (All-Inclusive): $' + total.toFixed(2));

            console.log('\n' + '═'.repeat(65));
            console.log('✅ TURNKEY PRICING COMPLETE');
            console.log('═'.repeat(65) + '\n');

            return res.json({
                success: true,
                calculation: {
                    // Base costs (for display purposes only)
                    laborTotal: parseFloat(baseLaborCost.toFixed(2)),
                    materialTotal: parseFloat(baseMaterialCost.toFixed(2)),

                    // NO markups for turnkey
                    laborMarkupPercent: 0,
                    laborMarkupAmount: 0,
                    laborCostWithMarkup: parseFloat(baseLaborCost.toFixed(2)),

                    materialMarkupPercent: 0,
                    materialMarkupAmount: 0,
                    materialCostWithMarkup: parseFloat(baseMaterialCost.toFixed(2)),

                    // NO overhead or profit for turnkey
                    overheadPercent: 0,
                    overhead: 0,
                    subtotalBeforeProfit: parseFloat(total.toFixed(2)),

                    profitMarginPercent: 0,
                    profitAmount: 0,

                    // Final totals (no tax added)
                    subtotal: parseFloat(total.toFixed(2)),
                    taxPercent: 0,
                    tax: 0,
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
                    jobType,
                    isTurnkey: true, // Flag to indicate turnkey pricing

                    // Quote validity
                    quoteValidityDays: parseInt(settings?.quoteValidityDays) || 30,

                    breakdown: [{
                        areaName: `${jobType === 'interior' ? 'Interior' : 'Exterior'} - Turnkey`,
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

        // CRITICAL FIX: Use flat rate items directly from request body
        const isFlatRate = pricingScheme && (
            pricingScheme.type === 'flat_rate_unit' ||
            pricingScheme.type === 'unit_pricing' ||
            pricingScheme.type === 'room_flat_rate'
        );

        if (isFlatRate && flatRateItems) {
            console.log('\n🔄 USING FLAT RATE ITEMS FROM REQUEST BODY');
            console.log('─────────────────────────────────────────────────────────────────');
            console.log('  Flat rate items received:');
            console.log('    Interior:', JSON.stringify(flatRateItems.interior || {}));
            console.log('    Exterior:', JSON.stringify(flatRateItems.exterior || {}));
            console.log('');

            // For flat rate pricing, use the unified calculator
            console.log('\n╔════════════════════════════════════════════════════════════════╗');
            console.log('║    🧮 FLAT RATE UNIT PRICING - UNIFIED CALCULATOR              ║');
            console.log('╚════════════════════════════════════════════════════════════════╝\n');

            // Build pricing rules with flat rate unit prices from contractor settings
            const pricingRules = pricingScheme?.pricingRules || {};
            const mergedRules = {
                ...pricingRules,
                includeMaterials: finalIncludeMaterials,
                coverage: finalCoverage,
                applicationMethod: finalApplicationMethod,
                coats: finalCoats,
                costPerGallon: pricingRules.costPerGallon || 40,
                flatRateUnitPrices: settings?.flatRateUnitPrices || {
                    // Interior items
                    door: 85,
                    doors: 85,
                    smallRoom: 350,
                    mediumRoom: 450,
                    largeRoom: 600,
                    closet: 150,
                    accentWall: 200,
                    cabinet: 125,
                    cabinets: 125,
                    cabinetsFace: 300,
                    cabinetsDoors: 400,
                    // Exterior items
                    exteriorDoor: 95,
                    exteriorDoors: 95,
                    window: 75,
                    windows: 75,
                    garageDoor: 200,
                    garageDoors: 200,
                    garageDoor1Car: 150,
                    garageDoor2Car: 200,
                    garageDoor3Car: 250,
                    shutter: 50,
                    shutters: 50,
                },
            };

            // Call unified calculator
            const basePricing = calculatePricing({
                model: 'flat_rate_unit',
                rules: mergedRules,
                areas: [],
                flatRateItems: flatRateItems,
                productSets: productSets,
                homeSqft: homeSqft || 0,
                jobScope: jobType || 'interior',
                analytics: {
                    tenantId: tenantId,
                    userId: req.user.id,
                    quoteId: null
                }
            });

            console.log('  Base Pricing from Calculator:', basePricing);

            // Apply markups, overhead, profit, and tax
            const finalPricing = applyMarkupsAndTax(basePricing, {
                laborMarkupPercent: parseFloat(settings?.laborMarkupPercent) || 0,
                materialMarkupPercent: parseFloat(settings?.materialMarkupPercent) || 0,
                overheadPercent: parseFloat(settings?.overheadPercent) || 0,
                profitMarginPercent: parseFloat(settings?.netProfitPercent) || 0,
                taxRatePercentage: parseFloat(settings?.taxRatePercentage) || 0,
                depositPercent: parseFloat(settings?.depositPercent) || 0,
            });

            console.log('  Final Pricing after Markups:', finalPricing);
            console.log('\n' + '═'.repeat(65));
            console.log('✅ FLAT RATE PRICING COMPLETE');
            console.log('═'.repeat(65) + '\n\n');

            // Return flat rate pricing result
            return res.json({
                success: true,
                calculation: {
                    ...finalPricing,
                    // Material calculation settings
                    includeMaterials: finalIncludeMaterials,
                    coverage: finalCoverage,
                    applicationMethod: finalApplicationMethod,
                    coats: finalCoats,
                    selectedTier: selectedTier,
                    // Pricing model metadata
                    pricingModelType: pricingScheme?.type || 'flat_rate_unit',
                    pricingModelName: pricingScheme?.name || 'Flat Rate Unit Pricing',
                    pricingModelFriendlyName: getPricingModelFriendlyName(pricingScheme?.type) || 'Flat Rate Unit Pricing',
                    // Quote validity
                    quoteValidityDays: parseInt(settings?.quoteValidityDays) || 30,
                },
            });
        }

        // Non-turnkey calculation (existing logic)
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║    🧮 ' + getPricingModelFriendlyName(pricingScheme?.type).toUpperCase() + '   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        console.log('Processing Areas & Items:');
        console.log('─────────────────────────────────────────────────────────────────');

        const markup = parseFloat(settings?.defaultMarkupPercentage) || 30;
        const taxRate = parseFloat(settings?.taxRatePercentage) || 0;

        let laborTotal = 0;
        let materialTotal = 0;
        let prepTotal = 0;
        let addOnsTotal = 0;
        const breakdown = [];

        // Calculate for each area - supports both laborItems and surfaces
        for (const area of areas || []) {
            console.log('\n📍 Area: "' + area.name + '"');
            const areaBreakdown = {
                areaId: area.id,
                areaName: area.name,
                items: [],
            };

            // New structure: laborItems
            if (area.laborItems) {
                for (const item of area.laborItems || []) {
                    if (!item.selected) continue;

                    console.log('  └─ Item: ' + item.categoryName);

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

                    console.log('     • Quantity:', quantity, item.measurementUnit);
                    console.log('     • Coats:', item.numberOfCoats);

                    // Calculate labor cost based on pricing scheme type
                    if (pricingScheme) {
                        console.log('     • Pricing Type:', pricingScheme.type);
                        switch (pricingScheme.type) {
                            case 'sqft_turnkey':
                                // All-in price per sqft (labor + materials included)
                                const turnkeyRate = parseFloat(categoryRule.price || 1.15);
                                if (item.measurementUnit === 'sqft') {
                                    itemBreakdown.laborCost = quantity * turnkeyRate;
                                    console.log('       Labor: ' + quantity + ' × $' + turnkeyRate + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                } else {
                                    // For non-sqft units, use the labor rate from item
                                    itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                                    console.log('       Labor: ' + quantity + ' × $' + item.laborRate + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                }
                                break;

                            case 'sqft_labor_paint':
                            case 'rate_based_sqft': {
                                // Rate-Based Pricing: Use labor rates from LaborRate table
                                const categoryNameLower = item.categoryName.toLowerCase();
                                let laborRate = laborRatesMap[categoryNameLower] || parseFloat(item.laborRate) || 0;

                                console.log('       Category:', item.categoryName);
                                console.log('       Labor Rate from DB: $' + laborRate + '/' + item.measurementUnit);

                                // Apply GBB tier override if available in settings
                                if (categoryRule.gbbRates) {
                                    laborRate = getTierValue(laborRate, categoryRule.gbbRates, selectedTier);
                                    console.log('       GBB Adjusted Rate: $' + laborRate);
                                }

                                itemBreakdown.laborCost = quantity * laborRate;
                                console.log('       Labor: ' + quantity + ' × $' + laborRate + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                break;
                            }

                            case 'hourly_time_materials':
                            case 'production_based': {
                                // Production-Based Pricing: Use production rates and hourly labor rate from ContractorSettings
                                // Formula: Labor Cost = (Area ÷ Production Rate) × Hourly Labor Rate
                                let hourlyRate = parseFloat(settings?.defaultBillableLaborRate) || 50;
                                let crewSize = parseInt(settings?.crewSize) || 1;

                                console.log('       Hourly Labor Rate from Settings: $' + hourlyRate + '/hr');
                                console.log('       Crew Size: ' + crewSize);

                                if (item.measurementUnit === 'hour') {
                                    // Direct hours
                                    itemBreakdown.laborCost = quantity * hourlyRate * crewSize;
                                    console.log('       Labor: ' + quantity + ' hrs × $' + hourlyRate + ' × ' + crewSize + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                } else if (item.measurementUnit === 'sqft' || item.measurementUnit === 'linear_foot' || item.measurementUnit === 'unit') {
                                    // Convert area/units to hours based on production rate from settings
                                    const categoryNameLower = item.categoryName.toLowerCase();
                                    const jobTypeLower = (area.jobType || 'interior').toLowerCase();
                                    let productionRate = 0;

                                    // Map category to production rate field in settings
                                    // Check for exterior first (more specific), then interior
                                    if (categoryNameLower.includes('wall') && (categoryNameLower.includes('exterior') || jobTypeLower === 'exterior')) {
                                        productionRate = parseFloat(settings?.productionExteriorWalls) || 250;
                                    } else if (categoryNameLower.includes('wall')) {
                                        // Interior walls (default if no exterior keyword)
                                        productionRate = parseFloat(settings?.productionInteriorWalls) || 300;
                                    } else if (categoryNameLower.includes('ceiling')) {
                                        productionRate = parseFloat(settings?.productionInteriorCeilings) || 250;
                                    } else if (categoryNameLower.includes('trim') && (categoryNameLower.includes('exterior') || jobTypeLower === 'exterior')) {
                                        productionRate = parseFloat(settings?.productionExteriorTrim) || 120;
                                    } else if (categoryNameLower.includes('trim')) {
                                        // Interior trim (default if no exterior keyword)
                                        productionRate = parseFloat(settings?.productionInteriorTrim) || 150;
                                    } else if (categoryNameLower.includes('soffit') || categoryNameLower.includes('fascia')) {
                                        productionRate = parseFloat(settings?.productionSoffitFascia) || 100;
                                    } else if (categoryNameLower.includes('gutter')) {
                                        productionRate = parseFloat(settings?.productionGutters) || 150;
                                    } else if (categoryNameLower.includes('door')) {
                                        productionRate = parseFloat(settings?.productionDoors) || 2;
                                    } else if (categoryNameLower.includes('cabinet')) {
                                        productionRate = parseFloat(settings?.productionCabinets) || 1.5;
                                    } else {
                                        productionRate = 250; // Default fallback
                                    }

                                    const hours = Math.ceil((quantity / productionRate) * 10) / 10;
                                    itemBreakdown.hours = hours;
                                    itemBreakdown.laborCost = hours * hourlyRate * crewSize;
                                    console.log('       Production Rate from Settings: ' + productionRate + ' ' + item.measurementUnit + '/hr');
                                    console.log('       Estimated Hours: ' + quantity + ' ÷ ' + productionRate + ' = ' + hours.toFixed(1) + ' hrs');
                                    console.log('       Labor: ' + hours.toFixed(1) + ' × $' + hourlyRate + ' × ' + crewSize + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                } else {
                                    // For other units, use production rate or fallback to item labor rate
                                    itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                                    console.log('       Labor: ' + quantity + ' × $' + item.laborRate + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                }
                                break;
                            }

                            case 'unit_pricing':
                            case 'flat_rate_unit': {
                                // Flat Rate Unit Pricing: Use flatRateUnitPrices from ContractorSettings
                                const flatRateUnitPrices = settings?.flatRateUnitPrices || {};
                                const categoryNameLowerFlat = item.categoryName.toLowerCase();

                                // Map category to flat rate price
                                let unitPrice = 0;
                                if (categoryNameLowerFlat.includes('wall') && !categoryNameLowerFlat.includes('exterior')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.walls) || 2.5;
                                } else if (categoryNameLowerFlat.includes('ceiling')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.ceilings) || 2;
                                } else if (categoryNameLowerFlat.includes('trim') && !categoryNameLowerFlat.includes('exterior')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.interior_trim) || 1.5;
                                } else if (categoryNameLowerFlat.includes('siding') || (categoryNameLowerFlat.includes('wall') && categoryNameLowerFlat.includes('exterior'))) {
                                    unitPrice = parseFloat(flatRateUnitPrices.siding) || 3;
                                } else if (categoryNameLowerFlat.includes('trim') && categoryNameLowerFlat.includes('exterior')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.exterior_trim) || 1.8;
                                } else if (categoryNameLowerFlat.includes('soffit') || categoryNameLowerFlat.includes('fascia')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.soffit_fascia) || 2;
                                } else if (categoryNameLowerFlat.includes('gutter')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.gutters) || 4;
                                } else if (categoryNameLowerFlat.includes('deck')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.deck) || 2.5;
                                } else if (categoryNameLowerFlat.includes('door')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.door) || 85;
                                } else if (categoryNameLowerFlat.includes('window')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.window) || 75;
                                } else if (categoryNameLowerFlat.includes('cabinet')) {
                                    unitPrice = parseFloat(flatRateUnitPrices.cabinet) || 125;
                                } else {
                                    // Try using the category key directly
                                    const categoryKey = categoryNameLowerFlat.replace(/\s+/g, '_');
                                    unitPrice = parseFloat(flatRateUnitPrices[categoryKey]) || parseFloat(item.laborRate) || 0;
                                }

                                console.log('       Unit Price from Settings: $' + unitPrice + '/' + item.measurementUnit);

                                itemBreakdown.laborCost = quantity * unitPrice;
                                console.log('       Labor: ' + quantity + ' × $' + unitPrice + ' = $' + itemBreakdown.laborCost.toFixed(2));
                                break;
                            }

                            case 'room_flat_rate':
                                // Flat rate per room (applies once per area, not per item)
                                // Only charge once for the primary surface in the area
                                const flatRate = parseFloat(pricingRules.room_flat_rate?.price || 325);
                                itemBreakdown.laborCost = flatRate;
                                console.log('       Flat Rate: $' + flatRate + ' per room');
                                break;

                            default:
                                // Fallback to labor rate from item
                                itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                                console.log('       Labor: ' + quantity + ' × $' + item.laborRate + ' = $' + itemBreakdown.laborCost.toFixed(2));
                        }
                    } else {
                        // No pricing scheme - use labor rate from item
                        itemBreakdown.laborCost = quantity * (parseFloat(item.laborRate) || 0);
                    }

                    // Calculate material cost server-side AND materials are included
                    if (finalIncludeMaterials && quantity > 0 && item.measurementUnit === 'sqft') {
                        // Get product for this surface type
                        const productSet = getProductSetForSurface(item.categoryName);

                        let pricePerGallon = pricingRules.costPerGallon || 35; // Default price from scheme or fallback
                        let itemCoats = item.numberOfCoats || finalCoats;
                        let itemCoverage = finalCoverage;

                        if (productSet) {
                            // Get the selected product ID from the chosen tier
                            const tierKey = selectedTier === 'single' ? 'single' : selectedTier;
                            const selectedProductId = productSet.products?.[tierKey] ||
                                productSet.products?.better || // Fallback to better
                                productSet.products?.good ||    // Then good
                                productSet.products?.best ||    // Then best
                                productSet.products?.single;    // Finally single

                            if (selectedProductId) {
                                // Fetch actual product price and tier-specific coats/coverage from database
                                try {
                                    const productConfig = await ProductConfig.findOne({
                                        where: { id: selectedProductId, tenantId },
                                        include: [{
                                            model: GlobalProduct,
                                            as: 'globalProduct'
                                        }]
                                    });

                                    if (productConfig) {
                                        // Get price from first sheen
                                        if (productConfig.sheens && productConfig.sheens.length > 0) {
                                            pricePerGallon = Number.parseFloat(productConfig.sheens[0].price || pricePerGallon);
                                        }

                                        // Get tier-specific coats and coverage
                                        if (productConfig.defaultCoats) {
                                            itemCoats = parseInt(productConfig.defaultCoats) || itemCoats;
                                        }
                                        if (productConfig.coverageSqftPerGal) {
                                            itemCoverage = parseInt(productConfig.coverageSqftPerGal) || itemCoverage;
                                        }
                                    }
                                } catch (err) {
                                    console.error('Error fetching product price:', err);
                                    // Keep default values
                                }
                            }
                        }

                        // Calculate gallons server-side with waste factor (10%)
                        const wasteFactor = 1.10;
                        const calculatedGallons = (quantity * itemCoats / itemCoverage) * wasteFactor;
                        const roundedGallons = roundGallons(calculatedGallons);

                        itemBreakdown.gallons = roundedGallons;
                        itemBreakdown.numberOfCoats = itemCoats;
                        itemBreakdown.coverage = itemCoverage;
                        itemBreakdown.materialCost = roundedGallons * pricePerGallon;
                    } else {
                        // Materials not included or not sqft-based - set to 0
                        itemBreakdown.gallons = 0;
                        itemBreakdown.materialCost = 0;
                    }

                    // Accumulate totals
                    laborTotal += itemBreakdown.laborCost;
                    if (finalIncludeMaterials) {
                        materialTotal += itemBreakdown.materialCost;
                    }

                    console.log('       ✓ Item Labor Cost: $' + itemBreakdown.laborCost.toFixed(2));
                    if (itemBreakdown.materialCost > 0) {
                        console.log('       ✓ Item Material Cost: $' + itemBreakdown.materialCost.toFixed(2));
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

        console.log('\n📊 TOTALS FROM ALL AREAS:');
        console.log('─────────────────────────────────────────────────────────────────');
        console.log('  • Labor Total: $' + laborTotal.toFixed(2));
        console.log('  • Material Total: $' + materialTotal.toFixed(2));
        console.log('  • Prep Total: $' + prepTotal.toFixed(2));
        console.log('  • Add-Ons Total: $' + addOnsTotal.toFixed(2));
        console.log('\n');
        console.log('ℹ️  Note: Prep work is included in Labor Total');
        console.log('\n');

        // Get pricing engine settings from contractor settings
        const laborMarkupPercent = parseFloat(settings?.laborMarkupPercent) || 0;
        const materialMarkupPercent = parseFloat(settings?.materialMarkupPercent) || markup;
        const overheadPercent = parseFloat(settings?.overheadPercent) || 0;
        const netProfitPercent = parseFloat(settings?.netProfitPercent) || 0;
        const quoteValidityDays = parseInt(settings?.quoteValidityDays) || 30;
        const depositPercent = parseFloat(settings?.depositPercentage) || 50;

        console.log('💰 PRICING ENGINE CALCULATIONS:');
        console.log('─────────────────────────────────────────────────────────────────');

        // Step 1: Base costs
        const baseLaborCost = laborTotal;
        const baseMaterialCost = materialTotal;
        console.log('Step 1: Base Costs');
        console.log('  • Labor (includes prep): $' + baseLaborCost.toFixed(2));
        console.log('  • Materials: $' + baseMaterialCost.toFixed(2));

        // Step 2: Apply markup to labor and materials separately (only if materials included)
        const laborMarkupAmount = baseLaborCost * (laborMarkupPercent / 100);
        const laborCostWithMarkup = baseLaborCost + laborMarkupAmount;

        const materialMarkupAmount = finalIncludeMaterials ? (baseMaterialCost * (materialMarkupPercent / 100)) : 0;
        const materialCostWithMarkup = finalIncludeMaterials ? (baseMaterialCost + materialMarkupAmount) : 0;

        console.log('\nStep 2: Apply Markups');
        console.log('  Labor:');
        console.log('    Base: $' + baseLaborCost.toFixed(2));
        console.log('    Markup (' + laborMarkupPercent + '%): +$' + laborMarkupAmount.toFixed(2));
        console.log('    With Markup: $' + laborCostWithMarkup.toFixed(2));
        console.log('  Materials:');
        console.log('    Base: $' + baseMaterialCost.toFixed(2));
        console.log('    Markup (' + materialMarkupPercent + '%): +$' + materialMarkupAmount.toFixed(2));
        console.log('    With Markup: $' + materialCostWithMarkup.toFixed(2));

        // Step 3: Subtotal before overhead
        const subtotalBeforeOverhead = laborCostWithMarkup + materialCostWithMarkup + prepTotal + addOnsTotal;
        console.log('\nStep 3: Subtotal Before Overhead');
        console.log('  • $' + subtotalBeforeOverhead.toFixed(2));

        // Step 4: Apply overhead (fixed amount or percentage of subtotal)
        let overheadAmount = 0;
        if (overheadPercent > 0) {
            overheadAmount = subtotalBeforeOverhead * (overheadPercent / 100);
        } else {
            overheadAmount = travelCost + cleanupCost; // Use fixed costs if no overhead percent
        }
        const subtotalBeforeProfit = subtotalBeforeOverhead + overheadAmount;
        console.log('\nStep 4: Apply Overhead');
        console.log('  • Overhead (' + overheadPercent + '%): +$' + overheadAmount.toFixed(2));
        console.log('  • Subtotal Before Profit: $' + subtotalBeforeProfit.toFixed(2));

        // Step 5: Apply net profit
        const profitAmount = subtotalBeforeProfit * (netProfitPercent / 100);
        const subtotal = subtotalBeforeProfit + profitAmount;
        console.log('\nStep 5: Apply Net Profit');
        console.log('  • Profit (' + netProfitPercent + '%): +$' + profitAmount.toFixed(2));
        console.log('  • Subtotal: $' + subtotal.toFixed(2));

        // Step 6: Calculate tax (only on materials with markup)
        const taxAmount = materialCostWithMarkup * (taxRate / 100);
        const total = subtotal + taxAmount;
        console.log('\nStep 6: Calculate Tax (on materials only)');
        console.log('  • Materials with Markup: $' + materialCostWithMarkup.toFixed(2));
        console.log('  • Tax (' + taxRate + '%): +$' + taxAmount.toFixed(2));
        console.log('  ✓ FINAL TOTAL: $' + total.toFixed(2));

        // Calculate deposit and balance
        const deposit = total * (depositPercent / 100);
        const balance = total - deposit;
        console.log('\nStep 7: Payment Terms');
        console.log('  • Deposit (' + depositPercent + '%): $' + deposit.toFixed(2));
        console.log('  • Balance: $' + balance.toFixed(2));

        console.log('\n' + '═'.repeat(65));
        console.log('✅ PRICING CALCULATION COMPLETE');
        console.log('═'.repeat(65) + '\n\n');

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
                taxOnMaterialsOnly: true, // Tax applies only to materials with markup
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
                selectedTier: selectedTier,

                // Pricing model metadata
                pricingModelType: pricingScheme?.type || 'rate_based_sqft',
                pricingModelName: pricingScheme?.name || 'Default Pricing',
                pricingModelFriendlyName: getPricingModelFriendlyName(pricingScheme?.type) || 'Rate-Based Square Foot Pricing',

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
 * OPTIMIZED: Implements batch loading, caching, and async processing
 */
exports.sendQuote = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // OPTIMIZATION: Batch load all required data in parallel
        const [quote, portalSettings, contractor, tenant, pDefaults] = await Promise.all([
            Quote.findOne({
                where: { id, tenantId },
                include: [
                    { model: PricingScheme, as: 'pricingScheme' }, // Include pricing scheme for accurate proposal generation
                ],
                transaction,
            }),

            // Cache contractor settings for 10 minutes
            req.cache ? req.cache.get(`contractor_settings:${tenantId}`) ||
                ContractorSettings.findOne({ where: { tenantId } }).then(settings => {
                    if (req.cache && settings) {
                        req.cache.set(`contractor_settings:${tenantId}`, settings, 600, { tags: [`tenant:${tenantId}`, 'settings'] });
                    }
                    return settings;
                }) : ContractorSettings.findOne({ where: { tenantId } }),

            // Cache user data for 5 minutes
            req.cache ? req.cache.get(`user:${userId}`) ||
                User.findByPk(userId).then(user => {
                    if (req.cache && user) {
                        req.cache.set(`user:${userId}`, user, 300, { tags: [`user:${userId}`] });
                    }
                    return user;
                }) : User.findByPk(userId),

            // Cache tenant data for 10 minutes
            req.cache ? req.cache.get(`tenant:${tenantId}`) ||
                Tenant.findByPk(tenantId).then(tenantData => {
                    if (req.cache && tenantData) {
                        req.cache.set(`tenant:${tenantId}`, tenantData, 600, { tags: [`tenant:${tenantId}`] });
                    }
                    return tenantData;
                }) : Tenant.findByPk(tenantId),

            // Cache proposal defaults for 15 minutes
            req.cache ? req.cache.get(`proposal_defaults:${tenantId}`) ||
                ProposalDefaults.findOne({ where: { tenantId } }).then(defaults => {
                    if (req.cache && defaults) {
                        req.cache.set(`proposal_defaults:${tenantId}`, defaults, 900, { tags: [`tenant:${tenantId}`, 'defaults'] });
                    }
                    return defaults;
                }) : ProposalDefaults.findOne({ where: { tenantId } })
        ]);

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

        // ===================================================================
        // CALCULATE AND SAVE PRICING DATA BEFORE SENDING
        // ===================================================================
        console.log('📊 Calculating pricing for quote before sending...');
        console.log('📋 Quote data for calculation:', {
            id: quote.id,
            pricingSchemeId: quote.pricingSchemeId,
            pricingSchemeType: quote.pricingScheme?.type,
            hasFlatRateItems: !!quote.flatRateItems,
            flatRateItems: quote.flatRateItems,
            hasAreas: !!quote.areas,
            areasCount: quote.areas?.length || 0
        });

        const calculation = await calculateQuotePricing(quote, tenantId);

        // Save calculation data to quote
        await quote.update({
            subtotal: calculation.subtotal || 0,
            laborTotal: calculation.laborTotal || 0,
            materialTotal: calculation.materialTotal || 0,
            laborMarkupPercent: calculation.laborMarkupPercent || 0,
            laborMarkupAmount: calculation.laborMarkupAmount || 0,
            materialMarkupPercent: calculation.materialMarkupPercent || 0,
            materialMarkupAmount: calculation.materialMarkupAmount || 0,
            overheadPercent: calculation.overheadPercent || 0,
            overheadAmount: calculation.overhead || 0,
            profitMarginPercent: calculation.profitMarginPercent || 0,
            profitAmount: calculation.profitAmount || 0,
            markup: calculation.markupAmount || 0,
            markupPercent: calculation.markupPercent || 0,
            tax: calculation.tax || calculation.taxAmount || 0,
            taxPercent: calculation.taxPercent || calculation.taxRate || 0,
            total: calculation.total || 0,
            totalSqft: calculation.totalSqft || null,
            breakdown: calculation.breakdown || [],
            depositAmount: calculation.deposit || 0,
            sentAt: new Date()
        }, { transaction });

        console.log('✅ Quote pricing saved:', {
            total: calculation.total,
            laborTotal: calculation.laborTotal,
            materialTotal: calculation.materialTotal,
            tax: calculation.tax
        });

        // Update quote status using Phase 1 status flow
        const StatusFlowService = require('../services/statusFlowService');
        await StatusFlowService.transitionQuoteStatus(
            quote,
            'sent',
            {
                userId,
                tenantId,
                isAdmin: true, // Admin sending quote
                req,
                transaction
            }
        );

        // Create audit log
        await createAuditLog({
            category: 'quote',
            action: 'Quote sent to client',
            userId,
            tenantId,
            entityType: 'Quote',
            entityId: quote.id,
            metadata: { quoteNumber: quote.quoteNumber, customerEmail: quote.customerEmail, total: calculation.total },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            transaction,
        });

        // Commit transaction before async operations (email, PDF)
        await transaction.commit();

        // ===================================================================
        // MAGIC LINK GENERATION (Passwordless Customer Portal Access)
        // ===================================================================
        const MagicLinkService = require('../services/magicLinkService');

        // Use cached portal settings
        const linkExpiryDays = portalSettings?.portalLinkExpiryDays || 7;

        let magicLinkResult = null;
        try {
            magicLinkResult = await MagicLinkService.createMagicLink({
                tenantId,
                clientId: quote.clientId,
                quoteId: quote.id,
                email: quote.customerEmail,
                phone: quote.customerPhone,
                purpose: 'quote_view',
                expiryDays: linkExpiryDays, // Use contractor's portal settings
                isSingleUse: false, // Allow multiple accesses
                allowMultiJobAccess: true, // Enable OTP verification for multi-job access
                metadata: {
                    quoteNumber: quote.quoteNumber,
                    sentBy: userId,
                }
            });

            console.log(`✅ Magic link generated (expires in ${linkExpiryDays} days):`, magicLinkResult.link);
        } catch (magicLinkError) {
            console.error('⚠️ Failed to generate magic link:', magicLinkError);
            // Continue - don't fail quote send if magic link fails
        }

        // IMPORTANT: Reload quote to get updated calculation data
        await quote.reload({
            include: [
                { model: PricingScheme, as: 'pricingScheme' }
            ]
        });

        console.log('📋 Quote reloaded with updated data:', {
            total: quote.total,
            subtotal: quote.subtotal,
            tax: quote.tax
        });

        // Return success immediately - PDF and email will be processed in background
        res.json({
            success: true,
            message: 'Quote is being sent. Email will arrive shortly.',
            quote: {
                id: quote.id,
                quoteNumber: quote.quoteNumber,
                total: calculation.total,
                status: quote.status
            },
            magicLinkGenerated: !!magicLinkResult,
            calculation: {
                total: calculation.total,
                deposit: calculation.deposit
            }
        });

        // BACKGROUND PROCESSING: Generate PDF and send emails asynchronously
        // This prevents blocking the HTTP response
        setImmediate(async () => {
            try {
                console.log(`[Background] Starting PDF generation for quote ${quote.id}`);
                console.log(`[Background] Pricing scheme: ${quote.pricingScheme?.type || 'none'}`);
                console.log(`[Background] Calculation total: ${calculation.total}`);
                console.log(`[Background] Quote total from DB: ${quote.total}`);

                // Reload quote one more time to ensure we have the absolute latest data
                await quote.reload({
                    include: [
                        { model: PricingScheme, as: 'pricingScheme' }
                    ]
                });

                console.log(`[Background] Quote reloaded - Total: ${quote.total}, Subtotal: ${quote.subtotal}`);

                // Generate PDF asynchronously
                const pdfBuffer = await (async () => {
                    try {
                        // Generate PROPOSAL PDF (not invoice)
                        const { renderProposalHtml } = require('../services/proposalTemplate');

                        // Load additional data needed for proposal
                        const [productConfigs, globalProducts, brands] = await Promise.all([
                            require('../models/ProductConfig').findAll({
                                where: { tenantId },
                                include: [{
                                    model: require('../models/GlobalProduct'),
                                    as: 'globalProduct',
                                    include: [{
                                        model: require('../models/Brand'),
                                        as: 'brand'
                                    }]
                                }]
                            }),
                            require('../models/GlobalProduct').findAll({
                                include: [{
                                    model: require('../models/Brand'),
                                    as: 'brand'
                                }]
                            }),
                            require('../models/Brand').findAll()
                        ]);

                        // Create product lookup map
                        const productMap = {};
                        productConfigs.forEach(config => {
                            let brandName, productName;

                            // Support both global and custom products
                            if (config.isCustom && config.customProduct) {
                                brandName = config.customProduct.brandName || '';
                                productName = config.customProduct.name || 'Custom Product';
                            } else if (config.globalProduct) {
                                brandName = config.globalProduct.brand?.name || '';
                                productName = config.globalProduct.name || 'Unknown Product';
                            } else {
                                brandName = '';
                                productName = 'Unknown Product';
                            }

                            const sheen = config.sheen || config.globalProduct?.sheen || '';

                            let fullName = brandName ? `${brandName} - ${productName}` : productName;
                            if (sheen && sheen !== 'Not specified') {
                                fullName += ` (${sheen})`;
                            }

                            productMap[config.id] = fullName;
                            if (config.globalProductId) {
                                productMap[config.globalProductId] = fullName;
                            }
                        });

                        // Parse productSets
                        let productSets = quote.productSets;
                        if (typeof productSets === 'string') {
                            try {
                                productSets = JSON.parse(productSets);
                            } catch (e) {
                                console.error('[Background] Failed to parse productSets:', e);
                                productSets = [];
                            }
                        }
                        if (!Array.isArray(productSets)) {
                            productSets = [];
                        }

                        console.log(`[Background] ProductSets count: ${productSets.length}`);
                        console.log(`[Background] Pricing scheme type: ${quote.pricingScheme?.type}`);
                        if (productSets.length > 0) {
                            console.log(`[Background] ProductSets sample:`, JSON.stringify(productSets.slice(0, 2), null, 2));
                        }

                        // Build GBB table rows based on pricing scheme
                        const rows = [];
                        const pricingSchemeType = quote.pricingScheme?.type;

                        // Check if this is flat rate pricing (different structure)
                        const isFlatRate = pricingSchemeType === 'flat_rate_unit';

                        if (isFlatRate) {
                            // Flat rate: Show products in Good/Better/Best columns
                            console.log(`[Background] Processing flat rate pricing - showing products`);

                            // For flat rate, use productSets to show the actual products selected
                            productSets.forEach(set => {
                                if (!set.products) {
                                    console.log(`[Background] Skipping set - missing products:`, set);
                                    return;
                                }

                                // Get the category from the set (interior/exterior)
                                const category = set.category || 'Interior';
                                const label = set.label || set.surfaceType || 'Unknown';

                                rows.push({
                                    category: category.charAt(0).toUpperCase() + category.slice(1), // Capitalize
                                    label: label,
                                    good: productMap[set.products.good] || undefined,
                                    better: productMap[set.products.better] || undefined,
                                    best: productMap[set.products.best] || undefined,
                                });

                                console.log(`[Background] Added flat rate row: ${label} (${category})`);
                            });

                            console.log(`[Background] Flat rate rows generated: ${rows.length}`);
                        } else {
                            // Check if this is area-wise pricing
                            const isAreaWise = ['production_based', 'rate_based_sqft', 'rate_based'].includes(pricingSchemeType);

                            if (isAreaWise) {
                                console.log(`[Background] Processing area-wise pricing`);
                                // Build area-wise product table
                                (quote.areas || []).forEach(area => {
                                    if (!area.laborItems || area.laborItems.length === 0) return;

                                    area.laborItems.forEach(item => {
                                        if (!item.selected) return;

                                        const surfaceType = item.categoryName;
                                        const productSet = productSets.find(ps =>
                                            ps.areaId === area.id && ps.surfaceType === surfaceType
                                        ) || productSets.find(ps =>
                                            !ps.areaId && ps.surfaceType === surfaceType
                                        );

                                        if (productSet && productSet.products) {
                                            rows.push({
                                                area: area.name,
                                                label: surfaceType,
                                                good: productMap[productSet.products.good] || undefined,
                                                better: productMap[productSet.products.better] || undefined,
                                                best: productMap[productSet.products.best] || undefined,
                                            });
                                        }
                                    });
                                });
                                console.log(`[Background] Area-wise rows generated: ${rows.length}`);
                            } else {
                                // Turnkey: Global product table
                                console.log(`[Background] Processing turnkey pricing`);

                                // For turnkey, productSets use 'label' field instead of 'surfaceType'
                                productSets.forEach(ps => {
                                    const surfaceLabel = ps.surfaceType || ps.label;

                                    if (!surfaceLabel) {
                                        console.log(`[Background] ProductSet missing both surfaceType and label:`, JSON.stringify(ps, null, 2));
                                        return;
                                    }

                                    console.log(`[Background] Found turnkey product set: "${surfaceLabel}", has products: ${!!ps.products}`);

                                    if (ps.products) {
                                        rows.push({
                                            label: surfaceLabel,
                                            good: productMap[ps.products.good] || undefined,
                                            better: productMap[ps.products.better] || undefined,
                                            best: productMap[ps.products.best] || undefined,
                                        });
                                        console.log(`[Background] Added row for "${surfaceLabel}":`, {
                                            good: productMap[ps.products.good],
                                            better: productMap[ps.products.better],
                                            best: productMap[ps.products.best]
                                        });
                                    } else {
                                        console.log(`[Background] No products found for: ${surfaceLabel}`);
                                    }
                                });

                                console.log(`[Background] Turnkey rows generated: ${rows.length}`);
                            }
                        }

                        console.log(`[Background] Generated ${rows.length} product rows for proposal`);

                        // Compute deposit - use calculation.total as primary source (freshly calculated)
                        const depositPct = parseFloat(portalSettings?.depositPercentage || 50);
                        const total = parseFloat(calculation.total || quote.total || 0);
                        const depositAmount = total * (depositPct / 100);

                        console.log(`[Background] Using total for PDF: ${total} (calculation: ${calculation.total}, quote: ${quote.total})`);

                        // Build proposal template data
                        const templateData = {
                            company: {
                                name: tenant?.companyName || 'Your Company',
                                email: tenant?.email || '',
                                phone: tenant?.phoneNumber || '',
                                addressLine1: tenant?.businessAddress || '',
                                logoUrl: tenant?.companyLogoUrl || pDefaults?.companyLogo || '',
                            },
                            proposal: {
                                invoiceNumber: quote.quoteNumber,
                                date: new Date().toLocaleDateString("en-US", {
                                    month: 'short', day: 'numeric', year: 'numeric'
                                }),
                                customerName: quote.customerName,
                                projectAddress: [quote.street, quote.city, quote.state, quote.zipCode].filter(Boolean).join(', '),
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
                                investment: {},
                            },
                        };

                        const html = renderProposalHtml(templateData, {
                            templateId: portalSettings?.selectedProposalTemplate || 'classic-professional',
                            colorScheme: portalSettings?.proposalTemplateSettings?.colorScheme || 'blue'
                        });
                        const pdfBuffer = await htmlToPdfBuffer(html);

                        console.log(`[Background] ✅ Proposal PDF generated successfully`);
                        return pdfBuffer;

                    } catch (proposalError) {
                        console.error('[Background] ⚠️ Proposal template generation failed, attempting legacy:', proposalError);

                        // Fallback to legacy proposal template
                        const legacyBuffer = await this.generateLegacyPDF(quote, tenant, pDefaults, portalSettings);
                        return legacyBuffer;
                    }
                })();

                // Save PDF to disk for customer portal access (after generation completes)
                if (pdfBuffer) {
                    try {
                        const fs = require('fs').promises;
                        const path = require('path');
                        const tempDir = path.join(__dirname, '..', 'temp');

                        // Ensure temp directory exists
                        try {
                            await fs.mkdir(tempDir, { recursive: true });
                        } catch (mkdirError) {
                            // Directory already exists, ignore error
                        }

                        // Generate unique filename
                        const timestamp = Date.now();
                        const pdfFileName = `proposal-${quote.id}-${timestamp}.pdf`;
                        const pdfPath = path.join(tempDir, pdfFileName);

                        // Write PDF to disk
                        await fs.writeFile(pdfPath, pdfBuffer);

                        // Update quote with PDF URL
                        const pdfUrl = `/temp/${pdfFileName}`;
                        await Quote.update(
                            {
                                proposalPdfUrl: pdfUrl,
                                proposalPdfGeneratedAt: new Date(),
                                proposalPdfVersion: (quote.proposalPdfVersion || 0) + 1
                            },
                            { where: { id: quote.id, tenantId } }
                        );

                        console.log(`[Background] ✅ Proposal PDF saved to disk: ${pdfUrl}`);
                    } catch (saveError) {
                        console.error('[Background] ⚠️ Failed to save PDF to disk:', saveError);
                        // Don't fail the request if PDF save fails - email will still work
                    }
                }

                // Send email notification with magic link
                try {
                    const { emailSubject, emailBody } = req.body || {};

                    if (!emailSubject || !emailBody) {
                        console.error('[Background] Email subject and body are required');
                        return;
                    }

                    // Send emails
                    const emailService = require('../services/emailService');

                    // Send magic link via email instead of traditional quote email
                    if (magicLinkResult) {
                        // Send both magic link and contractor message in parallel
                        await Promise.all([
                            emailService.sendMagicLink({
                                to: quote.customerEmail,
                                customerName: quote.customerName,
                                magicLink: magicLinkResult.link,
                                companyName: tenant?.companyName || 'Your Contractor',
                                companyLogo: tenant?.companyLogoUrl || null,
                                purpose: 'quote_view',
                                quoteInfo: {
                                    quoteNumber: quote.quoteNumber,
                                    total: quote.total,
                                    validUntil: quote.validUntil,
                                },
                                expiryHours: 168, // 7 days
                            }),

                            // Also attach PDF if available
                            pdfBuffer ? emailService.sendContractorMessageWithSignature({
                                to: quote.customerEmail,
                                subject: emailSubject,
                                body: emailBody,
                                contractor: {
                                    name: contractor.fullName,
                                    email: contractor.email,
                                    phone: tenant?.phoneNumber || portalSettings?.phone,
                                    companyName: tenant?.companyName || portalSettings?.businessName || 'Our Painting Team',
                                    logoUrl: tenant?.companyLogoUrl || undefined,
                                    website: tenant?.website || undefined
                                },
                                pdfBuffer,
                                attachmentName: `Proposal-${quote.quoteNumber}.pdf`
                            }) : Promise.resolve()
                        ]);

                        console.log(`[Background] ✅ Emails sent successfully`);
                    } else {
                        // Fallback: Send traditional email if magic link failed
                        await emailService.sendContractorMessageWithSignature({
                            to: quote.customerEmail,
                            subject: emailSubject,
                            body: emailBody,
                            contractor: {
                                name: contractor.fullName,
                                email: contractor.email,
                                phone: tenant?.phoneNumber || portalSettings?.phone,
                                companyName: tenant?.companyName || portalSettings?.businessName || 'Our Painting Team',
                                logoUrl: tenant?.companyLogoUrl || undefined,
                                website: tenant?.website || undefined
                            },
                            pdfBuffer,
                            attachmentName: `Proposal-${quote.quoteNumber}.pdf`
                        });

                        console.log(`[Background] ✅ Email sent successfully`);
                    }
                } catch (emailError) {
                    console.error('[Background] Error sending quote email:', emailError);
                }
            } catch (backgroundError) {
                console.error('[Background] Error in background processing:', backgroundError);
            }
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

        // Build GBB table rows from productSets or areas (resolve product IDs to names)
        const rows = [];

        // Parse productSets if needed
        let productSets = quote.productSets;
        if (typeof productSets === 'string') {
            try {
                productSets = JSON.parse(productSets);
            } catch (e) {
                console.error('Failed to parse productSets in PDF generation:', e);
                productSets = [];
            }
        }
        // Ensure it's an array
        if (!Array.isArray(productSets)) {
            productSets = [];
        }

        console.log('📄 PDF Generation Debug:', {
            hasAreas: !!quote.areas,
            areasLength: quote.areas?.length,
            hasProductSets: !!productSets,
            productSetsType: Array.isArray(productSets) ? 'array' : typeof productSets,
            productSetsLength: Array.isArray(productSets) ? productSets.length : 0,
            productSets: JSON.stringify(quote.productSets, null, 2)
        });

        // Load product configs to resolve product names
        const ProductConfig = require('../models/ProductConfig');
        const GlobalProduct = require('../models/GlobalProduct');
        const Brand = require('../models/Brand');
        const { Op } = require('sequelize');

        // Collect all product IDs from productSets
        const allProductIds = new Set();
        if (Array.isArray(productSets)) {
            productSets.forEach(set => {
                if (set.products) {
                    if (set.products.good) allProductIds.add(set.products.good);
                    if (set.products.better) allProductIds.add(set.products.better);
                    if (set.products.best) allProductIds.add(set.products.best);
                    if (set.products.single) allProductIds.add(set.products.single);
                }
            });
        }

        // Fetch product details in one query
        let productMap = {};
        if (allProductIds.size > 0) {
            const productConfigs = await ProductConfig.findAll({
                where: {
                    [Op.or]: [
                        { id: { [Op.in]: Array.from(allProductIds) } },
                        { globalProductId: { [Op.in]: Array.from(allProductIds) } }
                    ]
                },
                include: [{
                    model: GlobalProduct,
                    as: 'globalProduct',
                    include: [{
                        model: Brand,
                        as: 'brand'
                    }]
                }]
            });

            // Create lookup map for products by both config ID and global product ID
            productMap = {};
            productConfigs.forEach(config => {
                let brandName, productName;

                // Support both global and custom products
                if (config.isCustom && config.customProduct) {
                    brandName = config.customProduct.brandName || '';
                    productName = config.customProduct.name || 'Custom Product';
                } else if (config.globalProduct) {
                    brandName = config.globalProduct.brand?.name || '';
                    productName = config.globalProduct.name || 'Unknown Product';
                } else {
                    brandName = '';
                    productName = 'Unknown Product';
                }

                const sheen = config.sheen || config.globalProduct?.sheen || '';

                // Create full name with sheen if available
                let fullName = brandName ? `${brandName} - ${productName}` : productName;
                if (sheen && sheen !== 'Not specified') {
                    fullName += ` (${sheen})`;
                }

                productMap[config.id] = fullName;
                if (config.globalProductId) {
                    productMap[config.globalProductId] = fullName;
                }
            });
            console.log('📄 Product map created:', productMap);
        }

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
        console.log('📄 Surface types found:', surfaceTypes);

        // Check if this is area-wise pricing (flat rate, production-based, rate-based)
        const isAreaWise = quote.pricingScheme &&
            ['flat_rate_unit', 'production_based', 'rate_based'].includes(quote.pricingScheme.type);

        if (isAreaWise) {
            // Build area-wise product table
            const areaRows = [];

            (quote.areas || []).forEach(area => {
                if (!area.laborItems || area.laborItems.length === 0) return;

                area.laborItems.forEach(item => {
                    if (!item.selected) return;

                    const surfaceType = item.categoryName;

                    // Find product set for this area+surface
                    const productSet = Array.isArray(productSets) && productSets.find(ps =>
                        ps.areaId === area.id && ps.surfaceType === surfaceType
                    );

                    // Fallback to global selection
                    const selectedSet = productSet || (Array.isArray(productSets) && productSets.find(ps =>
                        !ps.areaId && ps.surfaceType === surfaceType
                    ));

                    if (selectedSet) {
                        let good, better, best;
                        if (selectedSet.products) {
                            good = productMap[selectedSet.products.good] || undefined;
                            better = productMap[selectedSet.products.better] || undefined;
                            best = productMap[selectedSet.products.best] || undefined;
                        }

                        areaRows.push({
                            area: area.name,
                            label: surfaceType,
                            good,
                            better,
                            best,
                            isOverridden: !!productSet
                        });
                    }
                });
            });

            rows.push(...areaRows);
            console.log('📄 Area-wise product rows:', areaRows);
        } else {
            // Global product table (original logic for turnkey)
            surfaceTypes.forEach((label) => {
                let good, better, best;

                if (Array.isArray(productSets)) {
                    const set = productSets.find(ps => ps.surfaceType === label && !ps.areaId) || {};
                    // Look up product names by ID
                    if (set.products) {
                        good = productMap[set.products.good] || undefined;
                        better = productMap[set.products.better] || undefined;
                        best = productMap[set.products.best] || undefined;
                    }
                }

                console.log(`📄 Row for ${label}:`, { good, better, best });
                rows.push({ label, good, better, best });
            });
        }

        console.log('📄 Final rows for PDF:', rows);

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
                logoUrl: tenant?.companyLogoUrl || pDefaults?.companyLogo || '',
            },
            proposal: {
                invoiceNumber: quote.quoteNumber,
                date: new Date().toLocaleDateString("en-US", {
                    month: 'short', day: 'numeric', year: 'numeric'
                }),
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
                investment: {},
            },
        };

        const html = renderProposalHtml(templateData, {
            templateId: settings?.selectedProposalTemplate || 'classic-professional',
            colorScheme: settings?.proposalTemplateSettings?.colorScheme || 'blue'
        });
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
    const { areas, productSets: rawProductSets, pricingScheme } = quote;

    // Parse productSets if it's a string
    let productSets = rawProductSets;
    if (typeof rawProductSets === 'string') {
        try {
            productSets = JSON.parse(rawProductSets);
        } catch (e) {
            console.error('Failed to parse productSets:', e);
            productSets = [];
        }
    }

    // Ensure productSets is an array
    if (!Array.isArray(productSets)) {
        console.warn('productSets is not an array, converting:', typeof productSets);
        productSets = [];
    }

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

    // Load product configurations to get pricing
    const ProductConfig = require('../models/ProductConfig');
    const GlobalProduct = require('../models/GlobalProduct');
    const Brand = require('../models/Brand');
    const { Op } = require('sequelize');

    // Collect all product IDs from productSets (new structure)
    const allProductIds = new Set();
    if (Array.isArray(productSets)) {
        productSets.forEach(set => {
            if (set.products && typeof set.products === 'object') {
                // New structure: products = { good: id, better: id, best: id }
                Object.values(set.products).forEach(productId => {
                    if (productId) allProductIds.add(productId);
                });
            }
        });
    }

    // Fetch product details
    let productDetailsMap = {};
    if (allProductIds.size > 0) {
        const productConfigs = await ProductConfig.findAll({
            where: {
                [Op.or]: [
                    { id: { [Op.in]: Array.from(allProductIds) } },
                    { globalProductId: { [Op.in]: Array.from(allProductIds) } }
                ]
            },
            include: [{
                model: GlobalProduct,
                as: 'globalProduct',
                include: [{ model: Brand, as: 'brand' }]
            }]
        });

        productConfigs.forEach(config => {
            let brandName, productName;

            // Support both global and custom products
            if (config.isCustom && config.customProduct) {
                brandName = config.customProduct.brandName || '';
                productName = config.customProduct.name || 'Custom Product';
            } else if (config.globalProduct) {
                brandName = config.globalProduct.brand?.name || '';
                productName = config.globalProduct.name || 'Unknown Product';
            } else {
                brandName = '';
                productName = 'Unknown Product';
            }

            const pricePerGallon = parseFloat(config.pricePerGallon || config.globalProduct?.pricePerGallon || 35);
            const coverage = parseInt(config.coverageSqftPerGal || config.globalProduct?.coverageSqftPerGal || 400);

            productDetailsMap[config.id] = {
                name: brandName ? `${brandName} - ${productName}` : productName,
                pricePerGallon,
                coverage
            };

            if (config.globalProductId) {
                productDetailsMap[config.globalProductId] = productDetailsMap[config.id];
            }
        });
    }

    // Calculate material costs from productSets (new area+surface structure)
    for (const set of productSets || []) {
        if (!set.products || typeof set.products !== 'object') continue;

        const quantity = parseFloat(set.quantity) || 0;
        const unit = set.unit || 'sqft';

        // Convert to sqft if needed
        let sqft = quantity;
        if (unit === 'linear_foot') {
            sqft = quantity * 0.5; // Approximate conversion
        } else if (unit === 'unit') {
            sqft = quantity * 20; // Approximate: doors/cabinets = 20 sqft each
        }

        // Process each tier's product
        Object.entries(set.products).forEach(([tier, productId]) => {
            if (!productId) return;

            const productDetails = productDetailsMap[productId];
            if (!productDetails) return;

            const coverage = productDetails.coverage || 400;
            const pricePerGallon = productDetails.pricePerGallon || 35;

            // Calculate gallons needed (with 10% waste factor)
            const gallonsNeeded = (sqft / coverage) * 1.1;
            const productCost = gallonsNeeded * pricePerGallon;

            materialCost += productCost;

            if (!productCosts[productId]) {
                productCosts[productId] = {
                    name: productDetails.name,
                    gallons: 0,
                    pricePerGallon: pricePerGallon,
                    cost: 0
                };
            }

            productCosts[productId].gallons += gallonsNeeded;
            productCosts[productId].cost += productCost;
        });
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

    // 8. Calculate Tax (only on markup amounts, not full subtotal)
    const materialMarkupAmount = materialTotal - materialCost;
    const totalMarkupAmount = materialMarkupAmount + overhead + profitAmount;
    const tax = totalMarkupAmount * (taxPercent / 100);

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
 * OPTIMIZED: Field selection excludes large JSON blobs (areas, productSets, breakdown)
 *            Only loads essential client fields, uses raw query
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
            attributes: [
                'id', 'quoteNumber', 'customerName', 'status', 'total', 'subtotal',
                'street', 'city', 'state', 'zipCode', 'jobScope', 'homeSqft',
                'productStrategy', 'pricingSchemeId', 'clientId',
                'createdAt', 'updatedAt'
            ],
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
                },
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

/**
 * Helper method to generate legacy PDF
 * OPTIMIZATION: Extracted to separate method for better maintainability
 */
exports.generateLegacyPDF = async (quote, tenant, pDefaults, settings) => {
    try {
        const projectAddress = [quote.street, quote.city, quote.state, quote.zipCode].filter(Boolean).join(', ');

        // Prepare GBB rows from productSets (organized by surface type)
        const rows = [];

        // Parse productSets if needed
        let productSets = quote.productSets;
        if (typeof productSets === 'string') {
            try {
                productSets = JSON.parse(productSets);
            } catch (e) {
                console.error('Failed to parse productSets in sendQuote:', e);
                productSets = [];
            }
        }
        // Ensure it's an array
        if (!Array.isArray(productSets)) {
            productSets = [];
        }

        // Helper to get product names by ID with caching
        const getProductNameById = async (productId) => {
            if (!productId) return undefined;
            try {
                const ProductConfig = require('../models/ProductConfig');
                const config = await ProductConfig.findByPk(productId, {
                    include: [{ model: GlobalProduct, as: 'globalProduct', include: [{ model: Brand, as: 'brand' }] }]
                });

                if (config) {
                    // Support both custom and global products
                    if (config.isCustom && config.customProduct) {
                        const brandName = config.customProduct.brandName || '';
                        const productName = config.customProduct.name || 'Custom Product';
                        return brandName ? `${brandName} ${productName}`.trim() : productName;
                    } else if (config.globalProduct) {
                        return `${config.globalProduct.brand?.name || ''} ${config.globalProduct.name || ''}`.trim();
                    }
                }
            } catch (e) {
                console.error('Error fetching product name:', e);
            }
            return undefined;
        };

        // Extract surface types from areas (labor items with selected status)
        const surfaceSet = new Set();
        (quote.areas || []).forEach(a => {
            a.laborItems?.forEach(li => {
                if (li?.selected && li?.categoryName) {
                    surfaceSet.add(li.categoryName);
                }
            });
        });

        // Build rows for each surface type with product selections
        // Group by area if we have area-wise data
        const hasAreas = productSets.some(ps => ps.areaId !== undefined);

        if (hasAreas) {
            // Area-wise structure: group by area
            const areaGroups = {};
            productSets.forEach(ps => {
                const areaName = ps.areaName || `Area ${ps.areaId}`;
                if (!areaGroups[areaName]) {
                    areaGroups[areaName] = [];
                }
                areaGroups[areaName].push(ps);
            });

            // Build rows for each area's surfaces
            for (const [areaName, areaSets] of Object.entries(areaGroups)) {
                for (const productSet of areaSets) {
                    const products = productSet.products || {};
                    const goodId = products.good;
                    const betterId = products.better;
                    const bestId = products.best;

                    // Fetch product names for each tier
                    const [goodName, betterName, bestName] = await Promise.all([
                        getProductNameById(goodId),
                        getProductNameById(betterId),
                        getProductNameById(bestId)
                    ]);

                    rows.push({
                        area: areaName,
                        label: productSet.surfaceType || 'Unknown',
                        good: goodName,
                        better: betterName,
                        best: bestName
                    });
                }
            }
        } else {
            // Turnkey structure: no areas
            for (const surfaceType of Array.from(surfaceSet)) {
                // Find productSet for this surface type
                const productSet = productSets.find(ps => ps.surfaceType === surfaceType);

                if (!productSet) {
                    rows.push({ label: surfaceType, good: undefined, better: undefined, best: undefined });
                    continue;
                }

                // Extract product IDs from nested structure
                const products = productSet.products || {};
                const goodId = products.good;
                const betterId = products.better;
                const bestId = products.best;

                // Fetch product names for each tier
                const [goodName, betterName, bestName] = await Promise.all([
                    getProductNameById(goodId),
                    getProductNameById(betterId),
                    getProductNameById(bestId)
                ]);

                rows.push({
                    label: surfaceType,
                    good: goodName,
                    better: betterName,
                    best: bestName
                });
            }
        }

        const depositPct = parseFloat(settings?.depositPercentage || 0);
        const total = parseFloat(quote.total || 0);
        const depositAmount = total * (depositPct / 100);

        const templateData = {
            company: {
                name: tenant?.companyName || 'Your Company',
                email: tenant?.email || '',
                phone: tenant?.phoneNumber || '',
                addressLine1: tenant?.businessAddress || '',
                logoUrl: tenant?.companyLogoUrl || '',
            },
            proposal: {
                invoiceNumber: quote.quoteNumber,
                date: new Date().toLocaleDateString("en-US", {
                    month: 'short', day: 'numeric', year: 'numeric'
                }),
                customerName: quote.customerName,
                projectAddress,
                selectedOption: quote.productStrategy === 'GBB' ? 'GBB' : 'Single',
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

        const { renderProposalHtml, htmlToPdfBuffer } = require('../services/proposalTemplate');
        const html = renderProposalHtml(templateData, {
            templateId: settings?.selectedProposalTemplate || 'classic-professional',
            colorScheme: settings?.proposalTemplateSettings?.colorScheme || 'blue'
        });
        return await htmlToPdfBuffer(html);

    } catch (pdfErrorNew) {
        console.error('New template PDF generation failed, falling back:', pdfErrorNew);
        try {
            const PDFGenerator = require('../utils/pdfGenerator');
            const calculation = await this.calculateQuoteData(quote);

            return await PDFGenerator.generateQuotePDF({
                quote: quote.toJSON(),
                calculation,
                contractor: {
                    name: 'Contractor',
                    email: '',
                    phone: settings?.phone,
                    companyName: settings?.businessName || 'Our Painting Team'
                },
                settings
            });
        } catch (pdfErrorLegacy) {
            console.error('Legacy PDF generation also failed:', pdfErrorLegacy);
            // Return null if all PDF generation fails
            return null;
        }
    }
};

/**
 * Get products by pricing scheme for a quote
 * GET /api/quote-builder/:quoteId/products/:pricingScheme
 * 
 * This endpoint retrieves the productSets from a quote and returns it in a 
 * structured format appropriate for the pricing scheme.
 * 
 * @param {string} quoteId - The ID of the quote
 * @param {string} pricingScheme - The pricing scheme type (turnkey, flat_rate_unit, unit_pricing, hourly)
 * @returns {Object} Structured product data based on the pricing scheme
 */
exports.getProductsByPricingScheme = async (req, res) => {
    try {
        const { quoteId, pricingScheme } = req.params;
        const tenantId = req.user.tenantId;

        // Validate pricing scheme parameter
        const validSchemes = ['turnkey', 'flat_rate_unit', 'unit_pricing', 'hourly', 'sqft_turnkey', 'production_based', 'rate_based', 'rate_based_sqft'];
        if (!validSchemes.includes(pricingScheme)) {
            return res.status(400).json({
                success: false,
                message: `Invalid pricing scheme. Must be one of: ${validSchemes.join(', ')}`,
            });
        }

        // Fetch the quote with related data
        const quote = await Quote.findOne({
            where: { id: quoteId, tenantId },
            include: [
                { model: PricingScheme, as: 'pricingScheme' },
                { model: Client, as: 'client' },
            ],
        });

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found',
            });
        }

        // Get the product sets from the quote
        const productSets = quote.productSets || [];

        // Determine the actual scheme type from the quote's pricing scheme
        const actualSchemeType = quote.pricingScheme?.type || pricingScheme;

        // Normalize scheme types for comparison
        const normalizeScheme = (scheme) => {
            const schemeMap = {
                'sqft_turnkey': 'turnkey',
                'production_based': 'unit_pricing',
                'rate_based': 'unit_pricing',
                'rate_based_sqft': 'unit_pricing',
            };
            return schemeMap[scheme] || scheme;
        };

        const normalizedActualScheme = normalizeScheme(actualSchemeType);
        const normalizedRequestedScheme = normalizeScheme(pricingScheme);

        // Warn if the requested scheme doesn't match the quote's scheme
        if (normalizedActualScheme !== normalizedRequestedScheme) {
            console.warn(`Warning: Requested scheme '${pricingScheme}' doesn't match quote's scheme '${actualSchemeType}'`);
        }

        // Structure the response based on the pricing scheme
        let structuredProducts = {};

        switch (normalizedActualScheme) {
            case 'turnkey':
                // Turnkey: Products organized by surface type globally
                structuredProducts = {
                    scheme: 'turnkey',
                    structure: 'global',
                    products: {},
                };

                if (Array.isArray(productSets)) {
                    // New array format
                    productSets.forEach(item => {
                        if (item.surfaceType && !item.areaId) {
                            structuredProducts.products[item.surfaceType] = {
                                surfaceType: item.surfaceType,
                                products: item.products || {},
                                quantity: item.quantity,
                                unit: item.unit,
                            };
                        }
                    });
                } else if (productSets.global) {
                    // Legacy object format
                    structuredProducts.products = productSets.global;
                }
                break;

            case 'flat_rate_unit':
                // Flat Rate Unit: Products organized by unit type (interior/exterior)
                structuredProducts = {
                    scheme: 'flat_rate_unit',
                    structure: 'by_unit_type',
                    interior: {},
                    exterior: {},
                };

                if (Array.isArray(productSets)) {
                    // New array format - group by category
                    productSets.forEach(item => {
                        if (item.unitType) {
                            const category = item.category || 'interior';
                            if (!structuredProducts[category]) {
                                structuredProducts[category] = {};
                            }
                            structuredProducts[category][item.unitType] = {
                                unitType: item.unitType,
                                products: item.products || [],
                                unitCount: item.unitCount,
                                totalCost: item.totalCost,
                            };
                        }
                    });
                } else if (productSets.interior || productSets.exterior) {
                    // Legacy object format
                    structuredProducts.interior = productSets.interior || {};
                    structuredProducts.exterior = productSets.exterior || {};
                }
                break;

            case 'unit_pricing':
                // Unit Pricing: Products organized by area and surface type
                structuredProducts = {
                    scheme: 'unit_pricing',
                    structure: 'by_area_and_surface',
                    areas: {},
                };

                if (Array.isArray(productSets)) {
                    // New array format - group by area
                    productSets.forEach(item => {
                        if (item.areaId) {
                            const areaId = item.areaId;
                            if (!structuredProducts.areas[areaId]) {
                                structuredProducts.areas[areaId] = {
                                    areaId: areaId,
                                    areaName: item.areaName,
                                    surfaces: {},
                                };
                            }
                            structuredProducts.areas[areaId].surfaces[item.surfaceType] = {
                                surfaceType: item.surfaceType,
                                products: item.products || {},
                                quantity: item.quantity,
                                unit: item.unit,
                                overridden: item.overridden || false,
                            };
                        }
                    });
                } else if (productSets.areas) {
                    // Legacy object format
                    structuredProducts.areas = productSets.areas;
                }
                break;

            case 'hourly':
                // Hourly: Products organized as items for time-and-materials
                structuredProducts = {
                    scheme: 'hourly',
                    structure: 'items',
                    items: [],
                };

                if (Array.isArray(productSets)) {
                    // New array format
                    structuredProducts.items = productSets.filter(item => item.id || item.description);
                } else if (productSets.items && Array.isArray(productSets.items)) {
                    // Legacy object format
                    structuredProducts.items = productSets.items;
                }
                break;

            default:
                // Unknown scheme - return raw data
                structuredProducts = {
                    scheme: actualSchemeType,
                    structure: 'raw',
                    products: productSets,
                };
        }

        // Add metadata
        const response = {
            success: true,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            pricingScheme: actualSchemeType,
            requestedScheme: pricingScheme,
            data: structuredProducts,
            areas: quote.areas || [],
            metadata: {
                lastModified: quote.lastModified,
                autoSaveVersion: quote.autoSaveVersion,
            },
        };

        res.json(response);
    } catch (error) {
        console.error('Get products by pricing scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve products',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Product Configuration Endpoints
 * These functions delegate to quoteController for actual implementation
 * to avoid code duplication while maintaining the expected API structure
 */

const quoteController = require('./quoteController');

/**
 * GET /api/quote-builder/:quoteId/product-configuration
 * Get product configuration for a quote with available products
 */
exports.getProductConfiguration = quoteController.getProductConfiguration;

/**
 * PUT /api/quote-builder/:quoteId/product-configuration
 * Update product configuration for a quote
 */
exports.updateProductConfiguration = quoteController.updateProductConfiguration;

/**
 * POST /api/quote-builder/:quoteId/product-configuration/apply-to-all
 * Apply a product to all specified categories
 */
exports.applyProductToAll = quoteController.applyProductToAll;

/**
 * POST /api/quote-builder/:quoteId/product-configuration/validate
 * Validate product configuration for a quote
 */
exports.validateProductConfiguration = quoteController.validateProductConfiguration;

/**
 * POST /api/quote-builder/calculate-tiers
 * Calculate pricing for all GBB tiers
 */
exports.calculateTierPricing = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { pricingScheme, pricingSchemeId, areas, homeSqft, jobScope, conditionModifier, flatRateItems, productSets } = req.body;

        // Validate required parameters - accept either pricingScheme object or pricingSchemeId
        if (!pricingScheme && !pricingSchemeId) {
            return res.status(400).json({
                success: false,
                message: 'Pricing scheme is required'
            });
        }

        // If pricingSchemeId is provided, fetch the pricing scheme
        let schemeData = pricingScheme;
        if (!schemeData && pricingSchemeId) {
            const { PricingScheme } = require('../models');
            const scheme = await PricingScheme.findOne({
                where: {
                    id: pricingSchemeId,
                    tenantId
                }
            });

            if (!scheme) {
                return res.status(404).json({
                    success: false,
                    message: 'Pricing scheme not found'
                });
            }

            schemeData = {
                id: scheme.id,
                name: scheme.name,
                type: scheme.type,
                rules: scheme.rules
            };
        }

        // Fetch GBB configuration from ContractorSettings
        const { ContractorSettings } = require('../models');
        const settings = await ContractorSettings.findOne({
            where: { tenantId }
        });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Contractor settings not found'
            });
        }

        // Prepare pricing parameters
        const pricingParams = {
            model: schemeData.type,
            areas,
            homeSqft,
            jobScope,
            conditionModifier,
            flatRateItems,
            productSets,
            rules: schemeData.rules || {}, // Use rules from pricing scheme
            analytics: {
                tenantId,
                userId: req.user.id
            }
        };

        // Calculate pricing for all tiers
        const { calculatePricingWithTiers } = require('../utils/pricingCalculator');
        const tierPricing = calculatePricingWithTiers(pricingParams, settings.gbbTiers);

        // If GBB is not enabled, return single-tier pricing
        if (!tierPricing.gbbEnabled) {
            return res.json({
                success: true,
                gbbEnabled: false,
                data: {
                    good: tierPricing.good,
                    better: tierPricing.good,
                    best: tierPricing.good
                }
            });
        }

        // Return tier pricing
        res.json({
            success: true,
            gbbEnabled: true,
            data: {
                good: tierPricing.good,
                better: tierPricing.better,
                best: tierPricing.best
            }
        });

    } catch (error) {
        console.error('Error calculating tier pricing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate tier pricing',
            error: error.message
        });
    }
};

module.exports = exports;

