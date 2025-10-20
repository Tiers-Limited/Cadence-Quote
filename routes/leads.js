// routes/leads.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get lead statistics
router.get('/stats', leadController.getLeadStats);

// Get all leads
router.get('/', leadController.getLeads);

// Get single lead
router.get('/:id', leadController.getLeadById);

// Update lead
router.put('/:id', leadController.updateLead);

// Delete lead
router.delete('/:id', leadController.deleteLead);

module.exports = router;
