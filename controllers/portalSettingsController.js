const MagicLinkService = require('../services/magicLinkService');
const emailService = require('../services/emailService');
const { validationResult } = require('express-validator');

/**
 * Portal Settings Controller
 * Handles contractor admin endpoints for managing customer portal
 */

/**
 * Get portal settings for contractor
 * GET /api/admin/portal/settings
 */
exports.getPortalSettings = async (req, res) => {
  try {
    const { tenantId } = req.user; // From auth middleware

    const settings = await MagicLinkService.getPortalSettings(tenantId);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error getting portal settings:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update portal settings for contractor
 * PUT /api/admin/portal/settings
 */
exports.updatePortalSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { tenantId } = req.user;
    const {
      defaultExpiryDays,
      maxExpiryDays,
      autoCleanupEnabled,
      autoCleanupDays,
      requireOTPForMultiJob,
      portalBrandingConfig,
    } = req.body;

    const updatedSettings = await MagicLinkService.updatePortalSettings(tenantId, {
      defaultExpiryDays,
      maxExpiryDays,
      autoCleanupEnabled,
      autoCleanupDays,
      requireOTPForMultiJob,
      portalBrandingConfig,
    });

    res.json({
      success: true,
      message: 'Portal settings updated successfully',
      data: updatedSettings,
    });
  } catch (error) {
    console.error('Error updating portal settings:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get all active magic links for contractor
 * GET /api/admin/portal/links
 */
exports.getActiveMagicLinks = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    const result = await MagicLinkService.getActiveMagicLinks(tenantId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting magic links:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get all active sessions for contractor
 * GET /api/admin/portal/sessions
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 50, offset = 0 } = req.query;

    const result = await MagicLinkService.getActiveSessions(tenantId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Revoke all sessions for a customer (emergency)
 * POST /api/admin/portal/customers/:clientId/revoke-all
 */
exports.revokeAllCustomerSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    const result = await MagicLinkService.revokeAllClientSessionsAdmin(tenantId, parseInt(clientId));

    res.json({
      success: true,
      message: 'All customer sessions and links revoked',
      data: result,
    });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Resend magic link to customer
 * POST /api/admin/portal/links/:linkId/resend
 */
exports.resendMagicLink = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { linkId } = req.params;

    const newLink = await MagicLinkService.resendMagicLinkAdmin(tenantId, parseInt(linkId));

    // Send email
    if (newLink.magicLink.email) {
      try {
        await emailService.sendMagicLink({
          to: newLink.magicLink.email,
          magicLinkToken: newLink.token,
          clientName: newLink.magicLink.Client?.firstName || 'Valued Customer',
          tenantBranding: req.user.tenantBranding,
          expiryDays: newLink.magicLink.expiryDurationDays,
          portalUrl: process.env.CUSTOMER_PORTAL_URL,
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail if email fails, link was created
      }
    }

    res.json({
      success: true,
      message: 'Magic link resent to customer',
      data: {
        linkId: newLink.magicLink.id,
        email: newLink.magicLink.email,
        expiresAt: newLink.magicLink.expiresAt,
        remainingDays: newLink.magicLink.getRemainingDays(),
      },
    });
  } catch (error) {
    console.error('Error resending magic link:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get expiry analytics
 * GET /api/admin/portal/analytics/expiry
 */
exports.getExpiryAnalytics = async (req, res) => {
  try {
    const { tenantId } = req.user;

    const analytics = await MagicLinkService.getExpiryAnalytics(tenantId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error getting expiry analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Run cleanup on expired data
 * POST /api/admin/portal/cleanup
 * Admin only - requires special permission
 */
exports.runCleanup = async (req, res) => {
  try {
    const { tenantId } = req.user;

    const result = await MagicLinkService.cleanupExpiredPortalData(tenantId);

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Send magic link to customer (contractor triggered)
 * POST /api/admin/portal/send-link
 */
exports.sendMagicLinkToCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { tenantId } = req.user;
    const { clientId, email, quoteId, expiryDays } = req.body;

    // Get portal settings for default expiry
    const settings = await MagicLinkService.getPortalSettings(tenantId);
    const daysToExpire = expiryDays || settings.defaultExpiryDays;

    // Create magic link
    const magicLink = await MagicLinkService.createMagicLink({
      tenantId,
      clientId: parseInt(clientId),
      quoteId: quoteId ? parseInt(quoteId) : null,
      email,
      purpose: quoteId ? 'quote_view' : 'portal_access',
      expiryDays: daysToExpire,
      allowMultiJobAccess: true,
    });

    // Send email
    try {
      await emailService.sendMagicLink({
        to: email,
        magicLinkToken: magicLink.token,
        clientName: magicLink.magicLink.Client?.firstName || 'Valued Customer',
        tenantBranding: req.user.tenantBranding,
        expiryDays: daysToExpire,
        portalUrl: process.env.CUSTOMER_PORTAL_URL,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Continue - link was created even if email failed
    }

    res.json({
      success: true,
      message: 'Magic link sent to customer',
      data: {
        linkId: magicLink.magicLink.id,
        email: magicLink.magicLink.email,
        expiresAt: magicLink.magicLink.expiresAt,
        remainingDays: daysToExpire,
      },
    });
  } catch (error) {
    console.error('Error sending magic link:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = exports;
