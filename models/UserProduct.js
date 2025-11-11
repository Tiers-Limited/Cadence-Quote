const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const GlobalProduct = require('./GlobalProduct');
const User = require('./User');
const Tenant = require('./Tenant');

const UserProduct = sequelize.define('UserProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  globalProductId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: GlobalProduct,
      key: 'id',
    },
    field: 'global_product_id',
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
    field: 'tenant_id',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
    field: 'user_id',
  },
  sheenOptions: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'sheen_options',
  },
  defaultSheen: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'default_sheen',
  },
  pricePerGallon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'price_per_gallon',
  },
  coverageRate: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'coverage_rate',
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
  tableName: 'user_products',
  timestamps: true,
  underscored: true,
});

UserProduct.belongsTo(GlobalProduct, { foreignKey: 'globalProductId', as: 'globalProduct' });
GlobalProduct.hasMany(UserProduct, { foreignKey: 'globalProductId' });

UserProduct.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(UserProduct, { foreignKey: 'tenantId' });

UserProduct.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(UserProduct, { foreignKey: 'userId' });

module.exports = UserProduct;
