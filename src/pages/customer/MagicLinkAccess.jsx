// src/pages/customer/MagicLinkAccess.jsx
// Customer portal magic link authentication

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spin, Result, Card } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { customerPortalAPI } from '../../services/api';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';

const MagicLinkAccess = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const accessPortal = async () => {
      try {
        const response = await customerPortalAPI.accessViaToken(token);
        
        // Store session data
        localStorage.setItem('customerSessionToken', response.session.token);
        localStorage.setItem('customerSessionExpiry', response.session.expiresAt);
        localStorage.setItem('customerData', JSON.stringify(response.client));
        localStorage.setItem('contractorBranding', JSON.stringify(response.branding));
        
        // Redirect to customer dashboard
        setTimeout(() => {
          navigate('/customer/dashboard', { replace: true });
        }, 1000);
        
      } catch (err) {
        console.error('Magic link access error:', err);
        setError(err.response?.data?.message || 'Invalid or expired access link');
        setLoading(false);
      }
    };

    if (token) {
      accessPortal();
    }
  }, [token, navigate]);

  if (loading) {
    return (
      <div>
        
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="text-center p-8">
            <Spin 
              indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
              size="large"
            />
            <h2 className="mt-4 text-xl font-semibold text-gray-800">
              Accessing Your Portal...
            </h2>
            <p className="text-gray-600 mt-2">
              Please wait while we verify your access link
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Result
            status="error"
            title="Access Denied"
            subTitle={error}
            extra={
              <div className="text-center text-gray-600 mt-4">
                <p>Your access link may have expired or is invalid.</p>
                <p className="mt-2">Please contact your contractor for a new access link.</p>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return null;
};

export default MagicLinkAccess;
