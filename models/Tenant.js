// models/Tenant.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  businessAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tradeType: {
    type: DataTypes.ENUM('painter', 'drywall', 'pressure_washing', 'plumbing', 'electrical', 'hvac', 'roofing', 'landscaping', 'other'),
    allowNull: false
  },
  subscriptionPlan: {
    type: DataTypes.ENUM('starter', 'pro'),
    defaultValue: 'starter',
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Stripe Customer ID for payment processing'
  },
  paymentStatus: {
    type: DataTypes.ENUM('trial', 'pending', 'active', 'past_due', 'cancelled'),
    defaultValue: 'trial',
    comment: 'Current payment/subscription status'
  },
  subscriptionExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Subscription expiration date'
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['stripeCustomerId']
    }
  ]
});

module.exports = Tenant;