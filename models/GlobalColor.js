const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Brand = require('./Brand');

const GlobalColor = sequelize.define('GlobalColor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  brandId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Brand,
      key: 'id',
    },
    field: 'brand_id',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'name',
  },
  code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'code',
  },
  hexValue: {
    type: DataTypes.STRING(7),
    allowNull: true,
    field: 'hex_value',
  },
  red: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'red',
  },
  green: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'green',
  },
  blue: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'blue',
  },
  sampleImage: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'sample_image',
  },
  crossBrandMappings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    field: 'cross_brand_mappings',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'global_colors',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['brand_id'] },
    { fields: ['code'] },
    { fields: ['name'] },
  ],
});

GlobalColor.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand' });
Brand.hasMany(GlobalColor, { foreignKey: 'brandId' });

module.exports = GlobalColor;
