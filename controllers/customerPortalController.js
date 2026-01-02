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
      clientId: customerId
    };

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { quoteNumber: { [Op.iLike]: `%${search}%` } },
        { customerName: { [Op.iLike]: `%${search}%` } },
        { customerEmail: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add status filter
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
        id: proposalId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    res.json({
      success: true,
      data: proposal
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

    // Check if quote is still valid
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This quote has expired. Please contact your contractor.'
      });
    }

    // Calculate deposit amount based on contractor settings or default 50%
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({
      where: { tenantId: proposal.tenantId }
    });
    
    const depositPercent = settings?.depositPercentage || 50;
    const depositAmount = (parseFloat(proposal.total) * depositPercent / 100).toFixed(2);

    // Update proposal status - mark as accepted but portal remains closed until deposit
    await proposal.update({
      status: 'accepted',
      selectedTier,
      depositAmount,
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
    const { brand, productId, colorId, customColor, sheen } = req.body;
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
      brand,
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
        brand,
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

    // Validate all areas have selections
    const areas = proposal.areas || [];
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
 */
exports.verifyDepositAndOpenPortal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { paymentIntentId } = req.body;
    const customerId = req.user?.id || 212;

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        status: 'accepted',
        depositVerified: false
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or deposit already verified'
      });
    }

    // Verify payment intent with Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment not completed'
        });
      }
    } catch (stripeError) {
      console.error('Stripe verification error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: stripeError.message
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

    // Update proposal - mark deposit as verified and open portal
    await proposal.update({
      depositVerified: true,
      depositVerifiedAt: new Date(),
      depositVerifiedBy: customerId,
      depositPaymentMethod: 'stripe',
      depositTransactionId: paymentIntentId,
      portalOpen: true,
      portalOpenedAt: new Date(),
      portalClosedAt: portalExpiresAt, // Set when portal should auto-close
      status: 'deposit_paid'
    });

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

module.exports = exports;
