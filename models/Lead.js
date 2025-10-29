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
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'last_name'
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
  zipCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'zip_code',
    comment: 'Zip code for Zip-Code Rubric AI pricing'
  },
  homeSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'home_size',
    comment: 'Home size in square feet'
  },
  roomCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'room_count',
    comment: 'Number of rooms to be painted'
  },
  projectType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'project_type',
    comment: 'Type of project: interior, exterior, trim, cabinets, etc.'
  },
  projectDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'project_details',
    comment: 'Tell us what you need - detailed project description'
  },
  preferredContactMethod: {
    type: DataTypes.ENUM('phone', 'email', 'text'),
    allowNull: true,
    field: 'preferred_contact_method'
  },
  bestTimeToContact: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'best_time_to_contact',
    comment: 'Best time to reach the lead'
  },
  timeline: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'When they hope to start the project'
  },
  paintPreference: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'paint_preference',
    comment: 'Walls only, whole house, cabinets, accent, etc.'
  },
  referralSource: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'referral_source',
    comment: 'How did you hear about us'
  },
  photoUrls: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'photo_urls',
    comment: 'Array of uploaded photo URLs'
  },
  agreedToTerms: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'agreed_to_terms',
    comment: 'Privacy policy & terms agreement'
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
  ballparkQuote: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'ballpark_quote',
    comment: 'AI-generated ballpark quote based on zip code and home size'
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'qualified', 'quote_sent', 'proposal_signed', 'won', 'lost'),
    allowNull: false,
    defaultValue: 'new'
  },
  source: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Lead source (e.g., website, social media, referral)'
  },
  utmSource: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'utm_source',
    comment: 'UTM source for lead attribution'
  },
  utmMedium: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'utm_medium',
    comment: 'UTM medium for lead attribution'
  },
  utmCampaign: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'utm_campaign',
    comment: 'UTM campaign for lead attribution'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contactedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'contacted_at',
    comment: 'Timestamp when lead was first contacted'
  },
  lastReminderAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_reminder_at',
    comment: 'Timestamp when last follow-up reminder was sent'
  },
  responseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'response_time',
    comment: 'Time to first contact in minutes'
  },
  assignedTo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'assigned_to',
    comment: 'User ID of assigned salesperson/estimator'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  tableName: 'leads',
  underscored: true, // This will automatically convert createdAt to created_at
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
    }
  ]
});

Lead.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Lead, { foreignKey: 'tenantId' });

Lead.belongsTo(LeadForm, { foreignKey: 'leadFormId' });
LeadForm.hasMany(Lead, { foreignKey: 'leadFormId' });

module.exports = Lead;
