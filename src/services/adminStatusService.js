// services/adminStatusService.js
// API service for contractor admin status management actions

import { apiService } from './apiService';

export const adminStatusService = {
  /**
   * Mark deposit as paid (Non-Stripe payment)
   */
  async markDepositPaid(quoteId, { paymentMethod = 'cash', notes = null }) {
    try {
      const response = await apiService.post(`/admin/status/quotes/${quoteId}/mark-deposit-paid`, {
        paymentMethod,
        notes
      });
      return response;
    } catch (error) {
      console.error('Mark deposit paid error:', error);
      throw error;
    }
  },

  /**
   * Reopen rejected/declined quote
   */
  async reopenQuote(quoteId, { reason = null } = {}) {
    try {
      const response = await apiService.post(`/admin/status/quotes/${quoteId}/reopen`, {
        reason
      });
      return response;
    } catch (error) {
      console.error('Reopen quote error:', error);
      throw error;
    }
  },

  /**
   * Update job status (manual admin action)
   */
  async updateJobStatus(jobId, { 
    status, 
    scheduledStartDate = null, 
    scheduledEndDate = null, 
    reason = null 
  }) {
    try {
      const response = await apiService.patch(`/admin/status/jobs/${jobId}/status`, {
        status,
        scheduledStartDate,
        scheduledEndDate,
        reason
      });
      return response;
    } catch (error) {
      console.error('Update job status error:', error);
      throw error;
    }
  },

  /**
   * Sync payment status (retry Stripe webhook or manual verification)
   */
  async syncPaymentStatus(quoteId, { paymentIntentId = null } = {}) {
    try {
      const response = await apiService.post(`/admin/status/quotes/${quoteId}/sync-payment`, {
        paymentIntentId
      });
      return response;
    } catch (error) {
      console.error('Sync payment status error:', error);
      throw error;
    }
  },

  /**
   * Override job status (with confirmation)
   */
  async overrideJobStatus(jobId, { status, reason, confirmOverride = true }) {
    try {
      const response = await apiService.post(`/admin/status/jobs/${jobId}/override-status`, {
        status,
        reason,
        confirmOverride
      });
      return response;
    } catch (error) {
      console.error('Override job status error:', error);
      throw error;
    }
  }
};

