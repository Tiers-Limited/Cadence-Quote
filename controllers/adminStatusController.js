// controllers/adminStatusController.js
// Admin-only status management endpoints for Phase 1 manual actions

const Quote = require('../models/Quote');
const Job = require('../models/Job');
const StatusFlowService = require('../services/statusFlowService');
const { createAuditLog } = require('./auditLogController');

/**
 * Contractor Admin: Mark deposit paid (Non-Stripe payment)
 * POST /api/v1/admin/status/quotes/:quoteId/mark-deposit-paid
 */
exports.markDepositPaidManual = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { paymentMethod = 'cash', notes = null } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const quote = await Quote.findOne({
      where: { id: quoteId, tenantId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Use Phase 1 status flow
    await StatusFlowService.markDepositPaidManual(quoteId, {
      userId,
      tenantId,
      paymentMethod,
      notes,
      req
    });

    // Reload quote to get updated status
    await quote.reload();

    res.json({
      success: true,
      message: 'Deposit marked as paid',
      data: quote
    });
  } catch (error) {
    console.error('Mark deposit paid error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark deposit as paid'
    });
  }
};

/**
 * Contractor Admin: Reopen rejected/declined quote
 * POST /api/v1/admin/status/quotes/:quoteId/reopen
 */
exports.reopenQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { reason = null } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const quote = await Quote.findOne({
      where: { id: quoteId, tenantId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Use Phase 1 status flow
    await StatusFlowService.reopenQuote(quoteId, {
      userId,
      tenantId,
      reason,
      req
    });

    // Reload quote
    await quote.reload();

    res.json({
      success: true,
      message: 'Quote reopened successfully',
      data: quote
    });
  } catch (error) {
    console.error('Reopen quote error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reopen quote'
    });
  }
};

/**
 * Contractor Admin: Update job status (Manual actions only)
 * PATCH /api/v1/admin/status/jobs/:jobId/status
 */
exports.updateJobStatusManual = async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      status,
      scheduledStartDate = null,
      scheduledEndDate = null,
      reason = null
    } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({
      where: { id: jobId, tenantId }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Validate manual status requirement
    if (!StatusFlowService.MANUAL_JOB_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status "${status}" is not a manual status. Use the appropriate endpoint.`
      });
    }

    // Use Phase 1 status flow
    await StatusFlowService.transitionJobStatus(job, status, {
      userId,
      tenantId,
      isAdmin: true,
      scheduledStartDate,
      scheduledEndDate,
      reason,
      req
    });

    // Reload job
    await job.reload();

    res.json({
      success: true,
      message: `Job status updated to "${status}"`,
      data: job
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update job status'
    });
  }
};

/**
 * Contractor Admin: Sync payment status (retry Stripe webhook or manual verification)
 * POST /api/v1/admin/status/quotes/:quoteId/sync-payment
 */
exports.syncPaymentStatus = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { paymentIntentId } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const quote = await Quote.findOne({
      where: { id: quoteId, tenantId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // If payment intent provided, verify with Stripe
    if (paymentIntentId) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded' && quote.status === 'accepted') {
        await StatusFlowService.handlePaymentSuccess(quoteId, paymentIntentId, {
          userId,
          tenantId,
          req
        });

        await quote.reload();

        res.json({
          success: true,
          message: 'Payment status synced - deposit marked as paid',
          data: quote
        });
      } else {
        res.status(400).json({
          success: false,
          message: `Payment intent status: ${paymentIntent.status}. Cannot mark as paid.`
        });
      }
    } else {
      // Manual sync - just verify current status
      res.json({
        success: true,
        message: 'Current payment status retrieved',
        data: {
          quoteId: quote.id,
          status: quote.status,
          depositVerified: quote.depositVerified,
          depositVerifiedAt: quote.depositVerifiedAt,
          depositTransactionId: quote.depositTransactionId
        }
      });
    }
  } catch (error) {
    console.error('Sync payment error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to sync payment status'
    });
  }
};

/**
 * Contractor Admin: Override job status (with confirmation and reason)
 * POST /api/v1/admin/status/jobs/:jobId/override-status
 */
exports.overrideJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, reason, confirmOverride = false } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    if (!confirmOverride) {
      return res.status(400).json({
        success: false,
        message: 'Override confirmation required. Set confirmOverride: true'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason required for status override'
      });
    }

    const job = await Job.findOne({
      where: { id: jobId, tenantId }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const oldStatus = job.status;

    // Direct update with override flag (bypasses normal flow)
    await job.update({ status });

    // Create audit log with override flag
    await createAuditLog({
      userId,
      tenantId,
      action: 'job_status_overridden',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: {
        oldStatus,
        newStatus: status,
        reason,
        override: true,
        adminAction: true,
        jobNumber: job.jobNumber
      },
      req
    });

    await job.reload();

    res.json({
      success: true,
      message: 'Job status overridden successfully',
      data: job,
      warning: 'This was an admin override. Normal status flow was bypassed.'
    });
  } catch (error) {
    console.error('Override job status error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to override job status'
    });
  }
};

module.exports = exports;

