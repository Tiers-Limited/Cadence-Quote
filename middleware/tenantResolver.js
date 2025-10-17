// middleware/tenantResolver.js
const Tenant = require('../models/Tenant');

/**
 * Middleware to resolve tenant from subdomain
 * Extracts subdomain from request host and attaches tenant to req.tenant
 * 
 * Example: acme.cadence.com -> subdomain: "acme"
 */
const resolveTenant = async (req, res, next) => {
  try {
    // Skip tenant resolution for public routes
    const publicRoutes = ['/api/auth/register', '/api/auth/login', '/health'];
    if (publicRoutes.includes(req.path)) {
      return next();
    }

    // Extract subdomain from host
    const host = req.get('host') || '';
    const subdomain = extractSubdomain(host);

    if (!subdomain) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subdomain. Please access via your tenant subdomain (e.g., yourcompany.cadence.com)'
      });
    }

    // Find tenant by subdomain
    const tenant = await Tenant.findOne({
      where: { 
        subdomain,
        isActive: true
      }
    });

    if (!tenant) {
      return res.status(404).json({
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
  
  if (requestTenantId && parseInt(requestTenantId) !== req.tenant.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Tenant mismatch'
    });
  }

  next();
};

module.exports = {
  resolveTenant,
  validateTenantOwnership,
  extractSubdomain
};
