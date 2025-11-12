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

  async get(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "GET",
        headers: this.getHeaders(),
        ...options,
      })

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
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "PUT",
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        },
        body: JSON.stringify(data),
        ...options,
      })

      return this.handleResponse(response)
    } catch (error) {
      throw new Error(`PUT request failed: ${error.message}`)
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

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryCount === 0) {
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
}

export const apiService = new ApiService(API_BASE_URL)
