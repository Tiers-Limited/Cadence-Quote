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
    type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
    defaultValue: 'basic',
    allowNull: false
  },
  mrr: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentStatus: {
    type: DataTypes.ENUM('trial', 'pending', 'active', 'past_due', 'cancelled'),
    defaultValue: 'trial'
  },
  subscriptionExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  seatLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    allowNull: false,
    field: 'seat_limit'
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'trial', 'cancelled'),
    defaultValue: 'active',
    allowNull: false
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_ends_at'
  },
  subscriptionId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'subscription_id'
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['stripeCustomerId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['subscription_id']
    }
  ]
});

// Associations will be set up in a separate file
Tenant.associate = (models) => {
  Tenant.hasMany(models.Subscription, {
    foreignKey: 'tenantId',
    as: 'subscriptions'
  });
  Tenant.hasMany(models.User, {
    foreignKey: 'tenantId'
  });
  Tenant.hasMany(models.Payment, {
    foreignKey: 'tenantId'
  });
};

module.exports = Tenant;