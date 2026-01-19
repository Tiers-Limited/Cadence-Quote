// controllers/stripeWebhookController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const Quote = require('../models/Quote');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');

/**
 * Handle Stripe webhook events
 */
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

/**
 * Handle successful payment
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const { proposalId, customerId } = paymentIntent.metadata;

    if (!proposalId) {
      console.error('No proposalId in payment intent metadata');
      return;
    }

    // Update proposal
    const proposal = await Quote.findByPk(proposalId);
    if (!proposal) {
      console.error(`Proposal ${proposalId} not found`);
      return;
    }

    await proposal.update({
      depositVerified: true,
      depositVerifiedAt: new Date(),
      depositPaymentMethod: 'stripe',
      depositTransactionId: paymentIntent.id,
      portalOpen: true,
      portalOpenedAt: new Date()
    });

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
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    const { proposalId } = paymentIntent.metadata;
    console.error(`❌ Payment failed for proposal ${proposalId}:`, paymentIntent.last_payment_error?.message);
    
    // Optionally send notification to customer about failed payment
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
}

module.exports = exports;
