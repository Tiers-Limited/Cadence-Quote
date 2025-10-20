// routes/payments.js
var express = require('express');
var router = express.Router();
const {
  getSubscriptionPlans,
  createPaymentSession,
  confirmStripePayment,
  getPaymentHistory,
  getPaymentDetails
} = require('../controllers/paymentController');
const { auth, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/payments/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/plans', getSubscriptionPlans);

/**
 * @route   POST /api/payments/create-checkout-session
 * @desc    Create Stripe checkout session for payment
 * @access  Private (Authenticated users only)
 */
router.post('/create-checkout-session', auth, createPaymentSession);

/**
 * @route   GET /api/payments/confirm
 * @desc    Confirm Stripe payment after successful checkout
 * @access  Public (Called by Stripe redirect)
 * @query   sessionId - Stripe checkout session ID
 */
router.get('/confirm', confirmStripePayment);

/**
 * @route   GET /api/payments/history
 * @desc    Get payment history for current tenant
 * @access  Private (Authenticated users only)
 */
router.get('/history', auth, getPaymentHistory);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get single payment details
 * @access  Private (Authenticated users only)
 */
router.get('/:paymentId', auth, getPaymentDetails);

module.exports = router;
