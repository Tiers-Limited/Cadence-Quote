// services/statusFlowService.js
// Phase 1 Status Flow Management Service
// Enforces automated and manual status transitions with guardrails

const Quote = require('../models/Quote');
const Job = require('../models/Job');
const { createAuditLog } = require('../controllers/auditLogController');

/**
 * Phase 1 Status Flow Service
 * Manages status transitions according to Phase 1 specification
 */
class StatusFlowService {
  
  /**
   * Valid status transitions for Quotes (Phase 1)
   */
  static QUOTE_STATUS_FLOW = {
    draft: ['sent'],
    sent: ['viewed', 'declined', 'expired'],
    viewed: ['accepted', 'declined', 'expired'],
    accepted: ['deposit_paid', 'declined'],
    rejected: [], // Can only be reopened by admin
    declined: [], // Can only be reopened by admin
    expired: [], // Can only be resent
    deposit_paid: [] // End of quote flow - transitions to Job
  };

  /**
   * Valid status transitions for Jobs (Phase 1)
   */
  static JOB_STATUS_FLOW = {
    accepted: ['deposit_paid'], // Auto when deposit paid
    pending_deposit: ['deposit_paid'], // Alias for accepted
    deposit_paid: ['scheduled', 'selections_pending'], // Manual scheduling
    selections_pending: ['selections_complete', 'scheduled'],
    selections_complete: ['scheduled'],
    scheduled: ['in_progress'], // Manual or auto on scheduled date
    in_progress: ['completed', 'paused'],
    paused: ['in_progress'],
    completed: ['closed', 'paid'],
    invoiced: ['paid', 'closed'],
    paid: ['closed'],
    closed: [], // Terminal state
    canceled: [], // Terminal state
    on_hold: ['scheduled', 'deposit_paid'] // Manual recovery
  };

  /**
   * Automated status transitions (no admin approval needed)
   */
  static AUTOMATED_QUOTE_STATUSES = ['sent', 'viewed', 'accepted', 'rejected', 'deposit_paid'];
  static AUTOMATED_JOB_STATUSES = ['accepted', 'deposit_paid'];

  /**
   * Manual status transitions (require admin action)
   */
  static MANUAL_QUOTE_STATUSES = [];
  static MANUAL_JOB_STATUSES = ['scheduled', 'in_progress', 'completed', 'closed'];

  /**
   * Check if status transition is valid
   */
  static canTransition(entityType, fromStatus, toStatus, isAdmin = false) {
    const flow = entityType === 'quote' 
      ? this.QUOTE_STATUS_FLOW 
      : this.JOB_STATUS_FLOW;

    // Terminal states cannot transition (except admin override)
    if (entityType === 'quote' && ['rejected', 'declined', 'expired'].includes(fromStatus)) {
      return isAdmin && toStatus === 'sent'; // Only admin can reopen
    }

    if (entityType === 'job' && ['closed', 'canceled'].includes(fromStatus)) {
      return isAdmin; // Only admin can override terminal states
    }

    const allowedTransitions = flow[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Transition Quote status (Phase 1 compliant)
   */
  static async transitionQuoteStatus(quote, newStatus, options = {}) {
    const {
      userId = null,
      tenantId,
      reason = null,
      isAdmin = false,
      paymentIntentId = null,
      paymentMethod = null,
      notes = null,
      req = null
    } = options;

    const oldStatus = quote.status;
    const transaction = options.transaction || null;

    // Validate transition
    if (!this.canTransition('quote', oldStatus, newStatus, isAdmin)) {
      throw new Error(
        `Invalid status transition from "${oldStatus}" to "${newStatus}". ` +
        `Only admin can reopen rejected/declined quotes.`
      );
    }

    // Special handling for automated transitions
    const updates = { status: newStatus };
    const auditDetails = { oldStatus, newStatus, quoteNumber: quote.quoteNumber };

    switch (newStatus) {
      case 'sent':
        updates.sentAt = new Date();
        auditDetails.action = 'quote_sent';
        break;

      case 'viewed':
        // Only set on first view (idempotent) - Phase 1: Multiple views don't change status
        if (!quote.viewedAt && quote.status === 'sent') {
          updates.viewedAt = new Date();
          auditDetails.action = 'quote_viewed';
        } else if (quote.viewedAt) {
          // Multiple views - log but don't change status (Phase 1 requirement)
          await createAuditLog({
            userId,
            tenantId,
            action: 'quote_viewed_multiple',
            category: 'quote',
            entityType: 'Quote',
            entityId: quote.id,
            metadata: { ...auditDetails, subsequentView: true, viewedAt: quote.viewedAt },
            ipAddress: req?.ip || req?.connection?.remoteAddress || null,
            userAgent: req?.headers?.['user-agent'] || null,
            transaction
          });
          return quote; // No status change
        } else {
          // Already in viewed state or not in sent state - no change
          return quote;
        }
        break;

      case 'accepted':
        updates.acceptedAt = new Date();
        updates.approvedAt = new Date();
        auditDetails.action = 'quote_accepted';
        break;

      case 'rejected':
      case 'declined':
        updates.declinedAt = new Date();
        if (reason) updates.declineReason = reason;
        auditDetails.action = 'quote_declined';
        auditDetails.reason = reason;
        break;

      case 'deposit_paid':
        updates.depositVerified = true;
        updates.depositVerifiedAt = new Date();
        if (paymentIntentId) updates.depositTransactionId = paymentIntentId;
        if (paymentMethod) updates.depositPaymentMethod = paymentMethod;
        auditDetails.action = 'deposit_paid';
        auditDetails.paymentMethod = paymentMethod || 'stripe';
        auditDetails.paymentIntentId = paymentIntentId;
        break;

      case 'expired':
        auditDetails.action = 'quote_expired';
        break;
    }

    // Save updates
    if (transaction) {
      await quote.update(updates, { transaction });
    } else {
      await quote.update(updates);
    }

    // Create audit log
    await createAuditLog({
      userId,
      tenantId,
      action: auditDetails.action || 'quote_status_changed',
      category: 'quote',
      entityType: 'Quote',
      entityId: quote.id,
      metadata: auditDetails,
      ipAddress: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.headers?.['user-agent'] || null,
      transaction
    });

    return quote;
  }

  /**
   * Transition Job status (Phase 1 compliant)
   */
  static async transitionJobStatus(job, newStatus, options = {}) {
    const {
      userId = null,
      tenantId,
      reason = null,
      isAdmin = false,
      scheduledStartDate = null,
      scheduledEndDate = null,
      req = null
    } = options;

    const oldStatus = job.status;
    const transaction = options.transaction || null;

    // Validate transition
    if (!this.canTransition('job', oldStatus, newStatus, isAdmin)) {
      throw new Error(
        `Invalid status transition from "${oldStatus}" to "${newStatus}". ` +
        `This transition requires admin approval or is not allowed.`
      );
    }

    // Manual statuses require admin
    if (this.MANUAL_JOB_STATUSES.includes(newStatus) && !isAdmin) {
      throw new Error(
        `Status "${newStatus}" requires admin action. Only administrators can set this status.`
      );
    }

    const updates = { status: newStatus };
    const auditDetails = { oldStatus, newStatus, jobNumber: job.jobNumber };

    switch (newStatus) {
      case 'deposit_paid':
        updates.depositPaid = true;
        updates.depositPaidAt = new Date();
        auditDetails.action = 'job_deposit_paid';
        break;

      case 'scheduled':
        if (scheduledStartDate) updates.scheduledStartDate = scheduledStartDate;
        if (scheduledEndDate) updates.scheduledEndDate = scheduledEndDate;
        if (!isAdmin) {
          throw new Error('Scheduling requires admin action');
        }
        auditDetails.action = 'job_scheduled';
        auditDetails.scheduledStartDate = scheduledStartDate;
        auditDetails.scheduledEndDate = scheduledEndDate;
        break;

      case 'in_progress':
        updates.actualStartDate = updates.actualStartDate || new Date();
        if (!isAdmin) {
          throw new Error('Starting job requires admin action');
        }
        auditDetails.action = 'job_started';
        break;

      case 'completed':
        if (!isAdmin) {
          throw new Error('Completing job requires admin action');
        }
        updates.actualEndDate = updates.actualEndDate || new Date();
        auditDetails.action = 'job_completed';
        break;

      case 'closed':
        if (!isAdmin) {
          throw new Error('Closing job requires admin action');
        }
        auditDetails.action = 'job_closed';
        break;

      case 'paused':
        auditDetails.action = 'job_paused';
        auditDetails.reason = reason;
        break;
    }

    // Save updates
    if (transaction) {
      await job.update(updates, { transaction });
    } else {
      await job.update(updates);
    }

    // Create audit log
    await createAuditLog({
      userId,
      tenantId,
      action: auditDetails.action || 'job_status_changed',
      category: 'job',
      entityType: 'Job',
      entityId: job.id,
      metadata: auditDetails,
      ipAddress: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.headers?.['user-agent'] || null,
      transaction
    });

    return job;
  }

  /**
   * Handle Stripe payment success (auto transition to deposit_paid)
   */
  static async handlePaymentSuccess(quoteId, paymentIntentId, options = {}) {
    const { tenantId, userId = null, req = null } = options;
    const transaction = options.transaction || null;

    const quote = await Quote.findByPk(quoteId, { transaction });
    if (!quote) {
      throw new Error('Quote not found');
    }

    // Only transition if status is 'accepted'
    if (quote.status !== 'accepted') {
      throw new Error(
        `Quote must be in "accepted" status to receive payment. Current status: ${quote.status}`
      );
    }

    // Auto-transition to deposit_paid
    await this.transitionQuoteStatus(
      quote,
      'deposit_paid',
      {
        userId,
        tenantId,
        isAdmin: false, // Automated
        paymentIntentId,
        paymentMethod: 'stripe',
        req,
        transaction
      }
    );

    return quote;
  }

  /**
   * Admin action: Mark deposit paid (Non-Stripe)
   */
  static async markDepositPaidManual(quoteId, options = {}) {
    const {
      userId,
      tenantId,
      paymentMethod = 'cash',
      notes = null,
      req = null
    } = options;

    if (!userId) {
      throw new Error('Admin user ID required for manual deposit confirmation');
    }

    const transaction = options.transaction || null;
    const quote = await Quote.findByPk(quoteId, { transaction });

    if (!quote) {
      throw new Error('Quote not found');
    }

    if (quote.status !== 'accepted') {
      throw new Error(
        `Quote must be in "accepted" status. Current status: ${quote.status}`
      );
    }

    // Transition with admin flag
    await this.transitionQuoteStatus(
      quote,
      'deposit_paid',
      {
        userId,
        tenantId,
        isAdmin: true,
        paymentMethod,
        notes,
        req,
        transaction
      }
    );

    return quote;
  }

  /**
   * Admin action: Reopen rejected/declined quote
   */
  static async reopenQuote(quoteId, options = {}) {
    const { userId, tenantId, reason = null, req = null } = options;

    if (!userId) {
      throw new Error('Admin user ID required to reopen quote');
    }

    const quote = await Quote.findByPk(quoteId);

    if (!['rejected', 'declined', 'expired'].includes(quote.status)) {
      throw new Error(
        `Quote status "${quote.status}" cannot be reopened. Only rejected/declined/expired quotes can be reopened.`
      );
    }

    // Transition back to 'sent' (admin override)
    await this.transitionQuoteStatus(
      quote,
      'sent',
      {
        userId,
        tenantId,
        isAdmin: true,
        reason,
        req
      }
    );

    // Create special audit log for reopen
    await createAuditLog({
      userId,
      tenantId,
      action: 'quote_reopened',
      category: 'quote',
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        previousStatus: quote.status,
        reason,
        adminAction: true
      },
      ipAddress: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.headers?.['user-agent'] || null
    });

    return quote;
  }

  /**
   * Check if quote can advance to next status
   */
  static getNextAllowedStatuses(entityType, currentStatus, isAdmin = false) {
    const flow = entityType === 'quote' 
      ? this.QUOTE_STATUS_FLOW 
      : this.JOB_STATUS_FLOW;

    return flow[currentStatus] || [];
  }

  /**
   * Validate status before update (guardrail)
   */
  static validateStatusUpdate(entityType, oldStatus, newStatus, isAdmin = false) {
    if (oldStatus === newStatus) {
      return { valid: true, message: 'Status unchanged' };
    }

    const canTransition = this.canTransition(entityType, oldStatus, newStatus, isAdmin);
    
    if (!canTransition) {
      const allowed = this.getNextAllowedStatuses(entityType, oldStatus, isAdmin);
      return {
        valid: false,
        message: `Cannot transition from "${oldStatus}" to "${newStatus}". ` +
                 `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`
      };
    }

    return { valid: true };
  }
}

module.exports = StatusFlowService;

