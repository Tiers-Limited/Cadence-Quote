const FeatureFlag = require('../models/FeatureFlag');
const TenantFeature = require('../models/TenantFeature');
const Tenant = require('../models/Tenant');
const { Op } = require('sequelize');

// Get all feature flags
exports.getAllFeatureFlags = async (req, res) => {
  try {
    const { category, isEnabled, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (category) where.category = category;
    if (isEnabled !== undefined) where.isEnabled = isEnabled === 'true';

    const offset = (page - 1) * limit;

    const { count, rows } = await FeatureFlag.findAndCountAll({
      where,
      limit: Number.parseInt(limit),
      offset,
      order: [['displayName', 'ASC']],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flags',
      error: error.message,
    });
  }
};

// Get feature flag by ID
exports.getFeatureFlagById = async (req, res) => {
  try {
    const { id } = req.params;

    const feature = await FeatureFlag.findByPk(id, {
      include: [
        {
          model: TenantFeature,
          foreignKey: 'featureFlagId',
          include: [{ model: Tenant, as: 'tenant' }],
        },
      ],
    });

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    res.json({
      success: true,
      data: feature,
    });
  } catch (error) {
    console.error('Get feature flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flag',
      error: error.message,
    });
  }
};

// Create feature flag
exports.createFeatureFlag = async (req, res) => {
  try {
    const { name, displayName, description, category, isEnabled, isPaid, priceMonthly, priceYearly, config } = req.body;

    // Validation
    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Name and displayName are required',
      });
    }

    const existingFeature = await FeatureFlag.findOne({ where: { name } });
    if (existingFeature) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag with this name already exists',
      });
    }

    const feature = await FeatureFlag.create({
      name,
      displayName,
      description: description || null,
      category: category || 'feature',
      isEnabled: isEnabled || false,
      isPaid: isPaid || false,
      priceMonthly: priceMonthly || null,
      priceYearly: priceYearly || null,
      config: config || {},
    });

    res.status(201).json({
      success: true,
      message: 'Feature flag created successfully',
      data: feature,
    });
  } catch (error) {
    console.error('Create feature flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create feature flag',
      error: error.message,
    });
  }
};

// Update feature flag
exports.updateFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, description, category, isEnabled, isPaid, priceMonthly, priceYearly, config } = req.body;

    const feature = await FeatureFlag.findByPk(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    await feature.update({
      displayName: displayName || feature.displayName,
      description: description !== undefined ? description : feature.description,
      category: category || feature.category,
      isEnabled: isEnabled !== undefined ? isEnabled : feature.isEnabled,
      isPaid: isPaid !== undefined ? isPaid : feature.isPaid,
      priceMonthly: priceMonthly !== undefined ? priceMonthly : feature.priceMonthly,
      priceYearly: priceYearly !== undefined ? priceYearly : feature.priceYearly,
      config: config !== undefined ? config : feature.config,
    });

    res.json({
      success: true,
      message: 'Feature flag updated successfully',
      data: feature,
    });
  } catch (error) {
    console.error('Update feature flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feature flag',
      error: error.message,
    });
  }
};

// Delete feature flag
exports.deleteFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;

    const feature = await FeatureFlag.findByPk(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    await feature.destroy();

    res.json({
      success: true,
      message: 'Feature flag deleted successfully',
    });
  } catch (error) {
    console.error('Delete feature flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete feature flag',
      error: error.message,
    });
  }
};

// Assign feature to tenant
exports.assignFeatureToTenant = async (req, res) => {
  try {
    const { featureId, tenantId } = req.params;
    const { isEnabled, expiresAt, config } = req.body;

    const feature = await FeatureFlag.findByPk(featureId);
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    const [tenantFeature, created] = await TenantFeature.findOrCreate({
      where: { tenantId, featureFlagId: featureId },
      defaults: {
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        expiresAt: expiresAt || null,
        config: config || {},
      },
    });

    if (!created) {
      await tenantFeature.update({
        isEnabled: isEnabled !== undefined ? isEnabled : tenantFeature.isEnabled,
        expiresAt: expiresAt !== undefined ? expiresAt : tenantFeature.expiresAt,
        config: config !== undefined ? config : tenantFeature.config,
      });
    }

    const result = await TenantFeature.findByPk(tenantFeature.id, {
      include: [
        { model: FeatureFlag, as: 'feature' },
        { model: Tenant, as: 'tenant' },
      ],
    });

    res.json({
      success: true,
      message: created ? 'Feature assigned to tenant successfully' : 'Tenant feature updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Assign feature to tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign feature to tenant',
      error: error.message,
    });
  }
};

// Remove feature from tenant
exports.removeFeatureFromTenant = async (req, res) => {
  try {
    const { featureId, tenantId } = req.params;

    const tenantFeature = await TenantFeature.findOne({
      where: { tenantId, featureFlagId: featureId },
    });

    if (!tenantFeature) {
      return res.status(404).json({
        success: false,
        message: 'Tenant feature not found',
      });
    }

    await tenantFeature.destroy();

    res.json({
      success: true,
      message: 'Feature removed from tenant successfully',
    });
  } catch (error) {
    console.error('Remove feature from tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove feature from tenant',
      error: error.message,
    });
  }
};

// Get tenant features
exports.getTenantFeatures = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const features = await TenantFeature.findAll({
      where: { tenantId },
      include: [{ model: FeatureFlag, as: 'feature' }],
    });

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    console.error('Get tenant features error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant features',
      error: error.message,
    });
  }
};
