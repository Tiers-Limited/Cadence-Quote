import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Portal Admin Settings Component
 * Allows contractors to manage portal settings, expiry duration, and customer access
 */
const PortalAdminSettings = () => {
  const [state, setState] = useState({
    loading: true,
    saving: false,
    error: null,
    success: false,
    settings: {
      defaultExpiryDays: 7,
      maxExpiryDays: 90,
      autoCleanupEnabled: true,
      autoCleanupDays: 30,
      requireOTPForMultiJob: true,
      portalBrandingConfig: {},
    },
    activeTab: 'settings', // settings, links, sessions, analytics
    magicLinks: [],
    activeSessions: [],
    expiryAnalytics: null,
    sendLinkModal: {
      show: false,
      clientId: '',
      email: '',
      expiryDays: 7,
      quoteId: '',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (state.activeTab === 'links') {
      loadActiveMagicLinks();
    } else if (state.activeTab === 'sessions') {
      loadActiveSessions();
    } else if (state.activeTab === 'analytics') {
      loadExpiryAnalytics();
    }
  }, [state.activeTab]);

  const loadSettings = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const response = await axios.get(
        '/api/admin/portal/settings',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        loading: false,
        settings: response.data.data,
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load portal settings',
      }));
    }
  };

  const saveSettings = async () => {
    try {
      setState(prev => ({ ...prev, saving: true, error: null }));

      await axios.put(
        '/api/admin/portal/settings',
        state.settings,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        saving: false,
        success: true,
      }));

      setTimeout(() => {
        setState(prev => ({ ...prev, success: false }));
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setState(prev => ({
        ...prev,
        saving: false,
        error: error.response?.data?.error || 'Failed to save settings',
      }));
    }
  };

  const updateSetting = (key, value) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  const loadActiveMagicLinks = async () => {
    try {
      const response = await axios.get(
        '/api/admin/portal/links?limit=20&offset=0',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        magicLinks: response.data.data.links || [],
      }));
    } catch (error) {
      console.error('Error loading magic links:', error);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const response = await axios.get(
        '/api/admin/portal/sessions?limit=20&offset=0',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        activeSessions: response.data.data.sessions || [],
      }));
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadExpiryAnalytics = async () => {
    try {
      const response = await axios.get(
        '/api/admin/portal/analytics/expiry',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        expiryAnalytics: response.data.data,
      }));
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const sendMagicLink = async () => {
    try {
      const { email, clientId, expiryDays, quoteId } = state.sendLinkModal;

      if (!email || !clientId) {
        alert('Please fill in all required fields');
        return;
      }

      await axios.post(
        '/api/admin/portal/send-link',
        { email, clientId: parseInt(clientId), expiryDays: parseInt(expiryDays), quoteId: quoteId ? parseInt(quoteId) : null },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      setState(prev => ({
        ...prev,
        sendLinkModal: {
          show: false,
          clientId: '',
          email: '',
          expiryDays: 7,
          quoteId: '',
        },
      }));

      alert('Magic link sent successfully!');
      loadActiveMagicLinks();
    } catch (error) {
      console.error('Error sending magic link:', error);
      alert(error.response?.data?.error || 'Failed to send magic link');
    }
  };

  const resendLink = async (linkId) => {
    if (!window.confirm('Are you sure you want to resend this link?')) return;

    try {
      await axios.post(
        `/api/admin/portal/links/${linkId}/resend`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      alert('Link resent successfully!');
      loadActiveMagicLinks();
    } catch (error) {
      console.error('Error resending link:', error);
      alert('Failed to resend link');
    }
  };

  const revokeSession = async (clientId) => {
    if (!window.confirm('Are you sure? This will revoke all sessions for this customer.')) return;

    try {
      await axios.post(
        `/api/admin/portal/customers/${clientId}/revoke-all`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      alert('All sessions revoked!');
      loadActiveSessions();
    } catch (error) {
      console.error('Error revoking sessions:', error);
      alert('Failed to revoke sessions');
    }
  };

  const runCleanup = async () => {
    if (!window.confirm('This will delete expired portal data. Continue?')) return;

    try {
      const response = await axios.post(
        '/api/admin/portal/cleanup',
        {},
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        }
      );

      alert(`Cleanup complete!\n${response.data.data.linksDeleted} links and ${response.data.data.sessionsDeleted} sessions deleted`);
    } catch (error) {
      console.error('Error running cleanup:', error);
      alert('Failed to run cleanup');
    }
  };

  if (state.loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Loading portal settings...</p>
      </div>
    );
  }

  return (
    <div className="portal-admin-container">
      <h1>Portal Admin Settings</h1>

      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.success && <div className="alert alert-success">Settings saved successfully!</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${state.activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'settings' }))}
        >
          Settings
        </button>
        <button 
          className={`tab-button ${state.activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'links' }))}
        >
          Magic Links
        </button>
        <button 
          className={`tab-button ${state.activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'sessions' }))}
        >
          Active Sessions
        </button>
        <button 
          className={`tab-button ${state.activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'analytics' }))}
        >
          Analytics
        </button>
      </div>

      {/* Settings Tab */}
      {state.activeTab === 'settings' && (
        <div className="settings-tab">
          <div className="settings-section">
            <h2>Portal Configuration</h2>

            <div className="setting-group">
              <label>Default Link Expiry (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={state.settings.defaultExpiryDays}
                onChange={(e) => updateSetting('defaultExpiryDays', parseInt(e.target.value))}
              />
              <small>How many days before magic links automatically expire</small>
            </div>

            <div className="setting-group">
              <label>Maximum Link Expiry (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={state.settings.maxExpiryDays}
                onChange={(e) => updateSetting('maxExpiryDays', parseInt(e.target.value))}
              />
              <small>Maximum expiry customers can be granted</small>
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={state.settings.autoCleanupEnabled}
                  onChange={(e) => updateSetting('autoCleanupEnabled', e.target.checked)}
                />
                Auto-Cleanup Expired Data
              </label>
              <small>Automatically delete expired links and sessions</small>
            </div>

            <div className="setting-group">
              <label>Auto-Cleanup Retention (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={state.settings.autoCleanupDays}
                onChange={(e) => updateSetting('autoCleanupDays', parseInt(e.target.value))}
                disabled={!state.settings.autoCleanupEnabled}
              />
              <small>How long to keep expired data before deletion</small>
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={state.settings.requireOTPForMultiJob}
                  onChange={(e) => updateSetting('requireOTPForMultiJob', e.target.checked)}
                />
                Require OTP for Multi-Job Access
              </label>
              <small>Customers must verify via OTP to see all their projects</small>
            </div>

            <div className="settings-actions">
              <button 
                className="btn-primary"
                onClick={saveSettings}
                disabled={state.saving}
              >
                {state.saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Magic Links Tab */}
      {state.activeTab === 'links' && (
        <div className="links-tab">
          <div className="tab-header">
            <h2>Active Magic Links</h2>
            <button 
              className="btn-primary"
              onClick={() => setState(prev => ({
                ...prev,
                sendLinkModal: { ...prev.sendLinkModal, show: true }
              }))}
            >
              + Send New Link
            </button>
          </div>

          {state.magicLinks.length === 0 ? (
            <p className="empty-message">No active magic links</p>
          ) : (
            <div className="links-table">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Purpose</th>
                    <th>Expires</th>
                    <th>Days Left</th>
                    <th>Accesses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.magicLinks.map(link => (
                    <tr key={link.id}>
                      <td>{link.client?.firstName} {link.client?.lastName}</td>
                      <td>{link.email}</td>
                      <td>{link.purpose}</td>
                      <td>{new Date(link.expiresAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</td>
                      <td>
                        <span className={`days-badge ${link.isExpiringsoon ? 'expiring' : ''}`}>
                          {link.remainingDays}
                        </span>
                      </td>
                      <td>{link.accessCount}</td>
                      <td>
                        <button 
                          className="btn-small"
                          onClick={() => resendLink(link.id)}
                        >
                          Resend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Active Sessions Tab */}
      {state.activeTab === 'sessions' && (
        <div className="sessions-tab">
          <h2>Active Portal Sessions</h2>

          {state.activeSessions.length === 0 ? (
            <p className="empty-message">No active sessions</p>
          ) : (
            <div className="sessions-table">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Started</th>
                    <th>Last Activity</th>
                    <th>Verified</th>
                    <th>Quotes</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.activeSessions.map(session => (
                    <tr key={session.id}>
                      <td>{session.client?.firstName} {session.client?.lastName}</td>
                      <td>{session.client?.email}</td>
                      <td>{new Date(session.createdAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</td>
                      <td>{new Date(session.lastActivityAt).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${session.isVerified ? 'verified' : 'unverified'}`}>
                          {session.isVerified ? '✓' : '✗'}
                        </span>
                      </td>
                      <td>{session.accessedQuotes}</td>
                      <td>{new Date(session.expiresAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</td>
                      <td>
                        <button 
                          className="btn-small btn-danger"
                          onClick={() => revokeSession(session.client.id)}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {state.activeTab === 'analytics' && (
        <div className="analytics-tab">
          <h2>Expiry Analytics</h2>

          {state.expiryAnalytics && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Expired Today</h3>
                <p className="analytics-value">{state.expiryAnalytics.expiredToday}</p>
              </div>
              <div className="analytics-card">
                <h3>Expiring Tomorrow</h3>
                <p className="analytics-value">{state.expiryAnalytics.expiringTomorrow}</p>
              </div>
              <div className="analytics-card">
                <h3>Expiring in 3 Days</h3>
                <p className="analytics-value">{state.expiryAnalytics.expiringIn3Days}</p>
              </div>
              <div className="analytics-card">
                <h3>Expiring in 7 Days</h3>
                <p className="analytics-value">{state.expiryAnalytics.expiringIn7Days}</p>
              </div>
            </div>
          )}

          <div className="cleanup-section">
            <h3>Data Maintenance</h3>
            <p>Run cleanup to delete expired links and sessions</p>
            <button 
              className="btn-danger"
              onClick={runCleanup}
            >
              Run Cleanup
            </button>
          </div>
        </div>
      )}

      {/* Send Link Modal */}
      {state.sendLinkModal.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button 
              className="modal-close"
              onClick={() => setState(prev => ({
                ...prev,
                sendLinkModal: { ...prev.sendLinkModal, show: false }
              }))}
            >
              ✕
            </button>

            <h2>Send Magic Link to Customer</h2>

            <div className="form-group">
              <label>Customer Email *</label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={state.sendLinkModal.email}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  sendLinkModal: { ...prev.sendLinkModal, email: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label>Customer ID *</label>
              <input
                type="number"
                placeholder="Customer ID"
                value={state.sendLinkModal.clientId}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  sendLinkModal: { ...prev.sendLinkModal, clientId: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label>Quote ID (Optional)</label>
              <input
                type="number"
                placeholder="Quote ID"
                value={state.sendLinkModal.quoteId}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  sendLinkModal: { ...prev.sendLinkModal, quoteId: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label>Expiry Duration (Days)</label>
              <input
                type="number"
                min="1"
                max={state.settings.maxExpiryDays}
                value={state.sendLinkModal.expiryDays}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  sendLinkModal: { ...prev.sendLinkModal, expiryDays: parseInt(e.target.value) }
                }))}
              />
              <small>Max: {state.settings.maxExpiryDays} days</small>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-primary"
                onClick={sendMagicLink}
              >
                Send Link
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setState(prev => ({
                  ...prev,
                  sendLinkModal: { ...prev.sendLinkModal, show: false }
                }))}
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

export default PortalAdminSettings;
