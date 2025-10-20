// models/LeadForm.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const LeadForm = sequelize.define('LeadForm', {
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
  formName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'form_name',
    comment: 'Internal name for the form'
  },
  formTitle: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'form_title',
    comment: 'Title displayed on the form'
  },
  formDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'form_description'
  },
  publicUrl: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'public_url',
    comment: 'Unique URL slug for public access'
  },
  formFields: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'form_fields',
    comment: 'JSON array of form field configurations'
  },
  // Example formFields structure:
  // [
  //   { "name": "fullName", "label": "Full Name", "type": "text", "required": true },
  //   { "name": "email", "label": "Email", "type": "email", "required": true },
  //   { "name": "phone", "label": "Phone", "type": "tel", "required": true },
  //   { "name": "projectType", "label": "Project Type", "type": "select", "options": ["Interior", "Exterior", "Both"], "required": true },
  //   { "name": "message", "label": "Project Details", "type": "textarea", "required": false }
  // ]
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  submissionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'submission_count',
    comment: 'Total number of submissions received'
  }
}, {
  timestamps: true,
  tableName: 'lead_forms',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      unique: true,
      fields: ['public_url']
    }
  ]
});

LeadForm.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(LeadForm, { foreignKey: 'tenantId' });

module.exports = LeadForm;
