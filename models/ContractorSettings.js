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
  },
  
  // Product Configuration Defaults
  productConfigLaborRates: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'product_config_labor_rates',
    defaultValue: { interior: [], exterior: [] },
    comment: 'Default labor rates for product configurations (interior/exterior)'
  },
  productConfigDefaultMarkup: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 15.00,
    field: 'product_config_default_markup',
    comment: 'Default markup percentage for product configurations'
  },
  productConfigDefaultTaxRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'product_config_default_tax_rate',
    comment: 'Default tax rate for product configurations'
  }
  ,
  // Global Pricing & Metrics (Pricing Engine)
  defaultLaborHourRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'default_labor_hour_rate',
    comment: 'Global labor hourly rate used for time & materials'
  },
  laborMarkupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'labor_markup_percent',
    comment: 'Markup percentage applied to labor'
  },
  materialMarkupPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'material_markup_percent',
    comment: 'Markup percentage applied to materials'
  },
  overheadPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'overhead_percent',
    comment: 'Overhead percentage used in pricing engine'
  },
  netProfitPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'net_profit_percent',
    comment: 'Target net profit percentage'
  },
  // Quote Settings
  depositPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 50.00,
    field: 'deposit_percentage',
    comment: 'Required deposit percentage'
  },
  quoteValidityDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    field: 'quote_validity_days',
    comment: 'Number of days quote remains valid'
  },
  // Customer Portal Settings
  portalDurationDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 14,
    field: 'portal_duration_days',
    comment: 'Number of days customer portal remains open after deposit'
  },
  portalAutoLock: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'portal_auto_lock',
    comment: 'Automatically lock portal after duration expires'
  },
  // Turnkey Square Foot Rates
  turnkeyInteriorRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'turnkey_interior_rate',
    comment: 'Turnkey all-in rate per sq ft for interior'
  },
  turnkeyExteriorRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'turnkey_exterior_rate',
    comment: 'Turnkey all-in rate per sq ft for exterior'
  },
  // Additional Hourly Labor Rates
  prepRepairHourlyRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'prep_repair_hourly_rate',
    comment: 'Hourly rate for prep and repair work'
  },
  finishCabinetHourlyRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'finish_cabinet_hourly_rate',
    comment: 'Hourly rate for finish and cabinet work'
  },
  // Production Rates (Interior - sqft or linear ft per hour)
  productionInteriorWalls: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_interior_walls',
    comment: 'Interior walls production rate (sq ft/hour)'
  },
  productionInteriorCeilings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_interior_ceilings',
    comment: 'Interior ceilings production rate (sq ft/hour)'
  },
  productionInteriorTrim: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_interior_trim',
    comment: 'Interior trim production rate (linear ft/hour)'
  },
  // Production Rates (Exterior)
  productionExteriorWalls: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_exterior_walls',
    comment: 'Exterior walls production rate (sq ft/hour)'
  },
  productionExteriorTrim: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_exterior_trim',
    comment: 'Exterior trim production rate (linear ft/hour)'
  },
  productionSoffitFascia: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_soffit_fascia',
    comment: 'Soffit & fascia production rate (linear ft/hour)'
  },
  // Production Rates (Optional)
  productionDoors: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_doors',
    comment: 'Doors production rate (units/hour)'
  },
  productionCabinets: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'production_cabinets',
    comment: 'Cabinets production rate (units/hour)'
  },
  // Flat Rate Unit Prices
  flatRateUnitPrices: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'flat_rate_unit_prices',
    defaultValue: {},
    comment: 'Flat rate unit prices for surfaces, items, and rooms'
  }
}, {
  timestamps: true,
  tableName: 'contractor_settings',
  indexes: [
    {
      
      fields: ['tenant_id']
    }
  ]
});

ContractorSettings.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasOne(ContractorSettings, { foreignKey: 'tenantId' });

module.exports = ContractorSettings;
