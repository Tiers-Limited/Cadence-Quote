import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { message } from 'antd';

function GoogleAuthSuccess() {
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error');

    if (error) {
      message.error(decodeURIComponent(error));
      navigate('/login');
      return;
    }

    if (token && refreshToken) {
      // We don't have the user object here, but it will be decoded from the token
      contextLogin(null, token, refreshToken);
      message.success('Successfully logged in with Google!');
      navigate('/dashboard');
    } else {
      message.error('Authentication failed. Missing tokens.');
      navigate('/login');
    }
  }, [navigate, contextLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing your Google sign-in...</p>
      </div>
    </div>
  );
}

export default GoogleAuthSuccess;