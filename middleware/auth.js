const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client');
const Tenant = require('../models/Tenant');

// Minimal memory cache for auth fallback lookups (10s TTL)
const authCache = new Map();

const auth = async (req, res, next) => {
    const start = Date.now();
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ success: false, message: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Client token path
        if (decoded.clientId) {
            const dbStart = Date.now();
            const client = await Client.findOne({
                where: { id: decoded.clientId, isActive: true, hasPortalAccess: true },
                include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'companyName'] }]
            });
            const dbDuration = Date.now() - dbStart;

            if (!client) {
                return res.status(401).json({ success: false, message: 'Client not found or access revoked' });
            }

            req.user = {
                id: client.id,
                fullName: client.name,
                email: client.email,
                role: 'customer',
                tenantId: client.tenantId,
                tenant: client.tenant,
                isClient: true
            };

            console.log(`[Auth] Client Path (${client.id}) took ${Date.now() - start}ms (DB: ${dbDuration}ms)`);
            return next();
        }

        // Fast path for enriched tokens
        if (decoded.role && decoded.tenant && decoded.fullName) {
            req.user = {
                id: decoded.userId,
                fullName: decoded.fullName,
                email: decoded.email,
                role: decoded.role,
                tenantId: decoded.tenantId,
                tenant: decoded.tenant,
                isClient: false
            };

            // tenantId validation if subdomains are used
            if (req.tenant && req.user.tenantId !== req.tenant.id) {
                return res.status(403).json({ success: false, message: 'Access denied: Tenant mismatch' });
            }

            // Optional: minimal log for fast path
            // console.log(`[Auth] Fast Path (${decoded.userId}) took ${Date.now() - start}ms`);
            return next();
        }

        // DEBUG: Why is Fast Path skipped?
        if (process.env.NODE_ENV === 'development') {
            const missing = [];
            if (!decoded.role) missing.push('role');
            if (!decoded.tenant) missing.push('tenant');
            if (!decoded.fullName) missing.push('fullName');
            if (missing.length > 0) {
                console.log(`[Auth Debug] Fast Path Skipped for user ${decoded.userId}. Missing: ${missing.join(', ')}`);
            }
        }

        // Fallback to database with short-term caching
        const dbStart = Date.now();
        const cacheKey = `user_${decoded.userId}`;
        const cached = authCache.get(cacheKey);

        let user;
        if (cached && cached.expiry > Date.now()) {
            user = cached.user;
        } else {
            user = await User.findOne({
                where: { id: decoded.userId, isActive: true },
                attributes: ['id', 'fullName', 'email', 'role', 'tenantId'],
                include: [{
                    model: Tenant,
                    as: 'tenant',
                    attributes: ['id', 'companyName', 'subscriptionPlan', 'isActive'],
                    required: true
                }],
                raw: true,
                nest: true
            });

            if (user) {
                authCache.set(cacheKey, { user, expiry: Date.now() + 10000 });
                // Cleanup old cache entries periodically
                if (authCache.size > 500) authCache.clear();
            }
        }
        const dbDuration = Date.now() - dbStart;

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found or inactive' });
        }

        if (req.tenant && user.tenantId !== req.tenant.id) {
            return res.status(403).json({ success: false, message: 'Access denied: Tenant mismatch' });
        }

        req.user = {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            tenant: user.tenant,
            isClient: false
        };

        console.log(`[Auth] DB Fallback (${user.id}) took ${Date.now() - start}ms (DB: ${dbDuration}ms)`);
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
        if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });

        console.error('[Auth Error]:', error);
        return res.status(500).json({ success: false, message: 'Authentication error' });
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
 * Payload includes role and tenant info to reduce DB lookups in middleware
 */
const generateToken = (user, tenant, expiresIn = '7d') => {
    // Handle both instance and plain object
    const userId = user.id || user;
    const tenantId = tenant?.id || tenant;

    const payload = {
        userId,
        tenantId,
        iat: Math.floor(Date.now() / 1000)
    };

    // If full objects are provided, enrich the payload
    // Handle Sequelize instances or plain objects
    const userObj = user && typeof user.get === 'function' ? user.get({ plain: true }) : user;
    const tenantObj = tenant && typeof tenant.get === 'function' ? tenant.get({ plain: true }) : tenant;

    // Use property access with fallbacks to handle raw query results vs models
    const role = userObj?.role || user?.role;
    const fullName = userObj?.fullName || user?.fullName;
    const email = userObj?.email || user?.email;

    if (role && fullName) {
        payload.role = role;
        payload.fullName = fullName;
        payload.email = email;
    }

    const tenantIdVal = tenantObj?.id || tenant?.id || tenantId;
    const companyName = tenantObj?.companyName || tenant?.companyName;

    if (companyName) {
        payload.tenant = {
            id: tenantIdVal,
            companyName: companyName,
            subscriptionPlan: tenantObj?.subscriptionPlan || tenant?.subscriptionPlan,
            isActive: tenantObj?.isActive ?? tenant?.isActive ?? true
        };
    }

    if (process.env.NODE_ENV === 'development') {
        const enriched = (payload.role && payload.tenant && payload.fullName) ? 'YES' : 'NO';
        console.log(`[Token Gen Debug] UserID: ${userId}, Enriched: ${enriched}`);
        if (enriched === 'NO') {
            console.log(`  - userObj has role: ${!!userObj?.role}, fullName: ${!!userObj?.fullName}`);
            console.log(`  - tenantObj has companyName: ${!!tenantObj?.companyName}`);
            // Explicitly check for Sequelize internal structures if plain failed
            if (!userObj?.role && user?.dataValues) {
                console.log(`  - Found dataValues in user, attempting fallback extraction...`);
                payload.role = user.dataValues.role;
                payload.fullName = user.dataValues.fullName;
                payload.email = user.dataValues.email;
            }
        }
    }

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate refresh token for user
 */
const generateRefreshToken = (user, tenant, expiresIn = '30d') => {
    const userId = user.id || user;
    const tenantId = tenant?.id || tenant;

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

        // Verify user still exists and is active, and fetch tenant for token enrichment
        const user = await User.findOne({
            where: { id: decoded.userId, isActive: true },
            include: [{ model: Tenant, as: 'tenant' }]
        });

        if (!user || !user.tenant) {
            return res.status(401).json({
                success: false,
                message: 'User or Tenant not found or inactive'
            });
        }

        // Generate new access token with FULL enrichment
        const newAccessToken = generateToken(user, user.tenant);

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
