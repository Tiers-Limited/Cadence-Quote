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
    allowNull: false,
    references: {
      model: 'global_products',
      key: 'id',
    },
    onDelete: 'CASCADE',
    field: 'global_product_id',
    comment: 'FK to global product being configured',
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
  laborRates: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: DEFAULT_LABOR_RATES,
    comment: 'Labor rates object: {interior: [...], exterior: [...]}',
    validate: {
      isValidLaborRates(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Labor rates must be an object');
        }
        ['interior', 'exterior'].forEach(type => {
          if (!Array.isArray(value[type])) {
            throw new Error(`Labor rates must include ${type} array`);
          }
          value[type].forEach((item, index) => {
            if (!item.category || typeof item.rate !== 'number' || item.rate < 0) {
              throw new Error(`Invalid labor rate at ${type}[${index}]`);
            }
          });
        });
      },
    },
  },
  defaultMarkup: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: DEFAULT_MARKUP,
    field: 'default_markup',
    comment: 'Default markup percentage applied to products (e.g., 15.00 for 15%)',
    validate: {
      min: 0,
      max: 999.99,
    },
  },
  productMarkups: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    field: 'product_markups',
    comment: 'Product-specific markup overrides: {globalProductId: markupPercent}',
    validate: {
      isValidMarkups(value) {
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Product markups must be an object');
        }
        Object.entries(value).forEach(([productId, markup]) => {
          if (typeof markup !== 'number' || markup < 0 || markup > 999.99) {
            throw new Error(`Invalid markup for product ${productId}`);
          }
        });
      },
    },
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: DEFAULT_TAX_RATE,
    field: 'tax_rate',
    comment: 'Tax rate percentage (e.g., 8.25 for 8.25%)',
    validate: {
      min: 0,
      max: 100,
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
      name: 'product_configs_global_product_id_idx',
      fields: ['global_product_id'],
    },
    {
      name: 'product_configs_is_active_idx',
      fields: ['is_active'],
    },
    {
      name: 'product_configs_tenant_global_product_unique',
      unique: true,
      fields: ['tenant_id', 'global_product_id'],
      where: {
        is_active: true,
      },
    },
  ],
  comment: 'Contractor-specific product configurations for customized pricing and labor rates',
});

module.exports = ProductConfig;
