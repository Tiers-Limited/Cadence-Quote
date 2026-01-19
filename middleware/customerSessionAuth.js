const MagicLinkService = require('../services/magicLinkService');

/**
 * Customer Session Authentication Middleware
 * Validates customer portal sessions (magic link-based authentication)
 * 
 * Usage:
 *   router.get('/protected-route', customerSessionAuth, controller.method);
 * 
 * Expects:
 *   Authorization: Bearer <sessionToken>
 * 
 * Adds to req:
 *   req.customerSession - Session object
 *   req.customer - Client object
 *   req.customerTenantId - Tenant ID (contractor)
 */
async function customerSessionAuth(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Customer session auth - Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No session token provided. Please access your portal link again.',
        code: 'NO_TOKEN',
      });
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    console.log('🔐 Session token (first 50 chars):', sessionToken.substring(0, 50));
    console.log('🔐 Validating session...');
    
    // Validate session
    const result = await MagicLinkService.validateSession(sessionToken, ipAddress, userAgent);
    
    console.log('🔐 Validation result:', result.valid ? '✅ Valid' : `❌ Invalid - ${result.reason}`);
    
    if (!result.valid) {
      const statusCode = result.reason === 'expired' ? 401 : 403;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        code: result.reason.toUpperCase(),
      });
    }
    
    // Debug: Log what we got from validation
    console.log('🔐 Session data:', {
      sessionId: result.session?.id,
      clientId: result.session?.clientId,
      tenantId: result.session?.tenantId,
      hasClient: !!result.client,
      clientId2: result.client?.id
    });
    
    // Attach session and customer info to request
    req.customerSession = result.session;
    req.customer = result.client;
    req.customerTenantId = result.session.tenantId;
    req.isVerifiedCustomer = result.session.isVerified;
    
    next();
    
  } catch (error) {
    console.error('Customer session auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Optional: Require verified session (multi-job access)
 * Use this middleware after customerSessionAuth for routes that require
 * the customer to have completed OTP verification
 * 
 * Usage:
 *   router.get('/all-quotes', customerSessionAuth, requireVerifiedSession, controller.method);
 */
async function requireVerifiedSession(req, res, next) {
  if (!req.customerSession) {
    return res.status(401).json({
      success: false,
      message: 'No active session',
    });
  }
  
  if (!req.customerSession.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'This action requires verification. Please complete OTP verification to access all your projects.',
      code: 'VERIFICATION_REQUIRED',
    });
  }
  
  next();
}

/**
 * Optional: Rate limiting middleware for sensitive customer portal actions
 * Prevents abuse of payment, approval, and other critical endpoints
 */
const rateLimit = require('express-rate-limit');

const customerPortalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 requests per window per IP
  message: {
    success: false,
    message: 'Too many requests. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const criticalActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 critical actions per window
  message: {
    success: false,
    message: 'Too many attempts. Please wait 5 minutes before trying again.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only count requests that fail (e.g., wrong OTP)
  skipSuccessfulRequests: true,
});

module.exports = {
  customerSessionAuth,
  requireVerifiedSession,
  customerPortalRateLimiter,
  criticalActionLimiter,
};
