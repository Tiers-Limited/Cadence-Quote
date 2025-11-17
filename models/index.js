// models/index.js
// Central model loader to handle associations without circular dependencies

const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Tenant = require('./Tenant');
const Subscription = require('./Subscription');
const Payment = require('./Payment');
const Role = require('./Role');

// Store models in an object
const models = {
  User,
  Tenant,
  Subscription,
  Payment,
  Role,
  sequelize
};

// Set up associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;
