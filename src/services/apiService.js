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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
          throw new Error("Session expired. Please login again.")
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
}

export const apiService = new ApiService(API_BASE_URL)
