const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('./Product');

const ProductPrice = sequelize.define('ProductPrice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  sheen: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Sheen type: Flat, Matte, Eggshell, Satin, Semi-Gloss, Gloss'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  tableName: 'product_prices',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['product_id', 'sheen']
    }
  ]
});

// Define associations
ProductPrice.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(ProductPrice, { foreignKey: 'product_id', as: 'prices' });

module.exports = ProductPrice;
