const User = require('../models/User');
const Role = require('../models/Role');

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }

            // Check if user's role is in allowed roles
            // roles are already on req.user thanks to auth middleware
            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions',
                });
            }

            next();
        } catch (error) {
            console.error('Role check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization error',
                error: error.message,
            });
        }
    };
};

module.exports = { requireRole };
