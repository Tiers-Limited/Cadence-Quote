// routes/customerPortal.js
// DEPRECATED: This file is being phased out in favor of customerPortalRoutes.js
// which uses magic link authentication instead of JWT
// Keeping for backward compatibility with existing JWT-authenticated flows

const express = require('express');
const router = express.Router();
const customerPortalController = require('../controllers/customerPortalController');
const brandController = require('../controllers/brandController');
const globalProductController = require('../controllers/globalProductController');
const globalColorController = require('../controllers/globalColorController');
const { customerSessionAuth } = require('../middleware/customerSessionAuth');

// All routes require magic link session authentication
router.use(customerSessionAuth);

// ===== PROPOSAL ROUTES (LEGACY - Use /quotes in new portal) =====
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

// Acknowledge finish standards
router.post('/proposals/:proposalId/acknowledge-finish-standards', 
  customerPortalController.acknowledgeFinishStandards
);

// Save area selections
router.post('/proposals/:proposalId/areas/:areaId/selections', 
  customerPortalController.saveAreaSelections
);

// Submit all selections
router.post('/proposals/:proposalId/submit-selections', 
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

// ===== JOB ROUTES =====
// Get all jobs for customer
router.get('/jobs', customerPortalController.getCustomerJobs);

// Get job detail with progress
router.get('/jobs/:jobId', customerPortalController.getJobDetail);

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
