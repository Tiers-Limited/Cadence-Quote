// routes/gbbDefaults.js
const express = require('express');
const router = express.Router();
const gbbProductDefaultsController = require('../controllers/gbbProductDefaultsController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all GBB defaults
router.get('/', gbbProductDefaultsController.getAllGBBDefaults);

// Bulk update GBB defaults
router.put('/', gbbProductDefaultsController.bulkUpdateGBBDefaults);

// Get GBB defaults for specific surface type
router.get('/:surfaceType', gbbProductDefaultsController.getGBBDefaultBySurface);

// Update GBB defaults for specific surface type
router.put('/:surfaceType', gbbProductDefaultsController.updateGBBDefaults);

module.exports = router;
