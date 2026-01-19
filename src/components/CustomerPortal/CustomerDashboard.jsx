import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CustomerDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

/**
 * Customer Portal Dashboard
 * Shows customer's quotes, expiry status, and allows OTP verification for multi-job access
 */
const CustomerDashboard = () => {
  const navigate = useNavigate();
  
  const [state, setState] = useState({
    loading: true,
    error: null,
    customer: {
      name: '',
      email: '',
    },
    portal: {
      expiresAt: null,
      remainingDays: null,
      isExpiringSoon: false,
    },
    quotes: [],
    session: {
      isVerified: false,
    },
    showOtpModal: false,
    showExpiredWarning: false,
  });

  useEffect(() => {
    loadPortalData();
    
    // Set up interval to check expiry status every minute
    const expiryCheckInterval = setInterval(() => {
      checkExpiryStatus();
    }, 60000);

    return () => clearInterval(expiryCheckInterval);
  }, []);

  const loadPortalData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const sessionToken = localStorage.getItem('portalSession');
      if (!sessionToken) {
        navigate('/portal/access');
        return;
      }

      // Validate session
      const sessionResponse = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/validate-session`,
        { sessionToken },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const { client, session, branding } = sessionResponse.data;
      
      // Calculate remaining days
      const expiresAt = new Date(session.expiresAt);
      const now = new Date();
      const remainingDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      // Get quotes
      const quotesResponse = await axios.get(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes`,
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          }
        }
      );

      const isExpiringSoon = remainingDays <= 2 && remainingDays > 0;
      const isExpired = remainingDays <= 0;

      setState(prev => ({
        ...prev,
        loading: false,
        customer: {
          name: client.name,
          email: client.email,
        },
        session: {
          isVerified: session.isVerified,
        },
        portal: {
          expiresAt,
          remainingDays,
          isExpiringSoon,
        },
        quotes: quotesResponse.data.quotes || [],
        showExpiredWarning: isExpired,
        showOtpModal: !session.isVerified && quotesResponse.data.quotes?.length > 1,
      }));

    } catch (error) {
      console.error('Error loading portal data:', error);
      
      if (error.response?.status === 401) {
        // Session expired
        localStorage.removeItem('portalSession');
        navigate('/portal/login', { state: { message: 'Your session has expired. Please request a new magic link.' } });
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load portal data. Please try again.',
        }));
      }
    }
  };

  const checkExpiryStatus = () => {
    const expiresAt = localStorage.getItem('portalExpiresAt');
    if (expiresAt) {
      const daysRemaining = Math.ceil((new Date(expiresAt) - new Date()) / (24 * 60 * 60 * 1000));
      
      if (daysRemaining <= 0) {
        setState(prev => ({ ...prev, showExpiredWarning: true }));
      } else if (daysRemaining <= 2) {
        setState(prev => ({ 
          ...prev, 
          portal: { ...prev.portal, isExpiringSoon: true, remainingDays: daysRemaining }
        }));
      }
    }
  };

  const requestNewLink = async () => {
    try {
      // This would be called from the contractor's admin panel
      alert('Please ask your contractor to send you a new magic link via email.');
    } catch (error) {
      console.error('Error requesting new link:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('portalSession');
    localStorage.removeItem('portalExpiresAt');
    localStorage.removeItem('tenantBranding');
    navigate('/portal/login');
  };

  if (state.loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading your portal...</p>
      </div>
    );
  }

  return (
    <div className="customer-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Welcome, {state.customer.name}</h1>
          <p className="header-email">{state.customer.email}</p>
        </div>
        <button className="btn-logout" onClick={logout}>Logout</button>
      </div>

      {/* Expiry Warning Banner */}
      {state.showExpiredWarning && (
        <div className="alert alert-danger">
          <h3>⚠️ Your Portal Access Has Expired</h3>
          <p>Your access to the customer portal has expired. Please request a new magic link from your contractor.</p>
          <button className="btn-secondary" onClick={requestNewLink}>
            Request New Link
          </button>
        </div>
      )}

      {state.portal.isExpiringSoon && !state.showExpiredWarning && (
        <div className="alert alert-warning">
          <h3>⏰ Portal Expiring Soon</h3>
          <p>Your access will expire in <strong>{state.portal.remainingDays}</strong> day(s) ({state.portal.expiresAt?.toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })})</p>
          <small>Contact your contractor to request a new link if needed.</small>
        </div>
      )}

      {/* Portal Status Card */}
      <div className="status-card">
        <div className="status-item">
          <label>Portal Access Expires:</label>
          <p className="status-value">{state.portal.expiresAt?.toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</p>
          <p className="status-subtitle">{state.portal.remainingDays} days remaining</p>
        </div>
        {!state.session.isVerified && state.quotes?.length > 1 && (
          <div className="status-action">
            <button 
              className="btn-verify"
              onClick={() => setState(prev => ({ ...prev, showOtpModal: true }))}
            >
              Verify to View All Projects
            </button>
          </div>
        )}
      </div>

      {/* Quotes Section */}
      <div className="quotes-section">
        <h2>Your Projects</h2>
        
        {state.error && (
          <div className="alert alert-error">{state.error}</div>
        )}

        {state.quotes?.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet</p>
            <small>You will see your projects here when your contractor sends you quotes.</small>
          </div>
        ) : (
          <div className="quotes-grid">
            {state.quotes.map(quote => (
              <div key={quote.id} className="quote-card">
                <div className="quote-header">
                  <h3>{quote.quoteNumber}</h3>
                  <span className={`status-badge status-${quote.status?.toLowerCase()}`}>
                    {quote.status}
                  </span>
                </div>

                <div className="quote-details">
                  <div className="detail-row">
                    <span className="label">Project:</span>
                    <span className="value">{quote.jobName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Amount:</span>
                    <span className="value">${(quote.totalPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date:</span>
                    <span className="value">{new Date(quote.createdAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</span>
                  </div>
                </div>

                <div className="quote-actions">
                  <button 
                    className="btn-view"
                    onClick={() => navigate(`/portal/quotes/${quote.id}`)}
                  >
                    View Details
                  </button>
                  {quote.status === 'pending_approval' && (
                    <button className="btn-approve">
                      Approve Quote
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OTP Verification Modal */}
      {state.showOtpModal && (
        <OTPVerificationModal
          onClose={() => setState(prev => ({ ...prev, showOtpModal: false }))}
          onVerified={() => {
            setState(prev => ({ 
              ...prev, 
              session: { ...prev.session, isVerified: true },
              showOtpModal: false 
            }));
            loadPortalData();
          }}
          email={state.customer.email}
        />
      )}
    </div>
  );
};

/**
 * OTP Verification Modal Component
 */
const OTPVerificationModal = ({ onClose, onVerified, email }) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    requestOTP();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const requestOTP = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionToken = localStorage.getItem('portalSession');
      await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/request-otp`,
        { email },
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          }
        }
      );

      setOtpSent(true);
      setResendTimer(60);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (otp.length !== 6) {
        setError('Please enter a 6-digit code');
        setLoading(false);
        return;
      }

      const sessionToken = localStorage.getItem('portalSession');
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/verify-otp`,
        { otp },
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          }
        }
      );

      if (response.data.success) {
        onVerified();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content otp-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2>Verify Your Identity</h2>
        <p className="modal-description">
          To access all your projects, we've sent a verification code to your email.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={verifyOTP}>
          <div className="form-group">
            <label htmlFor="otp">Enter 6-Digit Code:</label>
            <input
              type="text"
              id="otp"
              maxLength="6"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              className="otp-input"
            />
            <small>Check your email for the code</small>
          </div>

          <button 
            type="submit" 
            className="btn-primary"
            disabled={loading || otp.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="otp-resend">
          <p>Didn't receive the code?</p>
          <button
            type="button"
            onClick={requestOTP}
            disabled={resendTimer > 0 || loading}
            className="btn-text"
          >
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
          </button>
        </div>

        <button 
          type="button"
          onClick={onClose}
          className="btn-secondary"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
};

export default CustomerDashboard;
