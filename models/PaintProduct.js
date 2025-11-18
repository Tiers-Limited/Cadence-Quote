const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const PaintProduct = sequelize.define('PaintProduct', {
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
  brand: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Paint brand (e.g., Sherwin-Williams, Behr, Benjamin Moore)'
  },
  line: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Product line name'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Full product name'
  },
  sheen: {
    type: DataTypes.ENUM('matte', 'eggshell', 'satin', 'semi-gloss', 'gloss', 'other'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('interior', 'exterior', 'primer', 'ceiling', 'trim', 'custom'),
    allowNull: false
  },
  tier: {
    type: DataTypes.ENUM('good', 'better', 'best'),
    allowNull: false
  },
  costPerGallon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'cost_per_gallon'
  },
  coverageRate: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'coverage_rate',
    comment: 'Square feet per gallon'
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
    comment: 'Whether this is a system-provided default product'
  }
}, {
  timestamps: true,
  tableName: 'paint_products',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['brand']
    },
    {
      fields: ['category']
    },
    {
      fields: ['tier']
    }
  ]
});

PaintProduct.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(PaintProduct, { foreignKey: 'tenantId' });

module.exports = PaintProduct;