// routes/contractorRouter.js
// NEW FEATURE: Routes for contractor-specific product configurations
// All routes require authentication and contractor role

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getAllProductConfigs,
  getProductConfigById,
  createProductConfig,
  updateProductConfig,
  deleteProductConfig,
  getDefaults,
  updateDefaults,
} = require('../controllers/productConfigController');

// Apply authentication to all routes
router.use(auth);

// Apply role requirement - only contractors can access these routes
router.use(requireRole('contractor', 'contractor_admin'));

/**
 * @route   GET /api/v1/contractor/product-configs/defaults
 * @desc    Get default labor rates and configuration values
 * @access  Private (Contractor only)
 * @note    This route must come before /:id to avoid route conflicts
 */
router.get('/product-configs/defaults', getDefaults);

/**
 * @route   PUT /api/v1/contractor/product-configs/defaults
 * @desc    Update default labor rates and configuration values
 * @access  Private (Contractor only)
 * @body    { laborRates, defaultMarkup, defaultTaxRate }
 */
router.put('/product-configs/defaults', updateDefaults);

/**
 * @route   GET /api/v1/contractor/product-configs
 * @desc    Get all product configurations for authenticated contractor
 * @access  Private (Contractor only)
 * @query   brandId - Filter by brand ID
 * @query   search - Search in product names
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   sortBy - Sort field (default: createdAt)
 * @query   sortOrder - Sort order ASC/DESC (default: DESC)
 */
router.get('/product-configs', getAllProductConfigs);

/**
 * @route   GET /api/v1/contractor/product-configs/:id
 * @desc    Get a single product configuration by ID
 * @access  Private (Contractor only)
 */
router.get('/product-configs/:id', getProductConfigById);

/**
 * @route   POST /api/v1/contractor/product-configs
 * @desc    Create a new product configuration
 * @access  Private (Contractor only)
 * @body    {
 *            globalProductId: number,
 *            sheens: [{sheen: string, price: number, coverage: number}],
 *            laborRates: {interior: [...], exterior: [...]},
 *            defaultMarkup: number (optional, default: 15),
 *            productMarkups: {globalProductId: markup} (optional),
 *            taxRate: number (optional, default: 0)
 *          }
 */
router.post('/product-configs', createProductConfig);

/**
 * @route   PUT /api/v1/contractor/product-configs/:id
 * @desc    Update an existing product configuration
 * @access  Private (Contractor only)
 * @body    Partial update - same structure as POST
 */
router.put('/product-configs/:id', updateProductConfig);

/**
 * @route   DELETE /api/v1/contractor/product-configs/:id
 * @desc    Delete a product configuration (soft delete)
 * @access  Private (Contractor only)
 */
router.delete('/product-configs/:id', deleteProductConfig);

module.exports = router;
