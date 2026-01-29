const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4001/api/v1"

class ApiService {
  constructor(baseURL) {
    this.baseURL = baseURL
    this.isRefreshing = false
    this.refreshSubscribers = []
  }

  getAuthToken() {
    return localStorage.getItem("authToken")
  }

  getRefreshToken() {
    return localStorage.getItem("refreshToken")
  }

  getHeaders() {
    const token = this.getAuthToken()
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  onRefreshed(token) {
    this.refreshSubscribers.forEach((callback) => callback(token))
    this.refreshSubscribers = []
  }

  addRefreshSubscriber(callback) {
    this.refreshSubscribers.push(callback)
  }

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      throw new Error("No refresh token available")
    }

    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Token refresh failed")
    }

    // Store new token
    localStorage.setItem("authToken", data.data.token)
    return data.data.token
  }

  async get(endpoint, data = null, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "GET",
        headers: this.getHeaders(),
        ...options,
      })

      // Handle blob responses (file downloads)
      if (options.responseType === 'blob') {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP Error: ${response.status}`);
        }
        return await response.blob();
      }

      return this.handleResponse(response)
    } catch (error) {
      throw new Error(`GET request failed: ${error.message}`)
    }
  }

  async post(endpoint, data = {}, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        },
        body: JSON.stringify(data),
        ...options,
      })

      return this.handleResponse(response)
    } catch (error) {
      throw new Error(`POST request failed: ${error.message}`)
    }
  }

  // Upload FormData (files) without forcing Content-Type so browser sets boundary
  async postFile(endpoint, formData, options = {}) {
    try {
      const token = this.getAuthToken();
      const headers = {
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        ...options,
      });

      return this.handleResponse(response);
    } catch (error) {
      throw new Error(`POST file request failed: ${error.message}`);
    }
  }

  async put(endpoint, data = {}, options = {}) {
    try {
      const { headers: customHeaders, ...restOptions } = options;
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "PUT",
        headers: {
          ...this.getHeaders(),
          ...customHeaders
        },
        body: JSON.stringify(data),
        ...restOptions,
      })

      return this.handleResponse(response)
    } catch (error) {
      throw new Error(`PUT request failed: ${error.message}`)
    }
  }

  async patch(endpoint, data = {}, options = {}) {
    try {
      const { headers: customHeaders, ...restOptions } = options;
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "PATCH",
        headers: {
          ...this.getHeaders(),
          ...customHeaders
        },
        body: JSON.stringify(data),
        ...restOptions,
      })

      return this.handleResponse(response)
    } catch (error) {
      throw new Error(`PATCH request failed: ${error.message}`)
    }
  }

  async delete(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "DELETE",
        headers: this.getHeaders(),
        ...options,
      })

      return this.handleResponse(response)
    } catch (error) {
      throw new Error(`DELETE request failed: ${error.message}`)
    }
  }

  async handleResponse(response, retryCount = 0) {
    const data = await response.json()

    // Handle 401 Unauthorized - try to refresh token (but not for login/register endpoints)
    const isAuthEndpoint = response.url.includes('/auth/login') || 
                           response.url.includes('/auth/register') || 
                           response.url.includes('/auth/google') || 
                           response.url.includes('/auth/apple');
    
    if (response.status === 401 && retryCount === 0 && !isAuthEndpoint) {
      if (!this.isRefreshing) {
        this.isRefreshing = true
        
        try {
          const newToken = await this.refreshAccessToken()
          this.isRefreshing = false
          this.onRefreshed(newToken)
          
          // Retry the original request with new token
          const retryResponse = await fetch(response.url, {
            method: response.method || "GET",
            headers: this.getHeaders(),
          })
          
          return this.handleResponse(retryResponse, 1)
        } catch (refreshError) {
          // this.isRefreshing = false
          // this.logout()
          throw new Error("Invalid Credentials. Please Login Again.")
        }
      } else {
        // Wait for token refresh
        return new Promise((resolve, reject) => {
          this.addRefreshSubscriber((token) => {
            fetch(response.url, {
              method: response.method || "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            })
              .then((res) => res.json())
              .then(resolve)
              .catch(reject)
          })
        })
      }
    }

    // For auth endpoints, return the response even if not ok (they handle their own error responses)
    if (isAuthEndpoint) {
      return data;
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP Error: ${response.status}`)
    }

    return data
  }

  logout() {
    localStorage.removeItem("authToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
    localStorage.removeItem("tenant")
    localStorage.removeItem("registrationData")
    localStorage.removeItem("pendingRegistration")
  }

  // ===== ADMIN API METHODS =====
  
  // Global Products
  async getGlobalProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/products${query ? `?${query}` : ''}`);
  }

  async getGlobalProductById(id) {
    return this.get(`/admin/products/${id}`);
  }

  async createGlobalProduct(data) {
    return this.post('/admin/products', data);
  }

  async updateGlobalProduct(id, data) {
    return this.put(`/admin/products/${id}`, data);
  }

  async deleteGlobalProduct(id) {
    return this.delete(`/admin/products/${id}`);
  }

  async bulkImportGlobalProducts(data) {
    return this.post('/admin/products/bulk-import', data);
  }

  // Global Colors
  async getGlobalColors(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/colors${query ? `?${query}` : ''}`);
  }

  async getGlobalColorById(id) {
    return this.get(`/admin/colors/${id}`);
  }

  async createGlobalColor(data) {
    return this.post('/admin/colors', data);
  }

  async updateGlobalColor(id, data) {
    return this.put(`/admin/colors/${id}`, data);
  }

  async deleteGlobalColor(id) {
    return this.delete(`/admin/colors/${id}`);
  }

  async addCrossBrandMapping(colorId, data) {
    return this.post(`/admin/colors/${colorId}/cross-brand-mapping`, data);
  }

  async bulkImportGlobalColors(data) {
    return this.post('/admin/colors/bulk-import', data);
  }

  // Admin Brands
  async getAdminBrands(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/brands${query ? `?${query}` : ''}`);
  }

  async createAdminBrand(data) {
    return this.post('/admin/brands', data);
  }

  async updateAdminBrand(id, data) {
    return this.put(`/admin/brands/${id}`, data);
  }

  async deleteAdminBrand(id) {
    return this.delete(`/admin/brands/${id}`);
  }

  async seedBrands() {
    return this.post('/admin/brands/seed');
  }

  // Audit Logs
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/audit-logs${query ? `?${query}` : ''}`);
  }

  async getAuditLogsByCategory(category, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/audit-logs/category/${category}${query ? `?${query}` : ''}`);
  }

  async getTenantAuditLogs(tenantId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/audit-logs/tenant/${tenantId}${query ? `?${query}` : ''}`);
  }

  async getAuditLogStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/audit-logs/stats${query ? `?${query}` : ''}`);
  }

  // Tenant Management
  async getTenants(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/tenants${query ? `?${query}` : ''}`);
  }

  async getTenantById(id) {
    return this.get(`/admin/tenants/${id}`);
  }

  async updateTenant(id, data) {
    return this.put(`/admin/tenants/${id}`, data);
  }

  async activateTenant(id) {
    return this.post(`/admin/tenants/${id}/activate`);
  }

  async suspendTenant(id) {
    return this.post(`/admin/tenants/${id}/suspend`);
  }

  async assignUsersToTenant(id, userIds) {
    return this.post(`/admin/tenants/${id}/assign-users`, { userIds });
  }

  async getTenantStats() {
    return this.get('/admin/tenants/stats');
  }

  async impersonateUser(userId) {
    return this.post(`/admin/tenants/users/${userId}/impersonate`);
  }

  // Feature Flags
  async getFeatureFlags(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/feature-flags${query ? `?${query}` : ''}`);
  }

  async getFeatureFlagById(id) {
    return this.get(`/admin/feature-flags/${id}`);
  }

  async createFeatureFlag(data) {
    return this.post('/admin/feature-flags', data);
  }

  async updateFeatureFlag(id, data) {
    return this.put(`/admin/feature-flags/${id}`, data);
  }

  async deleteFeatureFlag(id) {
    return this.delete(`/admin/feature-flags/${id}`);
  }

  async getTenantFeatures(tenantId) {
    return this.get(`/admin/tenants/${tenantId}/features`);
  }

  async assignFeatureToTenant(tenantId, featureId, data = {}) {
    return this.post(`/admin/tenants/${tenantId}/features/${featureId}`, data);
  }

  async removeFeatureFromTenant(tenantId, featureId) {
    return this.delete(`/admin/tenants/${tenantId}/features/${featureId}`);
  }

  // Pricing Schemes
  async getPricingSchemes(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/pricing-schemes${query ? `?${query}` : ''}`);
  }

  async getPricingSchemeById(id) {
    return this.get(`/pricing-schemes/${id}`);
  }

  async createPricingScheme(data) {
    return this.post('/pricing-schemes', data);
  }

  async updatePricingScheme(id, data, customHeaders = {}) {
    return this.put(`/pricing-schemes/${id}`, data, { headers: customHeaders });
  }

  async deletePricingScheme(id) {
    return this.delete(`/pricing-schemes/${id}`);
  }

  async setDefaultPricingScheme(id) {
    return this.put(`/pricing-schemes/${id}/set-default`);
  }

  async getPricingSchemeWithRules(id) {
    return this.get(`/pricing-schemes/${id}/rules`);
  }

  async calculateQuote(id, data) {
    return this.post(`/pricing-schemes/${id}/calculate`, data);
  }

  // ============================================
  // Subscription & Billing Methods
  // ============================================

  /**
   * Get all subscriptions with filters and pagination
   * @param {Object} params - Query parameters (page, limit, status, tier, search)
   */
  async getSubscriptions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.get(`/subscriptions?${queryString}`);
  }

  /**
   * Get subscription statistics (MRR, churn, trials, etc.)
   */
  async getSubscriptionStats() {
    return this.get('/subscriptions/stats');
  }

  /**
   * Get Stripe integration status
   */
  async getStripeIntegrationStatus() {
    return this.get('/subscriptions/stripe-status');
  }

  /**
   * Update a subscription
   * @param {number} id - Subscription ID
   * @param {Object} data - Update data (tier, quantity, cancelAtPeriodEnd)
   */
  async updateSubscription(id, data) {
    return this.put(`/subscriptions/${id}`, data);
  }

  /**
   * Cancel a subscription
   * @param {number} id - Subscription ID
   * @param {boolean} immediate - Cancel immediately or at period end
   */
  async cancelSubscription(id, immediate = false) {
    return this.post(`/subscriptions/${id}/cancel`, { immediate });
  }

  /**
   * Retry a failed payment
   * @param {number} id - Subscription ID
   */
  async retryPayment(id) {
    return this.post(`/subscriptions/${id}/retry`);
  }

  /**
   * Process a refund
   * @param {number} paymentId - Payment ID
   * @param {number} amount - Amount to refund (optional, full refund if not provided)
   * @param {string} reason - Refund reason
   */
  async processRefund(paymentId, amount = null, reason = '') {
    return this.post(`/subscriptions/payments/${paymentId}/refund`, { amount, reason });
  }

  /**
   * Get payment session details
   * @param {string} sessionId - Stripe session ID
   */
  async getPaymentSession(sessionId) {
    return this.get(`/payments/session/${sessionId}`);
  }

  // ========================================
  // Contractor Product Configuration APIs
  // ========================================

  /**
   * Get all product configurations for the authenticated contractor
   * @param {Object} params - Query parameters (brandId, search, page, limit, sortBy, sortOrder)
   */
  async getProductConfigs(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/contractor/product-configs?${queryString}` : '/contractor/product-configs';
    return this.get(endpoint);
  }

  /**
   * Get a single product configuration by ID
   * @param {number} id - Product configuration ID
   */
  async getProductConfigById(id) {
    return this.get(`/contractor/product-configs/${id}`);
  }

  /**
   * Create a new product configuration
   * @param {Object} data - Configuration data (globalProductId, sheens, laborRates, defaultMarkup, productMarkups, taxRate)
   */
  async createProductConfig(data) {
    return this.post('/contractor/product-configs', data);
  }

  /**
   * Update an existing product configuration
   * @param {number} id - Product configuration ID
   * @param {Object} data - Updated configuration data
   */
  async updateProductConfig(id, data) {
    return this.put(`/contractor/product-configs/${id}`, data);
  }

  /**
   * Delete (soft delete) a product configuration
   * @param {number} id - Product configuration ID
   */
  async deleteProductConfig(id) {
    return this.delete(`/contractor/product-configs/${id}`);
  }

  /**
   * Get default values for product configurations
   * Returns default labor rates, markup, tax rate, and coverage
   */
  async getProductConfigDefaults() {
    return this.get('/contractor/product-configs/defaults');
  }

  /**
   * Update default values for product configurations
   * @param {Object} data - Updated defaults (laborRates, defaultMarkup, defaultTaxRate)
   */
  async updateProductConfigDefaults(data) {
    return this.put('/contractor/product-configs/defaults', data);
  }

  // ==================== Client Portal Invitations ====================

  /**
   * Invite a client to access the customer portal
   * @param {number} clientId - Client ID to invite
   */
  async inviteClientToPortal(clientId) {
    return this.post('/client-auth/invite', { clientId });
  }

  /**
   * Resend portal invitation to a client
   * @param {number} clientId - Client ID to resend invitation
   */
  async resendClientInvitation(clientId) {
    return this.post('/client-auth/resend-invitation', { clientId });
  }

  /**
   * Get client details including portal access status
   * @param {number} clientId - Client ID
   */
  async getClientDetails(clientId) {
    return this.get(`/clients/${clientId}`);
  }

  // ==================== Contractor Portal Controls ====================

  /**
   * Manually open customer portal for a proposal
   * @param {number} proposalId - Proposal ID
   */
  async openCustomerPortal(proposalId) {
    return this.post(`/contractor-portal/proposals/${proposalId}/open-portal`);
  }

  /**
   * Manually close customer portal for a proposal
   * @param {number} proposalId - Proposal ID
   */
  async closeCustomerPortal(proposalId) {
    return this.post(`/contractor-portal/proposals/${proposalId}/close-portal`);
  }

  /**
   * Get customer selections for a proposal (contractor view)
   * @param {number} proposalId - Proposal ID
   */
  async getCustomerSelections(proposalId) {
    return this.get(`/contractor-portal/proposals/${proposalId}/selections`);
  }

  // ==================== GBB (Good-Better-Best) Pricing Tiers ====================

  /**
   * Get GBB configuration for the authenticated contractor
   * @returns {Promise<Object>} GBB configuration data
   */
  async getGBBConfiguration() {
    return this.get('/settings/gbb');
  }

  /**
   * Update GBB configuration
   * @param {Object} config - GBB configuration object
   * @param {boolean} config.gbbEnabled - Whether GBB is enabled globally
   * @param {Object} config.gbbTiers - Tier configurations for all schemes
   * @returns {Promise<Object>} Updated configuration
   */
  async updateGBBConfiguration(config) {
    return this.put('/settings/gbb', config);
  }

  /**
   * Reset GBB configuration to defaults
   * @param {string} scheme - Scheme to reset ('rateBased', 'flatRate', 'productionBased', 'turnkey', or 'all')
   * @returns {Promise<Object>} Reset configuration
   */
  async resetGBBConfiguration(scheme = 'all') {
    return this.post('/settings/gbb/reset', { scheme });
  }

  /**
   * Calculate pricing for all GBB tiers
   * @param {Object} params - Calculation parameters
   * @returns {Promise<Object>} Tier pricing for all tiers
   */
  async calculateTierPricing(params) {
    return this.post('/quote-builder/calculate-tiers', params);
  }
}

export const apiService = new ApiService(API_BASE_URL)
export default apiService
