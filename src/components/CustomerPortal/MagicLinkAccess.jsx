import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './MagicLinkAccess.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

/**
 * Magic Link Access Page
 * Component that validates magic link token and displays contractor branding
 * Flow: Token validation → Session creation → Redirect to dashboard
 */
const MagicLinkAccess = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [state, setState] = useState({
    status: 'validating', // validating, success, error
    error: null,
    branding: null,
    clientName: null,
    expiresAt: null,
    remainingDays: null,
    session: null,
  });

  useEffect(() => {
    validateAndAccessPortal();
  }, [token]);

  const validateAndAccessPortal = async () => {
    try {
      setState(prev => ({ ...prev, status: 'validating' }));

      // Call backend to validate token and create session
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/access/${token}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const { 
        session, 
        branding, 
        client,
        quote,
        allowMultiJobAccess,
        message 
      } = response.data;

      // Store session token in localStorage
      localStorage.setItem('portalSession', session.token);
      localStorage.setItem('portalExpiresAt', session.expiresAt);
      localStorage.setItem('tenantBranding', JSON.stringify(branding));
      localStorage.setItem('portalClient', JSON.stringify(client));
      if (quote) {
        localStorage.setItem('portalQuote', JSON.stringify(quote));
      }

      // Calculate remaining days
      const expiresAt = new Date(session.expiresAt);
      const now = new Date();
      const remainingDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      setState(prev => ({
        ...prev,
        status: 'success',
        session,
        branding,
        clientName: client.name,
        expiresAt,
        remainingDays,
      }));

      // Auto-redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/portal/dashboard', { 
          state: { 
            clientName: client.name,
            message 
          } 
        });
      }, 2000);

    } catch (error) {
      console.error('Error validating magic link:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message ||
                          'Invalid or expired magic link. Please request a new one.';
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
    }
  };

  const getErrorTitle = (error) => {
    if (error?.includes('expired')) return 'Link Expired';
    if (error?.includes('revoked')) return 'Link Revoked';
    if (error?.includes('already')) return 'Link Already Used';
    if (error?.includes('invalid')) return 'Invalid Link';
    return 'Access Denied';
  };

  const renderContent = () => {
    switch (state.status) {
      case 'validating':
        return (
          <div className="magic-link-container validating">
            <div className="spinner"></div>
            <h2>Validating your access...</h2>
            <p>Please wait while we verify your magic link.</p>
          </div>
        );

      case 'success':
        return (
          <div className="magic-link-container success">
            {state.branding?.logo && (
              <img 
                src={state.branding.logo} 
                alt="Contractor Logo"
                className="contractor-logo"
              />
            )}
            <div className="success-icon">✓</div>
            <h2>Welcome, {state.clientName || 'Valued Customer'}!</h2>
            <p>Your access link has been verified successfully.</p>
            
            <div className="expiry-info">
              <p className="expiry-label">Portal Access Valid For:</p>
              <p className="expiry-days">{state.remainingDays} Days</p>
              <p className="expiry-date">Until {state.expiresAt?.toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</p>
            </div>

            <div className="success-message">
              <p>Redirecting you to your dashboard...</p>
            </div>

            <button 
              className="btn-continue"
              onClick={() => navigate('/portal/dashboard')}
            >
              Continue to Dashboard
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="magic-link-container error">
            <div className="error-icon">✗</div>
            <h2>{getErrorTitle(state.error)}</h2>
            <p className="error-message">{state.error}</p>
            
            <div className="error-actions">
              <p>What can you do?</p>
              <ul>
                <li>Check if the link was copied correctly</li>
                <li>Make sure the link hasn't expired</li>
                <li>Request a new magic link from your contractor</li>
                <li>Check your email for a fresh link</li>
              </ul>
            </div>

            <button 
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="magic-link-access">
      <div className="magic-link-background">
        {renderContent()}
      </div>
    </div>
  );
};

export default MagicLinkAccess;
