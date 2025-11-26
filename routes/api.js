const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');

const multer = require('multer');
const os = require('os');
const settingsController = require('../controllers/settingsController');

// Configure multer to use the system temp directory and name the file uniquely
const upload = multer({ dest: os.tmpdir() });
const pricingSchemeController = require('../controllers/pricingSchemeController');
const leadFormController = require('../controllers/leadFormController');

// Public routes (no auth required) - MUST be before auth middleware
router.get('/lead-forms/public/:publicUrl', leadFormController.getPublicLeadForm);
router.post('/lead-forms/public/:publicUrl/submit', leadFormController.submitPublicLead);

// Protected routes
router.use(auth);
router.use(resolveTenant);




// Pricing Scheme routes
router.get('/pricing-schemes', pricingSchemeController.getPricingSchemes);
router.get('/pricing-schemes/:id', pricingSchemeController.getPricingSchemeById);
router.post('/pricing-schemes', pricingSchemeController.createPricingScheme);
router.put('/pricing-schemes/:id', pricingSchemeController.updatePricingScheme);
router.delete('/pricing-schemes/:id', pricingSchemeController.deletePricingScheme);
router.put('/pricing-schemes/:id/set-default', pricingSchemeController.setDefaultScheme);

// Settings routes
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);
router.put('/settings/company', settingsController.updateCompanyInfo);

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

module.exports = router;