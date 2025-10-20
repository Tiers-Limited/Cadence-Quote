// controllers/paymentController.js
const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { createCheckoutSession, retrieveSession, SUBSCRIPTION_PLANS } = require('../services/stripeService');
const sequelize = require('../config/database');

/**
 * Get available subscription plans
 * GET /api/payments/plans
 */
const getSubscriptionPlans = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        plans: SUBSCRIPTION_PLANS
      }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans'
    });
  }
};

/**
 * Create Stripe Checkout Session
 * POST /api/payments/create-checkout-session
 */
const createPaymentSession = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { subscriptionPlan } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Validation
    if (!subscriptionPlan || !['starter', 'pro'].includes(subscriptionPlan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan. Must be "starter" or "pro"'
      });
    }

    // Get user and tenant details
    const user = await User.findByPk(userId, {
      include: [{ model: Tenant }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const tenant = user.Tenant;
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];

    // Create payment record
    const payment = await Payment.create({
      tenantId,
      userId,
      subscriptionPlan,
      amount: planDetails.price,
      currency: 'usd',
      status: 'pending',
      description: `${planDetails.name} - ${tenant.companyName}`,
      metadata: {
        planFeatures: planDetails.features
      }
    }, { transaction });

    // Create Stripe Checkout Session
    const BACKEND_URL = process.env.BACKEND_URL ;
    const FRONTEND_URL = process.env.FRONTEND_URL;

    const session = await createCheckoutSession({
      userId,
      tenantId,
      subscriptionPlan,
      email: user.email,
      successUrl: `${BACKEND_URL}/api/payments/confirm?sessionId={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${FRONTEND_URL}/payment-cancel`
    });

    // Update payment with session ID
    await payment.update({
      stripeSessionId: session.sessionId
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Checkout session created successfully',
      data: {
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
        paymentId: payment.id,
        amount: session.amount
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Confirm Stripe Payment
 * GET /api/payments/confirm?sessionId={CHECKOUT_SESSION_ID}
 */
const confirmStripePayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { sessionId, registration } = req.query;

    if (!sessionId) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${FRONTEND_URL}/payment-cancel?error=missing_session_id`);
    }

    // Retrieve session from Stripe
    const session = await retrieveSession(sessionId);
    console.log("Session",session)

    // Check payment status
    if (session.payment_status !== 'paid') {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${FRONTEND_URL}/payment-cancel?error=payment_not_completed`);
    }

    const { userId, tenantId, subscriptionPlan } = session.metadata;

    if (!userId || !tenantId || !subscriptionPlan) {
      await transaction.rollback();
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${FRONTEND_URL}/payment-cancel?error=missing_metadata`);
    }

    // Find payment record
    const payment = await Payment.findOne({
      where: {
        stripeSessionId: sessionId
      }
    });

    if (!payment) {
      await transaction.rollback();
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${FRONTEND_URL}/payment-cancel?error=payment_record_not_found`);
    }

    // Check if payment already processed to avoid double processing
    if (payment.status === 'paid') {
      console.log('Payment already processed:', { paymentId: payment.id, sessionId });
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
      if (registration === 'true') {
        return res.redirect(`${FRONTEND_URL}/registration-success?plan=${subscriptionPlan}&already_processed=true`);
      } else {
        return res.redirect(`${FRONTEND_URL}/payment-success?plan=${subscriptionPlan}&already_processed=true`);
      }
    }

    // Update payment record
    await payment.update({
      status: 'paid',
      stripePaymentIntentId: session.payment_intent,
      stripeCustomerId: session.customer,
      paidAt: new Date(),
      metadata: {
        ...payment.metadata,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total / 100,
        currency: session.currency
      }
    }, { transaction });

    // Update tenant subscription
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant) {
      const subscriptionExpiry = new Date();
      subscriptionExpiry.setMonth(subscriptionExpiry.getMonth() + 1); // 1 month from now

      await tenant.update({
        subscriptionPlan,
        stripeCustomerId: session.customer,
        paymentStatus: 'active',
        subscriptionExpiresAt: subscriptionExpiry,
        isActive: true // Activate tenant for registration flow
      }, { transaction });
    }

    // Update user status
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({
        isActive: true
      }, { transaction });
    }

    await transaction.commit();

    // Log successful payment
    console.log('Payment successful:', {
      paymentId: payment.id,
      userId,
      tenantId,
      subscriptionPlan,
      amount: payment.amount,
      registrationFlow: registration === 'true',
      timestamp: new Date().toISOString()
    });

    // Redirect based on flow type
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
    if (registration === 'true') {
      // Registration flow - redirect to registration success
      return res.redirect(`${FRONTEND_URL}/registration-success?sessionId=${sessionId}&plan=${subscriptionPlan}`);
    } else {
      // Regular payment flow
      return res.redirect(`${FRONTEND_URL}/payment-success?sessionId=${sessionId}&plan=${subscriptionPlan}`);
    }

  } catch (error) {
    await transaction.rollback();
    console.error('Confirm payment error:', error);
    
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${FRONTEND_URL}/payment-cancel?error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Get payment history for tenant
 * GET /api/payments/history
 */
const getPaymentHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: { tenantId },
      include: [
        {
          model: User,
          attributes: ['id', 'fullName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number.parseInt(limit, 10),
      offset: Number.parseInt(offset, 10)
    });

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total: count,
          page: Number.parseInt(page, 10),
          limit: Number.parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

/**
 * Get single payment details
 * GET /api/payments/:paymentId
 */
const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const tenantId = req.user.tenantId;

    const payment = await Payment.findOne({
      where: {
        id: paymentId,
        tenantId
      },
      include: [
        {
          model: User,
          attributes: ['id', 'fullName', 'email']
        },
        {
          model: Tenant,
          attributes: ['id', 'companyName', 'subscriptionPlan']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};

module.exports = {
  getSubscriptionPlans,
  createPaymentSession,
  confirmStripePayment,
  getPaymentHistory,
  getPaymentDetails
};
