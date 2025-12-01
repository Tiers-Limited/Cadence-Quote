// models/Subscription.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tenants',
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'tenant_id'
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'stripe_subscription_id'
  },
  stripePriceId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'stripe_price_id'
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'stripe_customer_id'
  },
  tier: {
    type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
    allowNull: false,
    defaultValue: 'basic'
  },
  status: {
    type: DataTypes.ENUM(
      'active',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired'
    ),
    allowNull: false,
    defaultValue: 'incomplete'
  },
  currentPeriodStart: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'current_period_start'
  },
  currentPeriodEnd: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'current_period_end'
  },
  cancelAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancel_at'
  },
  canceledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'canceled_at'
  },
  trialStart: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_start'
  },
  trialEnd: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_end'
  },
  mrr: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  cancelAtPeriodEnd: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'cancel_at_period_end'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'subscriptions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['stripe_subscription_id']
      
    },
    {
      fields: ['stripe_customer_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['tier']
    },
    {
      fields: ['current_period_end']
    }
  ]
});

// Associations will be defined in the model loading process
Subscription.associate = (models) => {
  Subscription.belongsTo(models.Tenant, {
    foreignKey: 'tenantId',
    as: 'tenant'
  });
  Subscription.hasMany(models.Payment, {
    foreignKey: 'subscriptionId',
    as: 'payments'
  });
};

module.exports = Subscription;
