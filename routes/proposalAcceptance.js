// routes/proposalAcceptance.js
// Routes for customer proposal acceptance with deposit payment

const express = require('express');
const router = express.Router();
const proposalAcceptanceController = require('../controllers/proposalAcceptanceController');
const { customerSessionAuth } = require('../middleware/customerSessionAuth');

// All routes require customer authentication
router.use(customerSessionAuth);

// Get proposal details
router.get('/:id', proposalAcceptanceController.getProposal);

// Accept proposal and create payment intent
router.post('/:id/accept', proposalAcceptanceController.acceptProposal);

// Confirm deposit payment
router.post('/:id/confirm-payment', proposalAcceptanceController.confirmDepositPayment);

// Reject proposal
router.post('/:id/reject', proposalAcceptanceController.rejectProposal);

module.exports = router;
