// controllers/gbbProductDefaultsController.js
// Controller for GBB product defaults management

const GBBProductDefaults = require('../models/GBBProductDefaults');
const GlobalProduct = require('../models/GlobalProduct');
const { createAuditLog } = require('./auditLogController');

/**
 * Get all GBB product defaults for tenant
 * GET /api/gbb-defaults
 */
exports.getAllGBBDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const defaults = await GBBProductDefaults.findAll({
      where: { tenantId, isActive: true },
      order: [['surfaceType', 'ASC']]
    });

    // If no defaults exist, create them with empty values
    if (defaults.length === 0) {
      const surfaceTypes = [
        'interior_walls',
        'interior_trim_doors',
        'interior_ceilings',
        'cabinets',
        'exterior_siding',
        'exterior_trim'
      ];

      const created = await Promise.all(
        surfaceTypes.map(surfaceType =>
          GBBProductDefaults.create({
            tenantId,
            surfaceType,
            isActive: true
          })
        )
      );

      return res.json({
        success: true,
        data: created
      });
    }

    res.json({
      success: true,
      data: defaults
    });
  } catch (error) {
    console.error('Get GBB defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GBB defaults',
      error: error.message
    });
  }
};

/**
 * Get GBB defaults for specific surface type
 * GET /api/gbb-defaults/:surfaceType
 */
exports.getGBBDefaultBySurface = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { surfaceType } = req.params;

    let defaults = await GBBProductDefaults.findOne({
      where: { tenantId, surfaceType, isActive: true }
    });

    // Create if doesn't exist
    if (!defaults) {
      defaults = await GBBProductDefaults.create({
        tenantId,
        surfaceType,
        isActive: true
      });
    }

    res.json({
      success: true,
      data: defaults
    });
  } catch (error) {
    console.error('Get GBB default by surface error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GBB default',
      error: error.message
    });
  }
};

/**
 * Update GBB defaults for surface type
 * PUT /api/gbb-defaults/:surfaceType
 */
exports.updateGBBDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { surfaceType } = req.params;
    const {
      goodProductId,
      goodPricePerGallon,
      betterProductId,
      betterPricePerGallon,
      bestProductId,
      bestPricePerGallon,
      notes
    } = req.body;

    let defaults = await GBBProductDefaults.findOne({
      where: { tenantId, surfaceType }
    });

    if (!defaults) {
      defaults = await GBBProductDefaults.create({
        tenantId,
        surfaceType,
        goodProductId,
        goodPricePerGallon,
        betterProductId,
        betterPricePerGallon,
        bestProductId,
        bestPricePerGallon,
        notes,
        isActive: true
      });
    } else {
      await defaults.update({
        goodProductId: goodProductId !== undefined ? goodProductId : defaults.goodProductId,
        goodPricePerGallon: goodPricePerGallon !== undefined ? goodPricePerGallon : defaults.goodPricePerGallon,
        betterProductId: betterProductId !== undefined ? betterProductId : defaults.betterProductId,
        betterPricePerGallon: betterPricePerGallon !== undefined ? betterPricePerGallon : defaults.betterPricePerGallon,
        bestProductId: bestProductId !== undefined ? bestProductId : defaults.bestProductId,
        bestPricePerGallon: bestPricePerGallon !== undefined ? bestPricePerGallon : defaults.bestPricePerGallon,
        notes: notes !== undefined ? notes : defaults.notes
      });
    }

    await createAuditLog({
      category: 'system',
      action: `GBB defaults updated for ${surfaceType}`,
      userId,
      tenantId,
      entityType: 'GBBProductDefaults',
      entityId: defaults.id,
      metadata: { surfaceType },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'GBB defaults updated successfully',
      data: defaults
    });
  } catch (error) {
    console.error('Update GBB defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update GBB defaults',
      error: error.message
    });
  }
};

/**
 * Bulk update all GBB defaults
 * PUT /api/gbb-defaults
 */
exports.bulkUpdateGBBDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { defaults } = req.body; // Array of surface defaults

    if (!Array.isArray(defaults)) {
      return res.status(400).json({
        success: false,
        message: 'Defaults must be an array'
      });
    }

    const results = [];

    for (const item of defaults) {
      const { surfaceType, ...updateData } = item;

      let gbbDefault = await GBBProductDefaults.findOne({
        where: { tenantId, surfaceType }
      });

      if (!gbbDefault) {
        gbbDefault = await GBBProductDefaults.create({
          tenantId,
          surfaceType,
          ...updateData,
          isActive: true
        });
      } else {
        await gbbDefault.update(updateData);
      }

      results.push(gbbDefault);
    }

    await createAuditLog({
      category: 'system',
      action: 'Bulk GBB defaults update',
      userId,
      tenantId,
      entityType: 'GBBProductDefaults',
      metadata: { count: results.length },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'GBB defaults updated successfully',
      data: results
    });
  } catch (error) {
    console.error('Bulk update GBB defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update GBB defaults',
      error: error.message
    });
  }
};

module.exports = exports;
