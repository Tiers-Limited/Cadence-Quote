const User = require('../models/User');
const Role = require('../models/Role');

const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const userId = req.user.id || req.user.userId;
      const user = await User.findByPk(userId, {
        include: [{ model: Role, as: 'userRole' }],
      });
     
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      // Attach full user details to request
      req.userDetails = user;
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
