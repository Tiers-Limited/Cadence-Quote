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
 * @returns {object} - Material cost breakdown
 */
function calculateMaterialCost(totalSqft, rules) {
  if (!rules.includeMaterials) {
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
 * Calculate Turnkey Pricing (Model 1)
 * Formula: Total = Home Sq Ft × Turnkey Rate
 * @param {object} params - Calculation parameters
 * @returns {object} - Pricing breakdown
 */
function calculateTurnkeyPricing(params) {
  const { homeSqft, jobScope, rules } = params;
  
  // Determine rate based on job scope
  let rate = rules.turnkeyRate || 3.50;
  if (jobScope === 'interior' && rules.interiorRate) {
    rate = rules.interiorRate;
  } else if (jobScope === 'exterior' && rules.exteriorRate) {
    rate = rules.exteriorRate;
  }
  
  const total = homeSqft * rate;
  
  // Respect includeMaterials flag
  let laborCost, materialCost;
  if (rules.includeMaterials) {
    // Materials included: 60/40 labor/material split
    laborCost = total * 0.60;
    materialCost = total * 0.40;
  } else {
    // Labor-only: 100% labor, 0% materials
    laborCost = total;
    materialCost = 0;
  }
  
  return {
    laborCost,
    materialCost,
    subtotal: total,
    total,
    homeSqft,
    rate,
    jobScope,
    model: 'turnkey',
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
  const { areas, rules } = params;
  
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
        if (category.includes('wall')) laborRate = rules.laborRates.walls || 0.55;
        else if (category.includes('ceiling')) laborRate = rules.laborRates.ceilings || 0.65;
        else if (category.includes('trim')) laborRate = rules.laborRates.trim || 2.50;
        else if (category.includes('door')) laborRate = rules.laborRates.doors || 45;
        else if (category.includes('cabinet')) laborRate = rules.laborRates.cabinets || 65;
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
  
  // Calculate materials
  const materials = calculateMaterialCost(totalSqft, rules);
  
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
  };
}

/**
 * Calculate Production-Based Pricing (Model 3)
 * Labor Cost = (Area ÷ Production Rate) × Hourly Labor Rate
 * Material Cost = (Total Sq Ft × Coats ÷ Coverage) × Cost per Gallon
 * @param {object} params - Calculation parameters
 * @returns {object} - Pricing breakdown
 */
function calculateProductionBasedPricing(params) {
  const { areas, rules } = params;
  
  const hourlyLaborRate = rules.hourlyLaborRate || 50;
  let totalLaborCost = 0;
  let totalSqft = 0;
  let totalHours = 0;
  const breakdown = [];
  
  // Calculate labor hours for each area
  for (const area of areas) {
    for (const item of area.items || []) {
      const quantity = parseFloat(item.quantity) || 0;
      const category = item.categoryName?.toLowerCase() || '';
      
      // Get production rate from rules (sqft or linear ft per hour)
      let productionRate = 0;
      if (rules.productionRates) {
        if (category.includes('wall')) productionRate = rules.productionRates.walls || 300;
        else if (category.includes('ceiling')) productionRate = rules.productionRates.ceilings || 250;
        else if (category.includes('trim')) productionRate = rules.productionRates.trim || 75;
      }
      
      if (productionRate > 0) {
        const hours = quantity / productionRate;
        const laborCost = hours * hourlyLaborRate;
        
        totalHours += hours;
        totalLaborCost += laborCost;
        
        breakdown.push({
          areaName: area.name,
          category: item.categoryName,
          quantity,
          unit: item.measurementUnit,
          productionRate,
          hours: parseFloat(hours.toFixed(2)),
          hourlyRate: hourlyLaborRate,
          laborCost,
        });
      }
      
      // Track square footage for material calculation
      if (item.measurementUnit === 'sqft') {
        totalSqft += quantity;
      }
    }
  }
  
  // Calculate materials
  const materials = calculateMaterialCost(totalSqft, rules);
  
  const subtotal = totalLaborCost + materials.materialCost;
  
  return {
    laborCost: totalLaborCost,
    materialCost: materials.materialCost,
    gallons: materials.gallons,
    totalHours: parseFloat(totalHours.toFixed(2)),
    hourlyLaborRate,
    subtotal,
    total: subtotal,
    totalSqft,
    breakdown,
    model: 'production_based',
  };
}

/**
 * Calculate Flat Rate Pricing (Model 4)
 * Formula: Total = Unit Price × Quantity
 * @param {object} params - Calculation parameters
 * @returns {object} - Pricing breakdown
 */
function calculateFlatRatePricing(params) {
  const { areas, rules } = params;
  
  let totalCost = 0;
  const breakdown = [];
  
  // Calculate cost for each unit
  for (const area of areas) {
    for (const item of area.items || []) {
      const quantity = parseFloat(item.quantity) || 0;
      const category = item.categoryName?.toLowerCase() || '';
      
      // Get unit price from rules
      let unitPrice = 0;
      if (rules.unitPrices) {
        if (category.includes('door')) unitPrice = rules.unitPrices.door || 85;
        else if (category.includes('window')) unitPrice = rules.unitPrices.window || 75;
        else if (category.includes('room')) {
          // Determine room size category
          if (category.includes('small')) unitPrice = rules.unitPrices.room_small || 350;
          else if (category.includes('large')) unitPrice = rules.unitPrices.room_large || 750;
          else unitPrice = rules.unitPrices.room_medium || 500;
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
  
  // Respect includeMaterials flag
  let laborCost, materialCost;
  if (rules.includeMaterials) {
    // Materials included: 60/40 labor/material split
    laborCost = totalCost * 0.60;
    materialCost = totalCost * 0.40;
  } else {
    // Labor-only: 100% labor, 0% materials
    laborCost = totalCost;
    materialCost = 0;
  }
  
  return {
    laborCost,
    materialCost,
    subtotal: totalCost,
    total: totalCost,
    breakdown,
    model: 'flat_rate_unit',
  };
}

/**
 * Main pricing calculator - routes to appropriate model
 * @param {object} params - Calculation parameters
 * @param {string} params.model - Pricing model type
 * @param {object} params.rules - Pricing rules from scheme
 * @param {array} params.areas - Quote areas (for non-turnkey)
 * @param {number} params.homeSqft - Home square footage (for turnkey)
 * @param {string} params.jobScope - Job scope (interior/exterior/both)
 * @returns {object} - Complete pricing breakdown
 */
function calculatePricing(params) {
  const { model, rules } = params;
  
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
  
  // Route to appropriate calculator
  switch (model) {
    case 'turnkey':
    case 'sqft_turnkey': // Legacy support
      basePricing = calculateTurnkeyPricing({ ...params, rules: defaultRules });
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
  
  return {
    ...basePricing,
    includeMaterials: defaultRules.includeMaterials,
  };
}

/**
 * Apply markup, overhead, profit, and tax to base pricing
 * @param {object} basePricing - Base pricing calculation
 * @param {object} settings - Contractor settings for markups/tax
 * @returns {object} - Final pricing with all adjustments
 */
function applyMarkupsAndTax(basePricing, settings = {}) {
  const {
    laborMarkupPercent = 0,
    materialMarkupPercent = 0,
    overheadPercent = 0,
    profitMarginPercent = 0,
    taxRatePercentage = 0,
    depositPercent = 50,
  } = settings;
  
  // Step 1: Base costs
  const baseLaborCost = basePricing.laborCost || 0;
  const baseMaterialCost = basePricing.materialCost || 0;
  
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
  const subtotal = subtotalBeforeProfit + profitAmount;
  
  // Step 6: Calculate tax
  const taxRate = parseFloat(taxRatePercentage) || 0;
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
    total: safeFormat(total),
    
    // Payment terms
    depositPercent: safeFormat(depositPercent),
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
}

module.exports = {
  calculatePricing,
  applyMarkupsAndTax,
  calculateGallons,
  calculateMaterialCost,
};
