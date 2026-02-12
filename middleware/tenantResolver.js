const Tenant = require('../models/Tenant');

const resolveTenant = async (req, res, next) => {
    try {
        // Skip tenant resolution for public routes
        const publicRoutes = ['/auth/register', '/auth/login', '/public'];
        if (publicRoutes.some(route => req.path.startsWith(route))) {
            return next();
        }

        // Get tenant from authenticated user
        if (!req.user || !req.user.tenantId) {
            return res.status(403).json({
                success: false,
                message: 'No tenant context found'
            });
        }

        // Optimization: Use tenant already fetched by auth middleware
        if (req.user.tenant && req.user.tenant.id === req.user.tenantId) {
            req.tenant = req.user.tenant;
            return next();
        }

        // Fallback if not fetched by auth
        const tenant = await Tenant.findOne({
            where: {
                id: req.user.tenantId,
                isActive: true
            },
            attributes: ['id', 'companyName', 'subdomain', 'isActive'] // Fetch only needed attributes
        });

        if (!tenant) {
            return res.status(403).json({
                success: false,
                message: 'Tenant not found or inactive'
            });
        }

        // Attach tenant to request
        req.tenant = tenant;
        next();
    } catch (error) {
        console.error('Tenant resolution error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error resolving tenant'
        });
    }
};

/**
 * Extract subdomain from host
 * Examples:
 * - acme.cadence.com -> acme
 * - localhost:3000 -> null (for development)
 * - acme.localhost:3000 -> acme (for local testing)
 */
function extractSubdomain(host) {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];

    // For localhost development, allow accessing without subdomain
    if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
        return null;
    }

    // For local testing with subdomain (e.g., acme.localhost)
    if (hostWithoutPort.endsWith('.localhost')) {
        const parts = hostWithoutPort.split('.');
        return parts.length > 2 ? parts[0] : null;
    }

    // Production: extract subdomain from domain
    const parts = hostWithoutPort.split('.');

    // Need at least 3 parts: subdomain.domain.tld
    if (parts.length >= 3) {
        return parts[0];
    }

    return null;
}

/**
 * Optional: Middleware to validate tenant ownership
 * Ensures that tenantId in request matches the resolved tenant
 */
const validateTenantOwnership = (req, res, next) => {
    if (!req.tenant) {
        return res.status(400).json({
            success: false,
            message: 'Tenant context not found'
        });
    }

    // If request body or params contain tenantId, validate it matches
    const requestTenantId = req.body.tenantId || req.params.tenantId || req.query.tenantId;

    if (requestTenantId && req.tenant && Number.parseInt(requestTenantId) !== req.tenant.id) {
        return res.status(403).json({
            success: false,
            message: 'Access denied: Tenant mismatch'
        });
    }

    next();
};

// Export all middleware functions
module.exports = {
    resolveTenant,
    validateTenantOwnership,
    extractSubdomain
};
