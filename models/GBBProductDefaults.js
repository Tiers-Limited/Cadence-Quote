// models/GBBProductDefaults.js
// Model for Good-Better-Best product defaults per surface type
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const GBBProductDefaults = sequelize.define('GBBProductDefaults', {
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
  
  // Surface type categorization
  surfaceType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'surface_type',
    comment: 'Surface category for GBB defaults'
  },

  // GOOD tier
  goodProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'good_product_id',
    comment: 'Global product ID for Good tier'
  },
  goodPricePerGallon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'good_price_per_gallon',
    defaultValue: 35.00
  },

  // BETTER tier
  betterProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'better_product_id',
    comment: 'Global product ID for Better tier'
  },
  betterPricePerGallon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'better_price_per_gallon',
    defaultValue: 45.00
  },

  // BEST tier
  bestProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'best_product_id',
    comment: 'Global product ID for Best tier'
  },
  bestPricePerGallon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'best_price_per_gallon',
    defaultValue: 60.00
  },

  // Additional metadata
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Internal notes about this surface type configuration'
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
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
  tableName: 'gbb_product_defaults',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['tenant_id', 'surface_type']
    }
  ]
});

GBBProductDefaults.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

module.exports = GBBProductDefaults;
