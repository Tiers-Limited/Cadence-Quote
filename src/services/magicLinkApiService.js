import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

/**
 * Magic Link API Service
 * Uses session token from localStorage instead of JWT authentication
 */
class MagicLinkApiService {
  constructor() {
    this.baseURL = API_BASE_URL.replace('/api/v1', '');
  }

  getSessionToken() {
    return localStorage.getItem('portalSession');
  }

  async request(method, endpoint, data = null, options = {}) {
    const sessionToken = this.getSessionToken();
    
    if (!sessionToken) {
      throw new Error('No active session. Please access your portal link again.');
    }

    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    try {
      const response = await axios(config);
      // For binary/blob responses we need to return the full axios response (headers + data)
      if (config.responseType === 'blob' || options.responseType === 'blob') {
        return response;
      }
      return response.data;
    } catch (error) {
      console.log('MagicLinkApiService request error:', error);
      throw error;
    }
  }

  get(endpoint, params = null, options = {}) {
    return this.request('GET', endpoint, params, options);
  }

  post(endpoint, data = null, options = {}) {
    return this.request('POST', endpoint, data, options);
  }

  put(endpoint, data = null, options = {}) {
    return this.request('PUT', endpoint, data, options);
  }

  delete(endpoint, data = null, options = {}) {
    return this.request('DELETE', endpoint, data, options);
  }

  patch(endpoint, data = null, options = {}) {
    return this.request('PATCH', endpoint, data, options);
  }
}

export const magicLinkApiService = new MagicLinkApiService();
