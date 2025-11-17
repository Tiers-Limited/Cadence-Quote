// routes/subscriptions.js
const express = require('express');
const router = express.Router();
const { auth: verifyToken, authorize } = require('../middleware/auth');
const {
  getAllSubscriptions,
  getSubscriptionStats,
  updateSubscription,
  cancelSubscription,
  retryFailedPayment,
  processRefund,
  getStripeIntegrationStatus
} = require('../controllers/subscriptionController');

// All routes require authentication and admin role
router.use(verifyToken);
router.use(authorize(['admin']));

/**
 * @route   GET /api/subscriptions
 * @desc    Get all subscriptions with filters and pagination
 * @access  Admin only
 * @query   page, limit, status, tier, search
 */
router.get('/', getAllSubscriptions);

/**
 * @route   GET /api/subscriptions/stats
 * @desc    Get subscription statistics (MRR, churn, trials, etc.)
 * @access  Admin only
 */
router.get('/stats', getSubscriptionStats);

/**
 * @route   GET /api/subscriptions/stripe-status
 * @desc    Get Stripe integration status
 * @access  Admin only
 */
router.get('/stripe-status', getStripeIntegrationStatus);

/**
 * @route   PUT /api/subscriptions/:id
 * @desc    Update a subscription (tier, quantity, etc.)
 * @access  Admin only
 * @body    tier, quantity, cancelAtPeriodEnd
 */
router.put('/:id', updateSubscription);

/**
 * @route   POST /api/subscriptions/:id/cancel
 * @desc    Cancel a subscription
 * @access  Admin only
 * @body    immediate (boolean)
 */
router.post('/:id/cancel', cancelSubscription);

/**
 * @route   POST /api/subscriptions/:id/retry
 * @desc    Retry a failed payment for a subscription
 * @access  Admin only
 */
router.post('/:id/retry', retryFailedPayment);

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Process a refund for a payment
 * @access  Admin only
 * @body    amount, reason
 */
router.post('/payments/:id/refund', processRefund);

module.exports = router;
