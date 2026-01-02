// routes/customerPortal.js
const express = require('express');
const router = express.Router();
const customerPortalController = require('../controllers/customerPortalController');
const { auth, authorize } = require('../middleware/auth');

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

// Acknowledge finish standards
router.post('/proposals/:proposalId/acknowledge-finish-standards', customerPortalController.acknowledgeFinishStandards);

// Save area selections
router.post('/proposals/:proposalId/areas/:areaId/selections', customerPortalController.saveAreaSelections);

// Submit all selections
router.post('/proposals/:proposalId/submit-selections', customerPortalController.submitAllSelections);

// Get documents
router.get('/proposals/:proposalId/documents', customerPortalController.getDocuments);

// Download document
router.get('/proposals/:proposalId/documents/:docType/download', customerPortalController.downloadDocument);

// Create payment intent for deposit
router.post('/proposals/:proposalId/create-payment-intent', customerPortalController.createPaymentIntent);

// Verify deposit payment and open portal
router.post('/proposals/:proposalId/verify-deposit', customerPortalController.verifyDepositAndOpenPortal);

// Check portal status (auto-lock if expired)
router.get('/proposals/:proposalId/portal-status', customerPortalController.checkPortalStatus);

module.exports = router;
