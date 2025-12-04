// models/index.js
// Central model loader to handle associations without circular dependencies

const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Tenant = require('./Tenant');
const Subscription = require('./Subscription');
const Payment = require('./Payment');
const Role = require('./Role');
const ProductConfig = require('./ProductConfig'); // NEW FEATURE: Contractor product configurations
const GlobalProduct = require('./GlobalProduct');
const GlobalColor = require('./GlobalColor');
const PricingScheme = require('./PricingScheme');
const ContractorSettings = require('./ContractorSettings');
const Quote = require('./Quote');
const Brand = require('./Brand');
const Client = require('./Client');
const ProposalDefaults = require('./ProposalDefaults');
const GBBProductDefaults = require('./GBBProductDefaults');
const ServiceType = require('./ServiceType');
const SurfaceType = require('./SurfaceType');

// Store models in an object
const models = {
  User,
  Tenant,
  Subscription,
  Payment,
  Role,
  ProductConfig,
  GlobalProduct,
  GlobalColor,
  PricingScheme,
  ContractorSettings,
  Quote,
  Brand,
  Client,
  ProposalDefaults,
  GBBProductDefaults,
  ServiceType,
  SurfaceType,
  sequelize
};

// Set up associations
// NEW FEATURE: ProductConfig associations
ProductConfig.belongsTo(GlobalProduct, { foreignKey: 'globalProductId', as: 'globalProduct' });
ProductConfig.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
ProductConfig.belongsTo(User, { foreignKey: 'userId', as: 'user' });

GlobalProduct.hasMany(ProductConfig, { foreignKey: 'globalProductId', as: 'productConfigs' });
Tenant.hasMany(ProductConfig, { foreignKey: 'tenantId', as: 'productConfigs' });
User.hasMany(ProductConfig, { foreignKey: 'userId', as: 'productConfigs' });

// Note: Quote associations are now defined in Quote.associate() method
// Removed duplicate associations from here to avoid "alias tenant in two separate associations" error

// Existing associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;
