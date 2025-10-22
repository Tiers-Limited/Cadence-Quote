
import { useState } from 'react';
import { apiService } from '../services/apiService';

export const useVerify2FA = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const verify2FA = async (userId, code) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiService.post('/auth/verify-2fa', {
        userId,
        code
      });

      return {
        success: true,
        data: data.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to verify 2FA code'
      };
    } finally {
      setLoading(false);
    }
  };

  return { verify2FA, loading, error };
};