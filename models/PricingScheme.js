// models/PricingScheme.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const PricingScheme = sequelize.define('PricingScheme', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM(
      'turnkey',                // Turnkey Pricing (Whole-Home) - formerly sqft_turnkey
      'rate_based_sqft',        // Rate-Based Square Foot Pricing - formerly sqft_labor_paint
      'production_based',       // Production-Based Pricing - formerly hourly_time_materials
      'flat_rate_unit',         // Flat Rate Pricing (Unit-Based) - formerly unit_pricing/room_flat_rate
      // Legacy support (will be migrated)
      'sqft_turnkey',
      'sqft_labor_paint',
      'hourly_time_materials',
      'unit_pricing',
      'room_flat_rate'
    ),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_default',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  
  // Pricing Rules (stored as JSON)
  pricingRules: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'pricing_rules',
    // New unified structure for all pricing models:
    // {
    //   // Common fields (all models)
    //   "includeMaterials": true,                    // Toggle for material inclusion (default: true)
    //   "coverage": 350,                             // Sq ft per gallon (default: 350)
    //   "applicationMethod": "roll",                 // "roll" or "spray" (default: "roll")
    //   "coats": 2,                                  // Number of coats (default: 2)
    //   "costPerGallon": 40,                        // Material cost per gallon
    //   
    //   // Model-specific fields:
    //   
    //   // For "turnkey" (Whole-Home):
    //   "turnkeyRate": 3.50,                        // Price per home sq ft
    //   "interiorRate": 3.25,                       // Optional interior-only rate
    //   "exteriorRate": 3.75,                       // Optional exterior-only rate
    //   
    //   // For "rate_based_sqft" (Rate-Based):
    //   "laborRates": {
    //     "walls": 0.55,                            // Labor rate per sq ft
    //     "ceilings": 0.65,
    //     "trim": 2.50,                             // Per linear ft
    //     "doors": 45,                              // Per unit
    //     "cabinets": 65                            // Per unit
    //   },
    //   
    //   // For "production_based" (Production-Based):
    //   "hourlyLaborRate": 50,                      // Per painter per hour
    //   "productionRates": {
    //     "walls": 300,                             // Sq ft per hour
    //     "ceilings": 250,
    //     "trim": 75                                // Linear ft per hour
    //   },
    //   
    //   // For "flat_rate_unit" (Unit-Based):
    //   "unitPrices": {
    //     "door": 85,                               // Fixed price per unit
    //     "window": 75,
    //     "room_small": 350,
    //     "room_medium": 500,
    //     "room_large": 750
    //   }
    // }
  },

  // PIN Protection
  isPinProtected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_pin_protected',
  },
  protectionPin: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'protection_pin',
  },
  protectionMethod: {
    type: DataTypes.ENUM('pin', '2fa'),
    allowNull: true,
    field: 'protection_method'
  }
}, {
  timestamps: true,
  tableName: 'pricing_schemes',
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_default']
    }
  ]
});

PricingScheme.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(PricingScheme, { foreignKey: 'tenantId' });

PricingScheme.associate = (models) => {
  PricingScheme.hasMany(models.Quote, { foreignKey: 'pricingSchemeId', as: 'quotes' });
};

module.exports = PricingScheme;
