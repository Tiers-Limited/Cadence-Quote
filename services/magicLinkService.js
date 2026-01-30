const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const MagicLink = require('../models/MagicLink');
const CustomerSession = require('../models/CustomerSession');
const OTPVerification = require('../models/OTPVerification');
const Client = require('../models/Client');
const Quote = require('../models/Quote');
const { Op } = require('sequelize');

/**
 * Magic Link Service
 * Handles secure, passwordless authentication for customer portal
 * 
 * Features:
 * - Cryptographically secure token generation
 * - Time-limited access (default 24 hours)
 * - Rate limiting per client
 * - Token revocation
 * - Session management
 * - OTP verification for multi-job access
 */
class MagicLinkService {
  
  /**
   * Generate a cryptographically secure random token
   * @returns {string} 128-character hex string
   */
  static generateToken() {
    return crypto.randomBytes(64).toString('hex');
  }
  
  /**
   * Generate a 6-digit OTP code
   * @returns {string} 6-digit numeric code
   */
  static generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }
  
  /**
   * Create a magic link for customer portal access
   * 
   * @param {Object} options
   * @param {number} options.tenantId - Contractor ID
   * @param {number} options.clientId - Customer/Client ID
   * @param {number} options.quoteId - Optional: Specific quote
   * @param {string} options.email - Customer email
   * @param {string} options.phone - Optional: Customer phone
   * @param {string} options.purpose - Link purpose (quote_view, payment, etc.)
   * @param {number} options.expiryHours - Hours until expiration (fallback if no expiryDays)
   * @param {number} options.expiryDays - Days until expiration (preferred, from ContractorSettings)
   * @param {boolean} options.isSingleUse - Single-use link (default false)
   * @param {boolean} options.allowMultiJobAccess - Allow multi-job after OTP (default true)
   * @returns {Promise<Object>} { link, token, magicLink }
   */
  static async createMagicLink({
    tenantId,
    clientId,
    quoteId = null,
    email,
    phone = null,
    purpose = 'portal_access',
    expiryHours = null,
    expiryDays = null,
    isSingleUse = false,
    allowMultiJobAccess = true,
    metadata = {}
  }) {
    
    // Fetch contractor settings if expiry not explicitly provided
    if (!expiryDays && !expiryHours) {
      try {
        const ContractorSettings = require('../models/ContractorSettings');
        const settings = await ContractorSettings.findOne({
          where: { tenantId }
        });
        expiryDays = settings?.portalLinkExpiryDays || 7; // Default 7 days
      } catch (error) {
        console.warn('Failed to fetch portal settings, using default expiry:', error.message);
        expiryDays = 7;
      }
    }
    
    // Verify client exists
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new Error('Client not found');
    }
    
    // Reuse existing active portal_access link for this client+tenant to avoid link sprawl.
    // This keeps a single long-lived link per contractor/customer, as required.
    const now = new Date();
    const existingActive = await MagicLink.findOne({
      where: {
        clientId,
        tenantId,
        purpose,
        expiresAt: { [Op.gt]: now },
        revokedAt: null,
        // only reuse non-single-use links
        isSingleUse: false,
      },
      order: [['createdAt', 'DESC']],
    });
    
    // Calculate expiration (prefer expiryDays, fallback to expiryHours, default 7 days)
    const expiresAt = new Date();
    const daysToAdd = expiryDays || (expiryHours ? Math.ceil(expiryHours / 24) : 7);
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    // If we have an existing active link, refresh/extend it and (optionally) point it at latest quote.
    if (existingActive) {
      // Refresh expiry to keep link alive (but do not exceed max configured expiry if present)
      let maxExpiryDays = null;
      try {
        const ContractorSettings = require('../models/ContractorSettings');
        const settings = await ContractorSettings.findOne({ where: { tenantId } });
        maxExpiryDays = settings?.portalLinkMaxExpiryDays || 30;
      } catch (e) {
        maxExpiryDays = 30;
      }

      const maxExpiresAt = new Date();
      maxExpiresAt.setDate(maxExpiresAt.getDate() + (maxExpiryDays || 30));
      const refreshedExpiresAt = expiresAt > maxExpiresAt ? maxExpiresAt : expiresAt;

      await existingActive.update({
        // keep token stable
        quoteId: quoteId || existingActive.quoteId,
        email: email || existingActive.email,
        phone: phone || existingActive.phone,
        expiresAt: refreshedExpiresAt,
        allowMultiJobAccess: typeof allowMultiJobAccess === 'boolean' ? allowMultiJobAccess : existingActive.allowMultiJobAccess,
        metadata: { ...(existingActive.metadata || {}), ...(metadata || {}) },
      });

      const baseUrl = process.env.CUSTOMER_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const link = `${baseUrl}/portal/access/${existingActive.token}`;

      return {
        link,
        token: existingActive.token,
        magicLink: existingActive,
        expiresAt: existingActive.expiresAt,
        reused: true,
      };
    }

    // No active link to reuse -> generate a new token
    const token = this.generateToken();

    // Create magic link record
    const magicLink = await MagicLink.create({
      token,
      tenantId,
      clientId,
      quoteId,
      email,
      phone,
      expiresAt,
      isSingleUse,
      allowMultiJobAccess,
      purpose,
      metadata,
    });
    
    // Generate URL
    const baseUrl = process.env.CUSTOMER_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${baseUrl}/portal/access/${token}`;
    
    return {
      link,
      token,
      magicLink,
      expiresAt,
    };
  }
  
  /**
   * Validate and consume a magic link token
   * 
   * @param {string} token - Magic link token
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   * @returns {Promise<Object>} { valid, magicLink, session }
   */
  static async validateMagicLink(token, ipAddress, userAgent) {
    
    // Find magic link
    const magicLink = await MagicLink.findOne({
      where: { token },
      include: [
        { model: Client, as: 'client' },
        { model: Quote, as: 'quote' },
      ]
    });
    
    if (!magicLink) {
      return { 
        valid: false, 
        reason: 'invalid_token',
        message: 'This link is invalid or has expired.' 
      };
    }
    
    // Check validity
    const validation = magicLink.isValid();
    if (!validation.valid) {
      const messages = {
        expired: 'This link has expired. Please request a new one.',
        revoked: 'This link has been revoked.',
        already_used: 'This link has already been used.',
      };
      
      return {
        valid: false,
        reason: validation.reason,
        message: messages[validation.reason] || 'This link is no longer valid.',
      };
    }
    
    // Mark as used
    await magicLink.markAsUsed(ipAddress, userAgent);
    
    // Create or get existing session
    const session = await this.createOrGetSession({
      magicLink,
      ipAddress,
      userAgent,
    });
    
    return {
      valid: true,
      magicLink,
      session,
      client: magicLink.client,
      quote: magicLink.quote,
    };
  }
  
  /**
   * Create or retrieve existing session for magic link
   * 
   * @param {Object} options
   * @param {MagicLink} options.magicLink - Validated magic link
   * @param {string} options.ipAddress - Client IP
   * @param {string} options.userAgent - Client user agent
   * @returns {Promise<CustomerSession>}
   */
  static async createOrGetSession({ magicLink, ipAddress, userAgent }) {
    
    // Check for existing valid session
    const existingSession = await CustomerSession.findOne({
      where: {
        clientId: magicLink.clientId,
        tenantId: magicLink.tenantId,
        expiresAt: { [Op.gt]: new Date() },
        revokedAt: null,
      },
      order: [['createdAt', 'DESC']],
    });
    
    if (existingSession) {
      // Update activity
      await existingSession.trackActivity(ipAddress, userAgent);
      
      // SECURITY: if the session is not verified yet, do NOT accumulate quoteIds.
      // Unverified customers must only see the single project the magic link was for.
      if (!existingSession.isVerified) {
        if (magicLink.quoteId && (!Array.isArray(existingSession.quoteIds) || existingSession.quoteIds.length === 0)) {
          existingSession.quoteIds = [magicLink.quoteId];
          await existingSession.save();
        } else if (magicLink.quoteId && Array.isArray(existingSession.quoteIds) && !existingSession.quoteIds.includes(magicLink.quoteId)) {
          // If the magic link is for a different quote, replace it (unverified should only see one)
          existingSession.quoteIds = [magicLink.quoteId];
          await existingSession.save();
        }
        return existingSession;
      }

      // Verified sessions can aggregate access to multiple quotes
      if (magicLink.quoteId && !existingSession.quoteIds.includes(magicLink.quoteId)) {
        existingSession.quoteIds = [...existingSession.quoteIds, magicLink.quoteId];
        await existingSession.save();
      }
      
      return existingSession;
    }
    
    // Create new session
    const sessionToken = this.generateSessionToken({
      clientId: magicLink.clientId,
      tenantId: magicLink.tenantId,
    });
    
    // Session expires at the same time as the magic link (from contractor settings)
    const expiresAt = new Date(magicLink.expiresAt);
    
    const quoteIds = magicLink.quoteId ? [magicLink.quoteId] : [];
    
    const session = await CustomerSession.create({
      sessionToken,
      tenantId: magicLink.tenantId,
      clientId: magicLink.clientId,
      isVerified: false,
      quoteIds,
      expiresAt,
      originMagicLinkId: magicLink.id,
      lastActivityIp: ipAddress,
      lastActivityUserAgent: userAgent,
      lastActivityAt: new Date(),
      activityCount: 1,
    });
    
    return session;
  }
  
  /**
   * Generate a JWT session token
   * 
   * @param {Object} payload
   * @param {number} payload.clientId
   * @param {number} payload.tenantId
   * @returns {string} JWT token
   */
  static generateSessionToken({ clientId, tenantId }) {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    
    return jwt.sign(
      {
        type: 'customer_session',
        clientId,
        tenantId,
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: '90d' }
    );
  }
  
  /**
   * Validate a session token
   * 
   * @param {string} sessionToken - JWT session token
   * @param {string} ipAddress - Client IP
   * @param {string} userAgent - Client user agent
   * @returns {Promise<Object>} { valid, session, client }
   */
  static async validateSession(sessionToken, ipAddress, userAgent) {
    
    // Find session
    const session = await CustomerSession.findOne({
      where: { sessionToken },
      include: [
        { model: Client, as: 'client' },
      ]
    });
    
    if (!session) {
      return {
        valid: false,
        reason: 'invalid_session',
        message: 'Invalid session. Please access your portal link again.',
      };
    }
    
    // Check validity
    const validation = session.isValid();
    if (!validation.valid) {
      return {
        valid: false,
        reason: validation.reason,
        message: validation.reason === 'expired' 
          ? 'Your session has expired. Please access your portal link again.'
          : 'Your session is no longer valid.',
      };
    }
    
    // Track activity
    await session.trackActivity(ipAddress, userAgent);
    
    return {
      valid: true,
      session,
      client: session.client,
    };
  }
  
  /**
   * Create OTP verification for multi-job access
   * 
   * @param {Object} options
   * @param {number} options.clientId
   * @param {number} options.tenantId
   * @param {number} options.sessionId
   * @param {string} options.method - 'email' or 'sms'
   * @param {string} options.target - Email or phone number
   * @returns {Promise<OTPVerification>}
   */
  static async createOTPVerification({ clientId, tenantId, sessionId, method, target }) {
    
    // Rate limiting: Check recent OTP requests
    const recentOTPs = await OTPVerification.count({
      where: {
        clientId,
        tenantId,
        createdAt: { [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      }
    });
    
    if (recentOTPs >= 3) {
      throw new Error('Too many OTP requests. Please wait 5 minutes and try again.');
    }
    
    // Generate OTP
    const code = this.generateOTP();
    
    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Create OTP record
    const otp = await OTPVerification.create({
      code,
      tenantId,
      clientId,
      deliveryMethod: method,
      deliveryTarget: target,
      expiresAt,
      customerSessionId: sessionId,
    });
    
    return otp;
  }
  
  /**
   * Verify OTP and upgrade session to multi-job access
   * 
   * @param {Object} options
   * @param {string} options.code - 6-digit OTP code
   * @param {number} options.sessionId - Customer session ID
   * @param {string} options.ipAddress - Client IP
   * @returns {Promise<Object>} { success, session }
   */
  static async verifyOTP({ code, sessionId, ipAddress }) {
    
    // Find OTP
    const otp = await OTPVerification.findOne({
      where: {
        code,
        customerSessionId: sessionId,
        verifiedAt: null,
      },
      order: [['createdAt', 'DESC']],
    });
    
    if (!otp) {
      return {
        success: false,
        reason: 'invalid_code',
        message: 'Invalid verification code.',
      };
    }
    
    // Verify OTP
    const result = await otp.verify(code, ipAddress);
    
    if (!result.success) {
      const messages = {
        expired: 'Verification code has expired. Please request a new one.',
        locked: 'Too many failed attempts. Please request a new code.',
        already_used: 'This code has already been used.',
        invalid_code: result.attemptsRemaining 
          ? `Invalid code. ${result.attemptsRemaining} attempts remaining.`
          : 'Invalid verification code.',
      };
      
      return {
        success: false,
        reason: result.reason,
        message: messages[result.reason] || 'Verification failed.',
        attemptsRemaining: result.attemptsRemaining,
      };
    }
    
    // Get session and upgrade it
    const session = await CustomerSession.findByPk(sessionId);
    if (!session) {
      return {
        success: false,
        reason: 'session_not_found',
        message: 'Session not found.',
      };
    }
    
    // Get all quotes for this client and tenant
    const quotes = await Quote.findAll({
      where: {
        tenantId: otp.tenantId,
        clientId: otp.clientId,
      },
      attributes: ['id'],
    });
    
    const quoteIds = quotes.map(q => q.id);
    
    // Upgrade session
    await session.markAsVerified(otp.deliveryMethod, quoteIds);
    
    return {
      success: true,
      session,
      quoteIds,
    };
  }
  
  /**
   * Revoke a magic link
   * 
   * @param {number} magicLinkId - Magic link ID
   * @returns {Promise<boolean>}
   */
  static async revokeMagicLink(magicLinkId) {
    const magicLink = await MagicLink.findByPk(magicLinkId);
    if (!magicLink) {
      return false;
    }
    
    await magicLink.revoke();
    return true;
  }
  
  /**
   * Revoke a customer session
   * 
   * @param {number} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  static async revokeSession(sessionId) {
    const session = await CustomerSession.findByPk(sessionId);
    if (!session) {
      return false;
    }
    
    await session.revoke();
    return true;
  }
  
  /**
   * Revoke all sessions for a client
   * 
   * @param {number} clientId
   * @param {number} tenantId
   * @returns {Promise<number>} Number of sessions revoked
   */
  static async revokeAllClientSessions(clientId, tenantId) {
    const sessions = await CustomerSession.findAll({
      where: {
        clientId,
        tenantId,
        revokedAt: null,
      }
    });
    
    for (const session of sessions) {
      await session.revoke();
    }
    
    return sessions.length;
  }
  
  /**
   * Clean up expired tokens and sessions
   * Should be run periodically (e.g., daily cron job)
   * 
   * @param {number} tenantId - Optional: Cleanup for specific tenant
   * @returns {Promise<Object>} Cleanup statistics
   */
  static async cleanupExpired(tenantId = null) {
    const now = new Date();
    
    // Get contractor settings for cleanup configuration
    let cleanupDays = 30; // Default
    if (tenantId) {
      try {
        const ContractorSettings = require('../models/ContractorSettings');
        const settings = await ContractorSettings.findOne({
          where: { tenantId }
        });
        if (settings?.portalAutoCleanup) {
          cleanupDays = settings.portalAutoCleanupDays || 30;
        }
      } catch (error) {
        console.warn('Failed to fetch cleanup settings, using defaults:', error.message);
      }
    }
    
    // Delete expired magic links
    const expiredLinksDate = new Date();
    expiredLinksDate.setDate(expiredLinksDate.getDate() - cleanupDays);
    
    const linkQuery = {
      expiresAt: { [Op.lt]: expiredLinksDate }
    };
    if (tenantId) linkQuery.tenantId = tenantId;
    
    const deletedLinks = await MagicLink.destroy({
      where: linkQuery
    });
    
    // Delete expired sessions
    const expiredSessionsDate = new Date();
    expiredSessionsDate.setDate(expiredSessionsDate.getDate() - cleanupDays);
    
    const sessionQuery = {
      expiresAt: { [Op.lt]: expiredSessionsDate }
    };
    if (tenantId) sessionQuery.tenantId = tenantId;
    
    const deletedSessions = await CustomerSession.destroy({
      where: sessionQuery
    });
    
    // Delete old OTP records (older than 24 hours)
    const expiredOTPDate = new Date();
    expiredOTPDate.setHours(expiredOTPDate.getHours() - 24);
    
    const deletedOTPs = await OTPVerification.destroy({
      where: {
        createdAt: { [Op.lt]: expiredOTPDate }
      }
    });
    
    return {
      deletedLinks,
      deletedSessions,
      deletedOTPs,
      timestamp: now,
    };
  }
  
  /**
   * Get active sessions for a client
   * 
   * @param {number} clientId
   * @param {number} tenantId
   * @returns {Promise<Array>} Active sessions
   */
  static async getActiveSessions(clientId, tenantId) {
    return await CustomerSession.findAll({
      where: {
        clientId,
        tenantId,
        expiresAt: { [Op.gt]: new Date() },
        revokedAt: null,
      },
      order: [['lastActivityAt', 'DESC']],
    });
  }
  
  /**
   * Get magic link statistics for a tenant
   * 
   * @param {number} tenantId
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(tenantId) {
    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const [
      totalLinks,
      activeLinks,
      usedLinks,
      activeSessions,
      verifiedSessions,
    ] = await Promise.all([
      MagicLink.count({ where: { tenantId } }),
      MagicLink.count({ 
        where: { 
          tenantId, 
          expiresAt: { [Op.gt]: now },
          revokedAt: null,
        } 
      }),
      MagicLink.count({ 
        where: { 
          tenantId,
          usedAt: { [Op.not]: null },
        } 
      }),
      CustomerSession.count({ 
        where: { 
          tenantId,
          expiresAt: { [Op.gt]: now },
          revokedAt: null,
        } 
      }),
      CustomerSession.count({ 
        where: { 
          tenantId,
          isVerified: true,
          expiresAt: { [Op.gt]: now },
        } 
      }),
    ]);
    
    return {
      totalLinks,
      activeLinks,
      usedLinks,
      activeSessions,
      verifiedSessions,
      last30Days: {
        links: await MagicLink.count({ 
          where: { 
            tenantId,
            createdAt: { [Op.gt]: last30Days }
          } 
        }),
        sessions: await CustomerSession.count({ 
          where: { 
            tenantId,
            createdAt: { [Op.gt]: last30Days }
          } 
        }),
      }
    };
  }

  /**
   * Get portal expiry settings for a tenant/contractor
   * @param {number} tenantId - Contractor ID
   * @returns {Promise<Object>} Portal settings with default expiry days
   */
  static async getPortalSettings(tenantId) {
    // Get default expiry settings from tenant config or use defaults
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findByPk(tenantId);
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      defaultExpiryDays: tenant.portalLinkExpiryDays || 7,
      maxExpiryDays: tenant.portalLinkMaxExpiryDays || 90,
      autoCleanupEnabled: tenant.portalAutoCleanup !== false,
      autoCleanupDays: tenant.portalAutoCleanupDays || 30,
      requireOTPForMultiJob: tenant.portalRequireOTPForMultiJob !== false,
      portalBrandingConfig: tenant.portalBrandingConfig || {},
    };
  }

  /**
   * Update portal settings for a contractor
   * @param {number} tenantId - Contractor ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  static async updatePortalSettings(tenantId, {
    defaultExpiryDays,
    maxExpiryDays,
    autoCleanupEnabled,
    autoCleanupDays,
    requireOTPForMultiJob,
    portalBrandingConfig,
  }) {
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findByPk(tenantId);
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Validate settings
    if (defaultExpiryDays && (defaultExpiryDays < 1 || defaultExpiryDays > 365)) {
      throw new Error('Default expiry days must be between 1 and 365');
    }

    if (maxExpiryDays && (maxExpiryDays < defaultExpiryDays || maxExpiryDays > 365)) {
      throw new Error('Max expiry days must be >= default expiry and <= 365');
    }

    // Update tenant settings
    if (defaultExpiryDays) tenant.portalLinkExpiryDays = defaultExpiryDays;
    if (maxExpiryDays) tenant.portalLinkMaxExpiryDays = maxExpiryDays;
    if (typeof autoCleanupEnabled === 'boolean') tenant.portalAutoCleanup = autoCleanupEnabled;
    if (autoCleanupDays) tenant.portalAutoCleanupDays = autoCleanupDays;
    if (typeof requireOTPForMultiJob === 'boolean') tenant.portalRequireOTPForMultiJob = requireOTPForMultiJob;
    if (portalBrandingConfig) tenant.portalBrandingConfig = portalBrandingConfig;

    await tenant.save();

    return {
      defaultExpiryDays: tenant.portalLinkExpiryDays,
      maxExpiryDays: tenant.portalLinkMaxExpiryDays,
      autoCleanupEnabled: tenant.portalAutoCleanup,
      autoCleanupDays: tenant.portalAutoCleanupDays,
      requireOTPForMultiJob: tenant.portalRequireOTPForMultiJob,
      portalBrandingConfig: tenant.portalBrandingConfig,
    };
  }

  /**
   * Get all active magic links for a contractor with details
   * @param {number} tenantId - Contractor ID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Active magic links
   */
  static async getActiveMagicLinks(tenantId, {
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = {}) {
    const links = await MagicLink.findAndCountAll({
      where: {
        tenantId,
        expiresAt: { [Op.gt]: new Date() },
        revokedAt: null,
      },
      include: [
        { model: Client, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { model: Quote, attributes: ['id', 'quoteNumber', 'totalPrice'] }
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    });

    return {
      total: links.count,
      links: links.rows.map(link => ({
        id: link.id,
        token: link.token.substring(0, 10) + '...', // Masked for security
        client: link.Client,
        quote: link.Quote,
        email: link.email,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        remainingDays: link.getRemainingDays(),
        isExpiringsoon: link.isExpiringsoon(),
        accessCount: link.accessCount,
        purpose: link.purpose,
      })),
    };
  }

  /**
   * Get all active sessions for a contractor
   * @param {number} tenantId - Contractor ID
   * @returns {Promise<Object>} Active sessions with details
   */
  static async getActiveSessions(tenantId, {
    limit = 50,
    offset = 0,
  } = {}) {
    const sessions = await CustomerSession.findAndCountAll({
      where: {
        tenantId,
        revokedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [
        { model: Client, attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['lastActivityAt', 'DESC']],
      limit,
      offset,
    });

    return {
      total: sessions.count,
      sessions: sessions.rows.map(session => ({
        id: session.id,
        client: session.Client,
        sessionToken: session.sessionToken.substring(0, 10) + '...', // Masked
        isVerified: session.isVerified,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        lastIp: session.lastIp,
        accessedQuotes: session.accessedQuoteIds ? session.accessedQuoteIds.length : 0,
      })),
    };
  }

  /**
   * Revoke all sessions for a client (emergency access control)
   * @param {number} tenantId - Contractor ID
   * @param {number} clientId - Customer ID
   * @returns {Promise<Object>} Revocation result
   */
  static async revokeAllClientSessionsAdmin(tenantId, clientId) {
    const sessions = await CustomerSession.findAll({
      where: { tenantId, clientId }
    });

    const count = sessions.length;
    for (const session of sessions) {
      await session.revoke();
    }

    // Also revoke all magic links for this client
    const links = await MagicLink.findAll({
      where: { tenantId, clientId }
    });

    for (const link of links) {
      await link.revoke();
    }

    return {
      sessionsRevoked: count,
      linksRevoked: links.length,
      clientId,
    };
  }

  /**
   * Resend magic link to customer (contractor admin action)
   * @param {number} tenantId - Contractor ID
   * @param {number} magicLinkId - Magic link ID
   * @returns {Promise<Object>} New magic link details
   */
  static async resendMagicLinkAdmin(tenantId, magicLinkId) {
    const link = await MagicLink.findOne({
      where: { id: magicLinkId, tenantId }
    });

    if (!link) {
      throw new Error('Magic link not found');
    }

    // Revoke old link
    await link.revoke();

    // Create new link with same expiry configuration
    const portalSettings = await this.getPortalSettings(tenantId);
    const newLink = await this.createMagicLink({
      tenantId: link.tenantId,
      clientId: link.clientId,
      quoteId: link.quoteId,
      email: link.email,
      phone: link.phone,
      purpose: link.purpose,
      expiryDays: portalSettings.defaultExpiryDays,
      allowMultiJobAccess: link.allowMultiJobAccess,
    });

    return newLink;
  }

  /**
   * Get expiry analytics for a contractor
   * @param {number} tenantId - Contractor ID
   * @returns {Promise<Object>} Expiry statistics
   */
  static async getExpiryAnalytics(tenantId) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const expiredToday = await MagicLink.count({
      where: {
        tenantId,
        expiresAt: { [Op.lte]: now },
        revokedAt: null,
      }
    });

    const expiringTomorrow = await MagicLink.count({
      where: {
        tenantId,
        expiresAt: { [Op.between]: [now, tomorrow] },
        revokedAt: null,
      }
    });

    const expiringIn3Days = await MagicLink.count({
      where: {
        tenantId,
        expiresAt: { [Op.between]: [tomorrow, in3Days] },
        revokedAt: null,
      }
    });

    const expiringIn7Days = await MagicLink.count({
      where: {
        tenantId,
        expiresAt: { [Op.between]: [in3Days, in7Days] },
        revokedAt: null,
      }
    });

    return {
      expiredToday,
      expiringTomorrow,
      expiringIn3Days,
      expiringIn7Days,
      totalExpiring: expiringTomorrow + expiringIn3Days + expiringIn7Days,
    };
  }

  /**
   * Cleanup expired magic links and sessions (scheduled job)
   * @param {number} tenantId - Optional: clean specific tenant, or null for all
   * @returns {Promise<Object>} Cleanup results
   */
  static async cleanupExpiredPortalData(tenantId = null) {
    const now = new Date();
    let where = { expiresAt: { [Op.lt]: now } };
    let sessionWhere = { expiresAt: { [Op.lt]: now } };

    if (tenantId) {
      where.tenantId = tenantId;
      sessionWhere.tenantId = tenantId;
    }

    // Get cleanup settings
    const Tenant = require('../models/Tenant');
    const tenants = tenantId ? 
      [await Tenant.findByPk(tenantId)] : 
      await Tenant.findAll();

    let totalLinksDeleted = 0;
    let totalSessionsDeleted = 0;

    for (const tenant of tenants) {
      if (!tenant) continue;

      const cleanupDays = tenant.portalAutoCleanupDays || 30;
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - cleanupDays);

      // Delete expired links older than cleanup period
      const deletedLinks = await MagicLink.destroy({
        where: {
          tenantId: tenant.id,
          expiresAt: { [Op.lt]: cleanupDate },
        }
      });

      // Delete expired sessions older than cleanup period
      const deletedSessions = await CustomerSession.destroy({
        where: {
          tenantId: tenant.id,
          expiresAt: { [Op.lt]: cleanupDate },
        }
      });

      totalLinksDeleted += deletedLinks;
      totalSessionsDeleted += deletedSessions;
    }

    return {
      linksDeleted: totalLinksDeleted,
      sessionsDeleted: totalSessionsDeleted,
      cleanupDate: now,
    };
  }
}


module.exports = MagicLinkService;
