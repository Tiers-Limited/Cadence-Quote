// models/Quote.js
// Model for storing contractor quotes/proposals

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quote = sequelize.define('Quote', {
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
    comment: 'Contractor/user who created the quote',
    references: {
      model: 'Users',
      key: 'id'
    }
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'client_id',
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  
  pricingSchemeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'pricing_scheme_id',
    references: {
      model: 'pricing_schemes',
      key: 'id'
    }
  },
  
  // Quote Identification
  quoteNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'quote_number',
    comment: 'Auto-generated quote number (e.g., Q-2024-001)'
  },
  
  // Customer Information (duplicated for historical accuracy)
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'customer_name'
  },
  
  customerEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'customer_email',
    validate: {
      isEmail: true
    }
  },
  
  customerPhone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'customer_phone'
  },
  
  street: {
    type: DataTypes.STRING(500),
    allowNull: true
  },

  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  state: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  
  zipCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'zip_code'
  },
  
  // propertyAddress: {
  //   type: DataTypes.TEXT,
  //   allowNull: true,
  //   field: 'property_address'
  // },
  
  // Job Details
  jobType: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'job_type'
  },
  
  jobCategory: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'residential',
    field: 'job_category'
  },

  // Product Strategy
  productStrategy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'GBB',
    field: 'product_strategy',
    comment: 'Good-Better-Best or Single Product strategy'
  },

  allowCustomerProductChoice: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'allow_customer_product_choice',
    comment: 'Allow customer to choose products in portal'
  },
  
  // Areas and Surfaces (stored as JSON)
  areas: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of areas with surfaces, measurements, substrates, and products'
  },

  // Product selections per surface type
  productSets: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'product_sets',
    comment: 'Product configurations per surface type (walls, trim, ceilings, etc.)'
  },
  
  // Mobile Quote Fields (Phase 2)
  useContractorDiscount: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'use_contractor_discount',
    comment: 'Whether customer is using contractor discount (pay fee) vs full job'
  },
  
  bookingRequest: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'booking_request',
    comment: 'Booking request details: preferredDate, alternates, timePreference, notes'
  },
  
  // Pricing Details
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  laborTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'labor_total'
  },
  
  materialTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'material_total'
  },
  
  markup: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  markupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'markup_percent'
  },
  
  zipMarkup: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'zip_markup'
  },
  
  zipMarkupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'zip_markup_percent'
  },
  
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  taxPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'tax_percent'
  },
  
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  totalSqft: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'total_sqft',
    comment: 'Total square footage of all surfaces'
  },
  
  // Quote Status
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  
  // Additional Details
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Internal notes about the quote'
  },
  
  clientNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'client_notes',
    comment: 'Notes visible to client in proposal'
  },
  
  // Detailed Breakdown (stored as JSON from calculation API)
  breakdown: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Detailed cost breakdown by area and surface'
  },
  
  // Customer Portal Fields
  selectedTier: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'selected_tier',
    comment: 'Customer selected tier: Good, Better, or Best'
  },
  
  depositAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'deposit_amount',
    comment: 'Required deposit amount for this quote'
  },
  
  depositVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'deposit_verified',
    comment: 'Whether deposit payment has been verified by contractor'
  },
  
  depositVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deposit_verified_at',
    comment: 'When deposit was verified'
  },
  
  depositVerifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'deposit_verified_by',
    comment: 'User ID of contractor who verified deposit',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  
  depositPaymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'deposit_payment_method',
    comment: 'Payment method: stripe, cash, check, wire_transfer'
  },
  
  depositTransactionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'deposit_transaction_id',
    comment: 'Stripe payment intent ID or check number'
  },
  
  finishStandardsAcknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'finish_standards_acknowledged',
    comment: 'Whether customer acknowledged finish standards'
  },
  
  finishStandardsAcknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'finish_standards_acknowledged_at',
    comment: 'When customer acknowledged finish standards'
  },
  
  portalOpen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'portal_open',
    comment: 'Whether customer portal is currently open for selections'
  },
  
  portalOpenedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'portal_opened_at',
    comment: 'When portal was opened for customer'
  },
  
  portalClosedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'portal_closed_at',
    comment: 'When portal was closed'
  },
  
  selectionsComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'selections_complete',
    comment: 'Whether customer has completed all product selections'
  },
  
  selectionsCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'selections_completed_at',
    comment: 'When customer submitted all selections'
  },
  
  tierChangeRequested: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'tier_change_requested',
    comment: 'Requested tier change (upgrade/downgrade)'
  },
  
  tierChangeRequestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'tier_change_requested_at',
    comment: 'When tier change was requested'
  },
  
  tierChangeApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: null,
    field: 'tier_change_approved',
    comment: 'Whether tier change was approved by contractor'
  },
  
  tierChangeApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'tier_change_approved_at',
    comment: 'When tier change was approved/denied'
  },
  
  // Dates
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_until',
    comment: 'Quote expiration date'
  },
  
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at',
    comment: 'When quote was sent to client'
  },
  
  viewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'viewed_at',
    comment: 'When client first viewed the quote'
  },
  
  acceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'accepted_at',
    comment: 'When customer accepted the proposal'
  },
  
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  
  declinedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'declined_at'
  },
  
  // Metadata
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'quotes',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['tenant_id'] },
    { fields: ['user_id'] },
    { fields: ['client_id'] },
    { fields: ['pricing_scheme_id'] },
    { fields: ['quote_number'] },
    { fields: ['status'] },
    { fields: ['job_type'] },
    { fields: ['created_at'] },
    { fields: ['customer_email'] },
    { fields: ['customer_phone'] },
    { fields: ['zip_code'] },
  ]
});

// Associations
Quote.associate = (models) => {
  Quote.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Quote.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  Quote.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  Quote.belongsTo(models.PricingScheme, { foreignKey: 'pricingSchemeId', as: 'pricingScheme' });
};

// Class methods
Quote.generateQuoteNumber = async function(tenantId, transaction = null) {
  const year = new Date().getFullYear();
  
  // Find the highest quote number for this year and tenant
  const queryOptions = {
    where: {
      tenantId,
      quoteNumber: {
        [sequelize.Sequelize.Op.like]: `Q-${year}-%`
      }
    },
    order: [['quoteNumber', 'DESC']]
  };
  
  if (transaction) {
    queryOptions.transaction = transaction;
  }
  
  const lastQuote = await Quote.findOne(queryOptions);
  
  let nextNumber = 1;
  if (lastQuote) {
    const lastNumber = parseInt(lastQuote.quoteNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }
  
  return `Q-${year}-${String(nextNumber).padStart(3, '0')}`;
};

// Instance methods
Quote.prototype.markAsSent = async function() {
  this.status = 'sent';
  this.sentAt = new Date();
  await this.save();
  return this;
};

Quote.prototype.markAsViewed = async function() {
  if (this.status === 'sent' && !this.viewedAt) {
    this.status = 'viewed';
    this.viewedAt = new Date();
    await this.save();
  }
  return this;
};

Quote.prototype.approve = async function() {
  this.status = 'approved';
  this.approvedAt = new Date();
  await this.save();
  return this;
};

Quote.prototype.decline = async function() {
  this.status = 'declined';
  this.declinedAt = new Date();
  await this.save();
  return this;
};

Quote.prototype.archive = async function() {
  this.status = 'archived';
  await this.save();
  return this;
};

Quote.prototype.calculateTotals = function() {
  // Recalculate totals from breakdown if needed
  if (this.breakdown && Array.isArray(this.breakdown)) {
    let labor = 0;
    let material = 0;
    
    this?.breakdown?.forEach(area => {
      area?.surfaces?.forEach(surface => {
        labor += parseFloat(surface.laborCost || 0);
        material += parseFloat(surface.materialCost || 0);
      });
    });
    
    this.laborTotal = labor;
    this.materialTotal = material;
    this.subtotal = labor + material;
    this.markup = this.subtotal * (parseFloat(this.markupPercent) / 100);
    this.zipMarkup = (this.subtotal + this.markup) * (parseFloat(this.zipMarkupPercent) / 100);
    const subtotalWithMarkups = this.subtotal + this.markup + this.zipMarkup;
    this.tax = subtotalWithMarkups * (parseFloat(this.taxPercent) / 100);
    this.total = subtotalWithMarkups + this.tax;
  }
};

module.exports = Quote;
