// models/SurfaceType.js
// Model for surface type configurations (walls, ceilings, trim, etc.)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const SurfaceType = sequelize.define('SurfaceType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'tenant_id'
  },

  // Surface categorization
  surfaceCategory: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'surface_category'
  },

  specificType: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'specific_type',
    comment: 'E.g., Drywall, Popcorn Texture, Baseboards, Vinyl Siding'
  },

  displayName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'display_name'
  },

  // Condition options
  conditionOptions: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'condition_options',
    defaultValue: ['smooth', 'textured', 'patched', 'damaged'],
    comment: 'Available condition states'
  },

  // Default coats required
  defaultCoats: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2,
    field: 'default_coats'
  },

  // Measurement specifications
  measurementUnit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'sqft',
    field: 'measurement_unit'
  },

  measurementNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'measurement_notes',
    comment: 'E.g., "Height x Width (exclude windows/doors)"'
  },

  // Add-on costs
  hasTextureAddOn: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'has_texture_add_on'
  },

  textureAddOnCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'texture_add_on_cost',
    comment: 'Additional cost per sqft for textured surfaces'
  },

  hasHeightAddOn: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'has_height_add_on'
  },

  heightAddOnCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'height_add_on_cost',
    comment: 'Additional cost for high/vaulted ceilings'
  },

  customAddOnCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'custom_add_on_cost',
    comment: 'Other custom add-on costs'
  },

  customAddOnDescription: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'custom_add_on_description'
  },

  // Coverage and waste factors
  defaultCoveragePerGallon: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 350,
    field: 'default_coverage_per_gallon',
    comment: 'Sq ft coverage per gallon'
  },

  wasteFactor: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 1.10,
    field: 'waste_factor',
    comment: 'Multiplier for waste (1.10 = 10% waste)'
  },

  // Additional metadata
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },

  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'display_order'
  },

  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  timestamps: true,
  tableName: 'surface_types',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['surface_category']
    }
  ]
});

SurfaceType.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

module.exports = SurfaceType;
