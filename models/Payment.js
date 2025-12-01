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
    type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
    allowNull: false
  },
  subscriptionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'subscriptions',
      key: 'id'
    },
    onDelete: 'SET NULL',
    field: 'subscription_id'
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
      fields: ['subscription_id']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Associations
Payment.associate = (models) => {
  Payment.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
  Payment.belongsTo(models.User, { foreignKey: 'userId' });
  Payment.belongsTo(models.Subscription, { 
    foreignKey: 'subscriptionId',
    as: 'subscription'
  });
};

module.exports = Payment;
