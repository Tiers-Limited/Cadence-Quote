// routes/proposalDefaults.js
const express = require('express');
const router = express.Router();
const proposalDefaultsController = require('../controllers/proposalDefaultsController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all proposal defaults
router.get('/', proposalDefaultsController.getProposalDefaults);

// Update all proposal defaults
router.put('/', proposalDefaultsController.updateProposalDefaults);

// Update specific section
router.put('/:section', proposalDefaultsController.updateSection);

module.exports = router;
