import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, message } from 'antd';
import { useUser } from '../context/UserContext';

function AppleAuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setAccessToken, login, setRefreshToken } = useUser();

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');
        const error = searchParams.get('error');

        if (error) {
          // Handle different error types
          const errorMessage = decodeURIComponent(error);
          
          if (errorMessage.includes('not active')) {
            message.error({
              content: errorMessage,
              duration: 6
            });
          } else if (errorMessage.includes('incomplete')) {
            message.warning({
              content: errorMessage,
              duration: 8
            });
          } else {
            message.error(errorMessage);
          }
          
          navigate('/login');
          return;
        }

        if (!token || !refreshToken) {
          message.error('Authentication failed: Missing tokens');
          navigate('/login');
          return;
        }

        // Store tokens
        setAccessToken(token);
        setRefreshToken(refreshToken);
        
        // Decode JWT to get user info (simple decode, verification happens on backend)
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Fetch full user details from backend
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user details');
        }

        const userData = await response.json();
        login(userData.data.user, token, refreshToken);

        navigate('/dashboard');
      } catch (error) {
        console.error('Auth success page error:', error);
        message.error('Authentication failed. Please try again.');
        navigate('/login');
      }
    };

    handleAuthSuccess();
  }, [searchParams, navigate, setUser, setAccessToken, setRefreshToken, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spin size="large" />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default AppleAuthSuccessPage;
