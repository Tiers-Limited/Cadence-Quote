// routes/serviceTypes.js
const express = require('express');
const router = express.Router();
const serviceTypeController = require('../controllers/serviceTypeController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Initialize default service types
router.post('/initialize-defaults', serviceTypeController.initializeDefaults);

// Get all service types
router.get('/', serviceTypeController.getAllServiceTypes);

// Create service type
router.post('/', serviceTypeController.createServiceType);

// Get service type by ID
router.get('/:id', serviceTypeController.getServiceTypeById);

// Update service type
router.put('/:id', serviceTypeController.updateServiceType);

// Delete service type
router.delete('/:id', serviceTypeController.deleteServiceType);

module.exports = router;
