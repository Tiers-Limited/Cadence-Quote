// services/stripeService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Subscription plan pricing configuration
 * NOTE: Replace price IDs with actual Stripe Price IDs from your Stripe Dashboard
 */
const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic Plan',
    description: 'Perfect for small contractors getting started',
    priceId: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic', // Replace with actual price ID
    price: 29.99, // USD per month
    trialDays: 14,
    features: [
      'Up to 10 projects',
      'Basic proposal templates',
      'Customer management',
      'Email support',
      '5 team seats'
    ]
  },
  pro: {
    name: 'Pro Plan',
    description: 'Advanced features for growing businesses',
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro', // Replace with actual price ID
    price: 79.99, // USD per month
    trialDays: 14,
    features: [
      'Unlimited projects',
      'Advanced proposal templates',
      'Team collaboration',
      'Priority support',
      'Custom branding',
      'Analytics dashboard',
      '20 team seats'
    ]
  },
  enterprise: {
    name: 'Enterprise Plan',
    description: 'Full-featured solution for large teams',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise', // Replace with actual price ID
    price: 199.99, // USD per month
    trialDays: 30,
    features: [
      'Everything in Pro',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom integrations',
      'Advanced analytics',
      'SLA guarantees',
      'Unlimited team seats'
    ]
  }
};

/**
 * Get subscription plan details
 */
const getSubscriptionPlan = (planType) => {
  return SUBSCRIPTION_PLANS[planType] || null;
};

/**
 * Create a Stripe Checkout Session
 * @param {Object} params - Session parameters
 * @param {string} params.userId - User ID
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.subscriptionPlan - Subscription plan (basic/pro/enterprise)
 * @param {string} params.email - Customer email
 * @param {string} params.successUrl - Success redirect URL
 * @param {string} params.cancelUrl - Cancel redirect URL
 */
const createCheckoutSession = async ({
  userId,
  tenantId,
  subscriptionPlan,
  email,
  successUrl,
  cancelUrl
}) => {
  try {
    const planDetails = getSubscriptionPlan(subscriptionPlan);
    
    if (!planDetails) {
      throw new Error('Invalid subscription plan');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment', // One-time payment (change to 'subscription' for recurring)
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planDetails.name,
              description: planDetails.description,
              metadata: {
                plan: subscriptionPlan
              }
            },
            unit_amount: Math.round(planDetails.price * 100) // Convert to cents
          },
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId.toString(),
        tenantId: tenantId.toString(),
        subscriptionPlan
      }
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
      amount: planDetails.price
    };
  } catch (error) {
    console.error('Stripe session creation error:', error);
    throw error;
  }
};

/**
 * Retrieve a Stripe Checkout Session
 * @param {string} sessionId - Stripe session ID
 */
const retrieveSession = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('Stripe session retrieval error:', error);
    throw error;
  }
};

/**
 * Create or retrieve a Stripe Customer
 * @param {Object} params - Customer parameters
 * @param {string} params.email - Customer email
 * @param {string} params.name - Customer name
 * @param {string} params.tenantId - Tenant ID
 */
const createOrGetCustomer = async ({ email, name, tenantId }) => {
  try {
    // Check if customer already exists
    const customers = await stripe.customers.list({
      email,
      limit: 1
    });

    if (customers.data.length > 0) {
      return customers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        tenantId: tenantId.toString()
      }
    });

    return customer;
  } catch (error) {
    console.error('Stripe customer creation error:', error);
    throw error;
  }
};

/**
 * Refund a payment
 * @param {string} paymentIntentId - Stripe Payment Intent ID
 * @param {number} amount - Amount to refund (in cents, optional)
 */
const refundPayment = async (paymentIntentId, amount = null) => {
  try {
    const refundData = {
      payment_intent: paymentIntentId
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundData);
    return refund;
  } catch (error) {
    console.error('Stripe refund error:', error);
    throw error;
  }
};

module.exports = {
  createCheckoutSession,
  retrieveSession,
  createOrGetCustomer,
  refundPayment,
  getSubscriptionPlan,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  retrieveSubscription,
  listSubscriptions,
  calculateMRR,
  SUBSCRIPTION_PLANS
};

/**
 * Create a new Stripe subscription
 * @param {Object} params - Subscription parameters
 * @param {string} params.customerId - Stripe Customer ID
 * @param {string} params.tier - Subscription tier (basic/pro/enterprise)
 * @param {number} params.quantity - Number of seats (default: 1)
 * @param {boolean} params.trialEnabled - Enable trial period (default: true)
 * @param {Object} params.metadata - Additional metadata
 */
async function createSubscription({ customerId, tier, quantity = 1, trialEnabled = true, metadata = {} }) {
  try {
    const plan = getSubscriptionPlan(tier);
    
    if (!plan) {
      throw new Error(`Invalid subscription tier: ${tier}`);
    }

    const subscriptionParams = {
      customer: customerId,
      items: [
        {
          price: plan.priceId,
          quantity
        }
      ],
      metadata: {
        tier,
        ...metadata
      },
      expand: ['latest_invoice.payment_intent']
    };

    // Add trial period if enabled
    if (trialEnabled && plan.trialDays) {
      subscriptionParams.trial_period_days = plan.trialDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Calculate MRR
    const mrr = (plan.price * quantity).toFixed(2);

    return {
      success: true,
      subscription,
      mrr: Number.parseFloat(mrr)
    };
  } catch (error) {
    console.error('Stripe subscription creation error:', error);
    throw error;
  }
}

/**
 * Update an existing subscription
 * @param {string} subscriptionId - Stripe Subscription ID
 * @param {Object} updates - Updates to apply
 */
async function updateSubscription(subscriptionId, updates) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, updates);
    return subscription;
  } catch (error) {
    console.error('Stripe subscription update error:', error);
    throw error;
  }
}

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Stripe Subscription ID
 * @param {boolean} atPeriodEnd - Cancel at period end (default: false)
 */
async function cancelSubscription(subscriptionId, atPeriodEnd = false) {
  try {
    if (atPeriodEnd) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
      return subscription;
    } else {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    }
  } catch (error) {
    console.error('Stripe subscription cancellation error:', error);
    throw error;
  }
}

/**
 * Retrieve a subscription
 * @param {string} subscriptionId - Stripe Subscription ID
 */
async function retrieveSubscription(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Stripe subscription retrieval error:', error);
    throw error;
  }
}

/**
 * List subscriptions with filters
 * @param {Object} params - Filter parameters
 */
async function listSubscriptions(params = {}) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      limit: params.limit || 100,
      ...params
    });
    return subscriptions;
  } catch (error) {
    console.error('Stripe subscriptions list error:', error);
    throw error;
  }
}

/**
 * Calculate total MRR from active subscriptions
 * @param {Array} subscriptions - Array of subscription objects from database
 */
function calculateMRR(subscriptions) {
  return subscriptions.reduce((total, sub) => {
    if (sub.status === 'active' || sub.status === 'trialing') {
      return total + Number.parseFloat(sub.mrr || 0);
    }
    return total;
  }, 0);
}
