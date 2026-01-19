import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './QuoteDetails.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

/**
 * Quote Details Component
 * Shows full quote details including items, pricing, and approval options
 */
const QuoteDetails = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState({
    loading: true,
    error: null,
    quote: null,
    expiresAt: null,
    remainingDays: null,
    isExpired: false,
    approving: false,
    declineReason: '',
    showDeclineModal: false,
  });

  useEffect(() => {
    loadQuoteDetails();
  }, [quoteId]);

  const loadQuoteDetails = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const sessionToken = localStorage.getItem('portalSession');
      const expiresAt = localStorage.getItem('portalExpiresAt');

      if (!sessionToken) {
        navigate('/portal/access');
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes/${quoteId}`,
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          }
        }
      );

      const remainingDays = expiresAt ? 
        Math.ceil((new Date(expiresAt) - new Date()) / (24 * 60 * 60 * 1000)) : 
        null;

      setState(prev => ({
        ...prev,
        loading: false,
        quote: response.data.quote,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        remainingDays,
        isExpired: remainingDays !== null && remainingDays <= 0,
      }));

    } catch (error) {
      console.error('Error loading quote:', error);
      
      if (error.response?.status === 401) {
        navigate('/portal/access');
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load quote details. Please try again.',
        }));
      }
    }
  };

  const approveQuote = async () => {
    try {
      setState(prev => ({ ...prev, approving: true }));

      const sessionToken = localStorage.getItem('portalSession');
      
      await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes/${quoteId}/approve`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        approving: false,
        quote: { ...prev.quote, status: 'approved' },
      }));

      // Show success message
      alert('Quote approved successfully!');
      
      setTimeout(() => {
        navigate('/portal/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error approving quote:', error);
      setState(prev => ({
        ...prev,
        approving: false,
      }));
      alert(error.response?.data?.error || 'Failed to approve quote. Please try again.');
    }
  };

  const declineQuote = async () => {
    try {
      setState(prev => ({ ...prev, approving: true }));

      const sessionToken = localStorage.getItem('portalSession');
      
      await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes/${quoteId}/decline`,
        { reason: state.declineReason },
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        approving: false,
        showDeclineModal: false,
        quote: { ...prev.quote, status: 'declined' },
      }));

      alert('Quote declined');
      setTimeout(() => {
        navigate('/portal/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error declining quote:', error);
      setState(prev => ({ ...prev, approving: false }));
      alert(error.response?.data?.error || 'Failed to decline quote');
    }
  };

  if (state.loading) {
    return (
      <div className="quote-loading">
        <div className="spinner"></div>
        <p>Loading quote details...</p>
      </div>
    );
  }

  if (state.error || !state.quote) {
    return (
      <div className="quote-error">
        <h2>Error</h2>
        <p>{state.error || 'Quote not found'}</p>
        <button onClick={() => navigate('/portal/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const quote = state.quote;

  return (
    <div className="quote-details-container">
      {/* Header */}
      <div className="quote-header-section">
        <button 
          className="btn-back"
          onClick={() => navigate('/portal/dashboard')}
        >
          ← Back to Dashboard
        </button>
        
        <h1>{quote.quoteNumber}</h1>
        
        <div className="quote-status-bar">
          <span className={`status-badge status-${quote.status?.toLowerCase()}`}>
            {quote.status}
          </span>
          {state.isExpired && (
            <span className="expiry-badge expired">Portal Access Expired</span>
          )}
          {state.remainingDays && state.remainingDays <= 2 && state.remainingDays > 0 && (
            <span className="expiry-badge expiring">
              Expires in {state.remainingDays} day(s)
            </span>
          )}
        </div>
      </div>

      {/* Project Information */}
      <div className="quote-section">
        <h2>Project Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Project Name:</label>
            <p>{quote.jobName}</p>
          </div>
          <div className="info-item">
            <label>Address:</label>
            <p>{quote.address}</p>
          </div>
          <div className="info-item">
            <label>Quote Date:</label>
            <p>{new Date(quote.createdAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</p>
          </div>
          <div className="info-item">
            <label>Validity:</label>
            <p>{quote.validityDays || 30} days</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      {quote.items && quote.items.length > 0 && (
        <div className="quote-section">
          <h2>Items</h2>
          <div className="items-table">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.description}</td>
                    <td>{item.category}</td>
                    <td>{item.quantity}</td>
                    <td>${item.unitPrice?.toFixed(2) || '0.00'}</td>
                    <td>${(item.quantity * item.unitPrice)?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      <div className="quote-section pricing-summary">
        <h2>Pricing Summary</h2>
        <div className="summary-rows">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>${quote.subtotal?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="summary-row">
            <span>Tax ({quote.taxRate || 0}%):</span>
            <span>${quote.taxAmount?.toFixed(2) || '0.00'}</span>
          </div>
          {quote.discount && (
            <div className="summary-row">
              <span>Discount:</span>
              <span>-${quote.discount?.toFixed(2)}</span>
            </div>
          )}
          <div className="summary-row total">
            <span>Total:</span>
            <span>${quote.totalPrice?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      {quote.terms && (
        <div className="quote-section">
          <h2>Terms & Conditions</h2>
          <div className="terms-content">
            {quote.terms}
          </div>
        </div>
      )}

      {/* Notes */}
      {quote.notes && (
        <div className="quote-section">
          <h2>Notes</h2>
          <p>{quote.notes}</p>
        </div>
      )}

      {/* Action Buttons */}
      {!state.isExpired && quote.status === 'pending_approval' && (
        <div className="quote-actions">
          <button 
            className="btn-approve btn-large"
            onClick={approveQuote}
            disabled={state.approving}
          >
            {state.approving ? 'Approving...' : '✓ Approve Quote'}
          </button>
          <button 
            className="btn-decline btn-large"
            onClick={() => setState(prev => ({ ...prev, showDeclineModal: true }))}
            disabled={state.approving}
          >
            ✗ Decline Quote
          </button>
        </div>
      )}

      {quote.status !== 'pending_approval' && (
        <div className="quote-status-message">
          <p>This quote has already been {quote.status}</p>
        </div>
      )}

      {state.isExpired && (
        <div className="quote-status-message expired">
          <p>Your portal access has expired. You cannot approve or decline quotes. Please request a new magic link.</p>
        </div>
      )}

      {/* Decline Modal */}
      {state.showDeclineModal && (
        <div className="modal-overlay">
          <div className="modal-content decline-modal">
            <button 
              className="modal-close"
              onClick={() => setState(prev => ({ ...prev, showDeclineModal: false }))}
            >
              ✕
            </button>
            
            <h2>Decline Quote</h2>
            <p>Tell us why you're declining this quote (optional):</p>
            
            <textarea
              value={state.declineReason}
              onChange={(e) => setState(prev => ({ ...prev, declineReason: e.target.value }))}
              placeholder="Your reason here..."
              rows="4"
            />

            <div className="modal-actions">
              <button 
                className="btn-danger"
                onClick={declineQuote}
                disabled={state.approving}
              >
                {state.approving ? 'Declining...' : 'Decline Quote'}
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setState(prev => ({ ...prev, showDeclineModal: false }))}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteDetails;
