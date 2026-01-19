// models/CustomerSelection.js
// Model for storing customer selections (product/color/sheens) per area/surface

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CustomerSelection = sequelize.define('CustomerSelection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'tenant_id',
  },
  quoteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'quote_id',
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'client_id',
  },
  areaId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'area_id',
  },
  areaName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'area_name',
  },
  surfaceType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'surface_type',
  },
  brandId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'brand_id',
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'product_id',
  },
  productName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'product_name',
  },
  customerNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'customer_notes',
  },
  colorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'color_id',
  },
  colorName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'color_name',
  },
  colorNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'color_number',
  },
  colorHex: {
    type: DataTypes.STRING(7),
    allowNull: true,
    field: 'color_hex',
  },
  sheen: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  quantityGallons: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'quantity_gallons',
  },
  selectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'selected_at',
  },
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'locked_at',
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_locked',
  },
}, {
  tableName: 'customer_selections',
  underscored: true,
});

CustomerSelection.associate = function(models) {
  CustomerSelection.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  CustomerSelection.belongsTo(models.Quote, { foreignKey: 'quoteId', as: 'quote' });
  CustomerSelection.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  CustomerSelection.belongsTo(models.Brand, { foreignKey: 'brandId', as: 'brand' });
};

module.exports = CustomerSelection;
