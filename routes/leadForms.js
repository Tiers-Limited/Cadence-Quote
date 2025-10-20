// routes/leadForms.js
const express = require('express');
const router = express.Router();
const leadFormController = require('../controllers/leadFormController');
const { authenticateToken } = require('../middleware/auth');

// PUBLIC ROUTES (no authentication required)
// Get lead form by public URL
router.get('/public/:publicUrl', leadFormController.getLeadFormByUrl);

// Submit lead form
router.post('/public/:publicUrl/submit', leadFormController.submitLeadForm);

// AUTHENTICATED ROUTES
router.use(authenticateToken);

// Get all lead forms for tenant
router.get('/', leadFormController.getLeadForms);

// Create new lead form
router.post('/', leadFormController.createLeadForm);

// Update lead form
router.put('/:id', leadFormController.updateLeadForm);

// Delete lead form
router.delete('/:id', leadFormController.deleteLeadForm);

module.exports = router;
