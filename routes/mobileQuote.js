// routes/mobileQuote.js
/**
 * Mobile Quote Builder Routes
 * Phase 2: Product Selection + Pricing + Booking
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const mobileQuoteController = require('../controllers/mobileQuoteController');
const { auth } = require('../middleware/auth');

// Rate limiter for quote operations
const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(auth);

/**
 * GET /api/v1/mbl/quote/pricing-schemes
 * Get available pricing schemes
 */
router.get('/pricing-schemes', quoteLimiter, mobileQuoteController.getPricingSchemes);

/**
 * GET /api/v1/mbl/quote/brands
 * Get available brands for color selection
 */
router.get('/brands', quoteLimiter, mobileQuoteController.getBrands);

/**
 * POST /api/v1/mbl/quote/products-for-areas
 * Get GBB products based on job type and service areas
 * Body: { jobType, areas, productStrategy, pricingSchemeId }
 */
router.post('/products-for-areas', quoteLimiter, mobileQuoteController.getProductsForAreas);

/**
 * POST /api/v1/mbl/quote/assign-products
 * Assign products to areas (apply to all or individually)
 * Body: { areas, applyToAll, productSelections }
 */
router.post('/assign-products', quoteLimiter, mobileQuoteController.assignProducts);

/**
 * GET /api/v1/mbl/quote/colors-by-brand/:brandId
 * Get colors for a specific brand
 * Query params: search, colorFamily, limit
 */
router.get('/colors-by-brand/:brandId', quoteLimiter, mobileQuoteController.getColorsByBrand);

/**
 * POST /api/v1/mbl/quote/calculate-pricing
 * Calculate complete pricing with materials, labor, markup, tax
 * Body: { areas, pricingSchemeId, useContractorDiscount }
 */
router.post('/calculate-pricing', quoteLimiter, mobileQuoteController.calculatePricing);

/**
 * POST /api/v1/mbl/quote/create-draft
 * Create a draft quote
 * Body: { areas, useContractorDiscount, notes }
 */
router.post('/create-draft', quoteLimiter, mobileQuoteController.createDraftQuote);

/**
 * POST /api/v1/mbl/quote/assign-colors
 * Assign colors to areas
 * Body: { quoteId, colorAssignments: [{ areaName, colorId, colorName, colorCode }] }
 */
router.post('/assign-colors', quoteLimiter, mobileQuoteController.assignColors);

/**
 * POST /api/v1/mbl/quote/request-booking
 * Request a booking date
 * Body: { quoteId, preferredDate, alternateDate1, alternateDate2, timePreference, additionalNotes }
 */
router.post('/request-booking', quoteLimiter, mobileQuoteController.requestBooking);

/**
 * GET /api/v1/mbl/quote/my-quotes
 * Get all quotes for logged-in user
 * Query params: status, page, limit
 */
router.get('/my-quotes', quoteLimiter, mobileQuoteController.getMyQuotes);

/**
 * GET /api/v1/mbl/quote/:id
 * Get detailed quote information
 */
router.get('/:id', quoteLimiter, mobileQuoteController.getQuoteDetails);

module.exports = router;

