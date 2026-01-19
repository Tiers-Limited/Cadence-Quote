// routes/webhooks.js
const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { SUBSCRIPTION_PLANS } = require('../services/stripeService');

// Webhook endpoint - NO authentication middleware (Stripe signs the request)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  console.log(`🔔 Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(subscription) {
  console.log('Creating subscription:', subscription.id);

  const tier = subscription.metadata?.tier || 'basic';
  const plan = SUBSCRIPTION_PLANS[tier];
  const mrr = plan ? plan.price * subscription.quantity : 0;

  // Find tenant by Stripe customer ID
  const tenant = await Tenant.findOne({
    where: { stripeCustomerId: subscription.customer }
  });

  if (!tenant) {
    console.error('Tenant not found for customer:', subscription.customer);
    return;
  }

  // Create subscription record
  await Subscription.create({
    tenantId: tenant.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0].price.id,
    stripeCustomerId: subscription.customer,
    tier,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    mrr,
    quantity: subscription.quantity,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadata: subscription.metadata
  });

  // Update tenant
  tenant.subscriptionPlan = tier;
  tenant.subscriptionId = subscription.id;
  tenant.paymentStatus = subscription.status === 'trialing' ? 'trial' : 'active';
  tenant.subscriptionExpiresAt = new Date(subscription.current_period_end * 1000);
  tenant.mrr = mrr;
  if (subscription.trial_end) {
    tenant.trialEndsAt = new Date(subscription.trial_end * 1000);
  }
  await tenant.save();

  console.log('✅ Subscription created successfully');
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  console.log('Updating subscription:', subscription.id);

  const subscriptionRecord = await Subscription.findOne({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!subscriptionRecord) {
    console.error('Subscription record not found:', subscription.id);
    return;
  }

  // Calculate new MRR if tier or quantity changed
  const tier = subscription.metadata?.tier || subscriptionRecord.tier;
  const plan = SUBSCRIPTION_PLANS[tier];
  const mrr = plan ? plan.price * subscription.quantity : subscriptionRecord.mrr;

  // Update subscription record
  subscriptionRecord.status = subscription.status;
  subscriptionRecord.currentPeriodStart = new Date(subscription.current_period_start * 1000);
  subscriptionRecord.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  subscriptionRecord.cancelAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null;
  subscriptionRecord.cancelAtPeriodEnd = subscription.cancel_at_period_end;
  subscriptionRecord.quantity = subscription.quantity;
  subscriptionRecord.tier = tier;
  subscriptionRecord.mrr = mrr;
  await subscriptionRecord.save();

  // Update tenant
  const tenant = await Tenant.findByPk(subscriptionRecord.tenantId);
  if (tenant) {
    tenant.subscriptionPlan = tier;
    tenant.paymentStatus = subscription.status === 'active' ? 'active' : subscription.status;
    tenant.subscriptionExpiresAt = new Date(subscription.current_period_end * 1000);
    tenant.mrr = mrr;
    await tenant.save();
  }

  console.log('✅ Subscription updated successfully');
}

/**
 * Handle subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  console.log('Deleting subscription:', subscription.id);

  const subscriptionRecord = await Subscription.findOne({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!subscriptionRecord) {
    console.error('Subscription record not found:', subscription.id);
    return;
  }

  // Update subscription status
  subscriptionRecord.status = 'canceled';
  subscriptionRecord.canceledAt = new Date();
  await subscriptionRecord.save();

  // Update tenant
  const tenant = await Tenant.findByPk(subscriptionRecord.tenantId);
  if (tenant) {
    tenant.paymentStatus = 'cancelled';
    tenant.status = 'cancelled';
    tenant.mrr = 0;
    await tenant.save();
  }

  console.log('✅ Subscription deleted successfully');
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Payment succeeded for invoice:', invoice.id);

  if (!invoice.subscription) {
    return; // Not a subscription payment
  }

  const subscriptionRecord = await Subscription.findOne({
    where: { stripeSubscriptionId: invoice.subscription }
  });

  if (!subscriptionRecord) {
    console.error('Subscription not found for invoice:', invoice.subscription);
    return;
  }

  // Create payment record
  await Payment.create({
    tenantId: subscriptionRecord.tenantId,
    userId: null, // Could be set if we track which user made the payment
    subscriptionPlan: subscriptionRecord.tier,
    amount: invoice.amount_paid / 100, // Convert from cents
    currency: invoice.currency,
    status: 'paid',
    stripeSessionId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    stripeCustomerId: invoice.customer,
    paymentMethod: 'stripe',
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      subscriptionId: invoice.subscription
    },
    paidAt: new Date(invoice.status_transitions.paid_at * 1000)
  });

  // Update tenant payment status
  const tenant = await Tenant.findByPk(subscriptionRecord.tenantId);
  if (tenant) {
    tenant.paymentStatus = 'active';
    await tenant.save();
  }

  console.log('✅ Payment recorded successfully');
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice) {
  console.log('Payment failed for invoice:', invoice.id);

  if (!invoice.subscription) {
    return;
  }

  const subscriptionRecord = await Subscription.findOne({
    where: { stripeSubscriptionId: invoice.subscription }
  });

  if (!subscriptionRecord) {
    console.error('Subscription not found for invoice:', invoice.subscription);
    return;
  }

  // Update subscription status
  subscriptionRecord.status = 'past_due';
  await subscriptionRecord.save();

  // Update tenant payment status
  const tenant = await Tenant.findByPk(subscriptionRecord.tenantId);
  if (tenant) {
    tenant.paymentStatus = 'past_due';
    await tenant.save();
  }

  // Create failed payment record
  await Payment.create({
    tenantId: subscriptionRecord.tenantId,
    userId: null,
    subscriptionPlan: subscriptionRecord.tier,
    amount: invoice.amount_due / 100,
    currency: invoice.currency,
    status: 'failed',
    stripeSessionId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    stripeCustomerId: invoice.customer,
    paymentMethod: 'stripe',
    metadata: {
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt
    },
    failedReason: invoice.last_finalization_error?.message || 'Payment failed'
  });

  console.log('✅ Failed payment recorded');
}

/**
 * Handle subscription.trial_will_end event (3 days before trial ends)
 */
async function handleTrialWillEnd(subscription) {
  console.log('Trial will end for subscription:', subscription.id);

  const subscriptionRecord = await Subscription.findOne({
    where: { stripeSubscriptionId: subscription.id },
    include: [{ model: Tenant, as: 'tenant' }]
  });

  if (!subscriptionRecord) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  // TODO: Send email notification to tenant about trial ending
  console.log(`📧 Send trial ending notification to: ${subscriptionRecord.tenant.email}`);
  
  console.log('✅ Trial ending notification sent');
}

/**
 * Handle payment_intent.succeeded for customer portal deposits
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Payment intent succeeded:', paymentIntent.id);

  // Check if this is a customer portal deposit payment
  const { proposalId, customerId } = paymentIntent.metadata;

  if (!proposalId) {
    console.log('Not a customer portal payment, skipping');
    return;
  }

  const Quote = require('../models/Quote');
  const { createAuditLog } = require('../controllers/auditLogController');
  const emailService = require('../services/emailService');

  // Update proposal using Phase 1 status flow
  const proposal = await Quote.findByPk(proposalId);
  if (!proposal) {
    console.error(`Proposal ${proposalId} not found`);
    return;
  }

  // Use StatusFlowService for automated deposit_paid transition
  const StatusFlowService = require('../services/statusFlowService');
  try {
    await StatusFlowService.handlePaymentSuccess(proposalId, paymentIntent.id, {
      tenantId: proposal.tenantId,
      userId: null // Automated
    });

    // Open portal after deposit is paid
    await proposal.update({
      portalOpen: true,
      portalOpenedAt: new Date()
    });
  } catch (statusError) {
    console.error('Status transition error:', statusError);
    // Fallback to direct update if status flow fails
    await proposal.update({
      depositVerified: true,
      depositVerifiedAt: new Date(),
      depositPaymentMethod: 'stripe',
      depositTransactionId: paymentIntent.id,
      portalOpen: true,
      portalOpenedAt: new Date()
    });
  }

  // Create audit log
  await createAuditLog({
    userId: Number.parseInt(customerId),
    tenantId: proposal.tenantId,
    action: 'deposit_verified_stripe',
    entityType: 'Quote',
    entityId: proposalId,
    details: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100
    }
  });

  // Send email notification to customer
  try {
    await emailService.sendDepositVerifiedEmail(proposal.customerEmail, {
      quoteNumber: proposal.quoteNumber,
      customerName: proposal.customerName,
      id: proposal.id
    }, { tenantId: proposal.tenantId });
  } catch (emailError) {
    console.error('Error sending deposit verified email:', emailError);
  }

  console.log(`✅ Deposit verified for proposal ${proposalId}`);
}

/**
 * Handle payment_intent.payment_failed for customer portal deposits
 */
async function handlePaymentIntentFailed(paymentIntent) {
  const { proposalId } = paymentIntent.metadata;
  
  if (proposalId) {
    console.error(`❌ Payment failed for proposal ${proposalId}:`, paymentIntent.last_payment_error?.message);
    // TODO: Optionally send notification to customer about failed payment
  }
}

module.exports = router;
