// controllers/gbbSettingsController.js
/**
 * GBB (Good-Better-Best) Settings Controller
 * 
 * Handles CRUD operations for GBB tier configurations.
 * Provides endpoints for contractors to manage tier-specific pricing.
 */

const { ContractorSettings } = require('../models');
const { validateGBBConfig } = require('../utils/gbbValidation');
const { generateDefaultGBBConfig } = require('../utils/gbbDefaults');

/**
 * Get GBB configuration for the authenticated contractor
 * GET /api/settings/gbb
 */
async function getGBBConfiguration(req, res) {
  try {
    const tenantId = req.user.tenantId;
    
    // Fetch contractor settings
    const settings = await ContractorSettings.findOne({
      where: { tenantId }
    });
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Contractor settings not found'
      });
    }
    
    // Return GBB configuration
    res.json({
      success: true,
      data: {
        gbbEnabled: settings.gbbEnabled || false,
        gbbTiers: settings.gbbTiers || {}
      }
    });
    
  } catch (error) {
    console.error('Error fetching GBB configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GBB configuration',
      error: error.message
    });
  }
}

/**
 * Update GBB configuration for the authenticated contractor
 * PUT /api/settings/gbb
 */
async function updateGBBConfiguration(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { gbbEnabled, gbbTiers } = req.body;
    
    // Validate input
    if (gbbEnabled === undefined && !gbbTiers) {
      return res.status(400).json({
        success: false,
        message: 'Either gbbEnabled or gbbTiers must be provided'
      });
    }
    
    // Validate GBB configuration if provided
    if (gbbTiers) {
      const validation = validateGBBConfig(gbbTiers);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GBB configuration',
          errors: validation.errors
        });
      }
    }
    
    // Fetch contractor settings
    let settings = await ContractorSettings.findOne({
      where: { tenantId }
    });
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Contractor settings not found'
      });
    }
    
    // Update GBB configuration
    const updates = {};
    if (gbbEnabled !== undefined) {
      updates.gbbEnabled = gbbEnabled;
    }
    if (gbbTiers) {
      updates.gbbTiers = gbbTiers;
    }
    
    await settings.update(updates);
    
    res.json({
      success: true,
      message: 'GBB configuration updated successfully',
      data: {
        gbbEnabled: settings.gbbEnabled,
        gbbTiers: settings.gbbTiers
      }
    });
    
  } catch (error) {
    console.error('Error updating GBB configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update GBB configuration',
      error: error.message
    });
  }
}

/**
 * Reset GBB configuration to defaults
 * POST /api/settings/gbb/reset
 */
async function resetGBBConfiguration(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { scheme } = req.body;
    
    // Validate scheme parameter
    const validSchemes = ['rateBased', 'flatRate', 'productionBased', 'turnkey', 'all'];
    if (scheme && !validSchemes.includes(scheme)) {
      return res.status(400).json({
        success: false,
        message: `Invalid scheme. Must be one of: ${validSchemes.join(', ')}`
      });
    }
    
    // Fetch contractor settings
    let settings = await ContractorSettings.findOne({
      where: { tenantId }
    });
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Contractor settings not found'
      });
    }
    
    // Generate default configuration
    const defaultConfig = generateDefaultGBBConfig();
    
    // Determine what to reset
    let updatedTiers;
    if (!scheme || scheme === 'all') {
      // Reset all schemes
      updatedTiers = defaultConfig;
    } else {
      // Reset specific scheme
      updatedTiers = {
        ...(settings.gbbTiers || {}),
        [scheme]: defaultConfig[scheme]
      };
    }
    
    // Update settings
    await settings.update({
      gbbTiers: updatedTiers
    });
    
    res.json({
      success: true,
      message: `GBB configuration reset to defaults${scheme && scheme !== 'all' ? ` for ${scheme}` : ''}`,
      data: {
        gbbEnabled: settings.gbbEnabled,
        gbbTiers: settings.gbbTiers
      }
    });
    
  } catch (error) {
    console.error('Error resetting GBB configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset GBB configuration',
      error: error.message
    });
  }
}

module.exports = {
  getGBBConfiguration,
  updateGBBConfiguration,
  resetGBBConfiguration
};
