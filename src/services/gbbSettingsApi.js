/**
 * GBB Settings API Service
 * 
 * Handles API calls for GBB (Good-Better-Best) pricing tier configuration.
 * Uses the centralized apiService for consistent error handling and token management.
 */

import apiService from './apiService';

/**
 * Fetch GBB configuration for the authenticated contractor
 * @returns {Promise<Object>} GBB configuration data
 */
export const fetchGBBConfiguration = async () => {
  return apiService.get('/settings/gbb');
};

/**
 * Update GBB configuration
 * @param {Object} config - GBB configuration object
 * @param {boolean} config.gbbEnabled - Whether GBB is enabled globally
 * @param {Object} config.gbbTiers - Tier configurations for all schemes
 * @returns {Promise<Object>} Updated configuration
 */
export const updateGBBConfiguration = async (config) => {
  return apiService.put('/settings/gbb', config);
};

/**
 * Reset GBB configuration to defaults
 * @param {string} scheme - Scheme to reset ('rateBased', 'flatRate', 'productionBased', 'turnkey', or 'all')
 * @returns {Promise<Object>} Reset configuration
 */
export const resetGBBConfiguration = async (scheme = 'all') => {
  return apiService.post('/settings/gbb/reset', { scheme });
};

/**
 * Calculate pricing for all GBB tiers
 * @param {Object} params - Calculation parameters
 * @param {string} params.pricingScheme - Pricing scheme type
 * @param {Array} params.areas - Areas data (for area-based schemes)
 * @param {number} params.homeSqft - Home square footage (for turnkey)
 * @param {string} params.jobScope - Job scope (for turnkey)
 * @param {string} params.conditionModifier - Condition modifier (for turnkey)
 * @param {Object} params.flatRateItems - Flat rate items (for flat rate)
 * @param {Object} params.productSets - Product selections
 * @returns {Promise<Object>} Tier pricing for all tiers
 */
export const calculateTierPricing = async (params) => {
  return apiService.post('/quote-builder/calculate-tiers', params);
};

export default {
  fetchGBBConfiguration,
  updateGBBConfiguration,
  resetGBBConfiguration,
  calculateTierPricing
};
