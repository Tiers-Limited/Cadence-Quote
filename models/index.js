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
const Brand = require('./Brand');

// Store models in an object
const models = {
  User,
  Tenant,
  Subscription,
  Payment,
  Role,
  ProductConfig,
  GlobalProduct,
  Brand,
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

// Existing associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;
