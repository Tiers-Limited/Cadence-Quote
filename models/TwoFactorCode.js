const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const TwoFactorCode = sequelize.define('TwoFactorCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['code'] }
  ]
});

TwoFactorCode.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TwoFactorCode, { foreignKey: 'userId' });

module.exports = TwoFactorCode;