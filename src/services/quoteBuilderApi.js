// src/services/quoteBuilderApiService.js

import apiService from "./apiService";


const quoteBuilderApi = {
  /**
   * Detect existing client by email or phone
   */
  detectClient: async (email, phone) => {
    const response = await apiService.post('/quote-builder/detect-client', {
      email,
      phone,
    });
    return response.data;
  },

  /**
   * Save or update quote draft (auto-save)
   */
  saveDraft: async (quoteData) => {
    const response = await apiService.post('/quote-builder/save-draft', quoteData);
    return response.data;
  },

  /**
   * Get quote by ID
   */
  getQuoteById: async (quoteId) => {
    const response = await apiService.get(`/quote-builder/${quoteId}`);
    return response;
  },

  /**
   * Calculate quote totals
   */
  calculateQuote: async (areas, productSets, pricingSchemeId) => {
    const response = await apiService.post('/quote-builder/calculate', {
      areas,
      productSets,
      pricingSchemeId,
    });
    return response;
  },

  /**
   * Send quote to client
   */
  sendQuote: async (quoteId) => {
    const response = await apiService.post(`/quote-builder/${quoteId}/send`);
    return response.data;
  },

  /**
   * Get all draft quotes
   */
  getDrafts: async (limit = 10) => {
    const response = await apiService.get('/quote-builder/drafts', {
      params: { limit },
    });
    return response;
  },
};

export { quoteBuilderApi };
