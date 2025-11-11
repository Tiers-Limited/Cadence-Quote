const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Brand = require('./Brand');

const GlobalProduct = sequelize.define('GlobalProduct', {
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
  customBrand: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'custom_brand',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'name',
  },
  category: {
    type: DataTypes.ENUM('Interior', 'Exterior'),
    allowNull: false,
    field: 'category',
  },
  tier: {
    type: DataTypes.ENUM('Good', 'Better', 'Best'),
    allowNull: true,
    field: 'tier',
  },
  sheenOptions: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'sheen_options',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'notes',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'global_products',
  timestamps: true,
  underscored: true,
});

GlobalProduct.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand' });
Brand.hasMany(GlobalProduct, { foreignKey: 'brandId' });

module.exports = GlobalProduct;
