// controllers/contractorPortalController.js
// Contractor Portal Management - Manual deposit verification, portal controls

const Quote = require('../models/Quote');
const User = require('../models/User');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');

/**
 * Manually verify deposit (cash, check, wire transfer)
 */
exports.verifyDeposit = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { amount, paymentMethod, transactionId, notes } = req.body;
    const contractorId = req.user.id;

    // Validate payment method
    const validMethods = ['cash', 'check', 'wire_transfer', 'other'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    const proposal = await Quote.findOne({
      where: {
        id: proposalId,
        tenantId: req.user.tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (proposal.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Deposit already verified'
      });
    }

    // Update deposit verification
    await proposal.update({
      depositVerified: true,
      depositVerifiedAt: new Date(),
      depositVerifiedBy: contractorId,
      depositPaymentMethod: paymentMethod,
      depositTransactionId: transactionId || null,
      depositAmount: amount || proposal.depositAmount,
      portalOpen: true,
      portalOpenedAt: new Date()
    });

    // Create audit log
    await createAuditLog({
      userId: contractorId,
      tenantId: proposal.tenantId,
      action: 'deposit_verified_manual',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        paymentMethod,
        amount,
        transactionId,
        notes
      },
      req
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
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Deposit verified successfully',
      data: proposal
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
 * Open portal for customer selections
 */
exports.openPortal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const contractorId = req.user.id;

    const proposal = await Quote.findOne({
      where: {
        id: proposalId,
        tenantId: req.user.tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!proposal.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Deposit must be verified before opening portal'
      });
    }

    if (!proposal.finishStandardsAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'Customer must acknowledge finish standards first'
      });
    }

    // Open portal
    await proposal.update({
      portalOpen: true,
      portalOpenedAt: new Date()
    });

    // Create audit log
    await createAuditLog({
      userId: contractorId,
      tenantId: proposal.tenantId,
      action: 'portal_opened',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        reopened: proposal.selectionsComplete // If selections were already complete, this is a reopen
      },
      req
    });

    // Send email if portal is being reopened
    if (proposal.selectionsComplete) {
      try {
        await emailService.sendPortalReopenedEmail(proposal.customerEmail, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          id: proposal.id
        });
      } catch (emailError) {
        console.error('Error sending portal reopened email:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Portal opened successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Open portal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open portal',
      error: error.message
    });
  }
};

/**
 * Close portal
 */
exports.closePortal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const contractorId = req.user.id;

    const proposal = await Quote.findOne({
      where: {
        id: proposalId,
        tenantId: req.user.tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Close portal
    await proposal.update({
      portalOpen: false,
      portalClosedAt: new Date()
    });

    // Create audit log
    await createAuditLog({
      userId: contractorId,
      tenantId: proposal.tenantId,
      action: 'portal_closed',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        selectionsComplete: proposal.selectionsComplete
      },
      req
    });

    res.json({
      success: true,
      message: 'Portal closed successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Close portal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close portal',
      error: error.message
    });
  }
};

/**
 * Get customer selections for review
 */
exports.getCustomerSelections = async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await Quote.findOne({
      where: {
        id: proposalId,
        tenantId: req.user.tenantId
      },
      attributes: [
        'id',
        'quoteNumber',
        'customerName',
        'customerEmail',
        'selectedTier',
        'areas',
        'selectionsComplete',
        'selectionsCompletedAt',
        'portalOpen',
        'depositVerified'
      ]
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
    console.error('Get customer selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch selections',
      error: error.message
    });
  }
};

/**
 * Update deposit amount for proposal
 */
exports.updateDepositAmount = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { depositAmount } = req.body;
    const contractorId = req.user.id;

    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deposit amount'
      });
    }

    const proposal = await Quote.findOne({
      where: {
        id: proposalId,
        tenantId: req.user.tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (proposal.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change deposit amount after verification'
      });
    }

    await proposal.update({
      depositAmount: depositAmount
    });

    // Create audit log
    await createAuditLog({
      userId: contractorId,
      tenantId: proposal.tenantId,
      action: 'deposit_amount_updated',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        oldAmount: proposal.depositAmount,
        newAmount: depositAmount
      },
      req
    });

    res.json({
      success: true,
      message: 'Deposit amount updated successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Update deposit amount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update deposit amount',
      error: error.message
    });
  }
};

module.exports = exports;
