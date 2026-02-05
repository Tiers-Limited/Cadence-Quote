// models/Job.js
// Model for tracking jobs created from accepted quotes after deposit payment

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Foreign Keys
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'tenant_id',
    references: {
      model: 'Tenants',
      key: 'id'
    }
  },
  
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    
    references: {
      model: 'Users',
      key: 'id'
    }
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'client_id',
    
    references: {
      model: 'clients',
      key: 'id'
    }
  },

  quoteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  
    field: 'quote_id',
    
    references: {
      model: 'quotes',
      key: 'id'
    }
  },

  // Job Identification
  jobNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
 
    field: 'job_number',
    
  },

  // Basic Information
  jobName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'job_name',
    
  },

  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'customer_name'
  },

  customerEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'customer_email'
  },

  customerPhone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'customer_phone'
  },

  jobAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'job_address',
    
  },

  // Job Status
  status: {
    type: DataTypes.ENUM(
      'accepted',           // Quote accepted, awaiting deposit
      'pending_deposit',    // Same as accepted (alias for clarity)
      'deposit_paid',       // Deposit paid, portal open for customer selections
      'selections_pending', // Customer needs to complete selections
      'selections_complete',// Customer submitted all selections
      'scheduled',          // Job scheduled with start date
      'in_progress',        // Work has started
      'paused',            // Job temporarily paused
      'completed',         // Job finished
      'invoiced',          // Final invoice sent
      'paid',              // Fully paid
      'closed',            // Job closed after final payment
      'canceled',          // Job canceled
      'on_hold'            // On hold awaiting customer decision
    ),
    allowNull: false,
    defaultValue: 'accepted',
    field: 'status'
  },

  // Financial Information
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_amount',
    
  },

  depositAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'deposit_amount',
    
  },

  depositPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'deposit_paid'
  },

  depositPaidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deposit_paid_at'
  },

  balanceRemaining: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'balance_remaining',
    
  },

  // Final Payment Information
  finalPaymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'waived'),
    allowNull: false,
    defaultValue: 'pending',
    field: 'final_payment_status',
  },

  finalPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'final_payment_date',
    
  },

  finalPaymentTransactionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'final_payment_transaction_id',
    
  },

  finalPaymentAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'final_payment_amount',
    
  },

  // Scheduling
  scheduledStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scheduled_start_date',
    
  },

  scheduledEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scheduled_end_date',
    
  },

  estimatedDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'estimated_duration',
    
  },

  actualStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'actual_start_date',
    
  },

  actualEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'actual_end_date',
    
  },

  // Job Details from Quote
  selectedTier: {
    type: DataTypes.ENUM('good', 'better', 'best'),
    allowNull: true,
    defaultValue: 'better',
    field: 'selected_tier',
    
  },

  jobType: {
    type: DataTypes.ENUM('interior', 'exterior', 'both'),
    allowNull: false,
    defaultValue: 'interior',
    field: 'job_type'
  },

  // Customer Portal Selections
  customerSelectionsComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'customer_selections_complete',
    
  },

  customerSelectionsSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'customer_selections_submitted_at'
  },

  portalExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'portal_expires_at',
    
  },

  // Job Progress Tracking (for areas)
  areaProgress: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'area_progress',
    
  },

  // Documents
  materialListGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'material_list_generated'
  },

  workOrderGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'work_order_generated'
  },

  materialListUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'material_list_url'
  },

  workOrderUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'work_order_url'
  },

  // Crew Assignment
  assignedCrewMembers: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'assigned_crew_members',
    
  },

  crewNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'crew_notes',
    
  },

  // Lost Job Intelligence (only for non-approved jobs)
  lostReason: {
    type: DataTypes.ENUM(
      'budget_mismatch',
      'chose_competitor',
      'timing_changed',
      'scope_misalignment',
      'confidence_issues',
      'project_paused',
      'other'
    ),
    allowNull: true,
    field: 'lost_reason',
    
  },

  lostReasonDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'lost_reason_details',
    
  },

  lostAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'lost_at'
  },

  // Notes and Communication
  contractorNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'contractor_notes',
    
  },

  customerNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'customer_notes',
    
  },

  // Job Document URLs
  materialListUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'material_list_url',
    
  },

  paintOrderUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'paint_order_url',
    
  },

  workOrderUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'work_order_url',
    
  },

  documentsGeneratedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'documents_generated_at',
    
  },

  quoteAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'quote_accepted_at',
    
  },

  // Metadata
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
  tableName: 'jobs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['tenant_id'] },
    { fields: ['user_id'] },
    { fields: ['client_id'] },
    { fields: ['quote_id'], unique: true },
    { fields: ['job_number'], unique: true },
    { fields: ['status'] },
    { fields: ['scheduled_start_date'] },
    { fields: ['created_at'] }
    // Composite indexes removed - will be added via migration to avoid lock timeout
  ]
});

// Define associations
Job.associate = (models) => {
  Job.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Job.belongsTo(models.User, { foreignKey: 'userId', as: 'contractor' });
  Job.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  Job.belongsTo(models.Quote, { foreignKey: 'quoteId', as: 'quote' });
};

module.exports = Job;
