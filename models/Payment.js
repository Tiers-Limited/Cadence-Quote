// models/Payment.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');

const Payment = sequelize.define('Payment', {
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
    onDelete: 'CASCADE'
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
  subscriptionPlan: {
    type: DataTypes.ENUM('starter', 'pro'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Amount in USD'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'usd',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded'),
    defaultValue: 'pending',
    allowNull: false
  },
  stripeSessionId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Stripe Checkout Session ID'
  },
  stripePaymentIntentId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Stripe Payment Intent ID'
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Stripe Customer ID'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    defaultValue: 'card',
    comment: 'Payment method type (card, etc.)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional payment metadata'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failedReason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['stripeSessionId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Associations
Payment.belongsTo(Tenant, { foreignKey: 'tenantId' });
Payment.belongsTo(User, { foreignKey: 'userId' });
Tenant.hasMany(Payment, { foreignKey: 'tenantId' });
User.hasMany(Payment, { foreignKey: 'userId' });

module.exports = Payment;
