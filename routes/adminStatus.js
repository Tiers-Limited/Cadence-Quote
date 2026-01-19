// routes/adminStatus.js
// Admin-only status management routes for Phase 1 manual actions

const express = require('express');
const router = express.Router();
const adminStatusController = require('../controllers/adminStatusController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// All routes require authentication and contractor_admin role
router.use(auth);
router.use(requireRole('contractor_admin'));

/**
 * POST /api/v1/admin/status/quotes/:quoteId/mark-deposit-paid
 * Contractor Admin: Mark deposit paid (Non-Stripe payment)
 */
router.post('/quotes/:quoteId/mark-deposit-paid', adminStatusController.markDepositPaidManual);

/**
 * POST /api/v1/admin/status/quotes/:quoteId/reopen
 * Contractor Admin: Reopen rejected/declined quote
 */
router.post('/quotes/:quoteId/reopen', adminStatusController.reopenQuote);

/**
 * PATCH /api/v1/admin/status/jobs/:jobId/status
 * Contractor Admin: Update job status (Manual actions: scheduled, in_progress, completed, closed)
 */
router.patch('/jobs/:jobId/status', adminStatusController.updateJobStatusManual);

/**
 * POST /api/v1/admin/status/quotes/:quoteId/sync-payment
 * Contractor Admin: Sync payment status (retry Stripe webhook or manual verification)
 */
router.post('/quotes/:quoteId/sync-payment', adminStatusController.syncPaymentStatus);

/**
 * POST /api/v1/admin/status/jobs/:jobId/override-status
 * Contractor Admin: Override job status (with confirmation and reason)
 */
router.post('/jobs/:jobId/override-status', adminStatusController.overrideJobStatus);

module.exports = router;

