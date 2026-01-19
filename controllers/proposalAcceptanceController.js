// controllers/proposalAcceptanceController.js
// Handles customer proposal acceptance with deposit payment

const Quote = require('../models/Quote');
const Client = require('../models/Client');
const Job = require('../models/Job');
const ContractorSettings = require('../models/ContractorSettings');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sequelize = require('../config/database');

/**
 * Get proposal details for customer
 * GET /api/customer-portal/proposals/:id
 */
exports.getProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    // Validate quote access
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone'],
        },
      ],
    });
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }
    
    // Get contractor settings for deposit percentage
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
    });
    
    const depositPercentage = parseFloat(settings?.depositPercentage || 50);
    const depositAmount = (parseFloat(quote.total) * depositPercentage) / 100;
    
    // Check payment status
    let paymentStatus = 'not_started';
    if (quote.depositVerified || quote.portalOpen) {
      paymentStatus = 'completed';
    } else if (quote.status === 'accepted' && quote.stripePaymentIntentId) {
      paymentStatus = 'pending';
    }
    
    res.json({
      success: true,
      quote: quote.toJSON(),
      depositPercentage,
      depositAmount,
      paymentStatus,
    });
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Accept proposal and create Stripe payment intent for deposit
 * POST /api/customer-portal/proposals/:id/accept
 */
exports.acceptProposal = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { selectedTier } = req.body; // 'good', 'better', 'best' for GBB
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    // Validate quote access
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
      transaction,
    });
    
    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }
    
    // Check if quote is already fully processed
    if (quote.status === 'approved' || quote.depositVerified || quote.portalOpen) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Proposal has already been accepted and deposit paid. Portal is now open for selections.',
      });
    }
    
    // If status is 'accepted' but deposit not verified, check for existing payment intent
    let existingPaymentIntent = null;
    if (quote.status === 'accepted' && quote.stripePaymentIntentId) {
      try {
        existingPaymentIntent = await stripe.paymentIntents.retrieve(quote.stripePaymentIntentId);
        
        // If payment intent already succeeded, update quote and return success
        if (existingPaymentIntent.status === 'succeeded') {
          const settings = await ContractorSettings.findOne({
            where: { tenantId },
            transaction,
          });
          
          const portalDurationDays = parseInt(settings?.portalDurationDays || 7);
          const portalExpiryDate = new Date();
          portalExpiryDate.setDate(portalExpiryDate.getDate() + portalDurationDays);
          
          await quote.update({
            depositVerified: true,
            depositPaidAt: new Date(),
            portalOpen: true,
            portalOpenedAt: new Date(),
            portalExpiresAt: portalExpiryDate,
          }, { transaction });
          
          await transaction.commit();
          
          return res.json({
            success: true,
            message: 'Payment already completed. Redirecting to selections...',
            quote: {
              id: quote.id,
              quoteNumber: quote.quoteNumber,
              status: quote.status,
              depositVerified: true,
              portalOpen: true,
            },
            paymentCompleted: true,
            redirectTo: 'selections',
          });
        }
        
        // If payment intent is still usable (requires_payment_method, requires_confirmation, requires_action)
        if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(existingPaymentIntent.status)) {
          await transaction.commit();
          
          return res.json({
            success: true,
            message: 'Resuming payment process',
            quote: {
              id: quote.id,
              quoteNumber: quote.quoteNumber,
              status: quote.status,
              acceptedAt: quote.acceptedAt,
              selectedTier: quote.selectedTier || selectedTier,
              depositAmount: quote.depositAmount,
            },
            payment: {
              clientSecret: existingPaymentIntent.client_secret,
              amount: quote.depositAmount,
              currency: 'usd',
            },
          });
        }
        
        // If payment intent is in failed/canceled state, create a new one
        // (will be handled below)
      } catch (stripeError) {
        console.error('Error retrieving existing payment intent:', stripeError);
        // Continue to create new payment intent
      }
    }
    
    // Check if quote is expired
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Proposal has expired. Please contact contractor for renewal.',
      });
    }
    
    // Validate selected tier for GBB quotes
    if (quote.productStrategy === 'GBB') {
      if (!selectedTier || !['good', 'better', 'best'].includes(selectedTier)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Please select a pricing tier (Good, Better, or Best)',
        });
      }
    }
    
    // Get contractor settings for deposit percentage
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
      transaction,
    });
    
    const depositPercentage = parseFloat(settings?.depositPercentage || 30);
    const total = parseFloat(quote.total || 0);
    
    // Calculate deposit amount for selected tier
    let depositAmount = 0;
    let tierTotal = total;
    
    if (quote.productStrategy === 'GBB' && quote.pricingTiers) {
      const tiers = typeof quote.pricingTiers === 'string' 
        ? JSON.parse(quote.pricingTiers) 
        : quote.pricingTiers;
      
      const tier = tiers[selectedTier];
      if (tier && tier.total) {
        tierTotal = parseFloat(tier.total);
      }
    }
    
    depositAmount = Math.round(tierTotal * (depositPercentage / 100) * 100) / 100;
    
    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(depositAmount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        clientId: clientId,
        tenantId: tenantId,
        paymentType: 'deposit',
        selectedTier: selectedTier || 'single',
      },
      description: `Deposit for ${quote.quoteNumber} - ${quote.customerName}`,
    });
    
    // Update quote with acceptance data
    await quote.update({
      status: 'accepted',
      acceptedAt: new Date(),
      selectedTier: selectedTier || null,
      depositAmount: depositAmount,
      stripePaymentIntentId: paymentIntent.id,
    }, { transaction });
    
    await transaction.commit();
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Proposal accepted by customer',
      userId: null,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientId,
        selectedTier,
        depositAmount,
        total: tierTotal,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findOne({ 
        where: { tenantId, isActive: true },
        order: [['role', 'ASC']], // Admin first
      });
      
      if (contractor?.email) {
        await emailService.sendProposalAcceptedEmail(contractor.email, {
          quoteNumber: quote.quoteNumber,
          customerName: req.customer.name,
          customerEmail: req.customer.email,
          selectedTier,
          total: tierTotal,
          depositAmount,
        });
      }
    } catch (emailError) {
      console.error('Error sending acceptance email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Proposal accepted successfully',
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        acceptedAt: quote.acceptedAt,
        selectedTier,
        depositAmount,
      },
      payment: {
        clientSecret: paymentIntent.client_secret,
        amount: depositAmount,
        currency: 'usd',
      },
    });
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Accept proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept proposal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Confirm deposit payment and open selection portal
 * POST /api/customer-portal/proposals/:id/confirm-payment
 */
exports.confirmDepositPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { paymentIntentId } = req.body;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
      transaction,
    });
    
    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }
    
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment not completed',
        paymentStatus: paymentIntent.status,
      });
    }
    
    // Verify payment matches quote
    if (paymentIntent.metadata.quoteId != quote.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment does not match this proposal',
      });
    }
    
    // Calculate portal expiry
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
      transaction,
    });
    
    const portalDurationDays = parseInt(settings?.portalDurationDays || 7);
    const portalExpiryDate = new Date();
    portalExpiryDate.setDate(portalExpiryDate.getDate() + portalDurationDays);
    
    // Update quote - open selection portal
    await quote.update({
      depositVerified: true,
      depositPaidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      portalOpen: true,
      portalOpenedAt: new Date(),
      portalExpiresAt: portalExpiryDate,
    }, { transaction });
    
    await transaction.commit();
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Deposit payment confirmed - Selection portal opened',
      userId: null,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientId,
        depositAmount: quote.depositAmount,
        paymentIntentId,
        portalExpiresAt: portalExpiryDate,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send portal access email to customer
    try {
      await emailService.sendSelectionPortalOpenEmail(req.customer.email, {
        customerName: req.customer.name,
        quoteNumber: quote.quoteNumber,
        portalExpiryDate,
        portalDurationDays,
      }, { tenantId });
    } catch (emailError) {
      console.error('Error sending portal open email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Payment confirmed! Selection portal is now open.',
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        portalOpen: true,
        portalExpiresAt: portalExpiryDate,
        portalDaysRemaining: portalDurationDays,
      },
    });
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Reject proposal
 * POST /api/customer-portal/proposals/:id/reject
 */
exports.rejectProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, comments } = req.body;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
    });
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }
    
    if (quote.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: 'Proposal is already rejected',
      });
    }
    
    if (quote.status === 'accepted' || quote.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an accepted proposal',
      });
    }
    
    await quote.update({
      status: 'declined',
      declinedAt: new Date(),
      declineReason: reason,
      customerNotes: comments,
    });
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Proposal rejected by customer',
      userId: null,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientId,
        reason,
        comments,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findOne({ 
        where: { tenantId, isActive: true },
      });
      
      if (contractor?.email) {
        await emailService.sendProposalRejectedEmail(contractor.email, {
          quoteNumber: quote.quoteNumber,
          customerName: req.customer.name,
          customerEmail: req.customer.email,
          total: quote.total,
          reason,
          comments,
        });
      }
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Proposal rejected successfully',
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        declinedAt: quote.declinedAt,
      },
    });
    
  } catch (error) {
    console.error('Reject proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject proposal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = exports;
