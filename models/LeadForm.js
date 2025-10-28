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
    comment: 'JSON array of form field configurations with steps'
  },
  // Example formFields structure for multi-step form:
  // {
  //   "steps": [
  //     {
  //       "stepNumber": 1,
  //       "stepTitle": "Contact Information",
  //       "fields": [
  //         { "name": "firstName", "label": "First Name", "type": "text", "required": true },
  //         { "name": "lastName", "label": "Last Name", "type": "text", "required": true },
  //         { "name": "email", "label": "Email", "type": "email", "required": true },
  //         { "name": "phone", "label": "Phone Number", "type": "tel", "required": true }
  //       ]
  //     },
  //     {
  //       "stepNumber": 2,
  //       "stepTitle": "Project Details",
  //       "fields": [
  //         { "name": "address", "label": "Property Address", "type": "text", "required": false },
  //         { "name": "zipCode", "label": "Zip Code", "type": "text", "required": true },
  //         { "name": "homeSize", "label": "Home Size (sq ft)", "type": "number", "required": false },
  //         { "name": "roomCount", "label": "Number of Rooms", "type": "number", "required": false },
  //         { "name": "projectType", "label": "Project Type", "type": "select", 
  //           "options": ["Interior", "Exterior", "Trim/Baseboards", "Cabinets", "Whole House"], "required": true },
  //         { "name": "projectDetails", "label": "Tell us what you need", "type": "textarea", "required": true }
  //       ]
  //     },
  //     {
  //       "stepNumber": 3,
  //       "stepTitle": "Preferences",
  //       "fields": [
  //         { "name": "preferredContactMethod", "label": "Preferred Contact Method", "type": "radio",
  //           "options": ["phone", "email", "text"], "required": false },
  //         { "name": "bestTimeToContact", "label": "Best Time to Reach You", "type": "text", "required": false },
  //         { "name": "timeline", "label": "When do you hope to start?", "type": "select",
  //           "options": ["ASAP", "Within 1 month", "1-3 months", "3-6 months", "Just exploring"], "required": false },
  //         { "name": "paintPreference", "label": "What needs painting?", "type": "select",
  //           "options": ["Just walls", "Whole house", "Cabinets", "Accent wall", "Not sure yet"], "required": false },
  //         { "name": "referralSource", "label": "How did you hear about us?", "type": "select",
  //           "options": ["Google Search", "Social Media", "Friend/Family", "Saw your work", "Advertisement", "Other"], "required": false },
  //         { "name": "agreedToTerms", "label": "I agree to privacy policy & terms", "type": "checkbox", "required": true }
  //       ]
  //     }
  //   ]
  // }
  
  isMultiStep: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_multi_step',
    comment: 'Whether form uses multi-step wizard'
  },
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
  },
  thankYouMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'thank_you_message',
    defaultValue: 'Thanks for reaching out! We\'ll follow up within 15 minutes.',
    comment: 'Message shown after successful submission'
  },
  thankYouRedirectUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'thank_you_redirect_url',
    comment: 'Optional URL to redirect after submission'
  },
  sendConfirmationEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'send_confirmation_email',
    comment: 'Send email confirmation to lead after submission'
  },
  confirmationEmailTemplate: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'confirmation_email_template',
    comment: 'Custom email template for lead confirmation'
  },
  sendInternalNotification: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'send_internal_notification',
    comment: 'Notify team when new lead is submitted'
  },
  notificationEmails: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'notification_emails',
    comment: 'Array of email addresses to notify on submission'
  },
  enableZipCodePricing: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'enable_zip_code_pricing',
    comment: 'Use Zip-Code Rubric AI for ballpark quotes'
  },
  autoResponseTimeMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    field: 'auto_response_time_minutes',
    comment: 'Target response time in minutes for auto-reminders'
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
