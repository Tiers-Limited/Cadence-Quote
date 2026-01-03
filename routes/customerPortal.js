// routes/customerPortal.js
const express = require('express');
const router = express.Router();
const customerPortalController = require('../controllers/customerPortalController');
const brandController = require('../controllers/brandController');
const globalProductController = require('../controllers/globalProductController');
const globalColorController = require('../controllers/globalColorController');
const { auth, authorize } = require('../middleware/auth');
const { checkPortalAccess, checkFinishStandardsAcknowledged } = require('../middleware/portalAccess');

// All routes require authentication and customer role
router.use(auth);
// router.use(authorize('customer', ));

// Get all proposals for customer
router.get('/proposals', customerPortalController.getCustomerProposals);

// Get specific proposal detail
router.get('/proposals/:proposalId', customerPortalController.getProposalDetail);

// Accept proposal with tier selection
router.post('/proposals/:proposalId/accept', customerPortalController.acceptProposal);

// Decline proposal
router.post('/proposals/:proposalId/decline', customerPortalController.declineProposal);

// Tier upgrade (after deposit verified)
router.post('/proposals/:proposalId/upgrade-tier', customerPortalController.upgradeTier);

// Request tier change (downgrade or upgrade approval)
router.post('/proposals/:proposalId/request-tier-change', customerPortalController.requestTierChange);

// Acknowledge finish standards (requires portal access)
router.post('/proposals/:proposalId/acknowledge-finish-standards', 
  checkPortalAccess, 
  customerPortalController.acknowledgeFinishStandards
);

// Save area selections (requires portal access + finish standards acknowledged)
router.post('/proposals/:proposalId/areas/:areaId/selections', 
  checkPortalAccess,
  checkFinishStandardsAcknowledged,
  customerPortalController.saveAreaSelections
);

// Submit all selections (requires portal access + finish standards acknowledged)
router.post('/proposals/:proposalId/submit-selections', 
  checkPortalAccess,
  checkFinishStandardsAcknowledged,
  customerPortalController.submitAllSelections
);

// Get documents
router.get('/proposals/:proposalId/documents', customerPortalController.getDocuments);

// Download document
router.get('/proposals/:proposalId/documents/:docType/download', customerPortalController.downloadDocument);

// Create payment intent for deposit
router.post('/proposals/:proposalId/create-payment-intent', customerPortalController.createPaymentIntent);

// Verify deposit payment and open portal
router.post('/proposals/:proposalId/verify-deposit', customerPortalController.verifyDepositAndOpenPortal);

// Check payment status (for recovery/debugging)
router.get('/proposals/:proposalId/payment-status', customerPortalController.checkPaymentStatus);

// Check portal status (auto-lock if expired)
router.get('/proposals/:proposalId/portal-status', customerPortalController.checkPortalStatus);

// ===== PRODUCT SELECTION DATA ROUTES =====
// Get all brands (for product selection)
router.get('/brands', brandController.getAllBrands);

// Get products (optionally filtered by brand)
router.get('/products', globalProductController.getAllGlobalProducts);

// Get colors (optionally filtered by brand)
router.get('/colors', globalColorController.getAllGlobalColors);

// Get sheens
router.get('/sheens', customerPortalController.getSheens);

module.exports = router;
