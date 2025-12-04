// routes/laborCategories.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');
const laborCategoryController = require('../controllers/laborCategoryController');

// All routes require authentication
router.use(auth);
router.use(resolveTenant);

// GET /api/v1/labor-categories - Get all predefined labor categories
router.get('/', laborCategoryController.getAllCategories);

// POST /api/v1/labor-categories/initialize - Initialize default categories (admin)
router.post('/initialize', laborCategoryController.initializeCategories);

// GET /api/v1/labor-rates - Get contractor's labor rates
router.get('/rates', laborCategoryController.getLaborRates);

// PUT /api/v1/labor-rates/:categoryId - Update labor rate for category
router.put('/rates/:categoryId', laborCategoryController.updateLaborRate);

// POST /api/v1/labor-rates/bulk - Bulk update labor rates
router.post('/rates/bulk', laborCategoryController.bulkUpdateRates);

module.exports = router;
