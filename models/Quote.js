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

  // New fields for enhanced quote builder functionality
  paintersOnSite: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 2,
    field: 'painters_on_site',
    validate: {
      min: 1,
      max: 10
    }
  },

  laborOnly: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'labor_only'
  },

  propertyCondition: {
    type: DataTypes.ENUM('excellent', 'good', 'average', 'fair', 'poor'),
    allowNull: true,
    defaultValue: 'average',
    field: 'property_condition'
  },

  // Flat rate items for unit-based pricing (JSONB structure)
  // Format: { interior: { doors: 2, smallRooms: 3, ... }, exterior: { windows: 5, ... } }
  flatRateItems: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'flat_rate_items'
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
    allowNull: true
  },
  
  // GBB (Good-Better-Best) Tier Pricing
  gbbSelectedTier: {
    type: DataTypes.ENUM('good', 'better', 'best'),
    allowNull: true,
    defaultValue: 'better',
    field: 'gbb_selected_tier'
  },
  
  gbbTierPricing: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'gbb_tier_pricing',
    defaultValue: {}
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
  
  depositPaidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deposit_paid_at',
    comment: 'Date when deposit payment was completed'
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
  
  // Enhanced auto-save fields for optimistic locking
  lastModified: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    field: 'last_modified'
  },
  
  autoSaveVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'auto_save_version'
  },

  // Job Analytics Fields
  jobCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'job_completed_at',
    comment: 'When job was marked as complete'
  },

  finalInvoiceAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'final_invoice_amount',
    validate: {
      min: 0
    },
    comment: 'Final invoiced amount (may differ from quote total)'
  },

  actualMaterialCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'actual_material_cost',
    validate: {
      min: 0
    },
    comment: 'Tracked material expenses during job execution'
  },

  actualLaborCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'actual_labor_cost',
    validate: {
      min: 0
    },
    comment: 'Tracked labor expenses during job execution'
  },

  analyticsCalculated: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'analytics_calculated',
    comment: 'Whether job analytics have been calculated'
  },

  // Proposal PDF Fields
  proposalPdfUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'proposal_pdf_url',
    comment: 'URL/path to the generated proposal PDF'
  },

  proposalPdfGeneratedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'proposal_pdf_generated_at',
    comment: 'When the proposal PDF was last generated'
  },

  proposalPdfVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'proposal_pdf_version',
    comment: 'Version number of the proposal PDF (increments on regeneration)'
  },
  
  // Invoice PDF Fields (generated after deposit payment)
  invoicePdfUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'invoice_pdf_url',
    comment: 'URL/path to the generated invoice PDF (created after deposit payment)'
  },

  invoicePdfGeneratedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'invoice_pdf_generated_at',
    comment: 'When the invoice PDF was generated'
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
    { fields: ['last_modified'] },
    { fields: ['auto_save_version'] },
    { fields: ['painters_on_site'] },
    { fields: ['labor_only'] },
    { fields: ['property_condition'] },
    { fields: ['job_completed_at'] },
    { fields: ['analytics_calculated'] },
    { fields: ['final_invoice_amount'] },
    { fields: ['gbb_selected_tier'] },
    { fields: ['gbb_tier_pricing'], using: 'gin' }
    // Composite indexes removed - will be added via migration to avoid lock timeout
  ]
});

// Associations
Quote.associate = (models) => {
  Quote.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Quote.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  Quote.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  Quote.belongsTo(models.PricingScheme, { foreignKey: 'pricingSchemeId', as: 'pricingScheme' });
  
  // Job Analytics association
  Quote.hasOne(models.JobAnalytics, { foreignKey: 'quoteId', as: 'jobAnalytics' });
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
    
    // Tax should only be applied to markup, not total amount
    const totalMarkup = this.markup + this.zipMarkup;
    this.tax = totalMarkup * (parseFloat(this.taxPercent) / 100);
    
    this.total = this.subtotal + totalMarkup + this.tax;
  }
};

// Job completion methods
Quote.prototype.markJobComplete = async function(finalInvoiceAmount = null, actualMaterialCost = null, actualLaborCost = null) {
  this.jobCompletedAt = new Date();
  this.finalInvoiceAmount = finalInvoiceAmount || this.total;
  
  if (actualMaterialCost !== null) {
    this.actualMaterialCost = actualMaterialCost;
  }
  
  if (actualLaborCost !== null) {
    this.actualLaborCost = actualLaborCost;
  }
  
  await this.save();
  return this;
};

Quote.prototype.isJobComplete = function() {
  return this.jobCompletedAt !== null;
};

Quote.prototype.canCalculateAnalytics = function() {
  return this.isJobComplete() && this.finalInvoiceAmount > 0;
};

Quote.prototype.markAnalyticsCalculated = async function() {
  this.analyticsCalculated = true;
  await this.save();
  return this;
};

// Product configuration helper methods
Quote.prototype.getProductsByScheme = function() {
  if (!this.productSets || typeof this.productSets !== 'object') {
    return null;
  }
  return this.productSets;
};

Quote.prototype.setProductsByScheme = function(productSets, scheme) {
  // Validate that productSets has the correct structure for the scheme
  if (!productSets || typeof productSets !== 'object') {
    throw new Error('Invalid productSets: must be an object');
  }
  
  // Add scheme identifier if not present
  if (!productSets.scheme) {
    productSets.scheme = scheme;
  }
  
  this.productSets = productSets;
  return this;
};

Quote.prototype.validateProductConfiguration = function(pricingScheme) {
  const productSets = this.productSets;
  
  if (!productSets || typeof productSets !== 'object') {
    return {
      valid: false,
      errors: [{ code: 'MISSING_PRODUCTS', message: 'No product configuration found' }]
    };
  }
  
  const errors = [];
  const warnings = [];
  
  // Validate based on pricing scheme
  switch (pricingScheme) {
    case 'turnkey':
      this._validateTurnkeyStructure(productSets, errors, warnings);
      break;
      
    case 'flat_rate_unit':
      this._validateFlatRateUnitStructure(productSets, errors, warnings);
      break;
      
    case 'unit_pricing':
    case 'production_based':
    case 'rate_based':
      this._validateUnitPricingStructure(productSets, errors, warnings);
      break;
      
    case 'hourly':
      this._validateHourlyStructure(productSets, errors, warnings);
      break;
      
    default:
      warnings.push({
        code: 'UNKNOWN_SCHEME',
        message: `Unknown pricing scheme: ${pricingScheme}`
      });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// Private validation methods for each pricing scheme
Quote.prototype._validateTurnkeyStructure = function(productSets, errors, warnings) {
  // Validate turnkey structure: should have global surface types
  if (!productSets.global || typeof productSets.global !== 'object') {
    errors.push({
      code: 'INVALID_STRUCTURE',
      message: 'Turnkey pricing requires global surface type configuration',
      severity: 'error'
    });
    return;
  }
  
  // Expected surface types for turnkey pricing
  const expectedSurfaces = ['walls', 'ceilings', 'trim', 'doors'];
  const missingSurfaces = [];
  
  expectedSurfaces.forEach(surface => {
    if (!productSets.global[surface]) {
      missingSurfaces.push(surface);
    } else {
      // Validate product structure
      const product = productSets.global[surface];
      if (!product.productId || !product.productName) {
        errors.push({
          code: 'INVALID_PRODUCT',
          category: surface,
          message: `Invalid product configuration for ${surface}`,
          severity: 'error'
        });
      }
      
      // Validate quantity is positive
      if (product.quantity !== undefined && product.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          category: surface,
          message: `Quantity must be greater than 0 for ${surface}`,
          severity: 'error'
        });
      }
    }
  });
  
  if (missingSurfaces.length > 0) {
    warnings.push({
      code: 'MISSING_SURFACE_TYPES',
      message: `Some surface types are missing products: ${missingSurfaces.join(', ')}`,
      severity: 'warning'
    });
  }
};

Quote.prototype._validateFlatRateUnitStructure = function(productSets, errors, warnings) {
  // Validate flat rate structure: should have interior and/or exterior categories
  if (!productSets.interior && !productSets.exterior) {
    errors.push({
      code: 'INVALID_STRUCTURE',
      message: 'Flat Rate Unit pricing requires interior or exterior category configuration',
      severity: 'error'
    });
    return;
  }
  
  // Validate interior categories
  if (productSets.interior) {
    const expectedInteriorCategories = [
      'door', 'smallRoom', 'mediumRoom', 'largeRoom', 
      'closet', 'accentWall', 'cabinetsFace', 'cabinetsDoors'
    ];
    
    const missingInterior = [];
    const hasCabinetsFace = !!productSets.interior.cabinetsFace;
    const hasCabinetsDoors = !!productSets.interior.cabinetsDoors;
    
    expectedInteriorCategories.forEach(category => {
      const categoryData = productSets.interior[category];
      
      if (!categoryData) {
        missingInterior.push(category);
      } else {
        // Validate category structure
        if (!categoryData.products || !Array.isArray(categoryData.products)) {
          errors.push({
            code: 'INVALID_CATEGORY_STRUCTURE',
            category: `interior.${category}`,
            message: `Category ${category} must have a products array`,
            severity: 'error'
          });
        } else {
          // Validate each product in the category
          categoryData.products.forEach((product, index) => {
            if (!product.productId || !product.productName) {
              errors.push({
                code: 'INVALID_PRODUCT',
                category: `interior.${category}`,
                message: `Invalid product at index ${index} in ${category}`,
                severity: 'error'
              });
            }
          });
        }
        
        // Validate unit count is positive
        if (categoryData.unitCount !== undefined && categoryData.unitCount < 0) {
          errors.push({
            code: 'INVALID_UNIT_COUNT',
            category: `interior.${category}`,
            message: `Unit count must be non-negative for ${category}`,
            severity: 'error'
          });
        }
      }
    });
    
    // Validate cabinet subcategory completeness
    if (hasCabinetsFace && !hasCabinetsDoors) {
      errors.push({
        code: 'MISSING_CABINET_SUBCATEGORY',
        category: 'interior.cabinets',
        subcategory: 'doors',
        message: 'Cabinet doors product required when cabinet face is selected',
        severity: 'error'
      });
    }
    
    if (hasCabinetsDoors && !hasCabinetsFace) {
      errors.push({
        code: 'MISSING_CABINET_SUBCATEGORY',
        category: 'interior.cabinets',
        subcategory: 'face',
        message: 'Cabinet face product required when cabinet doors is selected',
        severity: 'error'
      });
    }
    
    if (missingInterior.length > 0) {
      warnings.push({
        code: 'MISSING_INTERIOR_CATEGORIES',
        message: `Some interior categories are missing: ${missingInterior.join(', ')}`,
        severity: 'warning'
      });
    }
  }
  
  // Validate exterior categories
  if (productSets.exterior) {
    const expectedExteriorCategories = [
      'doors', 'windows', 'garageDoor1Car', 'garageDoor2Car', 
      'garageDoor3Car', 'shutters'
    ];
    
    const missingExterior = [];
    
    expectedExteriorCategories.forEach(category => {
      const categoryData = productSets.exterior[category];
      
      if (!categoryData) {
        missingExterior.push(category);
      } else {
        // Validate category structure
        if (!categoryData.products || !Array.isArray(categoryData.products)) {
          errors.push({
            code: 'INVALID_CATEGORY_STRUCTURE',
            category: `exterior.${category}`,
            message: `Category ${category} must have a products array`,
            severity: 'error'
          });
        } else {
          // Validate each product in the category
          categoryData.products.forEach((product, index) => {
            if (!product.productId || !product.productName) {
              errors.push({
                code: 'INVALID_PRODUCT',
                category: `exterior.${category}`,
                message: `Invalid product at index ${index} in ${category}`,
                severity: 'error'
              });
            }
          });
        }
        
        // Validate unit count is positive
        if (categoryData.unitCount !== undefined && categoryData.unitCount < 0) {
          errors.push({
            code: 'INVALID_UNIT_COUNT',
            category: `exterior.${category}`,
            message: `Unit count must be non-negative for ${category}`,
            severity: 'error'
          });
        }
        
        // Validate garage door multipliers
        if (category.startsWith('garageDoor')) {
          const expectedMultipliers = {
            'garageDoor1Car': 0.5,
            'garageDoor2Car': 1.0,
            'garageDoor3Car': 1.5
          };
          
          const expectedMultiplier = expectedMultipliers[category];
          
          if (categoryData.multiplier !== undefined && categoryData.multiplier !== expectedMultiplier) {
            errors.push({
              code: 'INVALID_GARAGE_DOOR_MULTIPLIER',
              category: `exterior.${category}`,
              message: `Invalid multiplier for ${category}. Expected ${expectedMultiplier}, got ${categoryData.multiplier}`,
              severity: 'error'
            });
          }
        }
      }
    });
    
    if (missingExterior.length > 0) {
      warnings.push({
        code: 'MISSING_EXTERIOR_CATEGORIES',
        message: `Some exterior categories are missing: ${missingExterior.join(', ')}`,
        severity: 'warning'
      });
    }
  }
};

Quote.prototype._validateUnitPricingStructure = function(productSets, errors, warnings) {
  // Validate unit pricing structure: should have areas
  if (!productSets.areas || typeof productSets.areas !== 'object') {
    errors.push({
      code: 'INVALID_STRUCTURE',
      message: 'Unit Pricing requires area-based configuration',
      severity: 'error'
    });
    return;
  }
  
  const areaIds = Object.keys(productSets.areas);
  
  if (areaIds.length === 0) {
    warnings.push({
      code: 'NO_AREAS',
      message: 'No areas configured for unit pricing',
      severity: 'warning'
    });
    return;
  }
  
  // Validate each area
  areaIds.forEach(areaId => {
    const area = productSets.areas[areaId];
    
    if (!area || typeof area !== 'object') {
      errors.push({
        code: 'INVALID_AREA',
        category: areaId,
        message: `Invalid area configuration for ${areaId}`,
        severity: 'error'
      });
      return;
    }
    
    if (!area.areaName) {
      errors.push({
        code: 'MISSING_AREA_NAME',
        category: areaId,
        message: `Area ${areaId} is missing a name`,
        severity: 'error'
      });
    }
    
    if (!area.surfaces || typeof area.surfaces !== 'object') {
      errors.push({
        code: 'MISSING_SURFACES',
        category: areaId,
        message: `Area ${areaId} is missing surfaces configuration`,
        severity: 'error'
      });
      return;
    }
    
    // Validate surfaces in the area
    const surfaceTypes = Object.keys(area.surfaces);
    
    surfaceTypes.forEach(surfaceType => {
      const surface = area.surfaces[surfaceType];
      
      if (!surface || typeof surface !== 'object') {
        errors.push({
          code: 'INVALID_SURFACE',
          category: `${areaId}.${surfaceType}`,
          message: `Invalid surface configuration for ${surfaceType} in ${areaId}`,
          severity: 'error'
        });
        return;
      }
      
      // Validate tier-based products (good, better, best)
      const tiers = ['good', 'better', 'best'];
      const hasTiers = tiers.some(tier => surface[tier]);
      
      if (hasTiers) {
        tiers.forEach(tier => {
          if (surface[tier]) {
            const product = surface[tier];
            
            if (!product.productId || !product.productName) {
              errors.push({
                code: 'INVALID_PRODUCT',
                category: `${areaId}.${surfaceType}.${tier}`,
                message: `Invalid product for ${tier} tier in ${surfaceType} of ${areaId}`,
                severity: 'error'
              });
            }
            
            // Validate quantity is positive
            if (product.quantity !== undefined && product.quantity <= 0) {
              errors.push({
                code: 'INVALID_QUANTITY',
                category: `${areaId}.${surfaceType}.${tier}`,
                message: `Quantity must be greater than 0 for ${tier} tier`,
                severity: 'error'
              });
            }
          }
        });
      } else {
        warnings.push({
          code: 'NO_TIER_PRODUCTS',
          category: `${areaId}.${surfaceType}`,
          message: `No tier products configured for ${surfaceType} in ${areaId}`,
          severity: 'warning'
        });
      }
    });
  });
};

Quote.prototype._validateHourlyStructure = function(productSets, errors, warnings) {
  // Validate hourly structure: should have items array
  if (!productSets.items || !Array.isArray(productSets.items)) {
    errors.push({
      code: 'INVALID_STRUCTURE',
      message: 'Hourly pricing requires items array configuration',
      severity: 'error'
    });
    return;
  }
  
  if (productSets.items.length === 0) {
    warnings.push({
      code: 'NO_ITEMS',
      message: 'No items configured for hourly pricing',
      severity: 'warning'
    });
    return;
  }
  
  // Validate each item
  productSets.items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({
        code: 'INVALID_ITEM',
        category: `item-${index}`,
        message: `Invalid item at index ${index}`,
        severity: 'error'
      });
      return;
    }
    
    if (!item.id) {
      errors.push({
        code: 'MISSING_ITEM_ID',
        category: `item-${index}`,
        message: `Item at index ${index} is missing an id`,
        severity: 'error'
      });
    }
    
    if (!item.description) {
      warnings.push({
        code: 'MISSING_DESCRIPTION',
        category: `item-${index}`,
        message: `Item at index ${index} is missing a description`,
        severity: 'warning'
      });
    }
    
    if (!item.products || !Array.isArray(item.products)) {
      errors.push({
        code: 'MISSING_PRODUCTS',
        category: `item-${index}`,
        message: `Item at index ${index} is missing products array`,
        severity: 'error'
      });
      return;
    }
    
    // Validate products in the item
    item.products.forEach((product, productIndex) => {
      if (!product.productId || !product.productName) {
        errors.push({
          code: 'INVALID_PRODUCT',
          category: `item-${index}.product-${productIndex}`,
          message: `Invalid product at index ${productIndex} in item ${index}`,
          severity: 'error'
        });
      }
      
      // Validate quantity is positive
      if (product.quantity !== undefined && product.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          category: `item-${index}.product-${productIndex}`,
          message: `Quantity must be greater than 0 for product at index ${productIndex}`,
          severity: 'error'
        });
      }
    });
    
    // Validate estimated hours is positive
    if (item.estimatedHours !== undefined && item.estimatedHours <= 0) {
      errors.push({
        code: 'INVALID_HOURS',
        category: `item-${index}`,
        message: `Estimated hours must be greater than 0 for item at index ${index}`,
        severity: 'error'
      });
    }
  });
};

Quote.prototype.getProductsForArea = function(areaId) {
  if (!this.productSets || !this.productSets.areas) {
    return null;
  }
  return this.productSets.areas[areaId] || null;
};

Quote.prototype.getProductsForSurfaceType = function(surfaceType) {
  // For turnkey pricing - get products from global configuration
  if (this.productSets && this.productSets.global) {
    return this.productSets.global[surfaceType] || null;
  }
  return null;
};

Quote.prototype.getProductsForUnitType = function(unitType, category = 'interior') {
  // For flat rate unit pricing - get products from category configuration
  if (this.productSets && this.productSets[category]) {
    return this.productSets[category][unitType] || null;
  }
  return null;
};

Quote.prototype.aggregateProducts = function() {
  // Aggregate all products across the quote for product order forms
  const productMap = new Map();
  
  if (!this.productSets) {
    return [];
  }
  
  const addProduct = (product) => {
    if (!product || !product.productId) return;
    
    const key = product.productId;
    if (productMap.has(key)) {
      const existing = productMap.get(key);
      existing.quantity = (parseFloat(existing.quantity) || 0) + (parseFloat(product.quantity) || 0);
    } else {
      productMap.set(key, {
        productId: product.productId,
        productName: product.productName,
        quantity: parseFloat(product.quantity) || 0,
        unit: product.unit || 'gallons',
        cost: parseFloat(product.cost) || 0
      });
    }
  };
  
  // Aggregate based on scheme
  if (this.productSets.scheme === 'turnkey' && this.productSets.global) {
    // Aggregate from global surface types
    Object.values(this.productSets.global).forEach(surface => {
      if (surface && typeof surface === 'object') {
        addProduct(surface);
      }
    });
  } else if (this.productSets.scheme === 'flat_rate_unit') {
    // Aggregate from interior and exterior categories
    ['interior', 'exterior'].forEach(category => {
      if (this.productSets[category]) {
        Object.values(this.productSets[category]).forEach(unitType => {
          if (unitType && unitType.products && Array.isArray(unitType.products)) {
            unitType.products.forEach(addProduct);
          }
        });
      }
    });
  } else if (this.productSets.areas) {
    // Aggregate from areas (unit pricing)
    Object.values(this.productSets.areas).forEach(area => {
      if (area && area.surfaces) {
        Object.values(area.surfaces).forEach(surface => {
          if (surface && typeof surface === 'object') {
            // Handle tier-based products (good, better, best)
            ['good', 'better', 'best', 'single'].forEach(tier => {
              if (surface[tier]) {
                addProduct(surface[tier]);
              }
            });
          }
        });
      }
    });
  } else if (this.productSets.items && Array.isArray(this.productSets.items)) {
    // Aggregate from hourly items
    this.productSets.items.forEach(item => {
      if (item && item.products && Array.isArray(item.products)) {
        item.products.forEach(addProduct);
      }
    });
  }
  
  return Array.from(productMap.values());
};

module.exports = Quote;
