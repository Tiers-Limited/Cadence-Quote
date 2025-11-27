const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { Op } = require('sequelize');

// Create audit log entry
exports.createAuditLog = async (logData) => {
  try {
    const log = await AuditLog.create({
      tenantId: logData.tenantId || null,
      userId: logData.userId || null,
      action: logData.action,
      category: logData.category,
      entityType: logData.entityType || null,
      entityId: logData.entityId || null,
      changes: logData.changes || null,
      metadata: logData.metadata || null,
      ipAddress: logData.ipAddress || null,
      userAgent: logData.userAgent || null,
      isImmutable: true,
    }, logData.transaction ? { transaction: logData.transaction } : {});
    return log;
  } catch (error) {
    console.error('Create audit log error:', error);
    throw error;
  }
};

// Get all audit logs (admin only)
exports.getAllAuditLogs = async (req, res) => {
  try {
    const { category, tenantId, userId, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (category) where.category = category;
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'email'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'companyName'] },
      ],
      limit: Number.parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
};

// Get audit logs by category
exports.getAuditLogsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where: { category },
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'email'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'companyName'] },
      ],
      limit: Number.parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(count / limit),
      },  
    });
  } catch (error) {
    console.error('Get audit logs by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
};

// Get audit logs for specific tenant
exports.getTenantAuditLogs = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { category, page = 1, limit = 50 } = req.query;

    const where = { tenantId };
    if (category) where.category = category;

    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'email'] },
      ],
      limit: Number.parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get tenant audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant audit logs',
      error: error.message,
    });
  }
};

// Get statistics
exports.getAuditLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const categoryCounts = await AuditLog.findAll({
      where,
      attributes: [
        'category',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
      ],
      group: ['category'],
    });

    const totalLogs = await AuditLog.count({ where });

    const recentActivity = await AuditLog.findAll({
      where,
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName'] },
      ],
    });

    res.json({
      success: true,
      data: {
        total: totalLogs,
        byCategory: categoryCounts,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Get audit log stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log statistics',
      error: error.message,
    });
  }
};

// Middleware to log actions automatically
exports.auditMiddleware = (category) => {
  return async (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      // Only log successful operations
      if (data.success && req.user) {
        const action = `${req.method} ${req.path}`;
        
        exports.createAuditLog({
          tenantId: req.user.tenantId || null,
          userId: req.user.id || req.user.userId,
          action,
          category,
          entityType: req.params.id ? req.baseUrl.split('/').pop() : null,
          entityId: req.params.id || null,
          changes: req.body || null,
          metadata: {
            method: req.method,
            path: req.path,
            query: req.query,
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
        }).catch(err => console.error('Audit logging failed:', err));
      }

      originalJson.call(this, data);
    };

    next();
  };
};
