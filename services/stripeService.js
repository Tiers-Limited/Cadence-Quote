// services/stripeService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Subscription plan pricing configuration
 */
const SUBSCRIPTION_PLANS = {
  starter: {
    name: 'Starter Plan',
    description: 'Perfect for small contractors getting started',
    price: 29.99, // USD per month
    features: [
      'Up to 10 projects',
      'Basic proposal templates',
      'Customer management',
      'Email support'
    ]
  },
  pro: {
    name: 'Pro Plan',
    description: 'Advanced features for growing businesses',
    price: 79.99, // USD per month
    features: [
      'Unlimited projects',
      'Advanced proposal templates',
      'Team collaboration',
      'Priority support',
      'Custom branding',
      'Analytics dashboard'
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
 * @param {string} params.subscriptionPlan - Subscription plan (starter/pro)
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
  SUBSCRIPTION_PLANS
};
