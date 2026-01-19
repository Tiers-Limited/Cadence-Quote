// src/services/customerPortalAPI.js
// API service for customer portal operations

import axios from 'axios';

// Customer portal routes are at /api/customer-portal (not under /api/v1)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001';
// Strip /api/v1 from base URL since customer portal routes are at root level
const API_BASE = API_BASE_URL.replace('/api/v1', '/api');

// Get session token from localStorage (check both keys for compatibility)
const getSessionToken = () => {
  return localStorage.getItem('portalSession') || localStorage.getItem('customerSessionToken');
};

// Configure axios instance with auth
const customerAPI = axios.create({
  baseURL: API_BASE,
});

// Add auth interceptor
customerAPI.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const customerPortalAPI = {
  // ============================================================================
  // MAGIC LINK AUTHENTICATION
  // ============================================================================
  
  /**
   * Access portal via magic link token
   */
  accessViaToken: async (token) => {
    const response = await axios.get(`${API_BASE}/customer-portal/access/${token}`);
    return response.data;
  },

  /**
   * Validate existing session
   */
  validateSession: async (sessionToken) => {
    const response = await axios.post(`${API_BASE}/customer-portal/validate-session`, {
      sessionToken,
    });
    return response.data;
  },

  /**
   * Request OTP for multi-job access
   */
  requestOTP: async (sessionToken, method = 'email') => {
    const response = await axios.post(`${API_BASE}/customer-portal/request-otp`, {
      sessionToken,
      method,
    });
    return response.data;
  },

  /**
   * Verify OTP code
   */
  verifyOTP: async (sessionToken, code) => {
    const response = await axios.post(`${API_BASE}/customer-portal/verify-otp`, {
      sessionToken,
      code,
    });
    return response.data;
  },

  // ============================================================================
  // PROPOSAL MANAGEMENT
  // ============================================================================
  
  /**
   * Get proposal details
   */
  getProposal: async (proposalId) => {
    const response = await customerAPI.get(`/customer-portal/proposals/${proposalId}`);
    return response.data;
  },

  /**
   * Accept proposal and create deposit payment intent
   */
  acceptProposal: async (proposalId, { selectedTier }) => {
    const response = await customerAPI.post(`/customer-portal/proposals/${proposalId}/accept`, {
      selectedTier,
    });
    return response.data;
  },

  /**
   * Confirm deposit payment after Stripe success
   */
  confirmDepositPayment: async (proposalId, { paymentIntentId }) => {
    const response = await customerAPI.post(`/customer-portal/proposals/${proposalId}/confirm-payment`, {
      paymentIntentId,
    });
    return response.data;
  },

  /**
   * Reject proposal
   */
  rejectProposal: async (proposalId, { reason, comments }) => {
    const response = await customerAPI.post(`/customer-portal/proposals/${proposalId}/reject`, {
      reason,
      comments,
    });
    return response.data;
  },

  // ============================================================================
  // CUSTOMER SELECTIONS
  // ============================================================================
  
  /**
   * Get selection options for a proposal
   */
  getSelectionOptions: async (proposalId) => {
    const response = await customerAPI.get(`/customer-portal/proposals/${proposalId}/selection-options`);
    return response.data;
  },

  /**
   * Get colors by brand with pagination and search
   * GET /api/customer-portal/colors?brandId=&page=&limit=&search=
   */
  getColors: async ({ brandId, page = 1, limit = 36, search = '' } = {}) => {
    const response = await customerAPI.get(`/customer-portal/colors`, {
      params: { brandId, page, limit, search }
    });
    return response.data;
  },

  /**
   * Get all brands (or paginated)
   */
  getBrands: async ({ search = '', page, limit } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (page) params.page = page;
    if (limit) params.limit = limit;
    const response = await customerAPI.get(`/customer-portal/brands`, { params });
    return response.data;
  },

  /**
   * Save customer selections (partial or complete)
   */
  saveSelections: async (proposalId, { selections }) => {
    const response = await customerAPI.post(`/customer-portal/proposals/${proposalId}/selections`, {
      selections,
    });
    return response.data;
  },

  /**
   * Submit and lock selections (converts to job)
   */
  submitSelections: async (proposalId) => {
    const response = await customerAPI.post(`/customer-portal/proposals/${proposalId}/submit-selections`);
    return response.data;
  },

  // ============================================================================
  // JOB TRACKING
  // ============================================================================
  
  /**
   * Get job details
   */
  getJobDetails: async (jobId) => {
    const response = await customerAPI.get(`/jobs/${jobId}`);
    return response.data;
  },

  /**
   * Create final payment intent
   */
  createFinalPayment: async (jobId) => {
    const response = await customerAPI.post(`/jobs/${jobId}/create-final-payment`);
    return response.data;
  },

  /**
   * Confirm final payment
   */
  confirmFinalPayment: async (jobId, { paymentIntentId }) => {
    const response = await customerAPI.post(`/jobs/${jobId}/confirm-final-payment`, {
      paymentIntentId,
    });
    return response.data;
  },
};

export default customerPortalAPI;
