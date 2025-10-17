// models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null for OAuth users
    validate: {
      isValidPassword(value) {
        // Only validate length if password is provided
        if (value && value.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
      }
    }
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    field: 'google_id'
  },
  authProvider: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'local', // 'local', 'google', or 'local,google'
    field: 'auth_provider'
  },
  role: {
    type: DataTypes.ENUM('business_admin', 'contractor_admin', 'customer'),
    defaultValue: 'contractor_admin',
    allowNull: false
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    },
    onDelete: 'CASCADE'  // Users tied to tenant
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      unique: true,
      fields: ['email']
    }
  ]
});

// Hooks: Hash password
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password') && user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// Method to verify password
User.prototype.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false; // OAuth users without password
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

User.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(User, { foreignKey: 'tenantId' });

module.exports = User;