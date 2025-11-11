const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const FeatureFlag = require('./FeatureFlag');

const TenantFeature = sequelize.define('TenantFeature', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
    field: 'tenant_id',
  },
  featureFlagId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: FeatureFlag,
      key: 'id',
    },
    field: 'feature_flag_id',
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_enabled',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
  },
  config: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    field: 'config',
  },
}, {
  tableName: 'tenant_features',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['tenant_id', 'feature_flag_id'],
    },
  ],
});

TenantFeature.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(TenantFeature, { foreignKey: 'tenantId' });

TenantFeature.belongsTo(FeatureFlag, { foreignKey: 'featureFlagId', as: 'feature' });
FeatureFlag.hasMany(TenantFeature, { foreignKey: 'featureFlagId' });

module.exports = TenantFeature;
