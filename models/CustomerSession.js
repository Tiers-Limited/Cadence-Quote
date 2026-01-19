const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CustomerSession Model
 * Represents an active customer portal session
 * 
 * After initial magic link access, customers get a session that:
 * - Persists across browser sessions (via JWT)
 * - Can be upgraded to multi-job access via OTP verification
 * - Tracks activity for security/analytics
 * - Can be revoked by contractor
 */
const CustomerSession = sequelize.define('CustomerSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  // Session Token (JWT stored client-side)
  sessionToken: {
    type: DataTypes.STRING(255),
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
  
  // Access Level
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    
  },
  
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  verificationMethod: {
    type: DataTypes.ENUM('email', 'sms', 'none'),
    defaultValue: 'none',
    
  },
  
  // Accessible Quotes
  quoteIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    
  },
  
  // Lifecycle
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    
  },
  
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  // Tracking
  lastActivityAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  activityCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    
  },
  
  lastActivityIp: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  
  lastActivityUserAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  
  // Device/Browser Info
  deviceFingerprint: {
    type: DataTypes.STRING(255),
    allowNull: true,
    
  },
  
  // Source
  originMagicLinkId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'magic_links',
      key: 'id',
    },
    
  },
  
}, {
  tableName: 'customer_sessions',
  timestamps: true,
  indexes: [
    { fields: ['sessionToken'], unique: true },
    { fields: ['tenantId'] },
    { fields: ['clientId'] },
    { fields: ['expiresAt'] },
    { fields: ['isVerified'] },
  ],
});

// Instance Methods

/**
 * Check if session is valid
 */
CustomerSession.prototype.isValid = function() {
  const now = new Date();
  
  if (this.expiresAt < now) {
    return { valid: false, reason: 'expired' };
  }
  
  if (this.revokedAt) {
    return { valid: false, reason: 'revoked' };
  }
  
  return { valid: true };
};

/**
 * Track session activity
 */
CustomerSession.prototype.trackActivity = async function(ipAddress, userAgent) {
  this.lastActivityAt = new Date();
  this.activityCount += 1;
  this.lastActivityIp = ipAddress;
  this.lastActivityUserAgent = userAgent;
  await this.save();
};

/**
 * Mark as verified (OTP completed)
 */
CustomerSession.prototype.markAsVerified = async function(method, quoteIds) {
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.verificationMethod = method;
  this.quoteIds = quoteIds || [];
  await this.save();
};

/**
 * Revoke session
 */
CustomerSession.prototype.revoke = async function() {
  this.revokedAt = new Date();
  await this.save();
};

/**
 * Define associations
 */
CustomerSession.associate = (models) => {
  CustomerSession.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  CustomerSession.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  CustomerSession.belongsTo(models.MagicLink, { foreignKey: 'originMagicLinkId', as: 'originMagicLink' });
};

module.exports = CustomerSession;
