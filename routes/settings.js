// routes/settings.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get contractor settings
router.get('/', settingsController.getSettings);

// Update contractor settings
router.put('/', settingsController.updateSettings);

// Update company info (Tenant table)
router.put('/company', settingsController.updateCompanyInfo);

module.exports = router;
