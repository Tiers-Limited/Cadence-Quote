// models/ServiceType.js
// Model for service types (interior painting, exterior painting, etc.)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const ServiceType = sequelize.define('ServiceType', {
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

  // Service categorization
  serviceType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'service_type'
  },

  subType: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'sub_type',
    comment: 'E.g., Walls, Ceilings, Siding, Epoxy Flooring'
  },

  displayName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'display_name',
    comment: 'Name shown in UI'
  },

  // Labor pricing
  laborRateType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'labor_rate_type',
    defaultValue: 'per_sqft'
  },

  laborRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'labor_rate',
    comment: 'Rate amount based on laborRateType'
  },

  // Prep requirements
  prepRequirements: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'prep_requirements',
    comment: 'e.g., Sanding, priming, masking'
  },

  prepIncluded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'prep_included',
    comment: 'Whether prep is included in base rate'
  },

  prepAddOnCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'prep_add_on_cost',
    comment: 'Additional cost if prep is an add-on'
  },

  // Duration estimates
  durationEstimate: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'duration_estimate',
    comment: 'e.g., "2-4 days for 500 sq ft"'
  },

  crewSizeDefault: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'crew_size_default',
    defaultValue: 2,
    comment: 'Default crew size for estimation'
  },

  productivityRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'productivity_rate',
    comment: 'Sq ft per man-hour (e.g., 250)'
  },

  // Additional metadata
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed description of service'
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
    field: 'display_order',
    comment: 'Sort order in UI'
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
  tableName: 'service_types',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['service_type']
    }
  ]
});

ServiceType.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

module.exports = ServiceType;
