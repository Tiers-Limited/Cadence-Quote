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
    references: {
      model: 'Tenants',
      key: 'id'
    }
  },
  
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Contractor/user who created the quote',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  
  pricingSchemeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'pricing_schemes',
      key: 'id'
    }
  },
  
  // Quote Identification
  quoteNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Auto-generated quote number (e.g., Q-2024-001)'
  },
  
  // Customer Information
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  
  customerEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  
  customerPhone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  
  propertyAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  zipCode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  
  // Job Details
  jobType: {
    type: DataTypes.ENUM('interior', 'exterior'),
    allowNull: false
  },
  
  jobCategory: {
    type: DataTypes.ENUM('residential', 'commercial'),
    allowNull: true,
    defaultValue: 'residential'
  },
  
  // Areas and Surfaces (stored as JSON)
  areas: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of areas with surfaces, measurements, and product selections'
    // Structure: [{ id, name, jobType, surfaces: [{ type, selected, selectedProduct, selectedSheen, selectedColor, sqft, dimensions }] }]
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
    defaultValue: 0.00
  },
  
  materialTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  markup: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  markupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  zipMarkup: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  zipMarkupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  taxPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  totalSqft: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Total square footage of all surfaces'
  },
  
  // Quote Status
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'declined', 'archived'),
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
    comment: 'Notes visible to client in proposal'
  },
  
  // Detailed Breakdown (stored as JSON from calculation API)
  breakdown: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Detailed cost breakdown by area and surface'
  },
  
  // Dates
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Quote expiration date'
  },
  
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When quote was sent to client'
  },
  
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  declinedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Metadata
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['userId'] },
    { fields: ['quoteNumber'], unique: true },
    { fields: ['status'] },
    { fields: ['jobType'] },
    { fields: ['createdAt'] },
    { fields: ['customerEmail'] },
    { fields: ['customerPhone'] }
  ]
});

// Class methods
Quote.generateQuoteNumber = async function(tenantId) {
  const year = new Date().getFullYear();
  
  // Find the highest quote number for this year and tenant
  const lastQuote = await Quote.findOne({
    where: {
      tenantId,
      quoteNumber: {
        [sequelize.Sequelize.Op.like]: `Q-${year}-%`
      }
    },
    order: [['quoteNumber', 'DESC']]
  });
  
  let nextNumber = 1;
  if (lastQuote) {
    const lastNumber = parseInt(lastQuote.quoteNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }
  
  return `Q-${year}-${String(nextNumber).padStart(3, '0')}`;
};

// Instance methods
Quote.prototype.markAsSent = function() {
  this.status = 'pending';
  this.sentAt = new Date();
  return this.save();
};

Quote.prototype.approve = function() {
  this.status = 'approved';
  this.approvedAt = new Date();
  return this.save();
};

Quote.prototype.decline = function() {
  this.status = 'declined';
  this.declinedAt = new Date();
  return this.save();
};

Quote.prototype.archive = function() {
  this.status = 'archived';
  return this.save();
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
