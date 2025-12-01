const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findOne({
      where: {
        id: decoded.userId,
        isActive: true
      },
      include: [{
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'companyName', 'subscriptionPlan']
      }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Validate tenant match (if tenant was resolved from subdomain)
    if (req.tenant && user.tenantId !== req.tenant.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: User does not belong to this tenant'
      });
    }

    // Attach user to request (exclude password)
    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Middleware to check if user has required role(s)
 * Usage: authorize(['business_admin', 'contractor_admin'])
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Convert single role to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Generate JWT token for user
 */
const generateToken = (userId, tenantId, expiresIn = '7d') => {
  return jwt.sign(
    { 
      userId, 
      tenantId,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Generate refresh token for user
 */
const generateRefreshToken = (userId, tenantId, expiresIn = '30d') => {
  return jwt.sign(
    { 
      userId, 
      tenantId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Verify refresh token and generate new access token
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Verify user still exists and is active
    const user = await User.findOne({
      where: {
        id: decoded.userId,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(decoded.userId, decoded.tenantId);

    res.json({
      success: true,
      data: {
        token: newAccessToken
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please login again.'
      });
    }
    
    console.error('Refresh token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
};

module.exports = {
  auth,
  authorize,
  generateToken,
  generateRefreshToken,
  refreshAccessToken
};
