const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'tenant_id',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'user_id',
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'action',
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'category',
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'entity_type',
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'entity_id',
  },
  changes: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'changes',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'metadata',
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address',
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent',
  },
  isImmutable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_immutable',
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
  updatable: false,
  indexes: [
    { fields: ['tenant_id'] },
    { fields: ['user_id'] },
    { fields: ['category'] },
    { fields: ['created_at'] },
  ],
});

// Associations will be set up in models/index.js
AuditLog.associate = (models) => {
  AuditLog.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  AuditLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
};

module.exports = AuditLog;
