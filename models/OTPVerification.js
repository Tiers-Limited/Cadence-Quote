const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * OTPVerification Model
 * Handles one-time password verification for multi-job access
 * 
 * Security features:
 * - 6-digit numeric codes
 * - Time-limited (5-10 minutes)
 * - Rate limited (max 3 attempts)
 * - Revocable
 */
const OTPVerification = sequelize.define('OTPVerification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  // OTP Code
  code: {
    type: DataTypes.STRING(6),
    allowNull: false,
    
  },
  
  // Scoping
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tenants',
      key: 'id',
    },
  },
  
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id',
    },
  },
  
  // Delivery
  deliveryMethod: {
    type: DataTypes.ENUM('email', 'sms'),
    allowNull: false,
    
  },
  
  deliveryTarget: {
    type: DataTypes.STRING(255),
    allowNull: false,
    
  },
  
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  deliveryError: {
    type: DataTypes.TEXT,
    allowNull: true,
    
  },
  
  // Lifecycle
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    
  },
  
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  // Security
  attemptCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    
  },
  
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    
  },
  
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  // Tracking
  verificationIp: {
    type: DataTypes.STRING(45),
    allowNull: true,
    
  },
  
  // Associated Session
  customerSessionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customer_sessions',
      key: 'id',
    },
    
  },
  
}, {
  tableName: 'otp_verifications',
  timestamps: true,
  indexes: [
    { fields: ['code'] },
    { fields: ['tenantId'] },
    { fields: ['clientId'] },
    { fields: ['expiresAt'] },
    { fields: ['verifiedAt'] },
  ],
});

// Instance Methods

/**
 * Check if OTP can be verified
 */
OTPVerification.prototype.canVerify = function() {
  const now = new Date();
  
  if (this.expiresAt < now) {
    return { valid: false, reason: 'expired' };
  }
  
  if (this.lockedAt) {
    return { valid: false, reason: 'locked' };
  }
  
  if (this.verifiedAt) {
    return { valid: false, reason: 'already_used' };
  }
  
  if (this.attemptCount >= this.maxAttempts) {
    return { valid: false, reason: 'max_attempts' };
  }
  
  return { valid: true };
};

/**
 * Verify OTP code
 */
OTPVerification.prototype.verify = async function(code, ipAddress) {
  const canVerify = this.canVerify();
  if (!canVerify.valid) {
    return { success: false, reason: canVerify.reason };
  }
  
  this.attemptCount += 1;
  
  if (this.code === code) {
    this.verifiedAt = new Date();
    this.verificationIp = ipAddress;
    await this.save();
    return { success: true };
  }
  
  // Lock after max attempts
  if (this.attemptCount >= this.maxAttempts) {
    this.lockedAt = new Date();
  }
  
  await this.save();
  return { 
    success: false, 
    reason: 'invalid_code',
    attemptsRemaining: this.maxAttempts - this.attemptCount 
  };
};

// Associations will be defined in models/index.js

module.exports = OTPVerification;
