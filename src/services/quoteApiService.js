// services/quoteApiService.js
// Optimized API service for Quote Builder - Professional data fetching

import apiService from './apiService';

/**
 * Quote Builder API Service
 * Provides optimized endpoints that return only necessary data
 */
const quoteApiService = {
  /**
   * Get minimal product list for dropdowns (paginated)
   * Returns: { id, globalProductId, name, category, brandId, brandName }
   */
  getMinimalProducts: async (params = {}) => {
    const { page = 1, limit = 20, jobType, search } = params;
    return apiService.get('/quotes/products/minimal', {
      params: { page, limit, jobType, search }
    });
  },

  /**
   * Get complete product details when user selects a product
   * Returns: { id, product, sheens, laborRates, defaultMarkup, taxRate }
   */
  getProductDetails: async (productConfigId) => {
    return apiService.get(`/quotes/products/${productConfigId}/details`);
  },

  /**
   * Get minimal color list for dropdowns (paginated)
   * Returns: { id, name, code, hexValue, brandId }
   */
  getMinimalColors: async (params = {}) => {
    const { page = 1, limit = 50, brandId, search } = params;
    return apiService.get('/quotes/colors/minimal', {
      params: { page, limit, brandId, search }
    });
  },

  /**
   * Get active pricing schemes for contractor
   * Returns: [{ id, name, type, description, isDefault, pricingRules }]
   */
  getPricingSchemes: async () => {
    return apiService.get('/quotes/pricing-schemes');
  },

  /**
   * Get surface dimension configuration
   * @param {String} surfaceType - Type of surface (walls, ceiling, trim, etc.)
   * Returns: { surfaceType, calculation, unit, description, required, optional }
   */
  getSurfaceDimensions: async (surfaceType) => {
    return apiService.get(`/quotes/surface-dimensions/${surfaceType}`);
  },

  /**
   * Get contractor settings (markup, tax, terms)
   * Returns: { defaultMarkupPercentage, taxRatePercentage, ... }
   */
  getContractorSettings: async () => {
    return apiService.get('/quotes/contractor-settings');
  },

  /**
   * Calculate quote totals based on selections
   * @param {Object} data - Quote calculation data
   * @param {Array} data.areas - Array of areas with surfaces
   * @param {Number} data.pricingSchemeId - Selected pricing scheme ID
   * @param {Boolean} data.applyZipMarkup - Whether to apply ZIP markup
   * @param {Number} data.zipMarkupPercent - ZIP markup percentage
   * Returns: { breakdown, summary, pricingScheme }
   */
  calculateQuote: async (data) => {
    return apiService.post('/quotes/calculate', data);
  },

  // ====================
  // Quote CRUD Methods
  // ====================

  /**
   * Save/Create a new quote
   * @param {Object} quoteData - Quote data
   * Returns: { success, data: savedQuote }
   */
  saveQuote: async (quoteData) => {
    return apiService.post('/quotes/save', quoteData);
  },

  /**
   * Get all quotes with optional filters
   * @param {Object} params - Filter parameters
   * @param {Number} params.page - Page number
   * @param {Number} params.limit - Items per page
   * @param {String} params.status - Filter by status
   * @param {String} params.jobType - Filter by job type
   * @param {String} params.search - Search in customer name/email/quote number
   * @param {String} params.dateFrom - Filter from date
   * @param {String} params.dateTo - Filter to date
   * @param {String} params.sortBy - Sort field (createdAt, total, customerName)
   * @param {String} params.sortOrder - Sort order (ASC, DESC)
   * Returns: { success, data: { quotes, pagination } }
   */
  getQuotes: async (params = {}) => {
    return apiService.get('/quotes', { params });
  },

  /**
   * Get single quote by ID
   * @param {Number} id - Quote ID
   * Returns: { success, data: quote }
   */
  getQuoteById: async (id) => {
    return apiService.get(`/quotes/${id}`);
  },

  /**
   * Update existing quote
   * @param {Number} id - Quote ID
   * @param {Object} quoteData - Updated quote data
   * Returns: { success, data: updatedQuote }
   */
  updateQuote: async (id, quoteData) => {
    return apiService.put(`/quotes/${id}`, quoteData);
  },

  /**
   * Update quote status
   * @param {Number} id - Quote ID
   * @param {String} status - New status (pending, approved, declined, archived)
   * Returns: { success, data: updatedQuote }
   */
  updateQuoteStatus: async (id, status) => {
    return apiService.put(`/quotes/${id}/status`, { status });
  },

  /**
   * Delete quote (soft delete)
   * @param {Number} id - Quote ID
   * Returns: { success, message }
   */
  deleteQuote: async (id) => {
    return apiService.delete(`/quotes/${id}`);
  },

  /**
   * Duplicate an existing quote
   * @param {Number} id - Quote ID to duplicate
   * Returns: { success, data: newQuote }
   */
  duplicateQuote: async (id) => {
    return apiService.post(`/quotes/${id}/duplicate`);
  }
};

export default quoteApiService;
