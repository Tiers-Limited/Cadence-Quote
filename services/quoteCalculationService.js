// services/quoteCalculationService.js
const PricingScheme = require('../models/PricingScheme');
const Product = require('../models/Product');

/**
 * Calculate quote total based on pricing scheme and measurements
 * @param {Object} params - Calculation parameters
 * @param {number} params.tenantId - Tenant ID
 * @param {number} params.pricingSchemeId - Pricing scheme ID
 * @param {Object} params.measurements - Room measurements
 * @param {Array} params.selectedProducts - Selected products with quantities
 * @returns {Object} Calculation result
 */
const calculateQuote = async (params) => {
  try {
    const { tenantId, pricingSchemeId, measurements, selectedProducts } = params;

    // Get pricing scheme
    const pricingScheme = await PricingScheme.findOne({
      where: { id: pricingSchemeId, tenantId }
    });

    if (!pricingScheme) {
      throw new Error('Pricing scheme not found');
    }

    const pricingRules = pricingScheme.pricingRules || {};
    let totalAmount = 0;
    const breakdown = {
      surfaces: {},
      products: {},
      labor: 0,
      materials: 0
    };

    // Calculate based on scheme type
    switch (pricingScheme.type) {
      case 'sqft_turnkey':
        totalAmount = calculateSqFtTurnkey(measurements, pricingRules, breakdown);
        break;

      case 'sqft_labor_only':
        totalAmount = calculateSqFtLaborOnly(measurements, pricingRules, breakdown);
        break;

      case 'hourly_time_materials':
        totalAmount = calculateHourlyTimeMaterials(measurements, pricingRules, breakdown);
        break;

      case 'unit_based':
        totalAmount = calculateUnitBased(measurements, pricingRules, breakdown);
        break;

      default:
        throw new Error('Unsupported pricing scheme type');
    }

    // Add product costs
    if (selectedProducts && selectedProducts.length > 0) {
      const productCost = await calculateProductCosts(selectedProducts, tenantId);
      totalAmount += productCost.total;
      breakdown.products = productCost.breakdown;
      breakdown.materials += productCost.total;
    }

    return {
      success: true,
      data: {
        totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
        breakdown,
        pricingScheme: {
          id: pricingScheme.id,
          name: pricingScheme.name,
          type: pricingScheme.type
        }
      }
    };

  } catch (error) {
    console.error('Quote calculation error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Calculate square-foot turnkey pricing (includes labor and materials)
 */
const calculateSqFtTurnkey = (measurements, pricingRules, breakdown) => {
  let total = 0;

  // Calculate walls
  if (measurements.walls && pricingRules.walls) {
    const wallSqFt = measurements.walls.width * measurements.walls.height * measurements.walls.count;
    const wallCost = wallSqFt * pricingRules.walls.price;
    breakdown.surfaces.walls = {
      squareFeet: wallSqFt,
      rate: pricingRules.walls.price,
      cost: wallCost
    };
    total += wallCost;
  }

  // Calculate ceilings
  if (measurements.ceilings && pricingRules.ceilings) {
    const ceilingSqFt = measurements.ceilings.length * measurements.ceilings.width;
    const ceilingCost = ceilingSqFt * pricingRules.ceilings.price;
    breakdown.surfaces.ceilings = {
      squareFeet: ceilingSqFt,
      rate: pricingRules.ceilings.rate,
      cost: ceilingCost
    };
    total += ceilingCost;
  }

  // Calculate trim
  if (measurements.trim && pricingRules.trim) {
    const trimLinearFt = measurements.trim.length;
    const trimCost = trimLinearFt * pricingRules.trim.price;
    breakdown.surfaces.trim = {
      linearFeet: trimLinearFt,
      rate: pricingRules.trim.price,
      cost: trimCost
    };
    total += trimCost;
  }

  return total;
};

/**
 * Calculate square-foot labor-only pricing
 */
const calculateSqFtLaborOnly = (measurements, pricingRules, breakdown) => {
  // Similar to turnkey but typically lower rates for labor only
  return calculateSqFtTurnkey(measurements, pricingRules, breakdown);
};

/**
 * Calculate hourly time & materials pricing
 */
const calculateHourlyTimeMaterials = (measurements, pricingRules, breakdown) => {
  let total = 0;

  if (pricingRules.hourly_rate && measurements.estimatedHours) {
    const laborCost = measurements.estimatedHours * pricingRules.hourly_rate.price;
    breakdown.labor = laborCost;
    total += laborCost;
  }

  return total;
};

/**
 * Calculate unit-based pricing
 */
const calculateUnitBased = (measurements, pricingRules, breakdown) => {
  let total = 0;

  // Calculate per unit costs (doors, windows, etc.)
  if (measurements.units) {
    Object.entries(measurements.units).forEach(([unitType, count]) => {
      if (pricingRules[unitType]) {
        const unitCost = count * pricingRules[unitType].price;
        breakdown.surfaces[unitType] = {
          count,
          rate: pricingRules[unitType].price,
          cost: unitCost
        };
        total += unitCost;
      }
    });
  }

  return total;
};

/**
 * Calculate costs for selected products
 */
const calculateProductCosts = async (selectedProducts, tenantId) => {
  let total = 0;
  const breakdown = {};

  for (const item of selectedProducts) {
    const product = await Product.findOne({
      where: { id: item.productId, tenantId }
    });

    if (product) {
      const itemTotal = item.quantity * product.pricePerGallon;
      breakdown[product.name] = {
        quantity: item.quantity,
        unitPrice: product.pricePerGallon,
        total: itemTotal
      };
      total += itemTotal;
    }
  }

  return { total, breakdown };
};

/**
 * Get pricing scheme with rules for frontend display
 */
const getPricingSchemeWithRules = async (schemeId, tenantId) => {
  try {
    const scheme = await PricingScheme.findOne({
      where: { id: schemeId, tenantId }
    });

    if (!scheme) {
      return { success: false, message: 'Pricing scheme not found' };
    }

    return {
      success: true,
      data: {
        ...scheme.toJSON(),
        rulesSummary: generateRulesSummary(scheme.pricingRules)
      }
    };
  } catch (error) {
    console.error('Get pricing scheme with rules error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Generate human-readable summary of pricing rules
 */
const generateRulesSummary = (pricingRules) => {
  if (!pricingRules || Object.keys(pricingRules).length === 0) {
    return 'No pricing rules defined';
  }

  const summaries = [];
  Object.entries(pricingRules).forEach(([key, rule]) => {
    const surfaceName = key.replace('_', ' ').toUpperCase();
    summaries.push(`${surfaceName}: $${rule.price}/${rule.unit}`);
  });

  return summaries.join(', ');
};

module.exports = {
  calculateQuote,
  getPricingSchemeWithRules
};