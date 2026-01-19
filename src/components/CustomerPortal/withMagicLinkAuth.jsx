import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { magicLinkApiService } from '../../services/magicLinkApiService';

/**
 * Higher Order Component that wraps customer portal pages
 * Redirects apiService calls to use magic link session instead of JWT auth
 */
export const withMagicLinkAuth = (WrappedComponent) => {
  return function MagicLinkAuthWrapper(props) {
    const navigate = useNavigate();

    useEffect(() => {
      // Check for magic link session
      const sessionToken = localStorage.getItem('portalSession');
      if (!sessionToken) {
        navigate('/portal/access');
        return;
      }

      // Override apiService methods to use magic link API
      const originalGet = apiService.get.bind(apiService);
      const originalPost = apiService.post.bind(apiService);
      const originalPut = apiService.put.bind(apiService);
      const originalDelete = apiService.delete.bind(apiService);

      // Intercept customer portal API calls
      apiService.get = async (endpoint, ...args) => {
        if (endpoint.startsWith('/customer/')) {
          // Redirect to customer-portal endpoint
          const newEndpoint = endpoint.replace('/customer/', '/api/customer-portal/');
          return magicLinkApiService.get(newEndpoint, ...args);
        }
        return originalGet(endpoint, ...args);
      };

      apiService.post = async (endpoint, ...args) => {
        if (endpoint.startsWith('/customer/')) {
          const newEndpoint = endpoint.replace('/customer/', '/api/customer-portal/');
          return magicLinkApiService.post(newEndpoint, ...args);
        }
        return originalPost(endpoint, ...args);
      };

      apiService.put = async (endpoint, ...args) => {
        if (endpoint.startsWith('/customer/')) {
          const newEndpoint = endpoint.replace('/customer/', '/api/customer-portal/');
          return magicLinkApiService.put(newEndpoint, ...args);
        }
        return originalPut(endpoint, ...args);
      };

      apiService.delete = async (endpoint, ...args) => {
        if (endpoint.startsWith('/customer/')) {
          const newEndpoint = endpoint.replace('/customer/', '/api/customer-portal/');
          return magicLinkApiService.delete(newEndpoint, ...args);
        }
        return originalDelete(endpoint, ...args);
      };

      // Cleanup function to restore original methods
      return () => {
        apiService.get = originalGet;
        apiService.post = originalPost;
        apiService.put = originalPut;
        apiService.delete = originalDelete;
      };
    }, [navigate]);

    return <WrappedComponent {...props} />;
  };
};
