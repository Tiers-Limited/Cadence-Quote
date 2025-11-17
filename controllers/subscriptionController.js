// controllers/subscriptionController.js
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const { 
  createSubscription, 
  updateSubscription: updateStripeSubscription,
  cancelSubscription: cancelStripeSubscription,
  retrieveSubscription,
  listSubscriptions: listStripeSubscriptions,
  calculateMRR,
  refundPayment,
  SUBSCRIPTION_PLANS
} = require('../services/stripeService');
const { Op } = require('sequelize');

/**
 * Get all subscriptions with filters and pagination
 */
const getAllSubscriptions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      tier, 
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (tier) {
      where.tier = tier;
    }

    // Search by tenant name or email
    let tenantWhere = {};
    if (search) {
      tenantWhere = {
        [Op.or]: [
          { companyName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ]
      };
    }

    const { count, rows: subscriptions } = await Subscription.findAndCountAll({
      where,
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'companyName', 'email', 'phoneNumber', 'status'],
          where: Object.keys(tenantWhere).length > 0 ? tenantWhere : undefined
        }
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          total: count,
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve subscriptions',
      error: error.message 
    });
  }
};

/**
 * Get subscription statistics (MRR, trials, churn, etc.)
 */
const getSubscriptionStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all active and trialing subscriptions
    const activeSubscriptions = await Subscription.findAll({
      where: {
        status: {
          [Op.in]: ['active', 'trialing']
        }
      }
    });

    // Calculate total MRR
    const totalMRR = calculateMRR(activeSubscriptions);

    // Get trialing subscriptions
    const trialingCount = await Subscription.count({
      where: { status: 'trialing' }
    });

    // Get active subscriptions count
    const activeCount = await Subscription.count({
      where: { status: 'active' }
    });

    // Get subscriptions by tier
    const tierBreakdown = await Subscription.findAll({
      attributes: [
        'tier',
        [Subscription.sequelize.fn('COUNT', Subscription.sequelize.col('id')), 'count'],
        [Subscription.sequelize.fn('SUM', Subscription.sequelize.col('mrr')), 'revenue']
      ],
      where: {
        status: {
          [Op.in]: ['active', 'trialing']
        }
      },
      group: ['tier'],
      raw: true
    });

    // Get new subscriptions this month
    const newSubscriptionsThisMonth = await Subscription.count({
      where: {
        createdAt: {
          [Op.gte]: startOfMonth
        }
      }
    });

    // Get canceled subscriptions this month (churn)
    const canceledThisMonth = await Subscription.count({
      where: {
        status: 'canceled',
        canceledAt: {
          [Op.gte]: startOfMonth
        }
      }
    });

    // Calculate churn rate
    const churnRate = activeCount > 0 
      ? ((canceledThisMonth / (activeCount + canceledThisMonth)) * 100).toFixed(2)
      : 0;

    // Get failed payments this month
    const failedPayments = await Payment.count({
      where: {
        status: 'failed',
        createdAt: {
          [Op.gte]: startOfMonth
        }
      }
    });

    // Get total refunds this month
    const refundsThisMonth = await Payment.sum('amount', {
      where: {
        status: 'refunded',
        updatedAt: {
          [Op.gte]: startOfMonth
        }
      }
    });

    // Calculate trial conversion rate (trials that became active this month)
    const convertedTrials = await Subscription.count({
      where: {
        status: 'active',
        trialEnd: {
          [Op.between]: [startOfMonth, now]
        }
      }
    });

    const trialConversionRate = trialingCount > 0 
      ? ((convertedTrials / trialingCount) * 100).toFixed(2)
      : 0;

    // Get MRR growth (compare to last month)
    const lastMonthSubscriptions = await Subscription.findAll({
      where: {
        status: {
          [Op.in]: ['active', 'trialing']
        },
        createdAt: {
          [Op.lte]: endOfLastMonth
        }
      }
    });
    const lastMonthMRR = calculateMRR(lastMonthSubscriptions);
    const mrrGrowth = lastMonthMRR > 0 
      ? (((totalMRR - lastMonthMRR) / lastMonthMRR) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        mrr: {
          total: Number.parseFloat(totalMRR.toFixed(2)),
          growth: Number.parseFloat(mrrGrowth),
          lastMonth: Number.parseFloat(lastMonthMRR.toFixed(2))
        },
        subscriptions: {
          active: activeCount,
          trialing: trialingCount,
          total: activeCount + trialingCount,
          new: newSubscriptionsThisMonth,
          canceled: canceledThisMonth
        },
        metrics: {
          churnRate: Number.parseFloat(churnRate),
          trialConversionRate: Number.parseFloat(trialConversionRate),
          failedPayments,
          refunds: Number.parseFloat((refundsThisMonth || 0).toFixed(2))
        },
        tierBreakdown: tierBreakdown.map(tier => ({
          tier: tier.tier,
          count: Number.parseInt(tier.count),
          revenue: Number.parseFloat(Number(tier.revenue || 0).toFixed(2))
        }))
      }
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve subscription statistics',
      error: error.message 
    });
  }
};

/**
 * Update a subscription (change plan, quantity, etc.)
 */
const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { tier, quantity, cancelAtPeriodEnd } = req.body;

    // Find subscription in database
    const subscription = await Subscription.findByPk(id);
    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription not found' 
      });
    }

    const updates = {};

    // Update tier if provided
    if (tier && tier !== subscription.tier) {
      const plan = SUBSCRIPTION_PLANS[tier];
      if (!plan) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid subscription tier' 
        });
      }

      updates.items = [{
        id: subscription.stripePriceId,
        price: plan.priceId
      }];

      // Update MRR
      const newMRR = plan.price * (quantity || subscription.quantity);
      subscription.tier = tier;
      subscription.mrr = newMRR;
    }

    // Update quantity if provided
    if (quantity && quantity !== subscription.quantity) {
      updates.quantity = quantity;
      const plan = SUBSCRIPTION_PLANS[subscription.tier];
      subscription.mrr = plan.price * quantity;
      subscription.quantity = quantity;
    }

    // Handle cancel at period end
    if (cancelAtPeriodEnd !== undefined) {
      updates.cancel_at_period_end = cancelAtPeriodEnd;
      subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    // Update in Stripe
    const updatedStripeSubscription = await updateStripeSubscription(
      subscription.stripeSubscriptionId, 
      updates
    );

    // Update in database
    await subscription.save();

    // Update tenant MRR
    const tenant = await Tenant.findByPk(subscription.tenantId);
    if (tenant) {
      tenant.mrr = subscription.mrr;
      tenant.subscriptionPlan = subscription.tier;
      await tenant.save();
    }

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: {
        subscription,
        stripeSubscription: updatedStripeSubscription
      }
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update subscription',
      error: error.message 
    });
  }
};

/**
 * Cancel a subscription
 */
const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { immediate = false } = req.body;

    // Find subscription in database
    const subscription = await Subscription.findByPk(id);
    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription not found' 
      });
    }

    // Cancel in Stripe
    const canceledStripeSubscription = await cancelStripeSubscription(
      subscription.stripeSubscriptionId,
      !immediate
    );

    // Update in database
    if (immediate) {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelAt = subscription.currentPeriodEnd;
    }
    await subscription.save();

    // Update tenant status
    const tenant = await Tenant.findByPk(subscription.tenantId);
    if (tenant && immediate) {
      tenant.status = 'cancelled';
      tenant.paymentStatus = 'cancelled';
      tenant.mrr = 0;
      await tenant.save();
    }

    res.json({
      success: true,
      message: immediate 
        ? 'Subscription canceled immediately' 
        : 'Subscription will be canceled at period end',
      data: {
        subscription,
        stripeSubscription: canceledStripeSubscription
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel subscription',
      error: error.message 
    });
  }
};

/**
 * Retry a failed payment
 */
const retryFailedPayment = async (req, res) => {
  try {
    const { id } = req.params;

    // Find subscription
    const subscription = await Subscription.findByPk(id);
    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription not found' 
      });
    }

    // Get latest invoice from Stripe
    const stripeSubscription = await retrieveSubscription(subscription.stripeSubscriptionId);
    
    if (!stripeSubscription.latest_invoice) {
      return res.status(400).json({ 
        success: false, 
        message: 'No invoice found for this subscription' 
      });
    }

    // Retry payment via Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const invoice = await stripe.invoices.retrieve(stripeSubscription.latest_invoice);
    
    if (invoice.status === 'paid') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invoice is already paid' 
      });
    }

    const retriedInvoice = await stripe.invoices.pay(invoice.id);

    res.json({
      success: true,
      message: 'Payment retry initiated',
      data: {
        invoice: retriedInvoice
      }
    });
  } catch (error) {
    console.error('Retry payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retry payment',
      error: error.message 
    });
  }
};

/**
 * Process a refund
 */
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    // Find payment
    const payment = await Payment.findByPk(id);
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    if (payment.status !== 'paid') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only paid payments can be refunded' 
      });
    }

    // Process refund in Stripe
    const refund = await refundPayment(
      payment.stripePaymentIntentId, 
      amount || payment.amount
    );

    // Update payment status
    payment.status = 'refunded';
    payment.metadata = {
      ...payment.metadata,
      refundId: refund.id,
      refundReason: reason,
      refundedAt: new Date().toISOString()
    };
    await payment.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        payment,
        refund
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process refund',
      error: error.message 
    });
  }
};

/**
 * Get Stripe integration status
 */
const getStripeIntegrationStatus = async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Check if Stripe is configured
    const isConfigured = !!(
      process.env.STRIPE_SECRET_KEY && 
      process.env.STRIPE_PUBLISHABLE_KEY
    );

    if (!isConfigured) {
      return res.json({
        success: true,
        data: {
          configured: false,
          mode: null,
          webhookConfigured: false,
          lastSync: null,
          accountStatus: 'not_configured'
        }
      });
    }

    // Determine mode (test/live)
    const mode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live';

    // Check webhook configuration
    const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;

    // Try to verify Stripe connection by fetching account info
    let accountStatus = 'unknown';
    let accountId = null;
    
    try {
      const account = await stripe.balance.retrieve();
      accountStatus = 'connected';
      
      // Get account details
      const accountDetails = await stripe.accounts.retrieve();
      accountId = accountDetails.id;
    } catch (error) {
      console.error('Stripe connection error:', error);
      accountStatus = 'error';
    }

    // Get the latest subscription update time as "last sync"
    const latestSubscription = await Subscription.findOne({
      order: [['updatedAt', 'DESC']],
      attributes: ['updatedAt']
    });

    // Get webhook events count (if available)
    let recentWebhookEvents = 0;
    try {
      const events = await stripe.events.list({ limit: 100 });
      recentWebhookEvents = events.data.length;
    } catch (error) {
      console.error('Error fetching webhook events:', error);
    }

    res.json({
      success: true,
      data: {
        configured: isConfigured,
        mode: mode,
        webhookConfigured: webhookConfigured,
        accountStatus: accountStatus,
        accountId: accountId,
        lastSync: latestSubscription?.updatedAt || null,
        recentWebhookEvents: recentWebhookEvents,
        priceIds: {
          basic: process.env.STRIPE_BASIC_PRICE_ID || null,
          pro: process.env.STRIPE_PRO_PRICE_ID || null,
          enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || null
        }
      }
    });
  } catch (error) {
    console.error('Get Stripe integration status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve Stripe integration status',
      error: error.message 
    });
  }
};

module.exports = {
  getAllSubscriptions,
  getSubscriptionStats,
  updateSubscription,
  cancelSubscription,
  retryFailedPayment,
  processRefund,
  getStripeIntegrationStatus
};
