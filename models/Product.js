// models/Product.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const Brand = require('./Brand');

const Product = sequelize.define('Product', {
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
  brandId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'brands',
      key: 'id'
    },
    field: 'brand_id'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  brand: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sheenOptions: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'sheen_options',
    comment: 'Comma-separated list of available sheen options'
  },
  category: {
    type: DataTypes.ENUM('wall_paint', 'ceiling_paint', 'trim_paint', 'primer', 'custom'),
    allowNull: false,
    defaultValue: 'wall_paint',
    field: 'category'
  },
  tier: {
    type: DataTypes.ENUM('good', 'better', 'best', 'default', 'upgrade'),
    allowNull: false,
    defaultValue: 'default'
  },
  sheen: {
    type: DataTypes.ENUM('flat', 'matte', 'eggshell', 'satin', 'semi-gloss', 'gloss'),
    allowNull: true,
    defaultValue: 'eggshell'
  },
  pricePerGallon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'price_per_gallon'
  },
  coverageRate: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 400, // sqft per gallon
    field: 'coverage_rate',
    comment: 'Coverage in square feet per gallon'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  isSystemDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_system_default',
    comment: 'True if this is a system-provided default product'
  }
}, {
  timestamps: true,
  tableName: 'products',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['brand']
    },
    {
      fields: ['brand_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['tier']
    }
  ]
});

Product.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Product, { foreignKey: 'tenantId' });

// Brand relationship
Product.belongsTo(Brand, { foreignKey: 'brandId', as: 'brandDetails' });
Brand.hasMany(Product, { foreignKey: 'brandId', as: 'products' });

module.exports = Product;
