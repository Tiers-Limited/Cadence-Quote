// models/PricingScheme.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const PricingScheme = sequelize.define('PricingScheme', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'e.g., "Square-Foot (Turnkey)", "Hourly (Labor Only)"'
  },
  type: {
    type: DataTypes.ENUM('sqft_turnkey', 'sqft_labor_only', 'hourly_time_materials', 'unit_based'),
    allowNull: false,
    comment: 'Type of pricing calculation'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_default',
    comment: 'Is this the default pricing scheme for this tenant'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  
  // Pricing Rules (stored as JSON)
  pricingRules: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'pricing_rules',
    comment: 'JSON object containing pricing rules for different surfaces/scenarios'
  },
  
  // Example structure for pricingRules:
  // {
  //   "walls": { "price": 1.50, "unit": "sqft" },
  //   "ceilings": { "price": 1.20, "unit": "sqft" },
  //   "trim": { "price": 0.75, "unit": "linear_ft" },
  //   "hourly_rate": { "price": 60, "unit": "hour" }
  // }
}, {
  timestamps: true,
  tableName: 'pricing_schemes',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_default']
    }
  ]
});

PricingScheme.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(PricingScheme, { foreignKey: 'tenantId' });

module.exports = PricingScheme;
