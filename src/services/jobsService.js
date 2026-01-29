// services/jobsService.js
// API service for job management

import { apiService } from './apiService';

export const jobsService = {
  /**
   * Get all jobs with filtering and pagination
   */
  async getAllJobs(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.status) queryParams.append('status', params.status);
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
      if (params.search) queryParams.append('search', params.search);

      const response = await apiService.get(`/jobs?${queryParams.toString()}`);
      return response;
    } catch (error) {
      console.error('Get all jobs error:', error);
      throw error;
    }
  },

  /**
   * Get single job by ID
   */
  async getJobById(jobId) {
    try {
      const response = await apiService.get(`/jobs/${jobId}`);
      return response;
    } catch (error) {
      console.error('Get job error:', error);
      throw error;
    }
  },

  /**
   * Update job scheduling
   */
  async updateJobSchedule(jobId, scheduleData) {
    try {
      const response = await apiService.patch(`/jobs/${jobId}/schedule`, scheduleData);
      return response;
    } catch (error) {
      console.error('Update job schedule error:', error);
      throw error;
    }
  },

  /**
   * Update job status
   */
  async updateJobStatus(jobId, status, notes = null) {
    try {
      const response = await apiService.patch(`/jobs/${jobId}/status`, {
        status,
        notes
      });
      return response;
    } catch (error) {
      console.error('Update job status error:', error);
      throw error;
    }
  },

  /**
   * Update area progress for Job Progress Tracker
   * Supports all pricing schemes
   */
  async updateAreaProgress(jobId, progressData) {
    try {
      const response = await apiService.post(`/jobs/${jobId}/area-progress`, progressData);
      return response;
    } catch (error) {
      console.error('Update area progress error:', error);
      throw error;
    }
  },

  /**
   * Contractor: Approve customer selections for a job
   */
  async approveSelections(jobId) {
    try {
      const response = await apiService.patch(`/jobs/${jobId}/approve-selections`);
      return response;
    } catch (error) {
      console.error('Approve selections error:', error);
      throw error;
    }
  },

  /**
   * Contractor: Toggle job visibility in customer portal
   */
  async setJobVisibility(jobId, visible) {
    try {
      const response = await apiService.patch(`/jobs/${jobId}/visibility`, { visible });
      return response;
    } catch (error) {
      console.error('Set job visibility error:', error);
      throw error;
    }
  },

  /**
   * Record lost job reason (for Lost Job Intelligence)
   */
  async recordLostJobReason(jobId, lostReason, lostReasonDetails = null) {
    try {
      const response = await apiService.post(`/jobs/${jobId}/lost-reason`, {
        lostReason,
        lostReasonDetails
      });
      return response;
    } catch (error) {
      console.error('Record lost job reason error:', error);
      throw error;
    }
  },

  /**
   * Get job calendar events
   */
  async getJobCalendar(startDate = null, endDate = null) {
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const response = await apiService.get(`/jobs/calendar?${queryParams.toString()}`);
      return response;
    } catch (error) {
      console.error('Get job calendar error:', error);
      throw error;
    }
  },

  /**
   * Get job statistics
   */
  async getJobStats() {
    try {
      const response = await apiService.get('/jobs/stats');
      return response;
    } catch (error) {
      console.error('Get job stats error:', error);
      throw error;
    }
  },

  /**
   * Get status display label
   */
  getStatusLabel(status) {
    const labels = {
      'accepted': 'Accepted - Awaiting Deposit',
      'pending_deposit': 'Pending Deposit',
      'deposit_paid': 'Deposit Paid',
      'selections_pending': 'Selections Pending',
      'selections_complete': 'Selections Complete',
      'scheduled': 'Scheduled',
      'in_progress': 'In Progress',
      'paused': 'Paused',
      'completed': 'Completed',
      'invoiced': 'Invoiced',
      'paid': 'Paid',
      'canceled': 'Canceled',
      'on_hold': 'On Hold'
    };
    return labels[status] || status;
  },

  /**
   * Get status color for display
   */
  getStatusColor(status) {
    const colors = {
      'accepted': 'orange',
      'pending_deposit': 'orange',
      'deposit_paid': 'blue',
      'selections_pending': 'gold',
      'selections_complete': 'cyan',
      'scheduled': 'purple',
      'in_progress': 'processing',
      'paused': 'default',
      'completed': 'success',
      'invoiced': 'lime',
      'paid': 'green',
      'canceled': 'error',
      'on_hold': 'warning'
    };
    return colors[status] || 'default';
  },

  /**
   * Get area status label
   */
  getAreaStatusLabel(status) {
    const labels = {
      'not_started': 'Not Started',
      'prepped': 'Prepped',
      'in_progress': 'In Progress',
      'touch_ups': 'Touch-Ups',
      'completed': 'Completed'
    };
    return labels[status] || status;
  },

  /**
   * Get area status color
   */
  getAreaStatusColor(status) {
    const colors = {
      'not_started': 'default',
      'prepped': 'blue',
      'in_progress': 'processing',
      'touch_ups': 'warning',
      'completed': 'success'
    };
    return colors[status] || 'default';
  },

  /**
   * Get lost reason label
   */
  getLostReasonLabel(reason) {
    const labels = {
      'budget_mismatch': 'Budget didn\'t align with expectations',
      'chose_competitor': 'Chose a different contractor',
      'timing_changed': 'Timing or priorities changed',
      'scope_misalignment': 'Scope or details weren\'t fully aligned',
      'confidence_issues': 'Needed more confidence before moving forward',
      'project_paused': 'Decided to pause the project',
      'other': 'Other'
    };
    return labels[reason] || reason;
  },

  /**
   * Get job documents
   */
  async getJobDocuments(jobId) {
    try {
      const response = await apiService.get(`/jobs/${jobId}/documents`);
      return response;
    } catch (error) {
      console.error('Get job documents error:', error);
      throw error;
    }
  },

  /**
   * Download job document
   */
  async downloadJobDocument(jobId, documentType) {
    try {
      const response = await apiService.get(
        `/jobs/${jobId}/documents/${documentType}`,
        null,
        { responseType: 'blob' }
      );
      return response;
    } catch (error) {
      console.error('Download job document error:', error);
      throw error;
    }
  },

  /**
   * Generate job documents
   */
  async generateJobDocuments(jobId) {
    try {
      const response = await apiService.post(`/jobs/${jobId}/documents/generate`);
      return response;
    } catch (error) {
      console.error('Generate job documents error:', error);
      throw error;
    }
  }
};

export default jobsService;
