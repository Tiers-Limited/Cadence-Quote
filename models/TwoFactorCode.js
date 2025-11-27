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
    allowNull: true, // Made nullable for pre-signup verification codes
    references: {
      model: User,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  identifier: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email or phone number for pre-signup verification'
  },
  purpose: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'login',
    comment: 'Purpose of the code: login, signup_verification, password_reset'
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of failed verification attempts'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional data for the verification code'
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['code'] },
    { fields: ['identifier'] },
    { fields: ['purpose'] },
    { fields: ['identifier', 'purpose'] }
  ]
});

TwoFactorCode.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TwoFactorCode, { foreignKey: 'userId' });

module.exports = TwoFactorCode;