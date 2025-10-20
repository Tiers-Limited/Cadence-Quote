const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const PaintProduct = require('./PaintProduct');
const Tenant = require('./Tenant');

const ColorLibrary = sequelize.define('ColorLibrary', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Color name'
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Manufacturer color code'
  },
  brand: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Paint brand for this color'
  },
  colorFamily: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'color_family',
    comment: 'General color category (e.g., Blues, Greens, Neutrals)'
  },
  hexValue: {
    type: DataTypes.STRING(7),
    allowNull: true,
    field: 'hex_value',
    comment: 'Hex color code for UI display'
  },
  isCustomMatch: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_custom_match',
    comment: 'Whether this is a custom-matched color'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'color_library',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['brand']
    },
    {
      fields: ['color_family']
    }
  ]
});

ColorLibrary.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(ColorLibrary, { foreignKey: 'tenantId' });

// Many-to-Many relationship with PaintProduct
const PaintProductColors = sequelize.define('PaintProductColors', {}, {
  timestamps: false,
  tableName: 'paint_product_colors'
});

ColorLibrary.belongsToMany(PaintProduct, { through: PaintProductColors });
PaintProduct.belongsToMany(ColorLibrary, { through: PaintProductColors });

module.exports = ColorLibrary;