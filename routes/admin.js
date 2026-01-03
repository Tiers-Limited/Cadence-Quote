const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Import controllers
const globalProductController = require('../controllers/globalProductController');
const globalColorController = require('../controllers/globalColorController');
const auditLogController = require('../controllers/auditLogController');
const tenantController = require('../controllers/tenantController');
const featureFlagController = require('../controllers/featureFlagController');
const brandController = require('../controllers/brandController');
const adminSettingsController = require('../controllers/adminSettingsController');

// Apply auth and admin role check to all routes
router.use(auth);
router.use(requireRole('admin','contractor_admin','customer'));

// ===== GLOBAL PRODUCTS ROUTES =====
router.get('/products', globalProductController.getAllGlobalProducts);
router.post('/products', globalProductController.createGlobalProduct);
router.post('/products/bulk-import', globalProductController.bulkImportGlobalProducts);
router.post('/products/bulk-upload', upload.single('file'), globalProductController.bulkUploadGlobalProducts);
router.put('/products/bulk-update-tiers', globalProductController.bulkUpdateProductTiers);
router.get('/products/:id', globalProductController.getGlobalProductById);
router.put('/products/:id', globalProductController.updateGlobalProduct);
router.delete('/products/:id', globalProductController.deleteGlobalProduct);

// ===== GLOBAL COLORS ROUTES =====
router.get('/colors', globalColorController.getAllGlobalColors);
router.get('/colors/:id', globalColorController.getGlobalColorById);
router.post('/colors', globalColorController.createGlobalColor);
router.put('/colors/:id', globalColorController.updateGlobalColor);
router.delete('/colors/:id', globalColorController.deleteGlobalColor);
router.post('/colors/:id/cross-brand-mapping', globalColorController.addCrossBrandMapping);
router.post('/colors/bulk-import', globalColorController.bulkImportGlobalColors);
router.post('/colors/bulk-upload', upload.single('file'), globalColorController.bulkUploadGlobalColors);

// ===== BRANDS ROUTES (Admin Only) =====
router.get('/brands', brandController.getAllBrands);
router.get('/brands/:id', brandController.getBrandById);
router.post('/brands', brandController.createBrand);
router.post('/brands/seed', brandController.seedBrands);
router.put('/brands/:id', brandController.updateBrand);
router.delete('/brands/:id', brandController.deleteBrand);

// ===== AUDIT LOGS ROUTES =====
router.get('/audit-logs', auditLogController.getAllAuditLogs);
router.get('/audit-logs/category/:category', auditLogController.getAuditLogsByCategory);
router.get('/audit-logs/tenant/:tenantId', auditLogController.getTenantAuditLogs);
router.get('/audit-logs/stats', auditLogController.getAuditLogStats);

// ===== TENANT MANAGEMENT ROUTES =====
router.get('/tenants', tenantController.getAllTenants);
router.get('/tenants/stats', tenantController.getTenantStats);
router.get('/tenants/:id', tenantController.getTenantById);
router.put('/tenants/:id', tenantController.updateTenant);
router.post('/tenants/:id/activate', tenantController.activateTenant);
router.post('/tenants/:id/suspend', tenantController.suspendTenant);
router.post('/tenants/:id/assign-users', tenantController.assignUsersToTenant);
router.post('/tenants/users/:userId/impersonate', tenantController.impersonateUser);

// ===== FEATURE FLAGS ROUTES =====
router.get('/feature-flags', featureFlagController.getAllFeatureFlags);
router.get('/feature-flags/:id', featureFlagController.getFeatureFlagById);
router.post('/feature-flags', featureFlagController.createFeatureFlag);
router.put('/feature-flags/:id', featureFlagController.updateFeatureFlag);
router.delete('/feature-flags/:id', featureFlagController.deleteFeatureFlag);

// ===== TENANT FEATURES ROUTES =====
router.get('/tenants/:tenantId/features', featureFlagController.getTenantFeatures);
router.post('/tenants/:tenantId/features/:featureId', featureFlagController.assignFeatureToTenant);
router.delete('/tenants/:tenantId/features/:featureId', featureFlagController.removeFeatureFromTenant);

// ===== ADMIN SETTINGS ROUTES =====
router.get('/settings/profile', adminSettingsController.getAdminProfile);
router.put('/settings/profile', adminSettingsController.updateAdminProfile);
router.post('/settings/change-password', adminSettingsController.changeAdminPassword);

module.exports = router;
