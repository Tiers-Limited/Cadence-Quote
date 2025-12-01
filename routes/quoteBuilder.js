// routes/quoteBuilder.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const quoteBuilderController = require('../controllers/quoteBuilderController');

// All routes require authentication
router.use(auth);

/**
 * @route   POST /api/quote-builder/detect-client
 * @desc    Detect existing client by email or phone
 * @access  Private (Contractor)
 */
router.post('/detect-client', quoteBuilderController.detectExistingClient);

/**
 * @route   POST /api/quote-builder/save-draft
 * @desc    Create or update quote draft (auto-save)
 * @access  Private (Contractor)
 */
router.post('/save-draft', quoteBuilderController.saveDraft);

/**
 * @route   GET /api/quote-builder/drafts
 * @desc    Get all draft quotes for current user
 * @access  Private (Contractor)
 */
router.get('/drafts', quoteBuilderController.getDrafts);

/**
 * @route   GET /api/quote-builder/:id
 * @desc    Get quote by ID
 * @access  Private (Contractor)
 */
router.get('/:id', quoteBuilderController.getQuoteById);

/**
 * @route   POST /api/quote-builder/calculate
 * @desc    Calculate quote totals
 * @access  Private (Contractor)
 */
router.post('/calculate', quoteBuilderController.calculateQuote);

/**
 * @route   POST /api/quote-builder/:id/send
 * @desc    Send quote to client
 * @access  Private (Contractor)
 */
router.post('/:id/send', quoteBuilderController.sendQuote);

module.exports = router;
