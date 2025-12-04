// routes/surfaceTypes.js
const express = require('express');
const router = express.Router();
const surfaceTypeController = require('../controllers/surfaceTypeController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all surface types
router.get('/', surfaceTypeController.getAllSurfaceTypes);

// Create surface type
router.post('/', surfaceTypeController.createSurfaceType);

// Get surface type by ID
router.get('/:id', surfaceTypeController.getSurfaceTypeById);

// Update surface type
router.put('/:id', surfaceTypeController.updateSurfaceType);

// Delete surface type
router.delete('/:id', surfaceTypeController.deleteSurfaceType);

module.exports = router;
