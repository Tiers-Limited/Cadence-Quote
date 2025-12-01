// models/Client.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tenants',
      key: 'id',
    },
    onDelete: 'CASCADE',
    field: 'tenant_id',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'name',
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'email',
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'phone',
  },
  street: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'street',
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'city',
  },
  state: {
    type: DataTypes.STRING(2),
    allowNull: false,
    field: 'state',
  },
  zip: {
    type: DataTypes.STRING(10),
    allowNull: false,
    field: 'zip',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'notes',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'clients',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['tenant_id'],
    },
    {
      fields: ['email', 'tenant_id'],
    },
    {
      fields: ['phone', 'tenant_id'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

Client.associate = (models) => {
  Client.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Client.hasMany(models.Quote, { foreignKey: 'clientId', as: 'quotes' });
};

module.exports = Client;
