const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * MagicLink Model
 * Represents secure, time-limited access tokens for customer portal
 * 
 * Security Features:
 * - Cryptographically secure random tokens
 * - Time-limited (default 24 hours)
 * - Scoped to specific client, tenant, and optionally quote
 * - Revocable at any time
 * - Single-use option available
 * - Rate limiting via attempt tracking
 */
const MagicLink = sequelize.define('MagicLink', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  // Security Token
  token: {
    type: DataTypes.STRING(128),
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
  
  quoteId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'quotes',
      key: 'id',
    },
    
  },
  
  // Contact Info (for verification)
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    
  },
  
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    
  },
  
  // Lifecycle
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    
  },
  
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  // Configuration
  isSingleUse: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    
  },
  
  allowMultiJobAccess: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    
  },
  
  expiryDurationDays: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    
  },
  
  portalExpiryNotificationSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  // Tracking
  accessCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    
  },
  
  lastAccessedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    
  },
  
  lastAccessIp: {
    type: DataTypes.STRING(45),
    allowNull: true,
    
  },
  
  lastAccessUserAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    
  },
  
  // Metadata
  purpose: {
    type: DataTypes.ENUM(
      'quote_view',
      'quote_approval',
      'payment',
      'portal_access',
      'job_status'
    ),
    defaultValue: 'portal_access',
    
  },
  
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    
  },
  
}, {
  tableName: 'magic_links',
  timestamps: true,
  indexes: [
    { fields: ['token'], unique: true },
    { fields: ['tenantId'] },
    { fields: ['clientId'] },
    { fields: ['quoteId'] },
    { fields: ['email'] },
    { fields: ['expiresAt'] },
    { fields: ['createdAt'] },
  ],
});

// Instance Methods

/**
 * Check if link is valid and can be used
 */
MagicLink.prototype.isValid = function() {
  const now = new Date();
  
  // Check expiration
  if (this.expiresAt < now) {
    return { valid: false, reason: 'expired' };
  }
  
  // Check if revoked
  if (this.revokedAt) {
    return { valid: false, reason: 'revoked' };
  }
  
  // Check if single-use and already used
  if (this.isSingleUse && this.usedAt) {
    return { valid: false, reason: 'already_used' };
  }
  
  return { valid: true };
};

/**
 * Get remaining days until expiration
 */
MagicLink.prototype.getRemainingDays = function() {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((this.expiresAt - now) / msPerDay);
  return Math.max(0, daysRemaining);
};

/**
 * Check if link is expiring soon (within 2 days)
 */
MagicLink.prototype.isExpiringsoon = function() {
  return this.getRemainingDays() <= 2 && this.getRemainingDays() > 0;
};

/**
 * Get formatted expiry time
 */
MagicLink.prototype.getExpiryTimeFormatted = function() {
  const daysRemaining = this.getRemainingDays();
  
  if (daysRemaining === 0) {
    return 'Expired';
  } else if (daysRemaining === 1) {
    return '1 day remaining';
  } else if (daysRemaining <= 7) {
    return `${daysRemaining} days remaining`;
  } else {
    return this.expiresAt.toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      });
  }
};

/**
 * Mark link as used
 */
MagicLink.prototype.markAsUsed = async function(ipAddress, userAgent) {
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  this.lastAccessIp = ipAddress;
  this.lastAccessUserAgent = userAgent;
  
  if (this.isSingleUse && !this.usedAt) {
    this.usedAt = new Date();
  }
  
  await this.save();
};

/**
 * Revoke this link
 */
MagicLink.prototype.revoke = async function() {
  this.revokedAt = new Date();
  await this.save();
};

/**
 * Define associations
 */
MagicLink.associate = (models) => {
  MagicLink.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  MagicLink.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  MagicLink.belongsTo(models.Quote, { foreignKey: 'quoteId', as: 'quote' });
};

module.exports = MagicLink;
