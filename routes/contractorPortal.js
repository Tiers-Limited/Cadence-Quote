// routes/contractorPortal.js
const express = require('express');
const router = express.Router();
const contractorPortalController = require('../controllers/contractorPortalController');
const { auth, authorize } = require('../middleware/auth');

// All routes require authentication and contractor role
router.use(auth);
router.use(authorize(['contractor_admin', 'contractor_user']));

// Manually verify deposit (cash, check, wire transfer)
router.post('/proposals/:proposalId/verify-deposit', contractorPortalController.verifyDeposit);

// Open portal for customer
router.post('/proposals/:proposalId/open-portal', contractorPortalController.openPortal);

// Close portal
router.post('/proposals/:proposalId/close-portal', contractorPortalController.closePortal);

// Get customer selections
router.get('/proposals/:proposalId/selections', contractorPortalController.getCustomerSelections);

// Update deposit amount
router.put('/proposals/:proposalId/deposit-amount', contractorPortalController.updateDepositAmount);

module.exports = router;
