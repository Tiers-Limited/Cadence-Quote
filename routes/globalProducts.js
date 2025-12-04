const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');
const globalProductController = require('../controllers/globalProductController');

// All routes require authentication
router.use(auth);
router.use(resolveTenant);

// GET /api/v1/global-products - Get all global products with pagination
router.get('/', globalProductController.getAllGlobalProducts);

// GET /api/v1/global-products/:id - Get single global product
router.get('/:id', globalProductController.getGlobalProductById);

// POST /api/v1/global-products - Create new global product
router.post('/', globalProductController.createGlobalProduct);

// PUT /api/v1/global-products/:id - Update global product
router.put('/:id', globalProductController.updateGlobalProduct);

// DELETE /api/v1/global-products/:id - Delete global product
router.delete('/:id', globalProductController.deleteGlobalProduct);



module.exports = router;
