// controllers/proposalDefaultsController.js
// Controller for managing proposal defaults

const ProposalDefaults = require('../models/ProposalDefaults');
const { createAuditLog } = require('./auditLogController');

/**
 * Get proposal defaults for tenant
 * GET /api/proposal-defaults
 */
exports.getProposalDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    let defaults = await ProposalDefaults.findOne({
      where: { tenantId }
    });

    // Create default settings if none exist
    if (!defaults) {
      defaults = await ProposalDefaults.create({ tenantId });
    }

    res.json({
      success: true,
      data: defaults
    });
  } catch (error) {
    console.error('Get proposal defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal defaults',
      error: error.message
    });
  }
};

/**
 * Update proposal defaults
 * PUT /api/proposal-defaults
 */
exports.updateProposalDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const updateData = req.body;

    let defaults = await ProposalDefaults.findOne({
      where: { tenantId }
    });

    if (!defaults) {
      defaults = await ProposalDefaults.create({
        tenantId,
        ...updateData
      });
    } else {
      await defaults.update(updateData);
    }

    // Create audit log
    await createAuditLog({
      category: 'system',
      action: 'Proposal defaults updated',
      userId,
      tenantId,
      entityType: 'ProposalDefaults',
      entityId: defaults.id,
      metadata: { updatedFields: Object.keys(updateData) },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Proposal defaults updated successfully',
      data: defaults
    });
  } catch (error) {
    console.error('Update proposal defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update proposal defaults',
      error: error.message
    });
  }
};

/**
 * Update specific section
 * PUT /api/proposal-defaults/:section
 */
exports.updateSection = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { section } = req.params;
    const updateData = req.body;

    const validSections = [
      'messaging',
      'processes',
      'warranty',
      'payments',
      'responsibilities',
      'policies',
      'products',
      'portfolio',
      'acceptance'
    ];

    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section'
      });
    }

    let defaults = await ProposalDefaults.findOne({
      where: { tenantId }
    });

    if (!defaults) {
      defaults = await ProposalDefaults.create({ tenantId });
    }

    await defaults.update(updateData);

    await createAuditLog({
      category: 'system',
      action: `Proposal defaults ${section} section updated`,
      userId,
      tenantId,
      entityType: 'ProposalDefaults',
      entityId: defaults.id,
      metadata: { section, updatedFields: Object.keys(updateData) },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `${section.charAt(0).toUpperCase() + section.slice(1)} section updated successfully`,
      data: defaults
    });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update section',
      error: error.message
    });
  }
};

module.exports = exports;
