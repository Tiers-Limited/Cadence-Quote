const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');
const paintProductController = require('../controllers/paintProductController');
const colorLibraryController = require('../controllers/colorLibraryController');
const multer = require('multer');
const os = require('os');

// Configure multer to use the system temp directory and name the file uniquely
const upload = multer({ dest: os.tmpdir() });
const pricingSchemeController = require('../controllers/pricingSchemeController');
const leadFormController = require('../controllers/leadFormController');

// Public routes (no auth required)
router.get('/public/lead-forms/:publicUrl', leadFormController.getPublicLeadForm);
router.post('/public/lead-forms/:publicUrl/submit', leadFormController.submitPublicLead);

// Protected routes
router.use(auth);
router.use(resolveTenant);

// Paint Product routes
router.get('/products', paintProductController.getAllProducts);
router.get('/products/:id', paintProductController.getProduct);
router.post('/products', paintProductController.createProduct);
router.put('/products/:id', paintProductController.updateProduct);
router.delete('/products/:id', paintProductController.deleteProduct);
router.get('/products/tier/:tier', paintProductController.getProductsByTier);
router.get('/products/category/:category', paintProductController.getProductsByCategory);

// Color Library routes
router.get('/colors/brand/:brand', colorLibraryController.getColorsByBrand);
router.get('/colors/family/:family', colorLibraryController.getColorsByFamily);
router.get('/colors', colorLibraryController.getAllColors);
router.get('/colors/:id', colorLibraryController.getColor);
router.post('/colors/bulk', colorLibraryController.createColorsBulk);
// Upload an Excel/CSV file and import colors server-side
router.post('/colors/upload', upload.single('file'), colorLibraryController.uploadColorsFromFile);
router.post('/colors', colorLibraryController.createColor);
router.put('/colors/:id', colorLibraryController.updateColor);
router.delete('/colors/:id', colorLibraryController.deleteColor);

// Pricing Scheme routes
router.get('/pricing-schemes', pricingSchemeController.getPricingSchemes);
router.get('/pricing-schemes/:id', pricingSchemeController.getPricingSchemeById);
router.post('/pricing-schemes', pricingSchemeController.createPricingScheme);
router.put('/pricing-schemes/:id', pricingSchemeController.updatePricingScheme);
router.delete('/pricing-schemes/:id', pricingSchemeController.deletePricingScheme);
router.put('/pricing-schemes/:id/set-default', pricingSchemeController.setDefaultScheme);

// Lead Form routes
router.get('/lead-forms', leadFormController.getLeadForms);
router.get('/lead-forms/:id', leadFormController.getLeadFormById);
router.post('/lead-forms', leadFormController.createLeadForm);
router.put('/lead-forms/:id', leadFormController.updateLeadForm);
router.delete('/lead-forms/:id', leadFormController.deleteLeadForm);

// Lead routes
router.get('/leads', leadFormController.getLeads);
router.get('/leads/:id', leadFormController.getLeadById);
router.post('/leads/:formId/submit', leadFormController.submitLead);
router.put('/leads/:id', leadFormController.updateLead);
router.delete('/leads/:id', leadFormController.deleteLead);

// Public routes (no auth required)
router.get('/public/lead-forms/:publicUrl', leadFormController.getPublicLeadForm);
router.post('/public/lead-forms/:publicUrl/submit', leadFormController.submitPublicLead);

module.exports = router;