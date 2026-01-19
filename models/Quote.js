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

  // Turnkey Pricing Fields
  homeSqft: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'home_sqft',
    
  },

  jobScope: {
    type: DataTypes.ENUM('interior', 'exterior', 'both'),
    allowNull: true,
    defaultValue: 'both',
    field: 'job_scope',
    
  },

  numberOfStories: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
    field: 'number_of_stories',
    
  },

  conditionModifier: {
    type: DataTypes.ENUM('excellent', 'good', 'average', 'fair', 'poor'),
    allowNull: true,
    defaultValue: 'average',
    field: 'condition_modifier',
    
  },

  // Product Strategy
  productStrategy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'GBB',
    field: 'product_strategy',
    
  },

  allowCustomerProductChoice: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'allow_customer_product_choice',
    
  },
  
  // Areas and Surfaces (stored as JSON)
  // Format: [{ id, name, laborItems: [{ categoryName, selected, quantity, ... }] }]
  areas: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    
  },

  // Product selections - supports both global (turnkey) and area-wise (flat_rate, production_based, rate_based)
  // Structure depends on pricing scheme type:
  // 
  // TURNKEY (global selection by surface type):
  // { surfaceType: { products: { good, better, best, single }, ... }, ... }
  //
  // AREA-WISE (flat_rate_unit, production_based, rate_based):
  // {
  //   areaId: {
  //     areaName: string,
  //     surfaces: {
  //       surfaceType: { products: { good, better, best, single }, quantity, unit, ... },
  //       ...
  //     }
  //   },
  //   ...
  // }
  productSets: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'product_sets',
    
  },
  
  // Mobile Quote Fields (Phase 2)
  useContractorDiscount: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'use_contractor_discount',
    allowNull: true
    
  },
  
  bookingRequest: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'booking_request',
    
  },
  
  // Pricing Details
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  
  laborTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'labor_total'
  },
  
  materialTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'material_total'
  },
  
  markup: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  
  markupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'markup_percent'
  },
  
  zipMarkup: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'zip_markup'
  },
  
  zipMarkupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'zip_markup_percent'
  },
  
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  
  taxPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'tax_percent'
  },
  
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  
  totalSqft: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'total_sqft',
    
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
    
  },
  
  clientNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'client_notes',
    
  },
  
  // Detailed Breakdown (stored as JSON from calculation API)
  breakdown: {
    type: DataTypes.JSONB,
    allowNull: true,
    
  },
  
  // Customer Portal Fields
  selectedTier: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'selected_tier',
    
  },
  
  depositAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'deposit_amount',
    
  },
  
  depositVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true,
    field: 'deposit_verified',
    
  },
  
  depositVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deposit_verified_at',
    
  },
  
  depositVerifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'deposit_verified_by',
    
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  
  depositPaymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'deposit_payment_method',
    
  },
  
  depositTransactionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'deposit_transaction_id',
    
  },
  
  finishStandardsAcknowledged: {
    type: DataTypes.BOOLEAN,
  allowNull: true,
    defaultValue: false,
    field: 'finish_standards_acknowledged',
    
  },
  
  finishStandardsAcknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'finish_standards_acknowledged_at',
    
  },
  
  portalOpen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true,
    field: 'portal_open',
    
  },
  
  portalOpenedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'portal_opened_at',
    
  },
  
  portalClosedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'portal_closed_at',
    
  },
  
  selectionsComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true,
    field: 'selections_complete',
    
  },
  
  selectionsCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'selections_completed_at',
    
  },
  
  tierChangeRequested: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'tier_change_requested',
    
  },
  
  tierChangeRequestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'tier_change_requested_at',
    
  },
  
  tierChangeApproved: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: null,
    field: 'tier_change_approved',
    
  },
  
  tierChangeApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'tier_change_approved_at',
    
  },
  
  // Dates
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_until',
    
  },
  
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at',
    
  },
  
  viewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'viewed_at',
    
  },
  
  acceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'accepted_at',
    
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
Quote.generateQuoteNumber = async function(tenantId, clientId = null, transaction = null) {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp for uniqueness
  
  // If client ID is provided, include it in the quote number format
  // Format: Q-{YEAR}-{TENANT_ID}-{CLIENT_ID}-{COUNT}
  // Example: Q-2026-3-615-001 (tenant 3, client 615, first quote)
  
  if (clientId) {
    // Find the highest quote number for this year, tenant, and client
    const queryOptions = {
      where: {
        tenantId,
        clientId,
        quoteNumber: {
          [sequelize.Sequelize.Op.like]: `Q-${year}-${tenantId}-${clientId}-%`
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
      // Extract the last number from format Q-YYYY-TID-CID-NNN
      const parts = lastQuote.quoteNumber.split('-');
      if (parts.length === 5) {
        nextNumber = parseInt(parts[4]) + 1;
      }
    }
    
    return `Q-${year}-${tenantId}-${clientId}-${String(nextNumber).padStart(3, '0')}`;
  }
  
  // Fallback: If no client ID, use tenant-level unique number with timestamp
  // Format: Q-{YEAR}-{TENANT_ID}-{TIMESTAMP}-{COUNT}
  const queryOptions = {
    where: {
      tenantId,
      quoteNumber: {
        [sequelize.Sequelize.Op.like]: `Q-${year}-${tenantId}-%`
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
    // Try to extract number from various formats
    const parts = lastQuote.quoteNumber.split('-');
    if (parts.length >= 4) {
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }
  }
  
  return `Q-${year}-${tenantId}-${timestamp}-${String(nextNumber).padStart(3, '0')}`;
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
