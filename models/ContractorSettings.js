// models/ContractorSettings.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const ContractorSettings = sequelize.define('ContractorSettings', {
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
  // Pricing Defaults
  defaultMarkupPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 30.00,
    field: 'default_markup_percentage',
    comment: 'Default markup percentage on materials'
  },
  taxRatePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 8.25,
    field: 'tax_rate_percentage',
    comment: 'Sales tax rate percentage'
  },
  
  // Payment Terms
  depositPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 50.00,
    field: 'deposit_percentage',
    comment: 'Required deposit percentage'
  },
  paymentTerms: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'payment_terms',
    defaultValue: '- 50% deposit required to begin work\n- Remaining balance due upon completion\n- Net 30 payment terms for approved commercial accounts'
  },
  
  // Warranty Information
  warrantyTerms: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'warranty_terms',
    defaultValue: '- 2-year warranty on all interior work\n- 5-year warranty on exterior work\n- Warranty covers peeling, cracking, and fading under normal conditions'
  },
  
  // General Terms
  generalTerms: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'general_terms',
    defaultValue: '- All work performed by licensed and insured contractors\n- Customer responsible for moving furniture and personal items\n- Weather delays may affect exterior project timelines'
  },
  
  // Business Hours & Contact
  businessHours: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'business_hours',
    defaultValue: 'Monday-Friday: 8:00 AM - 6:00 PM'
  },
  
  // Quote Validity
  quoteValidityDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    field: 'quote_validity_days',
    comment: 'Number of days quote remains valid'
  }
}, {
  timestamps: true,
  tableName: 'contractor_settings',
  indexes: [
    {
      unique: true,
      fields: ['tenant_id']
    }
  ]
});

ContractorSettings.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasOne(ContractorSettings, { foreignKey: 'tenantId' });

module.exports = ContractorSettings;
