const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// GET /api/brands - Get all brands
router.get('/', brandController.getAllBrands);

// POST /api/brands/seed - Seed default brands
router.post('/seed', brandController.seedBrands);

// GET /api/brands/:id - Get brand by ID
router.get('/:id', brandController.getBrandById);

// POST /api/brands - Create new brand
router.post('/', brandController.createBrand);

// PUT /api/brands/:id - Update brand
router.put('/:id', brandController.updateBrand);

// DELETE /api/brands/:id - Delete brand (soft delete)
router.delete('/:id', brandController.deleteBrand);

module.exports = router;
