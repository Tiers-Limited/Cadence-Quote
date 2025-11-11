const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeatureFlag = sequelize.define('FeatureFlag', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'name',
  },
  displayName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'display_name',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description',
  },
  category: {
    type: DataTypes.ENUM('feature', 'addon', 'integration'),
    allowNull: false,
    defaultValue: 'feature',
    field: 'category',
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_enabled',
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_paid',
  },
  priceMonthly: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'price_monthly',
  },
  priceYearly: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'price_yearly',
  },
  config: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    field: 'config',
  },
}, {
  tableName: 'feature_flags',
  timestamps: true,
  underscored: true,
});

module.exports = FeatureFlag;
