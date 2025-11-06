// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const productController = require('../controllers/productController');
const brandProductController = require('../controllers/brandProductController');
const { auth } = require('../middleware/auth');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

// All routes require authentication
router.use(auth);

// Brand-based product routes (new)
router.get('/by-brand', brandProductController.getAllProductsByBrand);
router.get('/:id/with-prices', brandProductController.getProductWithPrices);
router.post('/with-prices', brandProductController.createProductWithPrices);
router.put('/:id/prices', brandProductController.updateProductPrices);
router.post('/bulk-upload', upload.single('file'), brandProductController.bulkUploadProducts);

// Legacy routes (existing)
router.get('/', productController.getProducts);
router.get('/categories', productController.getProductCategories);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', brandProductController.deleteProduct);

module.exports = router;
