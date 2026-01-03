// controllers/customerPortalController.js
// Customer Portal Controller - Handles customer portal access and selections

const Quote = require('../models/Quote');
const Client = require('../models/Client');
const { Op } = require('sequelize');
const { createAuditLog } = require('./auditLogController');
const documentService = require('../services/documentService');
const emailService = require('../services/emailService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

/**
 * Get all proposals for the logged-in customer with pagination and search
 */
exports.getCustomerProposals = async (req, res) => {
  try {
    const customerId = req.user?.id || 212; // Use authenticated user or test ID
    const { page = 1, limit = 10, search = '', status = '' } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const whereClause = {
      clientId: customerId,
      // Filter out draft quotes - customers should only see sent/accepted/declined/completed quotes
      status: {
        [Op.notIn]: ['draft']
      }
    };

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { quoteNumber: { [Op.iLike]: `%${search}%` } },
        { customerName: { [Op.iLike]: `%${search}%` } },
        { customerEmail: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add status filter (override the default not-draft filter if specific status requested)
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const { count, rows: proposals } = await Quote.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'id',
        'clientId',
        'quoteNumber',
        'customerName',
        'customerEmail',
        'status',
        'selectedTier',
        'depositVerified',
        'depositAmount',
        'finishStandardsAcknowledged',
        'portalOpen',
        'portalOpenedAt',
        'portalClosedAt',
        'selectionsComplete',
        'selectionsCompletedAt',
        'total',
        'validUntil',
        'createdAt',
        'acceptedAt',
        'declinedAt'
      ]
    });

    // Calculate portal status for each proposal
    const proposalsWithStatus = proposals.map(proposal => {
      const data = proposal.toJSON();
      
      // Check if quote is expired
      if (data.validUntil && new Date(data.validUntil) < new Date() && data.status === 'pending') {
        data.isExpired = true;
      }

      // Check if portal is expired
      if (data.portalOpen && data.portalOpenedAt) {
        // We'll check this against contractor settings in a moment
        data.portalExpired = false;
      }

      return data;
    });

    res.json({
      success: true,
      data: proposalsWithStatus,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get customer proposals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

/**
 * Get detailed proposal information
 */
exports.getProposalDetail = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Calculate tier pricing structure for customer portal
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({ 
      where: { tenantId: proposal.tenantId }
    });
    
    const depositPercent = settings?.depositPercent || 50;
    const baseTotal = parseFloat(proposal.total || 0);
    
    // Calculate all three tier options
    const tiers = {
      good: {
        total: parseFloat((baseTotal * 0.85).toFixed(2)),
        deposit: parseFloat((baseTotal * 0.85 * (depositPercent / 100)).toFixed(2)),
        description: 'Basic preparation focused on repainting the space cleanly. Spot patching only.'
      },
      better: {
        total: baseTotal,
        deposit: parseFloat((baseTotal * (depositPercent / 100)).toFixed(2)),
        description: 'Expanded surface preparation including feather sanding. Recommended for most homes.'
      },
      best: {
        total: parseFloat((baseTotal * 1.15).toFixed(2)),
        deposit: parseFloat((baseTotal * 1.15 * (depositPercent / 100)).toFixed(2)),
        description: 'Advanced surface correction including skim coating. Best for luxury spaces.'
      }
    };

    // If tier is already selected, ensure depositAmount matches that tier
    let effectiveDepositAmount = proposal.depositAmount;
    if (proposal.selectedTier && tiers[proposal.selectedTier.toLowerCase()]) {
      effectiveDepositAmount = tiers[proposal.selectedTier.toLowerCase()].deposit;
    }

    res.json({
      success: true,
      data: {
        ...proposal.toJSON(),
        tiers,
        depositAmount: effectiveDepositAmount
      }
    });
  } catch (error) {
    console.error('Get proposal detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal',
      error: error.message
    });
  }
};

/**
 * Accept proposal with tier selection
 */
exports.acceptProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { selectedTier } = req.body;
    const customerId = req.user?.id || 212;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or already processed'
      });
    }

    // Check if quote is still valid
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This quote has expired. Please contact your contractor.'
      });
    }

    // Calculate deposit amount based on selected tier
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({
      where: { tenantId: proposal.tenantId }
    });
    
    const depositPercent = settings?.depositPercent || 50;
    const baseTotal = parseFloat(proposal.total || 0);
    
    // Calculate tier pricing
    const tierMultipliers = {
      good: 0.85,
      better: 1.0,
      best: 1.15
    };
    
    const multiplier = tierMultipliers[selectedTier.toLowerCase()] || 1.0;
    const tierTotal = baseTotal * multiplier;
    const depositAmount = parseFloat((tierTotal * (depositPercent / 100)).toFixed(2));

    // Update proposal status - mark as accepted but portal remains closed until deposit
    await proposal.update({
      status: 'accepted',
      selectedTier,
      depositAmount,
      total: parseFloat(tierTotal.toFixed(2)), // Update total to match selected tier
      acceptedAt: new Date(),
      // Portal stays closed until deposit is verified
      portalOpen: false
    });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'proposal_accepted',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        selectedTier,
        proposalId,
        depositAmount
      },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send email notification to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findByPk(proposal.userId);
      if (contractor && contractor.email) {
        await emailService.sendProposalAcceptedEmail(contractor.email, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          selectedTier: proposal.selectedTier,
          depositAmount,
          id: proposal.id
        });
      }
    } catch (emailError) {
      console.error('Error sending proposal accepted email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Proposal accepted successfully. Please proceed to deposit payment.',
      data: {
        id: proposal.id,
        status: proposal.status,
        depositAmount,
        selectedTier
      }
    });
  } catch (error) {
    console.error('Accept proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept proposal',
      error: error.message
    });
  }
};

/**
 * Decline proposal
 */
exports.declineProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { reason } = req.body;
    const customerId = req.user?.id || 212;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        status: 'pending'
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or already processed'
      });
    }

    await proposal.update({
      status: 'declined',
      declinedAt: new Date(),
      notes: reason ? `Customer decline reason: ${reason}\n${proposal.notes || ''}` : proposal.notes
    });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'proposal_declined',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: { proposalId, reason },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send email notification to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findByPk(proposal.userId);
      if (contractor && contractor.email) {
        await emailService.sendProposalDeclinedEmail(contractor.email, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          reason,
          id: proposal.id
        });
      }
    } catch (emailError) {
      console.error('Error sending proposal declined email:', emailError);
    }

    res.json({
      success: true,
      message: 'Proposal declined',
      data: proposal
    });
  } catch (error) {
    console.error('Decline proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline proposal',
      error: error.message
    });
  }
};
    

/**
 * Acknowledge finish standards
 */
exports.acknowledgeFinishStandards = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        depositVerified: true
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or deposit not verified'
      });
    }

    await proposal.update({
      finishStandardsAcknowledged: true,
      finishStandardsAcknowledgedAt: new Date()
    });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'finish_standards_acknowledged',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: { proposalId },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    res.json({
      success: true,
      message: 'Finish standards acknowledged'
    });
  } catch (error) {
    console.error('Acknowledge finish standards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge',
      error: error.message
    });
  }
};

/**
 * Save area selections
 */
exports.saveAreaSelections = async (req, res) => {
  try {
    const { proposalId, areaId } = req.params;
    const { brandId, productId, colorId, customColor, sheen } = req.body;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        portalOpen: true
      }
    });

    if (!proposal) {
      return res.status(403).json({
        success: false,
        message: 'Portal is closed or proposal not found'
      });
    }

    // Update area selections
    const areas = proposal.areas || [];
    const areaIndex = areas.findIndex(a => a.id === Number.parseInt(areaId));

    if (areaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    areas[areaIndex].selections = {
      brandId,
      productId,
      colorId,
      customColor,
      sheen,
      updatedAt: new Date()
    };

    await proposal.update({ areas });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'area_selection_saved',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        proposalId,
        areaId,
        brandId,
        productId,
        colorId,
        sheen
      },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    res.json({
      success: true,
      message: 'Selection saved successfully',
      data: areas[areaIndex]
    });
  } catch (error) {
    console.error('Save area selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save selections',
      error: error.message
    });
  }
};

/**
 * Submit all selections
 */
exports.submitAllSelections = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { selections } = req.body;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        portalOpen: true
      }
    });

    if (!proposal) {
      return res.status(403).json({
        success: false,
        message: 'Portal is closed or proposal not found'
      });
    }

    // Get areas from proposal
    const areas = proposal.areas || [];
    
    // If selections are provided in new format (from ColorSelections component)
    if (selections && typeof selections === 'object') {
      // Update each area with its selections
      const updatedAreas = areas.map(area => {
        const areaSelection = selections[area.id];
        if (areaSelection) {
          return {
            ...area,
            selections: areaSelection
          };
        }
        return area;
      });

      // Validate all areas have complete selections
      const incomplete = updatedAreas.filter(area => {
        if (!area.selections) return true;
        const sel = area.selections;
        // Must have either a color selection or custom/other brand
        const hasColor = sel.colorId || sel.isCustom || sel.isOtherBrand;
        // Must have a sheen
        const hasSheen = sel.sheen;
        return !hasColor || !hasSheen;
      });

      if (incomplete.length > 0) {
        return res.status(400).json({
          success: false,
          message: `All areas must have complete selections. ${incomplete.length} area(s) incomplete.`,
          incompleteAreas: incomplete.map(a => a.name)
        });
      }

      // Save updated areas back to proposal
      await proposal.update({
        areas: updatedAreas,
        selectionsComplete: true,
        selectionsCompletedAt: new Date(),
        portalOpen: false
      });
    } else {
      // Old format validation (from ProductSelections component)
      const incomplete = areas.filter(area => !area.selections || !area.selections.productId);

      if (incomplete.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All areas must have complete selections'
        });
      }

      // Lock portal and mark selections complete
      await proposal.update({
        selectionsComplete: true,
        selectionsCompletedAt: new Date(),
        portalOpen: false
      });
    }

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'selections_submitted',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: { proposalId },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send email notification to contractor
    try {
      const contractor = await proposal.getUser();
      if (contractor && contractor.email) {
        await emailService.sendSelectionsCompletedEmail(contractor.email, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          selectedTier: proposal.selectedTier,
          id: proposal.id
        });
      }
    } catch (emailError) {
      console.error('Error sending selections completed email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Selections submitted successfully'
    });
  } catch (error) {
    console.error('Submit selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit selections',
      error: error.message
    });
  }
};

/**
 * Get available documents
 */
exports.getDocuments = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const documents = [];

    if (proposal.selectionsComplete) {
      documents.push(
        { type: 'work_order', title: 'Work Order', available: true },
        { type: 'store_order', title: 'Store Order Sheet', available: true },
        { type: 'material_list', title: 'Material List', available: true }
      );
    }

    documents.push(
      { type: 'proposal', title: 'Original Proposal', available: true }
    );

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
};

/**
 * Download document
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { docType } = req.params;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Generate PDF based on docType
    let filePath;
    try {
      switch (docType) {
        case 'work_order':
          if (!proposal.selectionsComplete) {
            return res.status(400).json({
              success: false,
              message: 'Work order not available until selections are complete'
            });
          }
          filePath = await documentService.generateWorkOrder(proposal);
          break;
        case 'material_list':
          if (!proposal.selectionsComplete) {
            return res.status(400).json({
              success: false,
              message: 'Material list not available until selections are complete'
            });
          }
          filePath = await documentService.generateMaterialList(proposal);
          break;
        case 'store_order':
          if (!proposal.selectionsComplete) {
            return res.status(400).json({
              success: false,
              message: 'Store order not available until selections are complete'
            });
          }
          filePath = await documentService.generateStoreOrder(proposal);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid document type'
          });
      }

      // Send file
      res.download(filePath, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up temp file
        documentService.cleanupFile(filePath);
      });
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate document',
        error: pdfError.message
      });
    }
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: error.message
    });
  }
};

/**
 * Create Stripe payment intent for deposit
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { tier } = req.body;
    const customerId = req.user.id;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        status: 'accepted'
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or not accepted'
      });
    }

    // Calculate deposit amount (use depositAmount field or calculate from total)
    const depositAmount = proposal.depositAmount || (proposal.total * 0.5); // 50% default

    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deposit amount'
      });
    }

    // Create Stripe payment intent
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(depositAmount * 100), // Amount in cents
        currency: 'usd',
        metadata: {
          proposalId: proposal.id,
          quoteNumber: proposal.quoteNumber,
          customerId: customerId,
          customerEmail: proposal.customerEmail,
          selectedTier: proposal.selectedTier
        },
        automatic_payment_methods: {
          enabled: true,
        }
      });

      res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          amount: depositAmount,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
        }
      });
    } catch (stripeError) {
      console.error('Stripe payment intent error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        error: stripeError.message
      });
    }
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
};

/**
 * Verify deposit payment and open customer portal
 * Called after successful Stripe payment
 * Implements idempotency and comprehensive error handling
 */
exports.verifyDepositAndOpenPortal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { paymentIntentId } = req.body;
    const customerId = req.user?.id || 212;

    // Validate input
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        status: 'accepted'
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or not in accepted status'
      });
    }

    // IDEMPOTENCY CHECK: If deposit already verified with same transaction ID, return success
    if (proposal.depositVerified && proposal.depositTransactionId === paymentIntentId) {
      return res.json({
        success: true,
        message: 'Deposit already verified for this payment',
        data: {
          portalOpen: proposal.portalOpen,
          portalExpiresAt: proposal.portalClosedAt,
          portalDurationDays: Math.ceil((new Date(proposal.portalClosedAt) - new Date(proposal.portalOpenedAt)) / (1000 * 60 * 60 * 24)),
          redirectTo: `/portal/finish-standards/${proposalId}`,
          alreadyProcessed: true
        }
      });
    }

    // EDGE CASE: Deposit verified but different transaction ID (possible fraud/error)
    if (proposal.depositVerified && proposal.depositTransactionId !== paymentIntentId) {
      console.error(`Payment verification conflict: Proposal ${proposalId} already has transaction ${proposal.depositTransactionId}, attempted ${paymentIntentId}`);
      return res.status(409).json({
        success: false,
        message: 'Deposit has already been verified with a different payment. Please contact support.',
        code: 'PAYMENT_CONFLICT'
      });
    }

    // Verify payment intent with Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // COMPREHENSIVE STATUS CHECKS
      if (paymentIntent.status === 'succeeded') {
        // Payment successful - continue processing
        console.log(`Payment ${paymentIntentId} verified as succeeded`);
      } else if (paymentIntent.status === 'processing') {
        // Payment still processing - ask customer to wait
        return res.status(202).json({
          success: false,
          message: 'Payment is still processing. Please wait a moment and try again.',
          code: 'PAYMENT_PROCESSING',
          status: 'processing'
        });
      } else if (paymentIntent.status === 'requires_payment_method') {
        // Payment failed - needs new payment method
        return res.status(400).json({
          success: false,
          message: 'Payment failed. Please try again with a different payment method.',
          code: 'PAYMENT_FAILED',
          status: 'requires_payment_method'
        });
      } else if (paymentIntent.status === 'canceled') {
        // Payment canceled
        return res.status(400).json({
          success: false,
          message: 'Payment was canceled. Please try again.',
          code: 'PAYMENT_CANCELED',
          status: 'canceled'
        });
      } else {
        // Unknown status
        console.error(`Unexpected payment status: ${paymentIntent.status}`);
        return res.status(400).json({
          success: false,
          message: `Payment status is ${paymentIntent.status}. Please contact support.`,
          code: 'PAYMENT_UNEXPECTED_STATUS',
          status: paymentIntent.status
        });
      }

      // SECURITY: Verify payment amount matches expected deposit
      const expectedAmountCents = Math.round(proposal.depositAmount * 100);
      if (paymentIntent.amount !== expectedAmountCents) {
        console.error(`Payment amount mismatch: Expected ${expectedAmountCents}, got ${paymentIntent.amount}`);
        return res.status(400).json({
          success: false,
          message: 'Payment amount does not match expected deposit. Please contact support.',
          code: 'AMOUNT_MISMATCH'
        });
      }

      // SECURITY: Verify payment metadata matches proposal
      if (paymentIntent.metadata.proposalId !== proposalId.toString()) {
        console.error(`Payment metadata mismatch: Expected proposal ${proposalId}, got ${paymentIntent.metadata.proposalId}`);
        return res.status(400).json({
          success: false,
          message: 'Payment does not match this proposal. Please contact support.',
          code: 'PROPOSAL_MISMATCH'
        });
      }

    } catch (stripeError) {
      console.error('Stripe verification error:', stripeError);
      
      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment information. Please try again.',
          code: 'INVALID_PAYMENT_INTENT'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment with Stripe. Please try again.',
        error: stripeError.message,
        code: 'STRIPE_VERIFICATION_ERROR'
      });
    }

    // Get contractor settings for portal duration
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({
      where: { tenantId: proposal.tenantId }
    });

    const portalDurationDays = settings?.portalDurationDays || 14;
    const portalExpiresAt = new Date();
    portalExpiresAt.setDate(portalExpiresAt.getDate() + portalDurationDays);

    // CRITICAL: Use transaction for atomic update with rollback capability
    const sequelize = proposal.sequelize;
    const transaction = await sequelize.transaction();

    try {
      // Update proposal - mark deposit as verified and open portal
      await proposal.update({
        depositVerified: true,
        depositVerifiedAt: new Date(),
        // depositVerifiedBy is for contractor verification, not customer self-service payment
        depositPaymentMethod: 'stripe',
        depositTransactionId: paymentIntentId,
        portalOpen: true,
        portalOpenedAt: new Date(),
        portalClosedAt: portalExpiresAt, // Set when portal should auto-close
        status: 'deposit_paid'
      }, { transaction });

      // Commit transaction - all changes saved atomically
      await transaction.commit();
      console.log(`Proposal ${proposalId} deposit verified and portal opened successfully`);
      
    } catch (dbError) {
      // ROLLBACK: Database update failed, rollback transaction
      await transaction.rollback();
      console.error('Database update failed, transaction rolled back:', dbError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process payment verification. Your payment was successful but portal could not be opened. Please contact support.',
        code: 'DATABASE_UPDATE_FAILED',
        error: dbError.message,
        paymentIntentId // Include for support reference
      });
    }

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'deposit_verified',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        proposalId,
        paymentIntentId,
        amount: paymentIntent.amount / 100,
        portalExpiresAt
      },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send confirmation email to customer with portal link
    try {
      const portalLink = `${process.env.FRONTEND_URL}/portal/selections/${proposalId}`;
      await emailService.sendPortalAccessEmail(proposal.customerEmail, {
        customerName: proposal.customerName,
        quoteNumber: proposal.quoteNumber,
        portalLink,
        expiresAt: portalExpiresAt.toLocaleDateString(),
        depositAmount: proposal.depositAmount
      });
    } catch (emailError) {
      console.error('Error sending portal access email:', emailError);
    }

    res.json({
      success: true,
      message: 'Deposit verified! Your customer portal is now open.',
      data: {
        portalOpen: true,
        portalExpiresAt,
        portalDurationDays,
        redirectTo: `/portal/finish-standards/${proposalId}`
      }
    });
  } catch (error) {
    console.error('Verify deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify deposit',
      error: error.message
    });
  }
};

/**
 * Check payment status for recovery/debugging
 * Allows customer to check if their payment succeeded without triggering new processing
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { paymentIntentId } = req.query;
    const customerId = req.user?.id || 212;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const status = {
      proposalId: proposal.id,
      proposalStatus: proposal.status,
      depositVerified: proposal.depositVerified,
      portalOpen: proposal.portalOpen,
      transactionId: proposal.depositTransactionId
    };

    // If payment intent ID provided, check with Stripe
    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        status.stripeStatus = paymentIntent.status;
        status.stripeAmount = paymentIntent.amount / 100;
        status.stripeCreated = new Date(paymentIntent.created * 1000);
        
        // Check if matches our records
        status.transactionMatches = proposal.depositTransactionId === paymentIntentId;
      } catch (stripeError) {
        status.stripeError = stripeError.message;
      }
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};

/**
 * Check portal status and auto-lock if expired
 */
exports.checkPortalStatus = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.user?.id || 212;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Check if portal should be auto-locked
    let portalStatus = {
      isOpen: proposal.portalOpen,
      expiresAt: proposal.portalClosedAt,
      isExpired: false,
      selectionsComplete: proposal.selectionsComplete
    };

    if (proposal.portalOpen && proposal.portalClosedAt) {
      const now = new Date();
      const expiryDate = new Date(proposal.portalClosedAt);
      
      if (now > expiryDate) {
        // Auto-lock portal
        await proposal.update({
          portalOpen: false,
          portalClosedAt: now
        });

        portalStatus.isOpen = false;
        portalStatus.isExpired = true;

        // Notify contractor
        try {
          const User = require('../models/User');
          const contractor = await User.findByPk(proposal.userId);
          if (contractor && contractor.email) {
            await emailService.sendPortalExpiredEmail(contractor.email, {
              quoteNumber: proposal.quoteNumber,
              customerName: proposal.customerName,
              proposalId: proposal.id
            });
          }
        } catch (emailError) {
          console.error('Error sending portal expired email:', emailError);
        }
      }
    }

    res.json({
      success: true,
      data: portalStatus
    });
  } catch (error) {
    console.error('Check portal status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check portal status',
      error: error.message
    });
  }
};

/**
 * Get all sheens for product selection
 */
exports.getSheens = async (req, res) => {
  try {
    // Return standard paint sheens
    const sheens = [
      { id: 1, name: 'Flat', description: 'No sheen, hides imperfections' },
      { id: 2, name: 'Matte', description: 'Low sheen, minimal light reflection' },
      { id: 3, name: 'Eggshell', description: 'Slight sheen, easy to clean' },
      { id: 4, name: 'Satin', description: 'Soft sheen, durable' },
      { id: 5, name: 'Semi-Gloss', description: 'Noticeable sheen, moisture resistant' },
      { id: 6, name: 'Gloss', description: 'High shine, very durable' }
    ];

    res.json({
      success: true,
      data: sheens
    });
  } catch (error) {
    console.error('Get sheens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sheens',
      error: error.message
    });
  }
};

// Tier upgrade - create additional payment intent
exports.upgradeTier = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { newTier, additionalAmount } = req.body;
    const clientId = req.client.id;

    if (!['good', 'better', 'best'].includes(newTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier selection'
      });
    }

    const quote = await Quote.findOne({
      where: { id: proposalId, clientId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!quote.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Initial deposit must be paid before upgrading tier'
      });
    }

    // Store upgrade request in quote
    await quote.update({
      pendingTierUpgrade: newTier,
      tierUpgradeAmount: additionalAmount
    });

    res.json({
      success: true,
      message: 'Tier upgrade request created',
      data: {
        proposalId,
        newTier,
        additionalAmount
      }
    });
  } catch (error) {
    console.error('Upgrade tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process tier upgrade',
      error: error.message
    });
  }
};

// Request tier change (downgrade or upgrade approval)
exports.requestTierChange = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { newTier, reason } = req.body;
    const clientId = req.client.id;

    if (!['good', 'better', 'best'].includes(newTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier selection'
      });
    }

    const quote = await Quote.findOne({
      where: { id: proposalId, clientId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!quote.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Tier is not locked yet. You can change it freely before deposit payment.'
      });
    }

    // Create a tier change request (can be stored in quote or separate table)
    await quote.update({
      tierChangeRequest: newTier,
      tierChangeReason: reason,
      tierChangeRequestedAt: new Date()
    });

    // TODO: Send notification to contractor about tier change request

    res.json({
      success: true,
      message: 'Tier change request submitted successfully. Your contractor will review it.',
      data: {
        proposalId,
        requestedTier: newTier,
        currentTier: quote.selectedTier
      }
    });
  } catch (error) {
    console.error('Request tier change error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit tier change request',
      error: error.message
    });
  }
};

module.exports = exports;
