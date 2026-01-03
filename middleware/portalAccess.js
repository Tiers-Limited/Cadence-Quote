// middleware/portalAccess.js
// Middleware to check portal access and auto-lock expired portals

const Quote = require('../models/Quote');
const ContractorSettings = require('../models/ContractorSettings');
const emailService = require('../services/emailService');

/**
 * Check if customer portal is accessible and auto-lock if expired
 * This middleware should be used on all customer portal routes
 */
const checkPortalAccess = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.user?.id;

    if (!proposalId || !customerId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

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

    // Check if portal should be auto-locked due to expiration
    if (proposal.portalOpen && proposal.portalClosedAt) {
      const now = new Date();
      const expiryDate = new Date(proposal.portalClosedAt);

      // Get contractor settings to check if auto-lock is enabled
      const settings = await ContractorSettings.findOne({
        where: { tenantId: proposal.tenantId }
      });

      const autoLockEnabled = settings?.portalAutoLock !== false; // Default to true

      if (now > expiryDate && autoLockEnabled) {
        // Auto-lock the portal
        await proposal.update({
          portalOpen: false,
          portalClosedAt: now
        });

        // Notify contractor (don't wait for email)
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

        return res.status(403).json({
          success: false,
          message: 'Portal access has expired. Please contact your contractor to reopen.',
          code: 'PORTAL_EXPIRED'
        });
      }
    }

    // Check if portal is closed
    if (!proposal.portalOpen) {
      return res.status(403).json({
        success: false,
        message: 'Portal is currently closed. Please contact your contractor.',
        code: 'PORTAL_CLOSED'
      });
    }

    // Check if deposit is verified
    if (!proposal.depositVerified) {
      return res.status(403).json({
        success: false,
        message: 'Portal access requires verified deposit payment.',
        code: 'DEPOSIT_NOT_VERIFIED'
      });
    }

    // Check if selections are already complete
    if (proposal.selectionsComplete && req.path.includes('/selections')) {
      return res.status(403).json({
        success: false,
        message: 'Selections have already been submitted and locked.',
        code: 'SELECTIONS_COMPLETE'
      });
    }

    // Attach proposal to request for use in route handlers
    req.proposal = proposal;
    next();
  } catch (error) {
    console.error('Portal access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify portal access',
      error: error.message
    });
  }
};

/**
 * Check if finish standards need to be acknowledged
 */
const checkFinishStandardsAcknowledged = async (req, res, next) => {
  try {
    const proposal = req.proposal; // Should be attached by checkPortalAccess

    if (!proposal) {
      return res.status(400).json({
        success: false,
        message: 'Portal access check must run before this middleware'
      });
    }

    if (!proposal.finishStandardsAcknowledged) {
      return res.status(403).json({
        success: false,
        message: 'Please acknowledge finish standards before proceeding.',
        code: 'FINISH_STANDARDS_NOT_ACKNOWLEDGED',
        redirectTo: `/portal/finish-standards/${proposal.id}`
      });
    }

    next();
  } catch (error) {
    console.error('Finish standards check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify finish standards',
      error: error.message
    });
  }
};

module.exports = {
  checkPortalAccess,
  checkFinishStandardsAcknowledged
};
