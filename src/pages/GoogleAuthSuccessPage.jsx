import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, message } from 'antd';
import { useUser } from '../context/UserContext';

function GoogleAuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setAccessToken,login, setRefreshToken } = useUser();

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');
        const error = searchParams.get('error');

        if (error) {
          message.error(error);
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
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';
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


        message.success('Login successful!');
        navigate('/dashboard');
      } catch (error) {
        console.error('Auth success page error:', error);
        message.error('Authentication failed. Please try again.');
        navigate('/login');
      }
    };

    handleAuthSuccess();
  }, [searchParams, navigate, setUser, setAccessToken, setRefreshToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spin size="large" />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default GoogleAuthSuccessPage;
