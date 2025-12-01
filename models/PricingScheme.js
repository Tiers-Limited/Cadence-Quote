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
      'sqft_turnkey',           // Square Foot (Turnkey, All-In)
      'sqft_labor_paint',       // Square Foot (Labor + Paint Separated)
      'hourly_time_materials',  // Hourly Rate (Time & Materials)
      'unit_pricing',           // Unit Pricing (Doors, Windows, Trim, etc.)
      'room_flat_rate'          // Room-Based / Flat Rate
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
  },
  
  // Example structure for pricingRules by type:
  // 
  // sqft_turnkey: {
  //   "walls": { "price": 1.15, "unit": "sqft" },
  //   "ceilings": { "price": 0.95, "unit": "sqft" }
  // }
  //
  // sqft_labor_paint: {
  //   "labor_rate": { "price": 0.55, "unit": "sqft" },
  //   "paint": { "price": 40, "unit": "gallon" },
  //   "coverage": { "value": 350, "unit": "sqft_per_gallon" }
  // }
  //
  // hourly_time_materials: {
  //   "hourly_rate": { "price": 50, "unit": "hour_per_painter" },
  //   "crew_size": { "value": 3, "unit": "painters" },
  //   "paint": { "price": 40, "unit": "gallon" }
  // }
  //
  // unit_pricing: {
  //   "door": { "price": 85, "unit": "each" },
  //   "window": { "price": 75, "unit": "each" },
  //   "trim": { "price": 2.50, "unit": "linear_ft" },
  //   "shutter": { "price": 35, "unit": "each" },
  //   "cabinet_door": { "price": 45, "unit": "each" }
  // }
  //
  // room_flat_rate: {
  //   "small_bedroom": { "price": 350, "unit": "room", "size": "10x12x8" },
  //   "medium_bedroom": { "price": 450, "unit": "room", "size": "12x14x8" },
  //   "large_bedroom": { "price": 550, "unit": "room", "size": "14x16x8" },
  //   "small_living": { "price": 500, "unit": "room", "size": "12x15x8" },
  //   "medium_living": { "price": 650, "unit": "room", "size": "15x20x8" },
  //   "large_living": { "price": 850, "unit": "room", "size": "20x25x9" },
  //   "bathroom": { "price": 250, "unit": "room", "size": "5x8x8" },
  //   "kitchen": { "price": 600, "unit": "room", "size": "12x15x8" }
  // }
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
