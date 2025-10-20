// models/Lead.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const LeadForm = require('./LeadForm');

const Lead = sequelize.define('Lead', {
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
    onDelete: 'CASCADE',
    field: 'tenant_id'
  },
  leadFormId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: LeadForm,
      key: 'id'
    },
    onDelete: 'SET NULL',
    field: 'lead_form_id'
  },
  fullName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'full_name'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  projectType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'project_type'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  formData: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'form_data',
    comment: 'Complete form submission data'
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'qualified', 'quoted', 'won', 'lost'),
    allowNull: false,
    defaultValue: 'new'
  },
  source: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Lead source (e.g., website, social media, referral)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  timestamps: false, // We define them manually to match snake_case
  tableName: 'leads',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['lead_form_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['email']
    },
    {
      fields: ['createdAt']
    }
  ]
});

Lead.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Lead, { foreignKey: 'tenantId' });

Lead.belongsTo(LeadForm, { foreignKey: 'leadFormId' });
LeadForm.hasMany(Lead, { foreignKey: 'leadFormId' });

module.exports = Lead;
