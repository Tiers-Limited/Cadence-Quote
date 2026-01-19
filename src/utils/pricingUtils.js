// src/utils/pricingUtils.js
// Centralized pricing model utilities for consistent behavior across all components

/**
 * Get normalized pricing mode from pricing scheme type
 * @param {string} type - Pricing scheme type
 * @returns {string} - Normalized mode: 'turnkey' | 'flat_unit' | 'production' | 'rate_sqft' | 'unknown'
 */
export const getPricingMode = (type) => {
  if (!type) return 'unknown';
  if (type.includes('turnkey') || type === 'sqft_turnkey') return 'turnkey';
  if (type === 'flat_rate_unit' || type === 'unit_pricing' || type === 'room_flat_rate') return 'flat_unit';
  if (type === 'production_based' || type === 'hourly_time_materials') return 'production';
  if (type.includes('rate_based') || type === 'sqft_labor_paint') return 'rate_sqft';
  return 'unknown';
};

/**
 * Determine if coats should be shown for this pricing mode
 */
export const shouldShowCoats = (mode) => ['rate_sqft', 'production'].includes(mode);

/**
 * Determine if gallons should be shown for this pricing mode
 */
export const shouldShowGallons = (mode) => ['rate_sqft', 'production'].includes(mode);

/**
 * Determine if dimensions calculator should be shown
 */
export const shouldShowDimensionsCalculator = (mode, unit) => 
  mode !== 'flat_unit' && (unit === 'sqft' || unit === 'linear_foot');

/**
 * Determine if estimated hours should be shown (production-based only)
 */
export const shouldShowEstimatedHours = (mode) => mode === 'production';

/**
 * Check if areas step should be hidden (turnkey uses home size instead)
 */
export const shouldHideAreasStep = (mode) => mode === 'turnkey';

/**
 * Get user-friendly quantity label based on mode and unit
 */
export const getQuantityLabel = (mode, unit) => {
  if (mode === 'flat_unit') return 'Quantity (Count)';
  return unit === 'sqft' ? 'Square Feet' : 
         unit === 'linear_foot' ? 'Linear Feet' : 
         unit === 'unit' ? 'Units' : 
         unit === 'hour' ? 'Hours' : 'Quantity';
};

/**
 * Get placeholder text for quantity input
 */
export const getQuantityPlaceholder = (mode, unit) => {
  if (mode === 'flat_unit') return unit === 'unit' ? 'e.g., 5 items' : 'Count';
  return unit === 'sqft' ? 'e.g., 1200 sq ft' : 
         unit === 'linear_foot' ? 'e.g., 150 LF' : 
         unit === 'unit' ? 'e.g., 3 units' : 
         unit === 'hour' ? 'e.g., 8 hrs' : 'Qty';
};

/**
 * Get display label for measurement unit
 */
export const getUnitLabel = (unit) => {
  return unit === 'sqft' ? 'sq ft' : 
         unit === 'linear_foot' ? 'LF' : 
         unit === 'unit' ? 'units' : 
         unit === 'hour' ? 'hrs' : unit;
};

/**
 * Map category name to appropriate pricing key based on mode and job type
 * @param {string} categoryName - Labor category name
 * @param {string} jobType - 'interior' or 'exterior'
 * @param {boolean} isFlatRate - Is flat rate mode
 * @param {boolean} isProduction - Is production mode
 * @returns {string} - Key for accessing pricing data
 */
export const mapCategoryToKey = (categoryName, jobType = 'interior', isFlatRate = false, isProduction = false) => {
  const baseMap = {
    // Interior
    'Walls': isFlatRate ? 'walls' : isProduction ? 'interiorWalls' : 'Walls',
    'Ceilings': isFlatRate ? 'ceilings' : isProduction ? 'interiorCeilings' : 'Ceilings',
    'Trim': isFlatRate ? (jobType === 'exterior' ? 'exterior_trim' : 'interior_trim') : isProduction ? 'interiorTrim' : 'Trim',
    'Interior Trim': isFlatRate ? 'interior_trim' : isProduction ? 'interiorTrim' : 'Trim',
    'Doors': isFlatRate ? 'door' : isProduction ? 'doors' : 'Doors',
    'Cabinets': isFlatRate ? 'cabinet' : isProduction ? 'cabinets' : 'Cabinets',
    'Accent Walls': isFlatRate ? 'walls' : isProduction ? 'interiorWalls' : 'Accent Walls',
    'Drywall Repair': isFlatRate ? 'hour' : isProduction ? 'interiorWalls' : 'Drywall Repair',
    'Windows': isFlatRate ? 'window' : isProduction ? 'doors' : 'Windows',
    
    // Exterior
    'Exterior Walls': isFlatRate ? 'siding' : isProduction ? 'exteriorWalls' : 'Exterior Walls',
    'Siding': isFlatRate ? 'siding' : isProduction ? 'exteriorWalls' : 'Siding',
    'Exterior Siding': isFlatRate ? 'siding' : isProduction ? 'exteriorWalls' : 'Exterior Siding',
    'Exterior Trim': isFlatRate ? 'exterior_trim' : isProduction ? 'exteriorTrim' : 'Exterior Trim',
    'Exterior Doors': isFlatRate ? 'door' : isProduction ? 'doors' : 'Exterior Doors',
    'Shutters': isFlatRate ? 'door' : isProduction ? 'exteriorTrim' : 'Shutters',
    'Decks & Railings': isFlatRate ? 'deck' : isProduction ? 'exteriorWalls' : 'Decks & Railings',
    'Soffit & Fascia': isFlatRate ? 'soffit_fascia' : isProduction ? 'soffitFascia' : 'Soffit & Fascia',
    'Gutters': isFlatRate ? 'gutters' : isProduction ? 'exteriorTrim' : 'Gutters',
    'Prep Work': isFlatRate ? 'hour' : isProduction ? 'exteriorWalls' : 'Prep Work',
  };
  
  const key = baseMap[categoryName] || categoryName.toLowerCase().replace(/\s+/g, '_');
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PricingUtils] Mapped "${categoryName}" (${jobType}) to key: "${key}"`);
  }
  return key;
};

/**
 * Get labor rate for a category based on pricing mode
 * @param {string} categoryName - Labor category name
 * @param {string} jobType - 'interior' or 'exterior'
 * @param {object} formData - Full form data with contractorSettings
 * @returns {number} - Labor rate value
 */
export const getLaborRate = (categoryName, jobType, formData) => {
  const mode = getPricingMode(formData.pricingModelType);
  const settings = formData.contractorSettings || {};

  console.log('🔍 getLaborRate Debug:', {
    categoryName,
    jobType,
    mode,
    pricingModelType: formData.pricingModelType,
    hasFlatRateUnitPrices: !!settings.flatRateUnitPrices,
    flatRateUnitPricesKeys: settings.flatRateUnitPrices ? Object.keys(settings.flatRateUnitPrices) : []
  });

  if (mode === 'flat_unit') {
    const key = mapCategoryToKey(categoryName, jobType, true, false);
    const price = settings.flatRateUnitPrices?.[key] || 0;
    console.log('🔍 Flat Unit Price Lookup:', { key, price, allPrices: settings.flatRateUnitPrices });
    return parseFloat(price);
  }

  if (mode === 'production') {
    const key = mapCategoryToKey(categoryName, jobType, false, true);
    const rate = settings.productionRates?.[key] || 0;
    return parseFloat(rate);
  }

  if (mode === 'rate_sqft') {
    const cat = settings.laborCategories?.find(c => c.categoryName === categoryName);
    if (cat) {
      return settings.laborRates?.[cat.id] || 0;
    }
  }

  return 0;
};

/**
 * Get formatted price display for UI
 * @param {string} categoryName - Labor category name
 * @param {string} jobType - 'interior' or 'exterior'
 * @param {object} formData - Full form data
 * @returns {string} - Formatted price display
 */
export const getPriceDisplay = (categoryName, jobType, formData) => {
  const mode = getPricingMode(formData.pricingModelType);
  const settings = formData.contractorSettings || {};

  if (mode === 'flat_unit') {
    const key = mapCategoryToKey(categoryName, jobType, true, false);
    const price = settings.flatRateUnitPrices?.[key] || 0;
    return `$${parseFloat(price).toFixed(2)} / unit`;
  }

  if (mode === 'production') {
    const key = mapCategoryToKey(categoryName, jobType, false, true);
    const rate = settings.productionRates?.[key] || 0;
    return `${rate} sq ft / hour`;
  }

  if (mode === 'rate_sqft') {
    const cat = settings.laborCategories?.find(c => c.categoryName === categoryName);
    if (cat) {
      const rate = settings.laborRates?.[cat.id] || 0;
      return `$${rate.toFixed(2)} / ${getUnitLabel(cat.measurementUnit)}`;
    }
    return '$0.00 / unit';
  }

  if (mode === 'turnkey') {
    const rate = jobType === 'interior' ? settings.turnkey?.interior : settings.turnkey?.exterior;
    return `$${(rate || 0).toFixed(2)} / sq ft (all-in)`;
  }

  return 'N/A';
};

/**
 * Calculate estimated hours for production-based model
 * @param {number} quantity - Quantity of work (sq ft, LF, units)
 * @param {string} categoryName - Labor category name
 * @param {string} jobType - 'interior' or 'exterior'
 * @param {object} formData - Full form data
 * @returns {number} - Estimated hours
 */
export const calculateEstimatedHours = (quantity, categoryName, jobType, formData) => {
  if (!quantity || quantity <= 0) return 0;
  const settings = formData.contractorSettings || {};
  const key = mapCategoryToKey(categoryName, jobType, false, true);
  const productionRate = settings.productionRates?.[key] || 300;
  const crewSize = formData.crewSize || settings.other?.crewSize || 2;
  const hours = Math.ceil((quantity / productionRate) / crewSize);
  return hours > 0 ? hours : 1;
};

/**
 * Get guidance message for pricing model
 */
export const getModelGuidanceMessage = (mode) => {
  const messages = {
    flat_unit: '📦 Count items only - no measurements needed! Fixed price per item.',
    production: '⏱️ Enter measurements → we\'ll estimate hours based on your productivity rates.',
    rate_sqft: '📏 Enter precise measurements for accurate labor and material pricing.',
    turnkey: '🏠 All-inclusive pricing based on total square footage.'
  };
  return messages[mode] || 'Enter measurements and select options.';
};

/**
 * Validate quantity based on mode
 */
export const validateQuantity = (quantity, mode, unit) => {
  if (!quantity || quantity <= 0) {
    return { valid: false, message: 'Please enter a quantity greater than 0' };
  }

  if (mode === 'flat_unit' && unit === 'unit' && !Number.isInteger(quantity)) {
    return { valid: false, message: 'Please enter a whole number for item count' };
  }

  if (quantity > 100000) {
    return { valid: false, message: 'Quantity seems unusually large. Please verify.' };
  }

  return { valid: true };
};

export default {
  getPricingMode,
  shouldShowCoats,
  shouldShowGallons,
  shouldShowDimensionsCalculator,
  shouldShowEstimatedHours,
  shouldHideAreasStep,
  getQuantityLabel,
  getQuantityPlaceholder,
  getUnitLabel,
  mapCategoryToKey,
  getLaborRate,
  getPriceDisplay,
  calculateEstimatedHours,
  getModelGuidanceMessage,
  validateQuantity
};
