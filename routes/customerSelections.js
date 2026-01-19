// routes/customerSelections.js
// Routes for customer product/color/sheen selections

const express = require('express');
const router = express.Router();
const customerSelectionsController = require('../controllers/customerSelectionsController');
const { customerSessionAuth } = require('../middleware/customerSessionAuth');

// All routes require customer authentication
router.use(customerSessionAuth);

// Get selection options for a proposal
router.get('/:id/selection-options', customerSelectionsController.getSelectionOptions);

// Save selections (partial or complete)
router.post('/:id/selections', customerSelectionsController.saveSelections);

// Submit and lock selections (converts to job)
router.post('/:id/submit-selections', customerSelectionsController.submitSelections);

module.exports = router;
