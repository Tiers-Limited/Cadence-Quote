const Tenant = require('../models/Tenant');
const User = require('../models/User');
const TenantFeature = require('../models/TenantFeature');
const FeatureFlag = require('../models/FeatureFlag');
const { Op } = require('sequelize');
const { createAuditLog } = require('./auditLogController');

// Get all tenants
exports.getAllTenants = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { subdomain: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Tenant.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          foreignKey: 'tenantId',
          attributes: ['id', 'fullName', 'email', 'role', 'isActive'],
        },
        {
          model: TenantFeature,
          foreignKey: 'tenantId',
          include: [{ model: FeatureFlag, as: 'feature' }],
        },
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
    console.error('Get all tenants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenants',
      error: error.message,
    });
  }
};

// Get tenant by ID
exports.getTenantById = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id, {
      include: [
        { 
          model: User, 
          foreignKey: 'tenantId',
          attributes: ['id', 'fullName', 'email', 'role', 'isActive', 'createdAt'],
        },
        {
          model: TenantFeature,
          foreignKey: 'tenantId',
          include: [{ model: FeatureFlag, as: 'feature' }],
        },
      ],
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant',
      error: error.message,
    });
  }
};

// Update tenant
exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, seatLimit, trialEndsAt, subscriptionId } = req.body;

    const tenant = await Tenant.findByPk(id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    const changes = {};
    if (name && name !== tenant.name) changes.name = { old: tenant.name, new: name };
    if (status && status !== tenant.status) changes.status = { old: tenant.status, new: status };
    if (seatLimit !== undefined && seatLimit !== tenant.seatLimit) changes.seatLimit = { old: tenant.seatLimit, new: seatLimit };

    await tenant.update({
      name: name || tenant.name,
      status: status || tenant.status,
      seatLimit: seatLimit !== undefined ? seatLimit : tenant.seatLimit,
      trialEndsAt: trialEndsAt !== undefined ? trialEndsAt : tenant.trialEndsAt,
      subscriptionId: subscriptionId !== undefined ? subscriptionId : tenant.subscriptionId,
    });

    // Audit log
    await createAuditLog({
      tenantId: tenant.id,
      userId: req.user?.id,
      action: 'Update Tenant',
      category: 'tenant',
      entityType: 'Tenant',
      entityId: tenant.id,
      changes,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: tenant,
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant',
      error: error.message,
    });
  }
};

// Activate tenant
exports.activateTenant = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    await tenant.update({ status: 'active', isActive: true });

    // Audit log
    await createAuditLog({
      tenantId: tenant.id,
      userId: req.user?.id,
      action: 'Activate Tenant',
      category: 'tenant',
      entityType: 'Tenant',
      entityId: tenant.id,
      changes: { status: { old: tenant.status, new: 'active' }, isActive: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Tenant activated successfully',
      data: tenant,
    });
  } catch (error) {
    console.error('Activate tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate tenant',
      error: error.message,
    });
  }
};

// Suspend tenant
exports.suspendTenant = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    await tenant.update({ status: 'suspended', isActive: false });

    // Audit log
    await createAuditLog({
      tenantId: tenant.id,
      userId: req.user?.id,
      action: 'Suspend Tenant',
      category: 'tenant',
      entityType: 'Tenant',
      entityId: tenant.id,
      changes: { status: { old: tenant.status, new: 'suspended' }, isActive: false },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Tenant suspended successfully',
      data: tenant,
    });
  } catch (error) {
    console.error('Suspend tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend tenant',
      error: error.message,
    });
  }
};

// Assign users to tenant
exports.assignUsersToTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    const tenant = await Tenant.findByPk(id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    // Check seat limit
    const currentUserCount = await User.count({ where: { tenantId: id, isActive: true } });
    
    if (currentUserCount + userIds.length > tenant.seatLimit) {
      return res.status(400).json({
        success: false,
        message: `Seat limit exceeded. Current: ${currentUserCount}, Limit: ${tenant.seatLimit}`,
      });
    }

    // Assign users
    await User.update(
      { tenantId: id },
      { where: { id: { [Op.in]: userIds } } }
    );

    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['id', 'fullName', 'email', 'role'],
    });

    res.json({
      success: true,
      message: 'Users assigned to tenant successfully',
      data: users,
    });
  } catch (error) {
    console.error('Assign users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign users',
      error: error.message,
    });
  }
};

// Get tenant statistics
exports.getTenantStats = async (req, res) => {
  try {
    const totalTenants = await Tenant.count();
    const activeTenants = await Tenant.count({ where: { status: 'active' } });
    const suspendedTenants = await Tenant.count({ where: { status: 'suspended' } });
    const trialTenants = await Tenant.count({ where: { status: 'trial' } });

    const statusCounts = await Tenant.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
      ],
      group: ['status'],
    });

    res.json({
      success: true,
      data: {
        total: totalTenants,
        active: activeTenants,
        suspended: suspendedTenants,
        trial: trialTenants,
        byStatus: statusCounts,
      },
    });
  } catch (error) {
    console.error('Get tenant stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant statistics',
      error: error.message,
    });
  }
};

// Impersonate user (admin only)
exports.impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      include: [{ model: Tenant, foreignKey: 'tenantId' }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate impersonation token (you'd use your JWT logic here)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user.id, 
        userId: user.id,
        tenantId: user.tenantId,
        impersonatedBy: req.user.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      message: 'Impersonation token generated',
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          tenant: user.Tenant,
        },
      },
    });
  } catch (error) {
    console.error('Impersonate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to impersonate user',
      error: error.message,
    });
  }
};
