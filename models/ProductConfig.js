// models/ProductConfig.js
// NEW FEATURE: Contractor-specific product configurations
// Allows contractors to customize pricing, labor rates, markups, and taxes per global product

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { DEFAULT_LABOR_RATES, DEFAULT_MARKUP, DEFAULT_TAX_RATE } = require('../utils/laborDefaults');

const ProductConfig = sequelize.define('ProductConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tenants',
      key: 'id',
    },
    onDelete: 'CASCADE',
    field: 'tenant_id',
    comment: 'FK to tenant - ensures data isolation per contractor',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    field: 'user_id',
    comment: 'FK to user who created this config (optional)',
  },
  globalProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'global_products',
      key: 'id',
    },
    onDelete: 'CASCADE',
    field: 'global_product_id',
    comment: 'FK to global product being configured (nullable for contractor custom products)',
  },
  isCustom: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_custom',
    comment: 'True when this product config represents a contractor-created custom product',
  },
  customProduct: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'custom_product',
    comment: 'Custom product details when isCustom=true. Example: { name, brandName, category, description, sheens: [...] }',
  },
  sheens: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of sheen configurations: [{sheen: "Flat", price: 45.99, coverage: 350}]',
    validate: {
      isValidSheens(value) {
        if (!Array.isArray(value)) {
          throw new Error('Sheens must be an array');
        }
        if (value.length === 0) {
          throw new Error('At least one sheen configuration is required');
        }
        value.forEach((item, index) => {
          if (!item.sheen || typeof item.sheen !== 'string') {
            throw new Error(`Sheen[${index}]: sheen name is required`);
          }
          if (typeof item.price !== 'number' || item.price < 0) {
            throw new Error(`Sheen[${index}]: price must be a positive number`);
          }
          if (typeof item.coverage !== 'number' || item.coverage <= 0) {
            throw new Error(`Sheen[${index}]: coverage must be a positive number`);
          }
        });
      },
    },
  },
 
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
    comment: 'Soft delete flag',
  },
}, {
  tableName: 'product_configs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'product_configs_tenant_id_idx',
      fields: ['tenant_id'],
    },
    {
      name: 'product_configs_user_id_idx',
      fields: ['user_id'],
    },
   
    {
      name: 'product_configs_is_active_idx',
      fields: ['is_active'],
    },
    {
      name: 'product_configs_tenant_global_product_unique',
     
      fields: ['tenant_id', 'global_product_id'],
      where: {
        is_active: true,
      },
    },
  ],
  comment: 'Contractor-specific product configurations for customized pricing and labor rates',
});

module.exports = ProductConfig;
