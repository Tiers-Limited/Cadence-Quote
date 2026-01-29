// routes/gbbSettings.js
/**
 * GBB (Good-Better-Best) Settings Routes
 * 
 * API endpoints for managing GBB tier configurations.
 */

const express = require('express');
const router = express.Router();
const gbbSettingsController = require('../controllers/gbbSettingsController');
const { auth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');

/**
 * GET /api/settings/gbb
 * Fetch GBB configuration for the authenticated contractor
 */
router.get('/', auth, resolveTenant, gbbSettingsController.getGBBConfiguration);

/**
 * PUT /api/settings/gbb
 * Update GBB configuration for the authenticated contractor
 */
router.put('/', auth, resolveTenant, gbbSettingsController.updateGBBConfiguration);

/**
 * POST /api/settings/gbb/reset
 * Reset GBB configuration to defaults
 */
router.post('/reset', auth, resolveTenant, gbbSettingsController.resetGBBConfiguration);

module.exports = router;
