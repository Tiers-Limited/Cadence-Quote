import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, message, Button, Result } from 'antd';
import { FiCreditCard, FiRefreshCw } from 'react-icons/fi';
import Logo from '../components/Logo';
import { apiService } from '../services/apiService';

function ResumePaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    const provider = searchParams.get('provider');

    if (!sessionId) {
      setError('Payment session not found');
      setLoading(false);
      return;
    }

    // Fetch payment session details from backend
    fetchPaymentSession(sessionId, provider);
  }, [searchParams]);

  const fetchPaymentSession = async (sessionId, provider) => {
    try {
      const result = await apiService.getPaymentSession(sessionId);
      
      if (result.success && result.data) {
        setPaymentData({
          sessionUrl: result.data.url,
          provider: provider || 'google',
          status: result.data.status
        });
      } else {
        throw new Error(result.message || 'Invalid payment session');
      }
    } catch (err) {
      console.error('Failed to fetch payment session:', err);
      
      // Check if it's a 404 or 410 error (expired/not found session)
      if (err.response?.status === 404 || err.response?.status === 410) {
        setError('expired');
        setPaymentData({ provider });
      } else {
        setError(err.message || 'Failed to retrieve payment session');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResumePayment = () => {
    if (paymentData?.sessionUrl) {
      // Redirect to Stripe checkout
      window.location.href = paymentData.sessionUrl;
    }
  };

  const handleStartOver = () => {
    // Clear any stored data and redirect to registration
    localStorage.removeItem('googleProfile');
    localStorage.removeItem('appleProfile');
    navigate('/register');
  };

  const handleRetryWithOAuth = () => {
    // Redirect to OAuth signup flow
    const provider = paymentData?.provider || 'google';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';
    
    // Clear stored data
    localStorage.removeItem('googleProfile');
    localStorage.removeItem('appleProfile');
    
    // Redirect to OAuth provider
    window.location.href = `${apiBaseUrl}/v1/auth/${provider}?mode=signup`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Loading payment session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Special handling for expired sessions
    if (error === 'expired') {
      const providerName = paymentData?.provider === 'apple' ? 'Apple' : 'Google';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <Logo width={100} />
              <h1 className="text-2xl font-bold text-gray-900 mt-4">Payment Session Expired</h1>
            </div>
            
            <Result
              status="warning"
              title="Session Expired"
              subTitle="Your payment session has expired. Please complete registration again to continue."
              extra={[
                <Button 
                  key="oauth" 
                  type="primary" 
                  size="large"
                  onClick={handleRetryWithOAuth}
                  icon={<FiRefreshCw />}
                  className="mb-2"
                >
                  Continue with {providerName}
                </Button>,
                <Button 
                  key="register" 
                  size="large"
                  onClick={handleStartOver}
                >
                  Start Fresh Registration
                </Button>
              ]}
            />
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Click "Continue with {providerName}" to complete your registration. 
                Your previous incomplete registration will be automatically removed.
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // Other errors
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <Logo width={100} />
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Payment Session Error</h1>
          </div>
          
          <Result
            status="error"
            title="Unable to Load Payment Session"
            subTitle={error}
            extra={[
              <Button 
                key="register" 
                type="primary" 
                size="large"
                onClick={handleStartOver}
                icon={<FiRefreshCw />}
              >
                Start New Registration
              </Button>,
              <Button 
                key="login" 
                size="large"
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo width={100} />
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Resume Payment</h1>
          <p className="text-gray-600 mt-2">
            Your registration is almost complete!
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <FiCreditCard className="text-blue-600" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Incomplete Registration
            </h2>
            <p className="text-gray-600">
              You started registration with {paymentData?.provider === 'apple' ? 'Apple' : 'Google'} but didn't complete the payment.
              Click below to continue where you left off.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              type="primary"
              size="large"
              block
              icon={<FiCreditCard />}
              onClick={handleResumePayment}
              className="h-12 text-base font-semibold"
            >
              Complete Payment
            </Button>

            <Button
              size="large"
              block
              onClick={handleStartOver}
              className="h-12 text-base"
            >
              Start Over with New Registration
            </Button>

            <Button
              type="link"
              block
              onClick={() => navigate('/login')}
              className="text-gray-600 hover:text-gray-900"
            >
              Back to Login
            </Button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> If you start a new registration, your previous incomplete 
              registration will be automatically removed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResumePaymentPage;
