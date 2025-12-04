// models/LaborRate.js
// Contractor-specific labor rates for each category
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const LaborCategory = require('./LaborCategory');

const LaborRate = sequelize.define('LaborRate', {
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
  
  laborCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: LaborCategory,
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'labor_category_id'
  },
  
  rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Labor rate per measurement unit'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'labor_rates',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['tenant_id', 'labor_category_id']
    }
  ]
});

// Associations
LaborRate.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
LaborRate.belongsTo(LaborCategory, { foreignKey: 'laborCategoryId', as: 'category' });
LaborCategory.hasMany(LaborRate, { foreignKey: 'laborCategoryId', as: 'rates' });

module.exports = LaborRate;
