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
 * @desc    Create or update quote draft (enhanced auto-save with conflict detection)
 * @access  Private (Contractor)
 */
router.post('/save-draft', quoteBuilderController.saveDraft);

/**
 * @route   POST /api/quote-builder/resolve-conflict
 * @desc    Resolve quote conflict by choosing server or client version
 * @access  Private (Contractor)
 */
router.post('/resolve-conflict', quoteBuilderController.resolveConflict);

/**
 * @route   GET /api/quote-builder/drafts
 * @desc    Get all draft quotes for current user
 * @access  Private (Contractor)
 */
router.get('/drafts', quoteBuilderController.getDrafts);

/**
 * @route   GET /api/quote-builder/:quoteId/products/:pricingScheme
 * @desc    Get products by pricing scheme for a quote
 * @access  Private (Contractor)
 */
router.get('/:quoteId/products/:pricingScheme', quoteBuilderController.getProductsByPricingScheme);

/**
 * @route   GET /api/quote-builder/:quoteId/product-configuration
 * @desc    Get product configuration for a quote with available products
 * @access  Private (Contractor)
 */
router.get('/:quoteId/product-configuration', quoteBuilderController.getProductConfiguration);

/**
 * @route   PUT /api/quote-builder/:quoteId/product-configuration
 * @desc    Update product configuration for a quote
 * @access  Private (Contractor)
 */
router.put('/:quoteId/product-configuration', quoteBuilderController.updateProductConfiguration);

/**
 * @route   POST /api/quote-builder/:quoteId/product-configuration/apply-to-all
 * @desc    Apply a product to all specified categories
 * @access  Private (Contractor)
 */
router.post('/:quoteId/product-configuration/apply-to-all', quoteBuilderController.applyProductToAll);

/**
 * @route   POST /api/quote-builder/:quoteId/product-configuration/validate
 * @desc    Validate product configuration for a quote
 * @access  Private (Contractor)
 */
router.post('/:quoteId/product-configuration/validate', quoteBuilderController.validateProductConfiguration);

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
 * @route   POST /api/quote-builder/calculate-tiers
 * @desc    Calculate pricing for all GBB tiers
 * @access  Private (Contractor)
 */
router.post('/calculate-tiers', quoteBuilderController.calculateTierPricing);

/**
 * @route   POST /api/quote-builder/:id/send
 * @desc    Send quote to client
 * @access  Private (Contractor)
 */
router.post('/:id/send', quoteBuilderController.sendQuote);

/**
 * @route   GET /api/quote-builder/:id/proposal.pdf
 * @desc    Generate and stream proposal PDF for a quote
 * @access  Private (Contractor)
 */
router.get('/:id/proposal.pdf', quoteBuilderController.getProposalPdf);

module.exports = router;
