// src/services/quoteBuilderApiService.js

import apiService from "./apiService";
import loadingService from "./loadingService";

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
   * Save or update quote draft (enhanced auto-save with conflict detection)
   */
  saveDraft: async (quoteData) => {
    try {
      const response = await apiService.post('/quote-builder/save-draft', quoteData);
      return response;
    } catch (error) {
      // Handle conflict responses (409 status)
      if (error.response && error.response.status === 409) {
        const conflictData = error.response.data;
        if (conflictData.conflict) {
          // Return conflict data for resolution
          return {
            success: false,
            conflict: true,
            conflictData
          };
        }
      }
      // Re-throw other errors
      throw error;
    }
  },

  /**
   * Resolve conflict by choosing a version
   */
  resolveConflict: async (quoteId, resolution, data) => {
    const response = await apiService.post('/quote-builder/resolve-conflict', {
      quoteId,
      resolution, // 'server' or 'client'
      data
    });
    return response;
  },

  /**
   * Get quote by ID
   */
  getQuoteById: async (quoteId) => {
    const response = await apiService.get(`/quote-builder/${quoteId}`);
    return response;
  },

  /**
   * Calculate quote totals with loading indicator
   */
  calculateQuote: loadingService.wrapAsync(
    'quote-calculation',
    'Calculating quote...',
    async (areas, productSets, pricingSchemeId, jobType, additionalData = {}) => {
      const response = await apiService.post('/quote-builder/calculate', {
        areas,
        productSets,
        pricingSchemeId,
        jobType,
        ...additionalData, // Includes homeSqft, jobScope, numberOfStories, conditionModifier
      });
      return response;
    },
    {
      showProgress: true,
      estimatedDuration: 3000,
      successMessage: 'Quote calculated successfully'
    }
  ),

  /**
   * Send quote to client
   */
  sendQuote: async (quoteId, emailData = {}) => {
    const response = await apiService.post(`/quote-builder/${quoteId}/send`, emailData);
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
