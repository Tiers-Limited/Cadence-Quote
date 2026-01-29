// routes/settings.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get contractor settings
router.get('/', settingsController.getSettings);

// Update contractor settings
router.put('/', settingsController.updateSettings);

// Update company info (Tenant table)
router.put('/company', settingsController.updateCompanyInfo);

// Get available proposal templates
router.get('/templates', settingsController.getAvailableTemplates);

// Save template preference
router.post('/template', settingsController.saveTemplatePreference);

// Generate template preview
router.post('/template/preview', settingsController.generateTemplatePreview);

module.exports = router;
