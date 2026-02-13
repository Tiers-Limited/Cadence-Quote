// utils/pricingCalculator.js
/**
 * Unified Pricing Calculator for Cadence Quote
 * Supports 4 pricing models with labor (always included) and optional materials
 * 
 * Models:
 * 1. Turnkey Pricing (Whole-Home)
 * 2. Rate-Based Square Foot Pricing
 * 3. Production-Based Pricing
 * 4. Flat Rate Pricing (Unit-Based)
 */

const jobAnalyticsService = require('../services/jobAnalyticsService');

/**
 * Calculate paint gallons required
 * @param {number} totalSqft - Total square footage
 * @param {number} coats - Number of coats (default: 2)
 * @param {number} coverage - Coverage per gallon (default: 350)
 * @param {string} applicationMethod - "roll" or "spray" (default: "roll")
 * @returns {number} - Gallons required (rounded up)
 */
function calculateGallons(totalSqft, coats = 2, coverage = 350, applicationMethod = 'roll') {
    // Adjust coverage based on application method
    // If spray is selected and coverage is default (350), reduce to 300
    // If user has overridden coverage, respect their setting
    let adjustedCoverage = coverage;
    if (applicationMethod === 'spray') {
        // If coverage is at default (350), apply spray reduction to 300
        // Otherwise, user has manually overridden, so keep their setting
        if (coverage === 350) {
            adjustedCoverage = 300; // Reduced for spray overspray
        } else {
            adjustedCoverage = coverage; // User override respected
        }
    }

    const gallons = (totalSqft * coats) / adjustedCoverage;
    return Math.ceil(gallons);
}

/**
 * Calculate material cost
 * @param {number} totalSqft - Total square footage
 * @param {object} rules - Pricing rules from scheme
 * @param {boolean} laborOnly - If true, customer supplies paint (no material cost)
 * @returns {object} - Material cost breakdown
 */
function calculateMaterialCost(totalSqft, rules, laborOnly = false) {
    // If laborOnly is true, customer supplies paint - return zero material cost
    if (laborOnly || !rules.includeMaterials) {
        return {
            materialCost: 0,
            gallons: 0,
            costPerGallon: 0,
        };
    }

    const coats = rules.coats || 2;
    const coverage = rules.coverage || 350;
    const applicationMethod = rules.applicationMethod || 'roll';
    const costPerGallon = rules.costPerGallon || 40;

    const gallons = calculateGallons(totalSqft, coats, coverage, applicationMethod);
    const materialCost = gallons * costPerGallon;

    return {
        materialCost,
        gallons,
        costPerGallon,
        coats,
        coverage,
        applicationMethod,
    };
}

/**
 * Calculate Turnkey Pricing (Model 1) - FIXED
 * Formula: Total = (Home Sq Ft × Turnkey Rate × Condition Multiplier) + Product Costs
 * NOTE: Turnkey rate is all-inclusive. NO additional markups, overhead, profit, or tax.
 * 
 * @param {object} params - Calculation parameters
 * @param {number} params.homeSqft - Total home square footage
 * @param {string} params.jobScope - Job scope (interior/exterior/both)
 * @param {string} params.conditionModifier - Property condition (excellent/good/average/fair/poor)
 * @param {object} params.rules - Pricing rules from scheme
 * @param {object} params.productSets - Product selections (uses wholeHome structure)
 * @returns {object} - Pricing breakdown with isTurnkey flag
 */
function calculateTurnkeyPricing(params) {
    const { homeSqft, jobScope, rules, productSets, conditionModifier = 'average', settings = {} } = params;

    // Condition multipliers (Cadence-set defaults)
    const conditionMultipliers = {
        excellent: 1.00,
        good: 1.05,
        average: 1.12,
        fair: 1.25,
        poor: 1.45
    };

    // Determine rate based on job scope
    // Prefer contractor settings (if provided), then rules from scheme, then fallback
    let rate = 3.50;
    if (jobScope === 'interior') {
        rate = settings.turnkeyInteriorRate ?? rules.interiorRate ?? rules.turnkeyRate ?? 3.50;
    } else if (jobScope === 'exterior') {
        rate = settings.turnkeyExteriorRate ?? rules.exteriorRate ?? rules.turnkeyRate ?? 3.50;
    } else {
        rate = rules.turnkeyRate ?? settings.turnkeyInteriorRate ?? 3.50;
    }

    // Apply condition multiplier
    const multiplier = conditionMultipliers[conditionModifier] || 1.12;
    const baseTotal = homeSqft * rate * multiplier;

    // Calculate product costs from productSets if available
    // Turnkey uses whole-home products, not surface-specific
    let productCost = 0;
    const productBreakdown = [];

    if (productSets && productSets.wholeHome && typeof productSets.wholeHome === 'object') {
        // Check for Good-Better-Best strategy
        if (productSets.wholeHome.good || productSets.wholeHome.better || productSets.wholeHome.best) {
            ['good', 'better', 'best'].forEach(tier => {
                const productData = productSets.wholeHome[tier];
                if (productData && productData.cost) {
                    const cost = parseFloat(productData.cost) || 0;
                    productCost += cost;

                    productBreakdown.push({
                        tier: tier.charAt(0).toUpperCase() + tier.slice(1),
                        productName: productData.productName || 'Unknown Product',
                        productId: productData.productId,
                        quantity: productData.quantity || 0,
                        unit: productData.unit || 'gallons',
                        pricePerGallon: productData.pricePerGallon || 0,
                        cost: cost
                    });
                }
            });
        }
        // Check for single product strategy
        else if (productSets.wholeHome.single) {
            const productData = productSets.wholeHome.single;
            if (productData && productData.cost) {
                const cost = parseFloat(productData.cost) || 0;
                productCost += cost;

                productBreakdown.push({
                    tier: 'Selected',
                    productName: productData.productName || 'Unknown Product',
                    productId: productData.productId,
                    quantity: productData.quantity || 0,
                    unit: productData.unit || 'gallons',
                    pricePerGallon: productData.pricePerGallon || 0,
                    cost: cost
                });
            }
        }
    }
    // Fallback: Check for legacy global structure for backward compatibility
    else if (productSets && productSets.global && typeof productSets.global === 'object') {
        Object.entries(productSets.global).forEach(([surfaceType, productData]) => {
            if (productData && productData.cost) {
                const cost = parseFloat(productData.cost) || 0;
                productCost += cost;

                productBreakdown.push({
                    surfaceType,
                    productName: productData.productName || 'Unknown Product',
                    productId: productData.productId,
                    quantity: productData.quantity || 0,
                    unit: productData.unit || 'gallons',
                    cost: cost
                });
            }
        });
    }

    // For turnkey: 60/40 labor/material split of base, plus product costs
    const laborCost = baseTotal * 0.60;
    const materialCost = (baseTotal * 0.40) + productCost;
    const total = laborCost + materialCost;

    return {
        laborCost,
        materialCost,
        productCost,
        subtotal: total,
        total,
        homeSqft,
        rate,
        conditionMultiplier: multiplier,
        baseTotal,
        jobScope,
        productBreakdown,
        model: 'turnkey',
        isTurnkey: true, // Flag to skip markup application
    };
}

/**
 * Calculate Rate-Based Square Foot Pricing (Model 2)
 * Labor Cost = Σ (Area Sq Ft × Area Rate)
 * Material Cost = (Total Sq Ft × Coats ÷ Coverage) × Cost per Gallon
 * @param {object} params - Calculation parameters
 * @returns {object} - Pricing breakdown
 */
function calculateRateBasedPricing(params) {
    const { areas, rules, laborOnly = false } = params;

    let totalLaborCost = 0;
    let totalSqft = 0;
    const breakdown = [];

    // Calculate labor for each area
    for (const area of areas) {
        for (const item of area.items || []) {
            const quantity = parseFloat(item.quantity) || 0;
            const category = item.categoryName?.toLowerCase() || '';

            // Get labor rate from rules
            let laborRate = 0;
            if (rules.laborRates) {
                // Interior categories
                if (category.includes('wall') && !category.includes('exterior')) laborRate = rules.laborRates.walls || 0.55;
                else if (category.includes('ceiling')) laborRate = rules.laborRates.ceilings || 0.65;
                else if (category.includes('trim') && !category.includes('exterior')) laborRate = rules.laborRates.trim || 2.50;
                else if (category.includes('door') && !category.includes('exterior')) laborRate = rules.laborRates.doors || 45;
                else if (category.includes('cabinet')) laborRate = rules.laborRates.cabinets || 65;
                // Exterior categories
                else if (category.includes('exterior wall')) laborRate = rules.laborRates['exterior walls'] || 0.55;
                else if (category.includes('exterior trim')) laborRate = rules.laborRates['exterior trim'] || 2.50;
                else if (category.includes('exterior door')) laborRate = rules.laborRates['exterior doors'] || 45;
                else if (category.includes('deck')) laborRate = rules.laborRates.deck || 2.00;
                else if (category.includes('soffit') || category.includes('fascia')) laborRate = rules.laborRates['soffit & fascia'] || 2.50;
                else if (category.includes('shutter')) laborRate = rules.laborRates.shutters || 50;
            }

            const laborCost = quantity * laborRate;
            totalLaborCost += laborCost;

            // Track square footage for material calculation
            if (item.measurementUnit === 'sqft') {
                totalSqft += quantity;
            }

            breakdown.push({
                areaName: area.name,
                category: item.categoryName,
                quantity,
                unit: item.measurementUnit,
                laborRate,
                laborCost,
            });
        }
    }

    // Calculate materials (respects laborOnly flag)
    const materials = calculateMaterialCost(totalSqft, rules, laborOnly);

    const subtotal = totalLaborCost + materials.materialCost;

    return {
        laborCost: totalLaborCost,
        materialCost: materials.materialCost,
        gallons: materials.gallons,
        subtotal,
        total: subtotal,
        totalSqft,
        breakdown,
        model: 'rate_based_sqft',
        laborOnly,
    };
}

/**
 * Calculate Production-Based Pricing (Model 3)
 * Labor Cost = (Area ÷ Production Rate) × Hourly Labor Rate × Painters on Site
 * Material Cost = (Total Sq Ft × Coats ÷ Coverage) × Cost per Gallon + Product Costs
 * 
 * IMPORTANT: paintersOnSite overrides the default crewSize from contractor settings.
 * This allows contractors to adjust crew size per quote in the quote builder.
 * 
 * @param {object} params - Calculation parameters
 * @returns {object} - Pricing breakdown
 */
function calculateProductionBasedPricing(params) {
    const { areas, rules, productSets, laborOnly = false, paintersOnSite } = params;

    const billableLaborRate = rules.billableLaborRate || 50;
    // Use paintersOnSite from quote if provided, otherwise fall back to default crewSize
    const crewSize = paintersOnSite || rules.crewSize || 1;
    let totalLaborCost = 0;
    let totalSqft = 0;
    let totalHours = 0;
    let totalProductCost = 0;
    const breakdown = [];

    // Calculate labor hours for each area
    for (const area of areas) {
        for (const item of area.items || []) {
            const quantity = parseFloat(item.quantity) || 0;
            const category = item.categoryName?.toLowerCase() || '';

            // Get production rate from rules (sqft or linear ft per hour per painter)
            let productionRate = 0;
            if (rules.productionRates) {
                // Interior categories
                if (category.includes('wall') && !category.includes('exterior')) productionRate = rules.productionRates.walls || 300;
                else if (category.includes('ceiling')) productionRate = rules.productionRates.ceilings || 250;
                else if (category.includes('trim') && !category.includes('exterior')) productionRate = rules.productionRates.trim || 150;
                else if (category.includes('door')) productionRate = rules.productionRates.doors || 2;
                else if (category.includes('cabinet')) productionRate = rules.productionRates.cabinets || 1.5;
                // Exterior categories
                else if (category.includes('exterior wall')) productionRate = rules.productionRates['exterior walls'] || 250;
                else if (category.includes('exterior trim')) productionRate = rules.productionRates['exterior trim'] || 120;
                else if (category.includes('soffit') || category.includes('fascia')) productionRate = rules.productionRates['soffit & fascia'] || 100;
            }

            if (productionRate > 0) {
                // Calculate hours per painter (production rates are per painter)
                const hoursPerPainter = quantity / productionRate;
                // Multiply billable rate by crew size (paintersOnSite)
                // This means: hourly rate × number of painters × hours
                const laborCost = hoursPerPainter * billableLaborRate * crewSize;

                totalHours += hoursPerPainter;
                totalLaborCost += laborCost;

                // Get product cost from productSets if available (only if not laborOnly)
                let productCost = 0;
                if (!laborOnly && productSets && productSets.areas && productSets.areas[area.id]) {
                    const areaData = productSets.areas[area.id];
                    if (areaData.surfaces && areaData.surfaces[item.categoryName]) {
                        const surfaceData = areaData.surfaces[item.categoryName];

                        // Check for tier-based pricing (Good, Better, Best)
                        if (surfaceData.good || surfaceData.better || surfaceData.best) {
                            // Sum costs from all tiers (customer will select one, but we calculate all)
                            ['good', 'better', 'best'].forEach(tier => {
                                if (surfaceData[tier] && surfaceData[tier].cost) {
                                    productCost += parseFloat(surfaceData[tier].cost) || 0;
                                }
                            });
                        } else if (surfaceData.cost) {
                            productCost = parseFloat(surfaceData.cost) || 0;
                        }
                    }
                }

                totalProductCost += productCost;

                breakdown.push({
                    areaName: area.name,
                    category: item.categoryName,
                    quantity,
                    unit: item.measurementUnit,
                    productionRate,
                    crewSize,
                    hours: parseFloat(hoursPerPainter.toFixed(2)),
                    billableRate: billableLaborRate,
                    laborCost,
                    productCost,
                });
            }

            // Track square footage for material calculation
            if (item.measurementUnit === 'sqft') {
                totalSqft += quantity;
            }
        }
    }

    // Calculate materials (respects laborOnly flag)
    const materials = calculateMaterialCost(totalSqft, rules, laborOnly);

    const subtotal = totalLaborCost + materials.materialCost + totalProductCost;

    return {
        laborCost: totalLaborCost,
        materialCost: materials.materialCost + totalProductCost,
        productCost: totalProductCost,
        gallons: materials.gallons,
        totalHours: parseFloat(totalHours.toFixed(2)),
        billableLaborRate,
        crewSize,
        paintersOnSite: crewSize, // Return the actual crew size used
        subtotal,
        total: subtotal,
        totalSqft,
        breakdown,
        model: 'production_based',
        laborOnly,
    };
}

/**
 * Calculate Flat Rate Pricing (Model 4)
 * Formula: Total = Unit Price × Quantity + Product Costs
 * @param {object} params - Calculation parameters
 * @returns {object} - Pricing breakdown
 */
function calculateFlatRatePricing(params) {
    const { flatRateItems, rules, productSets } = params;

    let totalCost = 0;
    let totalProductCost = 0;
    const breakdown = [];

    // Handle new flatRateItems structure
    if (flatRateItems) {
        // Interior items
        if (flatRateItems.interior) {
            Object.entries(flatRateItems.interior).forEach(([itemKey, quantity]) => {
                if (quantity > 0) {
                    let unitPrice = 0;
                    let itemName = '';
                    let productCost = 0;

                    // Normalize item key (handle both camelCase and variations)
                    const normalizedKey = itemKey.toLowerCase().replace(/s$/, ''); // Remove trailing 's'

                    // Get unit price from rules based on item key
                    if (rules.flatRateUnitPrices) {
                        switch (itemKey) {
                            case 'doors':
                            case 'door':
                                unitPrice = rules.flatRateUnitPrices.door || rules.flatRateUnitPrices.doors || 85;
                                itemName = 'Interior Doors';
                                break;
                            case 'smallRooms':
                            case 'smallRoom':
                                unitPrice = rules.flatRateUnitPrices.smallRoom || rules.flatRateUnitPrices.room_small || 350;
                                itemName = 'Small Rooms';
                                break;
                            case 'mediumRooms':
                            case 'mediumRoom':
                                unitPrice = rules.flatRateUnitPrices.mediumRoom || rules.flatRateUnitPrices.room_medium || 450;
                                itemName = 'Medium Rooms';
                                break;
                            case 'largeRooms':
                            case 'largeRoom':
                                unitPrice = rules.flatRateUnitPrices.largeRoom || rules.flatRateUnitPrices.room_large || 600;
                                itemName = 'Large Rooms';
                                break;
                            case 'closets':
                            case 'closet':
                                unitPrice = rules.flatRateUnitPrices.closet || rules.flatRateUnitPrices.closets || 150;
                                itemName = 'Closets';
                                break;
                            case 'accentWalls':
                            case 'accentWall':
                                unitPrice = rules.flatRateUnitPrices.accentWall || rules.flatRateUnitPrices.accentWalls || 200;
                                itemName = 'Accent Walls';
                                break;
                            case 'cabinets':
                            case 'cabinet':
                                unitPrice = rules.flatRateUnitPrices.cabinet || rules.flatRateUnitPrices.cabinets || 125;
                                itemName = 'Cabinets';
                                break;
                            case 'cabinetFaces':
                            case 'cabinetFace':
                            case 'cabinetsFace':
                                unitPrice = rules.flatRateUnitPrices.cabinetsFace || rules.flatRateUnitPrices.cabinetFace || rules.flatRateUnitPrices.cabinet || 300;
                                itemName = 'Cabinet Faces';
                                break;
                            case 'cabinetDoors':
                            case 'cabinetsDoors':
                                unitPrice = rules.flatRateUnitPrices.cabinetsDoors || rules.flatRateUnitPrices.cabinetDoors || rules.flatRateUnitPrices.cabinet || 400;
                                itemName = 'Cabinet Doors';
                                break;
                        }
                    }

                    // Get product cost from productSets if available
                    // Try multiple key variations for compatibility
                    const possibleKeys = [itemKey, itemKey.replace(/s$/, ''), itemKey + 's'];
                    for (const key of possibleKeys) {
                        if (productSets && productSets.interior && productSets.interior[key]) {
                            const categoryData = productSets.interior[key];
                            if (categoryData.totalCost) {
                                productCost = parseFloat(categoryData.totalCost) || 0;
                                break;
                            } else if (categoryData.products && Array.isArray(categoryData.products)) {
                                // Sum up product costs
                                categoryData.products.forEach(product => {
                                    if (product.cost) {
                                        productCost += parseFloat(product.cost) || 0;
                                    }
                                });
                                break;
                            }
                        }
                    }

                    const cost = quantity * unitPrice;
                    totalCost += cost;
                    totalProductCost += productCost;

                    breakdown.push({
                        category: 'Interior',
                        itemName,
                        itemKey,
                        quantity,
                        unitPrice,
                        cost,
                        productCost,
                    });
                }
            });
        }

        // Exterior items
        if (flatRateItems.exterior) {
            Object.entries(flatRateItems.exterior).forEach(([itemKey, quantity]) => {
                if (quantity > 0) {
                    let unitPrice = 0;
                    let itemName = '';
                    let productCost = 0;
                    let multiplier = 1.0;

                    // Get unit price from rules based on item key
                    if (rules.flatRateUnitPrices) {
                        switch (itemKey) {
                            case 'doors':
                            case 'door':
                                unitPrice = rules.flatRateUnitPrices.exteriorDoor || rules.flatRateUnitPrices.exteriorDoors || 95;
                                itemName = 'Exterior Doors';
                                break;
                            case 'windows':
                            case 'window':
                                unitPrice = rules.flatRateUnitPrices.window || rules.flatRateUnitPrices.windows || 75;
                                itemName = 'Windows';
                                break;
                            case 'garageDoors':
                            case 'garageDoor':
                                unitPrice = rules.flatRateUnitPrices.garageDoor || rules.flatRateUnitPrices.garageDoors || 200;
                                itemName = 'Garage Doors';
                                break;
                            case 'garageDoors1Car':
                            case 'garageDoor1Car':
                                unitPrice = rules.flatRateUnitPrices.garageDoor1Car || rules.flatRateUnitPrices.garageDoor || 200;
                                itemName = '1-Car Garage Doors';
                                multiplier = 0.5;
                                break;
                            case 'garageDoors2Car':
                            case 'garageDoor2Car':
                                unitPrice = rules.flatRateUnitPrices.garageDoor2Car || rules.flatRateUnitPrices.garageDoor || 200;
                                itemName = '2-Car Garage Doors';
                                multiplier = 1.0;
                                break;
                            case 'garageDoors3Car':
                            case 'garageDoor3Car':
                                unitPrice = rules.flatRateUnitPrices.garageDoor3Car || rules.flatRateUnitPrices.garageDoor || 200;
                                itemName = '3-Car Garage Doors';
                                multiplier = 1.5;
                                break;
                            case 'shutters':
                            case 'shutter':
                                unitPrice = rules.flatRateUnitPrices.shutter || rules.flatRateUnitPrices.shutters || 50;
                                itemName = 'Shutters';
                                break;
                        }
                    }

                    // Get product cost from productSets if available
                    // Try multiple key variations for compatibility
                    const possibleKeys = [itemKey, itemKey.replace(/s$/, ''), itemKey + 's'];
                    for (const key of possibleKeys) {
                        if (productSets && productSets.exterior && productSets.exterior[key]) {
                            const categoryData = productSets.exterior[key];
                            if (categoryData.totalCost) {
                                productCost = parseFloat(categoryData.totalCost) || 0;
                            } else if (categoryData.products && Array.isArray(categoryData.products)) {
                                // Sum up product costs
                                categoryData.products.forEach(product => {
                                    if (product.cost) {
                                        productCost += parseFloat(product.cost) || 0;
                                    }
                                });
                            }

                            // Apply garage door multiplier if present in productSets
                            if (categoryData.multiplier !== undefined) {
                                multiplier = parseFloat(categoryData.multiplier) || multiplier;
                            }
                            break;
                        }
                    }

                    // Handle garage door multipliers for different sizes
                    if (itemKey.toLowerCase().includes('garagedoor')) {
                        // Check for specific garage door sizes in productSets
                        if (productSets && productSets.exterior) {
                            const gd1CarKey = ['garageDoor1Car', 'garageDoors1Car'].find(k => productSets.exterior[k]);
                            const gd2CarKey = ['garageDoor2Car', 'garageDoors2Car'].find(k => productSets.exterior[k]);
                            const gd3CarKey = ['garageDoor3Car', 'garageDoors3Car'].find(k => productSets.exterior[k]);

                            if (gd1CarKey && productSets.exterior[gd1CarKey].unitCount > 0) {
                                const gd1Car = productSets.exterior[gd1CarKey];
                                const gd1Cost = gd1Car.unitCount * unitPrice * 0.5; // 1-car = 0.5x
                                totalCost += gd1Cost;
                                if (gd1Car.totalCost) totalProductCost += parseFloat(gd1Car.totalCost) || 0;

                                breakdown.push({
                                    category: 'Exterior',
                                    itemName: '1-Car Garage Doors',
                                    itemKey: gd1CarKey,
                                    quantity: gd1Car.unitCount,
                                    unitPrice: unitPrice * 0.5,
                                    multiplier: 0.5,
                                    cost: gd1Cost,
                                    productCost: parseFloat(gd1Car.totalCost) || 0,
                                });
                            }

                            if (gd2CarKey && productSets.exterior[gd2CarKey].unitCount > 0) {
                                const gd2Car = productSets.exterior[gd2CarKey];
                                const gd2Cost = gd2Car.unitCount * unitPrice * 1.0; // 2-car = 1.0x
                                totalCost += gd2Cost;
                                if (gd2Car.totalCost) totalProductCost += parseFloat(gd2Car.totalCost) || 0;

                                breakdown.push({
                                    category: 'Exterior',
                                    itemName: '2-Car Garage Doors',
                                    itemKey: gd2CarKey,
                                    quantity: gd2Car.unitCount,
                                    unitPrice: unitPrice * 1.0,
                                    multiplier: 1.0,
                                    cost: gd2Cost,
                                    productCost: parseFloat(gd2Car.totalCost) || 0,
                                });
                            }

                            if (gd3CarKey && productSets.exterior[gd3CarKey].unitCount > 0) {
                                const gd3Car = productSets.exterior[gd3CarKey];
                                const gd3Cost = gd3Car.unitCount * unitPrice * 1.5; // 3-car = 1.5x
                                totalCost += gd3Cost;
                                if (gd3Car.totalCost) totalProductCost += parseFloat(gd3Car.totalCost) || 0;

                                breakdown.push({
                                    category: 'Exterior',
                                    itemName: '3-Car Garage Doors',
                                    itemKey: gd3CarKey,
                                    quantity: gd3Car.unitCount,
                                    unitPrice: unitPrice * 1.5,
                                    multiplier: 1.5,
                                    cost: gd3Cost,
                                    productCost: parseFloat(gd3Car.totalCost) || 0,
                                });
                            }

                            // Skip adding generic garageDoors entry since we handled specific sizes
                            return;
                        }
                    }

                    const cost = quantity * unitPrice * multiplier;
                    totalCost += cost;
                    totalProductCost += productCost;

                    breakdown.push({
                        category: 'Exterior',
                        itemName,
                        itemKey,
                        quantity,
                        unitPrice,
                        multiplier,
                        cost,
                        productCost,
                    });
                }
            });
        }

        // Handle cabinet subcategories (Face and Doors)
        if (productSets && productSets.interior) {
            // Try multiple key variations for compatibility
            const cabinetFaceKeys = ['cabinetsFace', 'cabinetFace', 'cabinetFaces'];
            const cabinetDoorKeys = ['cabinetsDoors', 'cabinetDoors', 'cabinetDoor'];

            const cabinetFaceKey = cabinetFaceKeys.find(k => productSets.interior[k] && productSets.interior[k].unitCount > 0);
            const cabinetDoorKey = cabinetDoorKeys.find(k => productSets.interior[k] && productSets.interior[k].unitCount > 0);

            if (cabinetFaceKey) {
                const cabinetsFace = productSets.interior[cabinetFaceKey];
                const unitPrice = rules.flatRateUnitPrices?.cabinetsFace || rules.flatRateUnitPrices?.cabinetFace || rules.flatRateUnitPrices?.cabinet || 300;
                const cost = cabinetsFace.unitCount * unitPrice;
                const productCost = parseFloat(cabinetsFace.totalCost) || 0;

                totalCost += cost;
                totalProductCost += productCost;

                breakdown.push({
                    category: 'Interior',
                    itemName: 'Cabinets - Face',
                    itemKey: cabinetFaceKey,
                    quantity: cabinetsFace.unitCount,
                    unitPrice,
                    cost,
                    productCost,
                });
            }

            if (cabinetDoorKey) {
                const cabinetsDoors = productSets.interior[cabinetDoorKey];
                const unitPrice = rules.flatRateUnitPrices?.cabinetsDoors || rules.flatRateUnitPrices?.cabinetDoors || rules.flatRateUnitPrices?.cabinet || 400;
                const cost = cabinetsDoors.unitCount * unitPrice;
                const productCost = parseFloat(cabinetsDoors.totalCost) || 0;

                totalCost += cost;
                totalProductCost += productCost;

                breakdown.push({
                    category: 'Interior',
                    itemName: 'Cabinets - Doors',
                    itemKey: cabinetDoorKey,
                    quantity: cabinetsDoors.unitCount,
                    unitPrice,
                    cost,
                    productCost,
                });
            }
        }

        // Handle garage door multipliers from productSets (when not in flatRateItems)
        if (productSets && productSets.exterior) {
            const baseGarageDoorPrice = rules.flatRateUnitPrices?.garageDoor || rules.flatRateUnitPrices?.garageDoors || 200;

            const gd1CarKeys = ['garageDoor1Car', 'garageDoors1Car'];
            const gd2CarKeys = ['garageDoor2Car', 'garageDoors2Car'];
            const gd3CarKeys = ['garageDoor3Car', 'garageDoors3Car'];

            const gd1CarKey = gd1CarKeys.find(k => productSets.exterior[k] && productSets.exterior[k].unitCount > 0);
            const gd2CarKey = gd2CarKeys.find(k => productSets.exterior[k] && productSets.exterior[k].unitCount > 0);
            const gd3CarKey = gd3CarKeys.find(k => productSets.exterior[k] && productSets.exterior[k].unitCount > 0);

            // Only process if not already handled by flatRateItems
            const alreadyHandled = breakdown.some(item =>
                item.itemKey && (
                    item.itemKey.includes('garageDoor1Car') ||
                    item.itemKey.includes('garageDoor2Car') ||
                    item.itemKey.includes('garageDoor3Car')
                )
            );

            if (!alreadyHandled) {
                if (gd1CarKey) {
                    const gd1Car = productSets.exterior[gd1CarKey];
                    const unitPrice = rules.flatRateUnitPrices?.garageDoor1Car || baseGarageDoorPrice;
                    const gd1Cost = gd1Car.unitCount * unitPrice * 0.5; // 1-car = 0.5x
                    const productCost = parseFloat(gd1Car.totalCost) || 0;

                    totalCost += gd1Cost;
                    totalProductCost += productCost;

                    breakdown.push({
                        category: 'Exterior',
                        itemName: '1-Car Garage Doors',
                        itemKey: gd1CarKey,
                        quantity: gd1Car.unitCount,
                        unitPrice: unitPrice * 0.5,
                        multiplier: 0.5,
                        cost: gd1Cost,
                        productCost,
                    });
                }

                if (gd2CarKey) {
                    const gd2Car = productSets.exterior[gd2CarKey];
                    const unitPrice = rules.flatRateUnitPrices?.garageDoor2Car || baseGarageDoorPrice;
                    const gd2Cost = gd2Car.unitCount * unitPrice * 1.0; // 2-car = 1.0x
                    const productCost = parseFloat(gd2Car.totalCost) || 0;

                    totalCost += gd2Cost;
                    totalProductCost += productCost;

                    breakdown.push({
                        category: 'Exterior',
                        itemName: '2-Car Garage Doors',
                        itemKey: gd2CarKey,
                        quantity: gd2Car.unitCount,
                        unitPrice: unitPrice * 1.0,
                        multiplier: 1.0,
                        cost: gd2Cost,
                        productCost,
                    });
                }

                if (gd3CarKey) {
                    const gd3Car = productSets.exterior[gd3CarKey];
                    const unitPrice = rules.flatRateUnitPrices?.garageDoor3Car || baseGarageDoorPrice;
                    const gd3Cost = gd3Car.unitCount * unitPrice * 1.5; // 3-car = 1.5x
                    const productCost = parseFloat(gd3Car.totalCost) || 0;

                    totalCost += gd3Cost;
                    totalProductCost += productCost;

                    breakdown.push({
                        category: 'Exterior',
                        itemName: '3-Car Garage Doors',
                        itemKey: gd3CarKey,
                        quantity: gd3Car.unitCount,
                        unitPrice: unitPrice * 1.5,
                        multiplier: 1.5,
                        cost: gd3Cost,
                        productCost,
                    });
                }
            }
        }
    } else {
        // Fallback: Handle legacy areas structure for backward compatibility
        for (const area of params.areas || []) {
            for (const item of area.items || []) {
                const quantity = parseFloat(item.quantity) || 0;
                const category = item.categoryName?.toLowerCase() || '';

                // Get unit price from rules
                let unitPrice = 0;
                if (rules.unitPrices) {
                    // Surface types (sqft/linear ft)
                    if (category.includes('wall')) unitPrice = rules.unitPrices.walls || 2.5;
                    else if (category.includes('ceiling')) unitPrice = rules.unitPrices.ceilings || 2.0;
                    else if (category.includes('trim')) unitPrice = rules.unitPrices.trim || 1.5;
                    // Item types (per unit)
                    else if (category.includes('door')) unitPrice = rules.unitPrices.door || 85;
                    else if (category.includes('window')) unitPrice = rules.unitPrices.window || 75;
                    else if (category.includes('cabinet')) unitPrice = rules.unitPrices.cabinet || 125;
                    // Room types
                    else if (category.includes('room')) {
                        // Determine room size category
                        if (category.includes('small')) unitPrice = rules.unitPrices.room_small || 350;
                        else if (category.includes('large')) unitPrice = rules.unitPrices.room_large || 600;
                        else unitPrice = rules.unitPrices.room_medium || 450;
                    }
                }

                const cost = quantity * unitPrice;
                totalCost += cost;

                breakdown.push({
                    areaName: area.name,
                    category: item.categoryName,
                    quantity,
                    unitPrice,
                    cost,
                });
            }
        }
    }

    // For flat rate pricing, the unit price already includes EVERYTHING
    // (labor, materials, overhead, profit). Do NOT split it.
    const laborCost = 0; // Not separately tracked in flat rate
    const materialCost = 0; // Not separately tracked in flat rate
    const total = totalCost + totalProductCost;

    return {
        laborCost,
        materialCost,
        productCost: totalProductCost,
        subtotal: total,
        total,
        breakdown,
        model: 'flat_rate_unit',
    };
}

/**
 * Validate pricing calculation parameters
 * @param {object} params - Calculation parameters
 * @returns {object} - Validation result with errors array
 */
function validatePricingParams(params) {
    const errors = [];
    const warnings = [];

    // Validate required parameters
    if (!params) {
        errors.push('Pricing parameters are required');
        return { isValid: false, errors, warnings };
    }

    if (!params.model) {
        errors.push('Pricing model is required');
    }

    // Validate model-specific parameters
    switch (params.model) {
        case 'turnkey':
        case 'sqft_turnkey':
            if (!params.homeSqft || params.homeSqft <= 0) {
                errors.push('Home square footage must be greater than 0 for turnkey pricing');
            }
            if (params.homeSqft > 50000) {
                warnings.push('Home square footage is unusually large (>50,000 sqft)');
            }
            break;

        case 'rate_based_sqft':
        case 'sqft_labor_paint':
        case 'production_based':
        case 'hourly_time_materials':
            if (!params.areas || !Array.isArray(params.areas) || params.areas.length === 0) {
                errors.push('Areas array is required for area-based pricing models');
            } else {
                // Validate areas structure
                params.areas.forEach((area, index) => {
                    if (!area.name) {
                        errors.push(`Area ${index + 1} must have a name`);
                    }
                    if (!area.items || !Array.isArray(area.items)) {
                        errors.push(`Area "${area.name || index + 1}" must have items array`);
                    } else {
                        area.items.forEach((item, itemIndex) => {
                            if (!item.quantity || item.quantity <= 0) {
                                errors.push(`Item ${itemIndex + 1} in area "${area.name}" must have quantity > 0`);
                            }
                            if (item.quantity > 10000) {
                                warnings.push(`Item ${itemIndex + 1} in area "${area.name}" has unusually large quantity (${item.quantity})`);
                            }
                        });
                    }
                });
            }
            break;

        case 'flat_rate_unit':
        case 'unit_pricing':
        case 'room_flat_rate':
            if (!params.flatRateItems && (!params.areas || params.areas.length === 0)) {
                errors.push('Flat rate items or areas are required for flat rate pricing');
            }
            break;
    }

    // Validate rules
    if (params.rules) {
        const { rules } = params;

        // Validate percentage values
        if (rules.laborMarkupPercent !== undefined) {
            if (rules.laborMarkupPercent < 0 || rules.laborMarkupPercent > 1000) {
                errors.push('Labor markup percent must be between 0 and 1000');
            }
        }

        if (rules.materialMarkupPercent !== undefined) {
            if (rules.materialMarkupPercent < 0 || rules.materialMarkupPercent > 1000) {
                errors.push('Material markup percent must be between 0 and 1000');
            }
        }

        if (rules.overheadPercent !== undefined) {
            if (rules.overheadPercent < 0 || rules.overheadPercent > 100) {
                errors.push('Overhead percent must be between 0 and 100');
            }
        }

        if (rules.profitMarginPercent !== undefined) {
            if (rules.profitMarginPercent < -50 || rules.profitMarginPercent > 200) {
                errors.push('Profit margin percent must be between -50 and 200');
            }
            if (rules.profitMarginPercent < 0) {
                warnings.push('Negative profit margin detected - this will result in a loss');
            }
        }

        // Validate numeric values
        if (rules.coverage !== undefined && (rules.coverage <= 0 || rules.coverage > 1000)) {
            errors.push('Paint coverage must be between 1 and 1000 sqft per gallon');
        }

        if (rules.costPerGallon !== undefined && (rules.costPerGallon <= 0 || rules.costPerGallon > 500)) {
            errors.push('Cost per gallon must be between $1 and $500');
        }

        if (rules.coats !== undefined && (rules.coats < 1 || rules.coats > 5)) {
            errors.push('Number of coats must be between 1 and 5');
        }

        if (rules.crewSize !== undefined && (rules.crewSize < 1 || rules.crewSize > 20)) {
            errors.push('Crew size must be between 1 and 20 painters');
        }

        // Skip billable labor rate validation for pricing models that don't use it
        const modelsWithoutBillableRate = ['turnkey', 'flat_rate_unit', 'unit_pricing', 'room_flat_rate', 'rate_based_sqft'];
        if (!modelsWithoutBillableRate.includes(params.model) && rules.billableLaborRate !== undefined && (rules.billableLaborRate <= 0 || rules.billableLaborRate > 500)) {
            errors.push('Billable labor rate must be between $1 and $500 per hour');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Handle edge cases in pricing calculations
 * @param {object} result - Calculation result
 * @param {object} params - Original parameters
 * @returns {object} - Adjusted result with edge case handling
 */
function handleEdgeCases(result, params) {
    const warnings = [];

    // Handle zero quantities
    if (result.total === 0) {
        warnings.push('Total cost is zero - verify that items have been selected and unit prices are configured');
    }

    // Handle extremely small totals
    if (result.total > 0 && result.total < 10) {
        warnings.push('Total cost is unusually low - verify quantities and unit prices');
    }

    // Handle extremely large totals
    if (result.total > 1000000) {
        warnings.push('Total cost is unusually high - verify quantities and unit prices');
    }

    // Handle negative values (should not happen but safety check)
    if (result.laborCost < 0) {
        result.laborCost = 0;
        warnings.push('Labor cost was negative and has been set to zero');
    }

    if (result.materialCost < 0) {
        result.materialCost = 0;
        warnings.push('Material cost was negative and has been set to zero');
    }

    // Handle infinite or NaN values
    const numericFields = ['laborCost', 'materialCost', 'subtotal', 'total', 'totalSqft', 'totalHours', 'gallons'];
    numericFields.forEach(field => {
        if (result[field] !== undefined && (!isFinite(result[field]) || isNaN(result[field]))) {
            result[field] = 0;
            warnings.push(`${field} contained invalid numeric value and has been set to zero`);
        }
    });

    // Add warnings to result
    if (warnings.length > 0) {
        result.warnings = warnings;
    }

    return result;
}

/**
 * Main pricing calculator - routes to appropriate model
 * @param {object} params - Calculation parameters
 * @param {string} params.model - Pricing model type
 * @param {object} params.rules - Pricing rules from scheme
 * @param {array} params.areas - Quote areas (for non-turnkey)
 * @param {number} params.homeSqft - Home square footage (for turnkey)
 * @param {string} params.jobScope - Job scope (interior/exterior/both)
 * @param {string} params.conditionModifier - Property condition (for turnkey: excellent/good/average/fair/poor)
 * @param {object} params.analytics - Analytics context (tenantId, userId, quoteId)
 * @returns {object} - Complete pricing breakdown
 */
function calculatePricing(params) {
    // Validate input parameters
    const validation = validatePricingParams(params);
    if (!validation.isValid) {
        throw new Error(`Pricing calculation validation failed: ${validation.errors.join(', ')}`);
    }

    const { model, rules, analytics, conditionModifier } = params;

    // Default rules
    const defaultRules = {
        includeMaterials: true,
        coverage: 350,
        applicationMethod: 'roll',
        coats: 2,
        costPerGallon: 40,
        ...rules,
    };

    let basePricing;

    try {
        // Route to appropriate calculator
        switch (model) {
            case 'turnkey':
            case 'sqft_turnkey': // Legacy support
                // CRITICAL: Pass conditionModifier to turnkey calculation
                basePricing = calculateTurnkeyPricing({
                    ...params,
                    rules: defaultRules,
                    conditionModifier: conditionModifier || 'average',
                    settings: params.settings || {}
                });
                break;

            case 'rate_based_sqft':
            case 'sqft_labor_paint': // Legacy support
                basePricing = calculateRateBasedPricing({ ...params, rules: defaultRules });
                break;

            case 'production_based':
            case 'hourly_time_materials': // Legacy support
                basePricing = calculateProductionBasedPricing({ ...params, rules: defaultRules });
                break;

            case 'flat_rate_unit':
            case 'unit_pricing': // Legacy support
            case 'room_flat_rate': // Legacy support
                basePricing = calculateFlatRatePricing({ ...params, rules: defaultRules });
                break;

            default:
                throw new Error(`Unsupported pricing model: ${model}`);
        }

        // Handle edge cases and add validation warnings
        const result = handleEdgeCases(basePricing, params);

        // Add validation warnings to result
        if (validation.warnings.length > 0) {
            result.validationWarnings = validation.warnings;
        }

        // Record pricing calculation to Job Analytics (async, non-blocking)
        if (analytics) {
            const analyticsData = {
                model: result.model,
                total: result.total,
                laborCost: result.laborCost,
                materialCost: result.materialCost,
                totalSqft: result.totalSqft,
                totalHours: result.totalHours,
                gallons: result.gallons,
                tenantId: analytics.tenantId,
                userId: analytics.userId,
                quoteId: analytics.quoteId,
                timestamp: new Date().toISOString()
            };

            // Record asynchronously without blocking the main calculation
            jobAnalyticsService.recordPricingCalculation(analyticsData).catch(error => {
                console.warn('Failed to record pricing calculation to analytics:', error.message);
            });
        }

        return {
            ...result,
            includeMaterials: defaultRules.includeMaterials,
        };

    } catch (error) {
        // Wrap calculation errors with context
        throw new Error(`Pricing calculation failed for model "${model}": ${error.message}`);
    }
}

/**
 * Apply markup, overhead, profit, and tax to base pricing - FIXED
 * @param {object} basePricing - Base pricing calculation
 * @param {object} settings - Contractor settings for markups/tax
 * @returns {object} - Final pricing with all adjustments
 */
function applyMarkupsAndTax(basePricing, settings = {}) {
    // CRITICAL FIX: Skip markup AND tax application for turnkey pricing
    if (basePricing.isTurnkey) {
        // For turnkey, NO tax is applied (rate is all-inclusive)
        const depositPercent = settings.depositPercentage || 50;
        const deposit = basePricing.total * (depositPercent / 100);
        const balance = basePricing.total - deposit;

        return {
            // Base costs (already calculated in turnkey function)
            laborTotal: basePricing.laborCost,
            materialTotal: basePricing.materialCost,
            productCost: basePricing.productCost,

            // No markups for turnkey
            laborMarkupPercent: 0,
            laborMarkupAmount: 0,
            laborCostWithMarkup: basePricing.laborCost,
            materialMarkupPercent: 0,
            materialMarkupAmount: 0,
            materialCostWithMarkup: basePricing.materialCost,

            // No overhead or profit for turnkey
            overheadPercent: 0,
            overhead: 0,
            subtotalBeforeProfit: basePricing.total,
            profitMarginPercent: 0,
            profitAmount: 0,

            // Subtotal and NO tax for turnkey
            subtotal: basePricing.total,
            taxPercent: 0,
            tax: 0,
            total: basePricing.total, // No tax added

            // Payment terms
            depositPercent,
            deposit,
            balance,

            // Additional info
            totalSqft: basePricing.homeSqft,
            breakdown: basePricing.productBreakdown,
            model: basePricing.model,
            isTurnkey: true,

            // Turnkey-specific fields
            homeSqft: basePricing.homeSqft,
            rate: basePricing.rate,
            conditionMultiplier: basePricing.conditionMultiplier,
            baseTotal: basePricing.baseTotal,
            jobScope: basePricing.jobScope
        };
    }

    // FLAT RATE PRICING: Unit price already includes labor, materials, overhead, and profit
    // Only apply tax to the total
    if (basePricing.model === 'flat_rate_unit') {
        const taxRatePercentage = settings.taxRatePercentage || 0;
        const depositPercentage = settings.depositPercentage || 50;

        // Base total from flat rate calculation
        const subtotal = basePricing.total || 0;

        // Apply tax to the total
        const taxAmount = subtotal * (taxRatePercentage / 100);
        const total = subtotal + taxAmount;

        // Calculate deposit and balance
        const deposit = total * (depositPercentage / 100);
        const balance = total - deposit;

        return {
            // For flat rate, labor and materials are not separately tracked
            // The unit price is all-inclusive
            laborTotal: 0,
            materialTotal: 0,
            productCost: basePricing.productCost || 0,

            // No markups for flat rate (already included in unit price)
            laborMarkupPercent: 0,
            laborMarkupAmount: 0,
            laborCostWithMarkup: 0,
            materialMarkupPercent: 0,
            materialMarkupAmount: 0,
            materialCostWithMarkup: 0,

            // No overhead or profit shown separately (already in unit price)
            overheadPercent: 0,
            overhead: 0,
            subtotalBeforeProfit: subtotal,
            profitMarginPercent: 0,
            profitAmount: 0,

            // Subtotal and tax
            subtotal: subtotal,
            taxPercent: taxRatePercentage,
            tax: taxAmount,
            total: total,

            // Payment terms
            depositPercentage,
            deposit,
            balance,
            balancePercent: 100 - depositPercentage,

            // Additional info
            breakdown: basePricing.breakdown,
            model: basePricing.model,
            isFlatRate: true,
        };
    }

    // For non-turnkey, non-flat-rate pricing, apply markups and tax
    const {
        laborMarkupPercent = 0,
        materialMarkupPercent = 0,
        overheadPercent = 0,
        profitMarginPercent = 0,
        taxRatePercentage = 0,
        depositPercentage = 50,
    } = settings;

    const warnings = [];
    const errors = [];

    // Validate percentage values
    const percentageFields = [
        { name: 'laborMarkupPercent', value: laborMarkupPercent, min: 0, max: 1000 },
        { name: 'materialMarkupPercent', value: materialMarkupPercent, min: 0, max: 1000 },
        { name: 'overheadPercent', value: overheadPercent, min: 0, max: 100 },
        { name: 'profitMarginPercent', value: profitMarginPercent, min: -50, max: 200 },
        { name: 'taxRatePercentage', value: taxRatePercentage, min: 0, max: 50 },
        { name: 'depositPercentage', value: depositPercentage, min: 0, max: 100 }
    ];

    percentageFields.forEach(field => {
        if (field.value < field.min || field.value > field.max) {
            errors.push(`${field.name} must be between ${field.min}% and ${field.max}%`);
        }
        if (field.name === 'profitMarginPercent' && field.value < 0) {
            warnings.push('Negative profit margin detected - this will result in a loss');
        }
    });

    // Check if percentages sum to reasonable total (warning only)
    const totalMarkupAndOverhead = laborMarkupPercent + materialMarkupPercent + overheadPercent + profitMarginPercent;
    if (totalMarkupAndOverhead > 300) {
        warnings.push('Combined markup, overhead, and profit exceed 300% - verify these values are correct');
    }

    // Throw error if validation fails
    if (errors.length > 0) {
        throw new Error(`Markup and tax validation failed: ${errors.join(', ')}`);
    }

    // Step 1: Base costs
    let baseLaborCost = basePricing.laborCost || 0;
    let baseMaterialCost = basePricing.materialCost || 0;

    // Validate base costs
    if (baseLaborCost < 0) {
        warnings.push('Base labor cost is negative - setting to zero');
        baseLaborCost = 0;
    }
    if (baseMaterialCost < 0) {
        warnings.push('Base material cost is negative - setting to zero');
        baseMaterialCost = 0;
    }

    // Step 2: Apply markups
    const laborMarkupAmount = baseLaborCost * (laborMarkupPercent / 100);
    const laborCostWithMarkup = baseLaborCost + laborMarkupAmount;

    const materialMarkupAmount = baseMaterialCost * (materialMarkupPercent / 100);
    const materialCostWithMarkup = baseMaterialCost + materialMarkupAmount;

    // Step 3: Subtotal before overhead and profit
    const subtotalBeforeOverhead = laborCostWithMarkup + materialCostWithMarkup;

    // Step 4: Apply overhead
    const overheadAmount = subtotalBeforeOverhead * (overheadPercent / 100);
    const subtotalBeforeProfit = subtotalBeforeOverhead + overheadAmount;

    // Step 5: Apply profit
    const profitAmount = subtotalBeforeProfit * (profitMarginPercent / 100);
    let subtotal = subtotalBeforeProfit + profitAmount;

    // Handle negative subtotal (edge case)
    if (subtotal < 0) {
        warnings.push('Subtotal is negative due to negative profit margin - setting to zero');
        subtotal = 0;
    }

    // Step 6: CRITICAL FIX - Calculate tax ONLY on markup amounts, not full subtotal
    // Tax is applied to: labor markup + material markup + overhead + profit
    const totalMarkupAmount = materialMarkupAmount;
    const taxRate = parseFloat(taxRatePercentage) || 0;
    const taxAmount = totalMarkupAmount * (taxRate / 100);

    // Final total
    const total = subtotal + taxAmount;

    // Calculate deposit and balance
    const deposit = total * (depositPercentage / 100);
    const balance = total - deposit;

    // Helper to safely format numbers
    const safeFormat = (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || !isFinite(num)) {
            warnings.push(`Invalid numeric value encountered: ${value}`);
            return 0;
        }
        return parseFloat(num.toFixed(2));
    };

    const result = {
        // Base costs
        laborTotal: safeFormat(baseLaborCost),
        materialTotal: safeFormat(baseMaterialCost),

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

        profitMarginPercent: safeFormat(profitMarginPercent),
        profitAmount: safeFormat(profitAmount),

        // Final totals
        subtotal: safeFormat(subtotal),
        taxPercent: safeFormat(taxRate),
        tax: safeFormat(taxAmount),
        taxableAmount: safeFormat(totalMarkupAmount), // NEW: Show what tax was calculated on
        total: safeFormat(total),

        // Payment terms
        depositPercentage: safeFormat(depositPercentage),
        deposit: safeFormat(deposit),
        balance: safeFormat(balance),

        // Additional info from base pricing
        totalSqft: basePricing.totalSqft,
        totalHours: basePricing.totalHours,
        gallons: basePricing.gallons,
        breakdown: basePricing.breakdown,
        model: basePricing.model,

        // Legacy fields for backward compatibility
        markupPercent: safeFormat(materialMarkupPercent),
        markupAmount: safeFormat(materialMarkupAmount),
    };

    // Add warnings to result if any
    if (warnings.length > 0) {
        result.warnings = warnings;
    }

    return result;
}

/**
 * Record final quote prices to Job Analytics
 * @param {object} quoteData - Final quote data
 * @returns {Promise<boolean>} - Success status
 */
async function recordQuoteToAnalytics(quoteData) {
    try {
        return await jobAnalyticsService.recordQuotePrices(quoteData);
    } catch (error) {
        console.warn('Failed to record quote to analytics:', error.message);
        return false;
    }
}

/**
 * Merge tier-specific configuration into base pricing parameters
 * @param {object} baseParams - Base pricing parameters
 * @param {object} tierConfig - Tier-specific configuration (good/better/best)
 * @param {string} model - Pricing model type
 * @returns {object} - Merged parameters with tier-specific values
 */
function mergeTierConfig(baseParams, tierConfig, model) {
    if (!tierConfig) {
        return baseParams;
    }

    const mergedParams = { ...baseParams };

    switch (model) {
        case 'rate_based_sqft':
        case 'sqft_labor_paint':
            // Merge labor rates and material settings
            if (tierConfig.laborRates) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    laborRates: { ...tierConfig.laborRates }
                };
            }
            if (tierConfig.materialSettings) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    costPerGallon: tierConfig.materialSettings.costPerGallon,
                    coverage: tierConfig.materialSettings.coverage,
                    coats: tierConfig.materialSettings.coats,
                    wasteFactor: tierConfig.materialSettings.wasteFactor
                };
            }
            break;

        case 'flat_rate_unit':
        case 'unit_pricing':
        case 'room_flat_rate':
            // Merge unit prices
            if (tierConfig.unitPrices) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    flatRateUnitPrices: { ...tierConfig.unitPrices }
                };
            }
            break;

        case 'production_based':
        case 'hourly_time_materials':
            // Merge hourly rate, production rates, and material settings
            if (tierConfig.hourlyRate !== undefined) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    billableLaborRate: tierConfig.hourlyRate
                };
            }
            if (tierConfig.productionRates) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    productionRates: { ...tierConfig.productionRates }
                };
            }
            if (tierConfig.materialSettings) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    costPerGallon: tierConfig.materialSettings.costPerGallon,
                    coverage: tierConfig.materialSettings.coverage,
                    coats: tierConfig.materialSettings.coats
                };
            }
            break;

        case 'turnkey':
        case 'sqft_turnkey':
            // Merge base rate
            if (tierConfig.baseRate !== undefined) {
                mergedParams.rules = {
                    ...mergedParams.rules,
                    turnkeyRate: tierConfig.baseRate
                };
            }
            break;
    }

    return mergedParams;
}

/**
 * Calculate pricing for all GBB tiers
 * @param {object} params - Base calculation parameters
 * @param {object} gbbConfig - GBB configuration with tier settings
 * @returns {object} - Pricing for all tiers (good, better, best)
 */
function calculatePricingWithTiers(params, gbbConfig) {
    const { model } = params;

    // Determine which scheme configuration to use
    let schemeConfig;
    switch (model) {
        case 'rate_based_sqft':
        case 'sqft_labor_paint':
            schemeConfig = gbbConfig?.rateBased;
            break;
        case 'flat_rate_unit':
        case 'unit_pricing':
        case 'room_flat_rate':
            schemeConfig = gbbConfig?.flatRate;
            break;
        case 'production_based':
        case 'hourly_time_materials':
            schemeConfig = gbbConfig?.productionBased;
            break;
        case 'turnkey':
        case 'sqft_turnkey':
            schemeConfig = gbbConfig?.turnkey;
            break;
        default:
            schemeConfig = null;
    }

    // If GBB is not enabled for this scheme, fall back to single-tier calculation
    if (!gbbConfig || !schemeConfig || !schemeConfig.enabled) {
        const singleTierResult = calculatePricing(params);
        return {
            good: singleTierResult,
            better: singleTierResult,
            best: singleTierResult,
            gbbEnabled: false
        };
    }

    // Calculate pricing for each tier
    const results = {};
    const tiers = ['good', 'better', 'best'];

    for (const tier of tiers) {
        const tierConfig = schemeConfig[tier];
        if (!tierConfig) {
            // If tier config is missing, use base calculation
            results[tier] = calculatePricing(params);
            continue;
        }

        // Merge tier configuration into params
        const tierParams = mergeTierConfig(params, tierConfig, model);

        // Add tier description to result
        const tierResult = calculatePricing(tierParams);
        tierResult.tierName = tier;
        tierResult.tierDescription = tierConfig.description || '';

        results[tier] = tierResult;
    }

    results.gbbEnabled = true;
    return results;
}

module.exports = {
    calculatePricing,
    applyMarkupsAndTax,
    calculateGallons,
    calculateMaterialCost,
    validatePricingParams,
    handleEdgeCases,
    recordQuoteToAnalytics,
    mergeTierConfig,
    calculatePricingWithTiers,
    jobAnalyticsService, // Export for testing and configuration
};
