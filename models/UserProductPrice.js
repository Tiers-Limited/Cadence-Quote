const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const UserProduct = require('./UserProduct');

const UserProductPrice = sequelize.define('UserProductPrice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userProductId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: UserProduct,
      key: 'id',
    },
    onDelete: 'CASCADE',
    field: 'user_product_id',
  },
  sheen: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'sheen',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'price',
  },
}, {
  tableName: 'user_product_prices',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_product_id', 'sheen'],
    },
  ],
});

UserProductPrice.belongsTo(UserProduct, { foreignKey: 'userProductId' });
UserProduct.hasMany(UserProductPrice, { foreignKey: 'userProductId', as: 'prices' });

module.exports = UserProductPrice;
