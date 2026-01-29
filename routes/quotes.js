// routes/quotes.js
// Professional Quote Builder Routes - Optimized API endpoints

const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// All routes require authentication and contractor role
router.use(auth);
router.use(requireRole('contractor', 'contractor_admin'));

/**
 * @route   GET /api/quotes/products/minimal
 * @desc    Get minimal product list for dropdowns (paginated)
 * @query   page, limit, jobType (interior/exterior), search
 * @access  Contractor
 */
router.get('/products/minimal', quoteController.getMinimalProducts);

/**
 * @route   GET /api/quotes/products/:id/details
 * @desc    Get complete product details (sheens, labor rates, markup, tax)
 * @params  id - ProductConfig ID
 * @access  Contractor
 */
router.get('/products/:id/details', quoteController.getProductDetails);

/**
 * @route   GET /api/quotes/colors/minimal
 * @desc    Get minimal color list for dropdowns (paginated)
 * @query   page, limit, brandId, search
 * @access  Contractor
 */
router.get('/colors/minimal', quoteController.getMinimalColors);

/**
 * @route   GET /api/quotes/pricing-schemes
 * @desc    Get active pricing schemes for contractor
 * @access  Contractor
 */
router.get('/pricing-schemes', quoteController.getPricingSchemes);

/**
 * @route   GET /api/quotes/surface-dimensions/:surfaceType
 * @desc    Get dimension configuration for surface type (walls, ceiling, trim, etc.)
 * @params  surfaceType - Type of surface
 * @access  Contractor
 */
router.get('/surface-dimensions/:surfaceType', quoteController.getSurfaceDimensions);

/**
 * @route   GET /api/quotes/contractor-settings
 * @desc    Get contractor settings (markup, tax, terms, etc.)
 * @access  Contractor
 */
router.get('/contractor-settings', quoteController.getContractorSettings);

/**
 * @route   POST /api/quotes/calculate
 * @desc    Calculate quote totals based on selections
 * @body    { areas, pricingSchemeId, applyZipMarkup, zipMarkupPercent }
 * @access  Contractor
 */
router.post('/calculate', quoteController.calculateQuote);

// ====================
// Quote CRUD Endpoints
// ====================

/**
 * @route   POST /api/quotes/save
 * @desc    Save/Create a new quote
 * @access  Contractor
 */
router.post('/save', quoteController.saveQuote);

/**
 * @route   GET /api/quotes
 * @desc    Get all quotes with filters
 * @query   page, limit, status, jobType, search, dateFrom, dateTo, sortBy, sortOrder
 * @access  Contractor
 */
router.get('/', quoteController.getQuotes);

/**
 * @route   GET /api/quotes/:id
 * @desc    Get single quote by ID
 * @access  Contractor
 */
router.get('/:id', quoteController.getQuoteById);

/**
 * @route   PUT /api/quotes/:id
 * @desc    Update existing quote
 * @access  Contractor
 */
router.put('/:id', quoteController.updateQuote);

/**
 * @route   PUT /api/quotes/:id/status
 * @desc    Update quote status (send, approve, decline, archive)
 * @body    { status }
 * @access  Contractor
 */
router.put('/:id/status', quoteController.updateQuoteStatus);

/**
 * @route   DELETE /api/quotes/:id
 * @desc    Soft delete quote
 * @access  Contractor
 */
router.delete('/:id', quoteController.deleteQuote);

/**
 * @route   POST /api/quotes/:id/duplicate
 * @desc    Duplicate an existing quote
 * @access  Contractor
 */
router.post('/:id/duplicate', quoteController.duplicateQuote);

/**
 * @route   POST /api/quotes/recalculate-production-based
 * @desc    Recalculate all production-based quotes when production rates change
 * @access  Contractor
 */
router.post('/recalculate-production-based', quoteController.recalculateProductionBasedQuotes);

// ====================
// Product Configuration Endpoints
// ====================

/**
 * @route   GET /api/quotes/:quoteId/product-configuration
 * @desc    Get product configuration for a quote with available products
 * @params  quoteId - Quote ID
 * @access  Contractor
 */
router.get('/:quoteId/product-configuration', quoteController.getProductConfiguration);

/**
 * @route   PUT /api/quotes/:quoteId/product-configuration
 * @desc    Save product configuration for a quote
 * @params  quoteId - Quote ID
 * @body    productSets - Product configuration object, autoSaveVersion - Version for conflict detection
 * @access  Contractor
 */
router.put('/:quoteId/product-configuration', quoteController.updateProductConfiguration);

/**
 * @route   POST /api/quotes/:quoteId/product-configuration/apply-to-all
 * @desc    Apply a product to all specified categories
 * @params  quoteId - Quote ID
 * @body    productId - Product ID to apply, targetCategories - Array of category names, scheme - Pricing scheme type, categoryType - Optional interior/exterior for flat_rate_unit
 * @access  Contractor
 */
router.post('/:quoteId/product-configuration/apply-to-all', quoteController.applyProductToAll);

/**
 * @route   POST /api/quotes/:quoteId/product-configuration/validate
 * @desc    Validate product configuration for a quote
 * @params  quoteId - Quote ID
 * @body    productSets - Product configuration object to validate, scheme - Optional pricing scheme type
 * @access  Contractor
 */
router.post('/:quoteId/product-configuration/validate', quoteController.validateProductConfiguration);

module.exports = router;


/**
 * @route   POST /api/quotes/:quoteId/generate-proposal
 * @desc    Generate proposal PDF for a quote
 * @params  quoteId - Quote ID
 * @access  Contractor
 */
router.post('/:quoteId/generate-proposal', quoteController.generateProposalPDF);

/**
 * @route   POST /api/quotes/:quoteId/regenerate-proposal
 * @desc    Regenerate proposal PDF with latest quote data
 * @params  quoteId - Quote ID
 * @access  Contractor
 */
router.post('/:quoteId/regenerate-proposal', quoteController.regenerateProposalPDF);
