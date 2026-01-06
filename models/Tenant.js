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
    allowNull: true,  // Changed to allow null for existing records
    validate: {
      notEmpty: {
        msg: 'Company name cannot be empty'
      }
    },
    field: 'company_name'
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
    allowNull: true,
    
    field: 'phone_number'
  },
  businessAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'business_address'
  },
  tradeType: {
    type: DataTypes.ENUM('painter', 'drywall', 'pressure_washing', 'plumbing', 'electrical', 'hvac', 'roofing', 'landscaping', 'other'),
    allowNull: true,
    field: 'trade_type'
  },
  subscriptionPlan: {
    type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
    defaultValue: 'basic',
    allowNull: true,
    field: 'subscription_plan'
  },
  mrr: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'stripe_customer_id'
  },
  paymentStatus: {
    type: DataTypes.ENUM('trial', 'pending', 'active', 'past_due', 'cancelled'),
    defaultValue: 'trial',
   
    field: 'payment_status'
  },
  subscriptionExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'subscription_expires_at'
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
    
      fields: ['email']
    },
    {
      
      fields: ['stripe_customer_id']
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
  Tenant.hasMany(models.Quote, {
    foreignKey: 'tenantId',
    as: 'quotes'
  });
};

module.exports = Tenant;