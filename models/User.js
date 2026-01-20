// models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

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
  appleId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    field: 'apple_id'
  },
  authProvider: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'local', // 'local', 'google', 'apple', or combinations like 'local,google'
    field: 'auth_provider'
  },
  role: {
    type: DataTypes.ENUM('business_admin', 'contractor_admin', 'customer', 'admin'),
    defaultValue: 'contractor_admin',
    allowNull: false
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id'
    },
    field: 'role_id'
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tenants',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_verified'
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'two_factor_enabled'
  },
  twoFactorSecret: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'two_factor_secret'
  },
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'password_reset_token'
  },
  passwordResetExpires: {
    type: DataTypes.BIGINT, // Store as milliseconds timestamp to avoid timezone issues
    allowNull: true,
    field: 'password_reset_expires'
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [0, 500] // Max 500 characters
    }
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'phone_number',
    validate: {
      is: /^[+]?[(]?\d{1,4}[)]?[-\s.]?[(]?\d{1,4}[)]?[-\s.]?\d{1,9}$/i
    }
  },
  profilePicture: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'profile_picture',
    validate: {
      isUrl: true
    }
  }
}, {
  tableName: 'Users', // Explicitly set table name to match database
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['email'] },
    { fields: ['google_id'] },
    { fields: ['apple_id'] }
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
User.prototype.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Alias for validatePassword (used in mobile auth)
User.prototype.validatePassword = async function (candidatePassword) {
  return this.comparePassword(candidatePassword);
};

// Associations will be set up in models/index.js
User.associate = (models) => {
  User.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  User.belongsTo(models.Role, { foreignKey: 'roleId', as: 'userRole' });
  User.hasMany(models.Payment, { foreignKey: 'userId' });
  User.hasMany(models.Quote, { foreignKey: 'userId', as: 'quotes' });
};

module.exports = User;