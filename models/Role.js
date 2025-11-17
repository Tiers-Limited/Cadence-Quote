const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'name',
  },
  displayName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'display_name',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description',
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    field: 'permissions',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'roles',
  timestamps: true,
  underscored: true,
});

// Associations
Role.associate = (models) => {
  Role.hasMany(models.User, {
    foreignKey: 'roleId'
  });
};

module.exports = Role;
