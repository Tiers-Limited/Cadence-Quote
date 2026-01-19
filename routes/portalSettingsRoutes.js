const express = require('express');
const { body, param, query } = require('express-validator');
const portalSettingsController = require('../controllers/portalSettingsController');
const { adminAuth } = require('../middleware/adminAuth'); // Contractor admin auth
const { customerPortalRateLimiter } = require('../middleware/customerSessionAuth');

const router = express.Router();

/**
 * Portal Settings Admin Routes
 * All routes require contractor admin authentication
 * Base: /api/admin/portal
 */

// Get portal settings for contractor
router.get('/settings', 
  adminAuth,
  portalSettingsController.getPortalSettings
);

// Update portal settings
router.put('/settings',
  adminAuth,
  [
    body('defaultExpiryDays').optional().isInt({ min: 1, max: 365 }).withMessage('Default expiry must be 1-365 days'),
    body('maxExpiryDays').optional().isInt({ min: 1, max: 365 }).withMessage('Max expiry must be 1-365 days'),
    body('autoCleanupEnabled').optional().isBoolean().withMessage('Must be boolean'),
    body('autoCleanupDays').optional().isInt({ min: 1, max: 365 }).withMessage('Cleanup days must be 1-365'),
    body('requireOTPForMultiJob').optional().isBoolean().withMessage('Must be boolean'),
  ],
  portalSettingsController.updatePortalSettings
);

// Get all active magic links
router.get('/links',
  adminAuth,
  [
    query('limit').optional().isInt({ max: 100 }).withMessage('Limit max 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
  ],
  portalSettingsController.getActiveMagicLinks
);

// Get all active sessions
router.get('/sessions',
  adminAuth,
  [
    query('limit').optional().isInt({ max: 100 }).withMessage('Limit max 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
  ],
  portalSettingsController.getActiveSessions
);

// Get expiry analytics
router.get('/analytics/expiry',
  adminAuth,
  portalSettingsController.getExpiryAnalytics
);

// Send magic link to customer (contractor triggered)
router.post('/send-link',
  adminAuth,
  customerPortalRateLimiter, // Rate limit to prevent abuse
  [
    body('clientId').isInt().withMessage('Invalid client ID'),
    body('email').isEmail().withMessage('Invalid email'),
    body('expiryDays').optional().isInt({ min: 1, max: 365 }).withMessage('Expiry days must be 1-365'),
    body('quoteId').optional().isInt().withMessage('Invalid quote ID'),
  ],
  portalSettingsController.sendMagicLinkToCustomer
);

// Resend magic link to customer
router.post('/links/:linkId/resend',
  adminAuth,
  [
    param('linkId').isInt().withMessage('Invalid link ID'),
  ],
  portalSettingsController.resendMagicLink
);

// Revoke all sessions for a customer (emergency)
router.post('/customers/:clientId/revoke-all',
  adminAuth,
  [
    param('clientId').isInt().withMessage('Invalid client ID'),
  ],
  portalSettingsController.revokeAllCustomerSessions
);

// Run cleanup on expired data (restricted to super admin)
router.post('/cleanup',
  adminAuth,
  portalSettingsController.runCleanup
);

module.exports = router;
