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
    const baseTotal = parseFloat(quote.total || 0);
    const depositAmount = (baseTotal * depositPercentage) / 100;
    
    // Calculate tier pricing for GBB quotes
    let pricingTiers = null;
    if (quote.productStrategy === 'GBB') {
      const tierMultipliers = { good: 0.85, better: 1.0, best: 1.15 };
      pricingTiers = {};
      
      Object.entries(tierMultipliers).forEach(([tier, multiplier]) => {
        const tierTotal = parseFloat((baseTotal * multiplier).toFixed(2));
        const tierDeposit = parseFloat((tierTotal * (depositPercentage / 100)).toFixed(2));
        
        pricingTiers[tier] = {
          total: tierTotal,
          deposit: tierDeposit,
          description: tier === 'good' ? 'Basic preparation focused on repainting the space cleanly. Spot patching only.' :
                      tier === 'better' ? 'Expanded surface preparation including feather sanding. Recommended for most homes.' :
                      'Advanced surface correction including skim coating. Best for luxury spaces.'
        };
      });
    }
    
    // Check payment status
    let paymentStatus = 'not_started';
    if (quote.depositVerified || quote.portalOpen) {
      paymentStatus = 'completed';
    } else if (quote.status === 'accepted' && quote.stripePaymentIntentId) {
      paymentStatus = 'pending';
    }
    
    // If tier is already selected, use that tier's deposit
    let effectiveDepositAmount = depositAmount;
    if (quote.gbbSelectedTier && pricingTiers && pricingTiers[quote.gbbSelectedTier.toLowerCase()]) {
      effectiveDepositAmount = pricingTiers[quote.gbbSelectedTier.toLowerCase()].deposit;
    }
    
    res.json({
      success: true,
      data: {
        ...quote.toJSON(),
        pricingTiers,
        tiers: pricingTiers, // Alias for compatibility
        depositPercentage,
        depositAmount: effectiveDepositAmount,
        paymentStatus,
      },
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
              selectedTier: quote.gbbSelectedTier || selectedTier,
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
    const baseTotal = parseFloat(quote.total || 0);
    
    // Calculate deposit amount for selected tier
    let depositAmount = 0;
    let tierTotal = baseTotal;
    
    if (quote.productStrategy === 'GBB' && selectedTier) {
      // Try to get tier pricing from stored data first
      let tierPricing = null;
      
      if (quote.gbbTierPricing && typeof quote.gbbTierPricing === 'object' && Object.keys(quote.gbbTierPricing).length > 0) {
        tierPricing = typeof quote.gbbTierPricing === 'string' 
          ? JSON.parse(quote.gbbTierPricing) 
          : quote.gbbTierPricing;
      }
      
      // If tier pricing exists and has the selected tier, use it
      if (tierPricing && tierPricing[selectedTier] && tierPricing[selectedTier].total) {
        tierTotal = parseFloat(tierPricing[selectedTier].total);
      } else {
        // Calculate tier pricing on-the-fly using standard multipliers
        const tierMultipliers = {
          good: 0.85,
          better: 1.0,
          best: 1.15
        };
        
        const multiplier = tierMultipliers[selectedTier.toLowerCase()] || 1.0;
        tierTotal = parseFloat((baseTotal * multiplier).toFixed(2));
        
        console.log(`Calculated tier pricing on-the-fly: ${selectedTier} tier = $${tierTotal} (base: $${baseTotal} × ${multiplier})`);
      }
    }
    
    depositAmount = Math.round(tierTotal * (depositPercentage / 100) * 100) / 100;
    
    console.log(`Deposit calculation: tierTotal=$${tierTotal}, depositPercentage=${depositPercentage}%, depositAmount=$${depositAmount}`);
    
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
      gbbSelectedTier: selectedTier || null,  // Fixed: use correct field name
      depositAmount: depositAmount,
      total: tierTotal,  // Update total to match selected tier
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
    
    // Generate invoice based on selected tier
    let invoicePdfUrl = null;
    try {
      const invoiceTemplateService = require('../services/invoiceTemplateService');
      const Tenant = require('../models/Tenant');
      
      const tenant = await Tenant.findByPk(tenantId);
      
      // Determine tier pricing
      let tierTotal = parseFloat(quote.total || 0);
      let tierDeposit = parseFloat(quote.depositAmount || 0);
      
      if (quote.productStrategy === 'GBB' && quote.gbbTierPricing) {
        const tiers = typeof quote.gbbTierPricing === 'string' 
          ? JSON.parse(quote.gbbTierPricing) 
          : quote.gbbTierPricing;
        
        const selectedTier = quote.gbbSelectedTier || 'better';
        const tier = tiers[selectedTier];
        
        if (tier) {
          tierTotal = parseFloat(tier.total || tierTotal);
          tierDeposit = parseFloat(tier.deposit || tierDeposit);
        }
      }
      
      const contractorInfo = {
        name: tenant?.companyName || 'Contractor',
        email: tenant?.email || '',
        phone: tenant?.phoneNumber || '',
        address: tenant?.businessAddress || '',
        logo: tenant?.companyLogoUrl || null,
      };
      
      const templateType = quote.productStrategy === 'GBB' ? 'gbb' : 'single';
      const templateStyle = settings?.invoiceTemplateStyle || 'light';
      
      const invoiceData = {
        invoiceNumber: quote.quoteNumber,
        issueDate: new Date().toLocaleDateString('en-US'),
        projectName: `${quote.customerName} Project`,
        projectAddress: [quote.street, quote.city, quote.state, quote.zipCode].filter(Boolean).join(', '),
        customerName: quote.customerName,
        customerPhone: quote.customerPhone,
        customerEmail: quote.customerEmail,
        selectedTier: quote.gbbSelectedTier || null,
        pricingItems: [{
          name: 'Project Total',
          qty: 1,
          amount: tierTotal
        }],
        projectInvestment: tierTotal,
        deposit: tierDeposit,
        balance: tierTotal - tierDeposit,
        depositPaid: true,
        depositPaidDate: new Date().toLocaleDateString('en-US'),
      };
      
      const pdfBuffer = await invoiceTemplateService.generateInvoice({
        templateType,
        style: templateStyle,
        invoiceData,
        contractorInfo
      });
      
      // Save invoice to disk
      const fs = require('fs').promises;
      const path = require('path');
      const tempDir = path.join(__dirname, '..', 'temp');
      
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (mkdirError) {
        // Directory already exists
      }
      
      const timestamp = Date.now();
      const invoiceFileName = `invoice-${quote.id}-${timestamp}.pdf`;
      const invoicePath = path.join(tempDir, invoiceFileName);
      
      await fs.writeFile(invoicePath, pdfBuffer);
      
      invoicePdfUrl = `/temp/${invoiceFileName}`;
      
      // Update quote with invoice URL
      await Quote.update(
        {
          invoicePdfUrl,
          invoicePdfGeneratedAt: new Date(),
        },
        { where: { id: quote.id, tenantId } }
      );
      
      console.log(`✅ Invoice generated and saved: ${invoicePdfUrl}`);
    } catch (invoiceError) {
      console.error('⚠️ Failed to generate invoice:', invoiceError);
      // Don't fail the request if invoice generation fails
    }
    
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
        invoiceGenerated: !!invoicePdfUrl,
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

