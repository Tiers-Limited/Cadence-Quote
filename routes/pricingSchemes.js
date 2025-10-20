// routes/pricingSchemes.js
const express = require('express');
const router = express.Router();
const pricingSchemeController = require('../controllers/pricingSchemeController');
const { authenticateToken } = require('../middleware/auth');
const quoteCalculationService = require('../services/quoteCalculationService');

// All routes require authentication
router.use(authenticateToken);

// Get all pricing schemes
router.get('/', pricingSchemeController.getPricingSchemes);

// Get pricing scheme with rules
router.get('/:id/rules', async (req, res) => {
  const result = await quoteCalculationService.getPricingSchemeWithRules(
    req.params.id,
    req.user.tenantId
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// Calculate quote using pricing scheme
router.post('/:id/calculate', async (req, res) => {
  const result = await quoteCalculationService.calculateQuote({
    tenantId: req.user.tenantId,
    pricingSchemeId: req.params.id,
    ...req.body
  });
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Create new pricing scheme
router.post('/', pricingSchemeController.createPricingScheme);

// Update pricing scheme
router.put('/:id', pricingSchemeController.updatePricingScheme);

// Set scheme as default
router.put('/:id/set-default', pricingSchemeController.setDefaultScheme);

// Delete pricing scheme
router.delete('/:id', pricingSchemeController.deletePricingScheme);

module.exports = router;
