const express = require('express');
const router = express.Router();
const customerPortalController = require('../controllers/customerPortalController');
const { customerSessionAuth } = require('../middleware/customerSessionAuth');
router.get('/proposals/:proposalId/documents/:docType/view', customerPortalController.viewDocument);
router.use(customerSessionAuth);
// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * Access portal via magic link
 * No authentication required - magic link token validates access
 * Accept both GET and POST to match existing frontend calls
 */
router.route('/access/:token')
	.get(customerPortalController.accessPortal)
	.post(customerPortalController.accessPortal);

/**
 * Get tenant branding (public)
 * Used for displaying contractor logo/colors before authentication
 */
router.get('/branding/:tenantId', customerPortalController.getBranding);

// ============================================================================
// SESSION MANAGEMENT ROUTES
// ============================================================================

/**
 * Validate existing session
 * Checks if session token is still valid
 */
router.post('/validate-session', customerPortalController.validateSession);

/**
 * Request OTP for multi-job verification
 * Sends 6-digit code to customer's email/phone
 */
router.post('/request-otp', customerPortalController.requestOTP);

/**
 * Verify OTP and upgrade session
 * Unlocks access to all customer's jobs with this contractor
 */
router.post('/verify-otp', customerPortalController.verifyOTP);

// Get documents
router.get('/proposals/:proposalId/documents', customerPortalController.getDocuments);

// Public document access (supports ?token=... for magic-link iframe/viewing and download)
// These are defined before the authenticated middleware so the endpoints can accept a token
router.get('/proposals/:proposalId/documents/:docType/download', customerPortalController.downloadDocument);
router.get('/proposals/:proposalId/documents/:docType/view', customerPortalController.viewDocument);

// ============================================================================
// AUTHENTICATED ROUTES (Require Valid Session)
// All routes below require Bearer token in Authorization header
// ============================================================================


/**
 * Get all accessible quotes for current session
 * Returns list of quotes customer can view
 */
router.get('/quotes', customerPortalController.getQuotes);

/**
 * Get specific quote details
 * Full quote information including products, areas, pricing
 */
router.get('/quotes/:id', customerPortalController.getQuoteDetails);

/**
 * Mark quote as viewed
 */
router.post('/quotes/:id/view', customerPortalController.markQuoteViewed);

/**
 * Approve a quote
 * Customer accepts the proposal
 */
router.post('/quotes/:id/approve', customerPortalController.approveQuote);

/**
 * Reject a quote
 * Customer declines the proposal
 */
router.post('/quotes/:id/reject', customerPortalController.rejectQuote);

// ============================================================================
// JOB MANAGEMENT ROUTES
// ============================================================================

/**
 * Get all jobs for current customer
 * Returns list of jobs customer can view
 */
router.get('/jobs', customerPortalController.getCustomerJobs);

/**
 * Get job calendar (view-only) for current customer
 */
router.get('/jobs/calendar', customerPortalController.getCustomerJobCalendar);

/**
 * Get specific job details with progress
 * Full job information including timeline, milestones, updates
 */
router.get('/jobs/:jobId', customerPortalController.getJobDetail);

// ============================================================================
// PRODUCT SELECTION DATA ROUTES
// ============================================================================

/**
 * Get all brands for product selection
 */
router.get('/brands', require('../controllers/brandController').getAllBrands);

/**
 * Get products (optionally filtered by brand)
 */
router.get('/products', require('../controllers/globalProductController').getAllGlobalProducts);

/**
 * Get colors (optionally filtered by brand)
 */
router.get('/colors', require('../controllers/globalColorController').getAllGlobalColors);

/**
 * Get available sheens
 */
router.get('/sheens', customerPortalController.getSheens);

/**
 * Get product configurations for customer selections
 * Returns contractor's configured products with pricing tiers
 */
router.get('/product-configs', require('../controllers/productConfigController').getAllProductConfigs);

// ============================================================================
// LEGACY PROPOSAL ROUTES (For Backward Compatibility)
// ============================================================================

/**
 * Existing routes from old implementation
 * TODO: Review and integrate or deprecate these routes
 */

// Get customer's proposals (paginated)
router.get('/proposals', customerPortalController.getCustomerProposals);

// Get single proposal details
router.get('/proposals/:id', customerPortalController.getProposalDetail);

// Acknowledge finish standards
router.post('/proposals/:id/acknowledge-standards', customerPortalController.acknowledgeFinishStandards);

// Tier upgrade (after deposit verified)
router.post('/proposals/:id/upgrade-tier', customerPortalController.upgradeTier);

// Request tier change (downgrade or upgrade approval)
router.post('/proposals/:id/request-tier-change', customerPortalController.requestTierChange);

// Save area selections
router.post('/proposals/:proposalId/areas/:areaId/selections', customerPortalController.saveAreaSelections);

// Submit all selections
// router.post('/proposals/:proposalId/submit-selections', customerPortalController.submitAllSelections);

// Get documents
router.get('/proposals/:proposalId/documents', customerPortalController.getDocuments);

// Public document access (supports ?token=... for magic-link iframe/viewing and download)
// These are defined before the authenticated middleware so the endpoints can accept a token
// in query string for preview access without a Bearer header.
router.get('/proposals/:proposalId/documents/:docType/download', customerPortalController.downloadDocument);
router.get('/proposals/:proposalId/documents/:docType/view', customerPortalController.viewDocument);

// Create payment intent for deposit
router.post('/proposals/:id/create-payment-intent', customerPortalController.createPaymentIntent);

// Verify deposit payment and open portal
router.post('/proposals/:id/verify-deposit', customerPortalController.verifyDepositAndOpenPortal);

// Check payment status (for recovery/debugging)
router.get('/proposals/:proposalId/payment-status', customerPortalController.checkPaymentStatus);

// Check portal status (auto-lock if expired)
router.get('/proposals/:proposalId/portal-status', customerPortalController.checkPortalStatus);

// REMOVED: Accept/decline proposal routes - now handled by proposalAcceptanceRouter
// which provides proper Stripe payment integration and deposit handling
// These legacy routes would conflict with the new routes at /api/customer-portal/proposals
// router.post('/proposals/:id/accept', customerPortalController.acceptProposal);
// router.post('/proposals/:id/decline', customerPortalController.declineProposal);

module.exports = router;
