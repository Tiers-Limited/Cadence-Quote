// models/LaborCategory.js
// Predefined labor categories for interior and exterior painting
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LaborCategory = sequelize.define('LaborCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  categoryName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'category_name',
    comment: 'E.g., "Walls", "Ceilings", "Trim", "Exterior Walls"'
  },
  
  categoryType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'category_type',
    comment: 'interior or exterior'
  },
  
  measurementUnit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'measurement_unit',
    comment: 'sqft, linear_foot, unit, hour'
  },
  
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'display_order'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Usage description for contractors'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'labor_categories',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['category_name']
    }
  ]
});

module.exports = LaborCategory;
