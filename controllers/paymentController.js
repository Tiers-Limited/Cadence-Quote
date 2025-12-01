// controllers/paymentController.js
const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { createCheckoutSession, retrieveSession, SUBSCRIPTION_PLANS } = require('../services/stripeService');
const sequelize = require('../config/database');
const { createAuditLog } = require('./auditLogController');

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
    if (!subscriptionPlan || !['basic', 'pro', 'enterprise'].includes(subscriptionPlan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan. Must be "basic", "pro", or "enterprise"'
      });
    }

    // Get user and tenant details
    const user = await User.findByPk(userId, {
      include: [{ model: Tenant, as: 'tenant' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const tenant = user.tenant;
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

    // Audit log
    await createAuditLog({
      tenantId,
      userId,
      action: 'Create Payment Session',
      category: 'payment',
      entityType: 'Payment',
      entityId: payment.id,
      changes: { subscriptionPlan, amount: planDetails.price },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

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

    // Ensure we have a Stripe customer
    let stripeCustomerId = session.customer;
    
    // If no customer was created (shouldn't happen with customer_creation: 'always')
    if (!stripeCustomerId) {
      console.log('No customer in session, creating one manually');
      const { createCustomer } = require('../services/stripeService');
      const user = await User.findByPk(userId);
      const customer = await createCustomer({
        email: user.email,
        name: user.fullName || `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId.toString(),
          tenantId: tenantId.toString()
        }
      });
      stripeCustomerId = customer.id;
    }

    // Update payment record
    await payment.update({
      status: 'paid',
      stripePaymentIntentId: session.payment_intent,
      stripeCustomerId: stripeCustomerId,
      paidAt: new Date(),
      metadata: {
        ...payment.metadata,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total / 100,
        currency: session.currency
      }
    }, { transaction });

    // Get plan details for MRR calculation
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];
    const currentDate = new Date();
    const trialEndDate = new Date(currentDate);
    trialEndDate.setDate(currentDate.getDate() + planDetails.trialDays);
    const currentPeriodEnd = new Date(currentDate);
    currentPeriodEnd.setMonth(currentDate.getMonth() + 1); // 1 month from now

    // Create Subscription record
    const subscription = await Subscription.create({
      tenantId,
      stripeSubscriptionId: session.subscription || `session_${session.id}`,
      stripePriceId: planDetails.priceId,
      stripeCustomerId: stripeCustomerId,
      tier: subscriptionPlan,
      status: 'trialing',
      currentPeriodStart: currentDate,
      currentPeriodEnd: currentPeriodEnd,
      trialStart: currentDate,
      trialEnd: trialEndDate,
      mrr: planDetails.price,
      quantity: 1,
      cancelAtPeriodEnd: false,
      metadata: {
        createdFrom: 'payment_confirmation',
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        registrationFlow: registration === 'true'
      }
    }, { transaction });

    // Link payment to subscription
    await payment.update({
      subscriptionId: subscription.id
    }, { transaction });

    // Update tenant subscription
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant) {
      await tenant.update({
        subscriptionPlan,
        stripeCustomerId: stripeCustomerId,
        paymentStatus: 'active',
        subscriptionExpiresAt: currentPeriodEnd,
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

    // Audit log
    await createAuditLog({
      tenantId,
      userId,
      action: 'Payment Confirmed & Subscription Created',
      category: 'payment',
      entityType: 'Payment',
      entityId: payment.id,
      changes: { 
        status: 'paid', 
        subscriptionPlan, 
        amount: payment.amount,
        subscriptionId: subscription.id,
        tier: subscription.tier,
        mrr: subscription.mrr
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log successful payment
    console.log('Payment successful:', {
      paymentId: payment.id,
      subscriptionId: subscription.id,
      userId,
      tenantId,
      subscriptionPlan,
      amount: payment.amount,
      mrr: subscription.mrr,
      trialEnd: subscription.trialEnd,
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

/**
 * Get Stripe payment session details (for resuming incomplete payments)
 * GET /api/payments/session/:sessionId
 */
const getPaymentSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Retrieve session from Stripe
    let session;
    try {
      session = await retrieveSession(sessionId);
    } catch (stripeError) {
      console.error('Stripe session retrieval error:', stripeError);
      // Any error retrieving the session means it's expired or invalid
      return res.status(410).json({
        success: false,
        message: 'Payment session has expired or is no longer available'
      });
    }

    if (!session) {
      return res.status(410).json({
        success: false,
        message: 'Payment session not found'
      });
    }

    // Check if session is still valid
    if (session.status === 'expired' || session.status === 'complete') {
      return res.status(410).json({
        success: false,
        message: 'Payment session has expired. Please start a new registration.'
      });
    }

    // Return session details
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        status: session.status,
        amount: session.amount_total,
        currency: session.currency
      }
    });

  } catch (error) {
    console.error('Get payment session error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment session'
    });
  }
};

module.exports = {
  getSubscriptionPlans,
  createPaymentSession,
  confirmStripePayment,
  getPaymentHistory,
  getPaymentDetails,
  getPaymentSession
};
