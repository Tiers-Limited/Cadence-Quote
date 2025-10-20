// controllers/pricingSchemeController.js
const PricingScheme = require('../models/PricingScheme');

/**
 * Get all pricing schemes for a tenant
 * GET /api/pricing-schemes
 */
const getPricingSchemes = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { isActive } = req.query;

    const where = { tenantId };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const schemes = await PricingScheme.findAll({
      where,
      order: [['isDefault', 'DESC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: schemes
    });
  } catch (error) {
    console.error('Get pricing schemes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pricing schemes'
    });
  }
};

/**
 * Get single pricing scheme by ID
 * GET /api/pricing-schemes/:id
 */
const getPricingSchemeById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const scheme = await PricingScheme.findOne({
      where: { id, tenantId }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Pricing scheme not found'
      });
    }

    res.json({
      success: true,
      data: scheme
    });
  } catch (error) {
    console.error('Get pricing scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pricing scheme'
    });
  }
};

/**
 * Create new pricing scheme
 * POST /api/pricing-schemes
 */
const createPricingScheme = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      name,
      type,
      description,
      isDefault,
      pricingRules
    } = req.body;

    // Validation
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['name', 'type']
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await PricingScheme.update(
        { isDefault: false },
        { where: { tenantId, isDefault: true } }
      );
    }

    const scheme = await PricingScheme.create({
      tenantId,
      name,
      type,
      description,
      isDefault: isDefault || false,
      isActive: true,
      pricingRules: pricingRules || {}
    });

    res.status(201).json({
      success: true,
      message: 'Pricing scheme created successfully',
      data: scheme
    });
  } catch (error) {
    console.error('Create pricing scheme error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create pricing scheme'
    });
  }
};

/**
 * Update pricing scheme
 * PUT /api/pricing-schemes/:id
 */
const updatePricingScheme = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const {
      name,
      type,
      description,
      isDefault,
      isActive,
      pricingRules
    } = req.body;

    const scheme = await PricingScheme.findOne({
      where: { id, tenantId }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Pricing scheme not found'
      });
    }

    // If setting as default, unset other defaults
    if (isDefault && !scheme.isDefault) {
      await PricingScheme.update(
        { isDefault: false },
        { where: { tenantId, isDefault: true } }
      );
    }

    // Update scheme
    await scheme.update({
      name: name || scheme.name,
      type: type || scheme.type,
      description: description !== undefined ? description : scheme.description,
      isDefault: isDefault !== undefined ? isDefault : scheme.isDefault,
      isActive: isActive !== undefined ? isActive : scheme.isActive,
      pricingRules: pricingRules !== undefined ? pricingRules : scheme.pricingRules
    });

    res.json({
      success: true,
      message: 'Pricing scheme updated successfully',
      data: scheme
    });
  } catch (error) {
    console.error('Update pricing scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pricing scheme'
    });
  }
};

/**
 * Delete pricing scheme
 * DELETE /api/pricing-schemes/:id
 */
const deletePricingScheme = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const scheme = await PricingScheme.findOne({
      where: { id, tenantId }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Pricing scheme not found'
      });
    }

    // Don't allow deleting the default scheme
    if (scheme.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the default pricing scheme. Set another scheme as default first.'
      });
    }

    await scheme.destroy();

    res.json({
      success: true,
      message: 'Pricing scheme deleted successfully'
    });
  } catch (error) {
    console.error('Delete pricing scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pricing scheme'
    });
  }
};

/**
 * Set pricing scheme as default
 * PUT /api/pricing-schemes/:id/set-default
 */
const setDefaultScheme = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const scheme = await PricingScheme.findOne({
      where: { id, tenantId }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Pricing scheme not found'
      });
    }

    // Unset all other defaults
    await PricingScheme.update(
      { isDefault: false },
      { where: { tenantId, isDefault: true } }
    );

    // Set this as default
    await scheme.update({ isDefault: true });

    res.json({
      success: true,
      message: 'Default pricing scheme updated',
      data: scheme
    });
  } catch (error) {
    console.error('Set default scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default scheme'
    });
  }
};

module.exports = {
  getPricingSchemes,
  getPricingSchemeById,
  createPricingScheme,
  updatePricingScheme,
  deletePricingScheme,
  setDefaultScheme
};
