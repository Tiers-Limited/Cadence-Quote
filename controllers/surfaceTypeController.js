// controllers/surfaceTypeController.js
// Controller for surface types management

const SurfaceType = require('../models/SurfaceType');
const { createAuditLog } = require('./auditLogController');
const { Op } = require('sequelize');

/**
 * Get all surface types
 * GET /api/surface-types
 */
exports.getAllSurfaceTypes = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { surfaceCategory, search } = req.query;

    const where = { tenantId, isActive: true };

    if (surfaceCategory) {
      where.surfaceCategory = surfaceCategory;
    }

    if (search) {
      where[Op.or] = [
        { displayName: { [Op.iLike]: `%${search}%` } },
        { specificType: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const surfaceTypes = await SurfaceType.findAll({
      where,
      order: [
        ['displayOrder', 'ASC'],
        ['displayName', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: surfaceTypes
    });
  } catch (error) {
    console.error('Get surface types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch surface types',
      error: error.message
    });
  }
};

/**
 * Get surface type by ID
 * GET /api/surface-types/:id
 */
exports.getSurfaceTypeById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const surfaceType = await SurfaceType.findOne({
      where: { id, tenantId }
    });

    if (!surfaceType) {
      return res.status(404).json({
        success: false,
        message: 'Surface type not found'
      });
    }

    res.json({
      success: true,
      data: surfaceType
    });
  } catch (error) {
    console.error('Get surface type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch surface type',
      error: error.message
    });
  }
};

/**
 * Create surface type
 * POST /api/surface-types
 */
exports.createSurfaceType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const newSurfaceType = await SurfaceType.create({
      tenantId,
      ...req.body,
      isActive: true
    });

    await createAuditLog({
      category: 'settings',
      action: 'Surface type created',
      userId,
      tenantId,
      entityType: 'SurfaceType',
      entityId: newSurfaceType.id,
      metadata: { displayName: newSurfaceType.displayName },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      message: 'Surface type created successfully',
      data: newSurfaceType
    });
  } catch (error) {
    console.error('Create surface type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create surface type',
      error: error.message
    });
  }
};

/**
 * Update surface type
 * PUT /api/surface-types/:id
 */
exports.updateSurfaceType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { id } = req.params;

    const surfaceType = await SurfaceType.findOne({
      where: { id, tenantId }
    });

    if (!surfaceType) {
      return res.status(404).json({
        success: false,
        message: 'Surface type not found'
      });
    }

    await surfaceType.update(req.body);

    await createAuditLog({
      category: 'settings',
      action: 'Surface type updated',
      userId,
      tenantId,
      entityType: 'SurfaceType',
      entityId: surfaceType.id,
      metadata: { displayName: surfaceType.displayName },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Surface type updated successfully',
      data: surfaceType
    });
  } catch (error) {
    console.error('Update surface type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update surface type',
      error: error.message
    });
  }
};

/**
 * Delete surface type (soft delete)
 * DELETE /api/surface-types/:id
 */
exports.deleteSurfaceType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { id } = req.params;

    const surfaceType = await SurfaceType.findOne({
      where: { id, tenantId }
    });

    if (!surfaceType) {
      return res.status(404).json({
        success: false,
        message: 'Surface type not found'
      });
    }

    await surfaceType.update({ isActive: false });

    await createAuditLog({
      category: 'settings',
      action: 'Surface type deleted',
      userId,
      tenantId,
      entityType: 'SurfaceType',
      entityId: surfaceType.id,
      metadata: { displayName: surfaceType.displayName },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Surface type deleted successfully'
    });
  } catch (error) {
    console.error('Delete surface type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete surface type',
      error: error.message
    });
  }
};

module.exports = exports;
