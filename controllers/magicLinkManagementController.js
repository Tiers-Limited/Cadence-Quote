// controllers/magicLinkManagementController.js
// Contractor-side magic link management - view, track, and maintain customer magic links

const MagicLink = require('../models/MagicLink');
const Client = require('../models/Client');
const Quote = require('../models/Quote');
const { Op } = require('sequelize');
const { createAuditLog } = require('./auditLogController');
const MagicLinkService = require('../services/magicLinkService');
const emailService = require('../services/emailService');
const ContractorSettings = require('../models/ContractorSettings');

/**
 * Get all magic links for contractor's customers
 * GET /api/v1/magic-links
 */
exports.getMagicLinks = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { status, search, page = 1, limit = 20 } = req.query;

    const whereClause = { tenantId };

    // Filter by status
    if (status === 'active') {
      whereClause.revokedAt = null;
      whereClause.expiresAt = { [Op.gt]: new Date() };
    } else if (status === 'expired') {
      whereClause[Op.or] = [
        { revokedAt: { [Op.ne]: null } },
        { expiresAt: { [Op.lte]: new Date() } },
      ];
    } else if (status === 'expiring_soon') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      whereClause.revokedAt = null;
      whereClause.expiresAt = {
        [Op.gt]: new Date(),
        [Op.lte]: threeDaysFromNow,
      };
    }

    const offset = (page - 1) * limit;

    const { rows: magicLinks, count } = await MagicLink.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone'],
          where: search
            ? {
                [Op.or]: [
                  { name: { [Op.like]: `%${search}%` } },
                  { email: { [Op.like]: `%${search}%` } },
                ],
              }
            : undefined,
        },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'status', 'total'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Calculate additional stats for each link
    const enhancedLinks = magicLinks.map(link => {
      const now = new Date();
      const expiresAt = new Date(link.expiresAt);
      const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
      const isExpired = expiresAt <= now || link.revokedAt !== null;
      const isExpiringSoon = !isExpired && daysUntilExpiry <= 3;

      return {
        ...link.toJSON(),
        daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
        isExpired,
        isExpiringSoon,
      };
    });

    // Get summary stats
    const stats = await this.getMagicLinkStats(tenantId);

    res.json({
      success: true,
      data: enhancedLinks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Get magic links error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch magic links',
      error: error.message,
    });
  }
};

/**
 * Get magic link statistics
 */
exports.getMagicLinkStats = async (tenantId) => {
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const [active, expired, expiringSoon, totalCreated] = await Promise.all([
    MagicLink.count({
      where: {
        tenantId,
        revokedAt: null,
        expiresAt: { [Op.gt]: now },
      },
    }),
    MagicLink.count({
      where: {
        tenantId,
        [Op.or]: [{ revokedAt: { [Op.ne]: null } }, { expiresAt: { [Op.lte]: now } }],
      },
    }),
    MagicLink.count({
      where: {
        tenantId,
        revokedAt: null,
        expiresAt: {
          [Op.gt]: now,
          [Op.lte]: threeDaysFromNow,
        },
      },
    }),
    MagicLink.count({ where: { tenantId } }),
  ]);

  return { active, expired, expiringSoon, totalCreated };
};

/**
 * Get single magic link details
 * GET /api/v1/magic-links/:id
 */
exports.getMagicLinkDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const magicLink = await MagicLink.findOne({
      where: { id, tenantId },
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone', 'street', 'city', 'state', 'zip'],
        },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'status', 'total', 'depositVerified', 'createdAt'],
        },
      ],
    });

    if (!magicLink) {
      return res.status(404).json({
        success: false,
        message: 'Magic link not found',
      });
    }

    // Get session history for this magic link
    const CustomerSession = require('../models/CustomerSession');
    const sessions = await CustomerSession.findAll({
      where: { magicLinkId: id },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const now = new Date();
    const expiresAt = new Date(magicLink.expiresAt);
    const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      data: {
        ...magicLink.toJSON(),
        daysUntilExpiry: expiresAt <= now ? 0 : daysUntilExpiry,
        isExpired: expiresAt <= now || magicLink.revokedAt !== null,
        sessions,
      },
    });
  } catch (error) {
    console.error('Get magic link detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch magic link details',
      error: error.message,
    });
  }
};

/**
 * Extend magic link expiry
 * PUT /api/v1/magic-links/:id/extend
 */
exports.extendMagicLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const magicLink = await MagicLink.findOne({
      where: { id, tenantId },
      include: [{ model: Client, as: 'client' }],
    });

    if (!magicLink) {
      return res.status(404).json({
        success: false,
        message: 'Magic link not found',
      });
    }

    // Extend expiry
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(days));

    await magicLink.update({
      expiresAt: newExpiryDate,
      revokedAt: null,
    });

    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: `Magic link extended by ${days} days`,
      userId,
      tenantId,
      entityType: 'MagicLink',
      entityId: magicLink.id,
      metadata: {
        clientName: magicLink.client?.name,
        newExpiryDate: newExpiryDate.toISOString(),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Send notification email to customer
    try {
      const settings = await ContractorSettings.findOne({ where: { tenantId } });
      await emailService.sendMagicLinkExtended({
        to: magicLink.email,
        customerName: magicLink.client?.name || 'Valued Customer',
        newExpiryDate,
        companyName: settings?.companyName || 'Your Contractor',
      });
    } catch (emailError) {
      console.error('Failed to send extension notification:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: `Magic link extended by ${days} days`,
      data: {
        ...magicLink.toJSON(),
        daysUntilExpiry: days,
      },
    });
  } catch (error) {
    console.error('Extend magic link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extend magic link',
      error: error.message,
    });
  }
};

/**
 * Regenerate magic link (create new token, invalidate old)
 * POST /api/v1/magic-links/:id/regenerate
 */
exports.regenerateMagicLink = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const oldLink = await MagicLink.findOne({
      where: { id, tenantId },
      include: [{ model: Client, as: 'client' }, { model: Quote, as: 'quote' }],
    });

    if (!oldLink) {
      return res.status(404).json({
        success: false,
        message: 'Magic link not found',
      });
    }

    // Deactivate old link
    await oldLink.update({ revokedAt: new Date() });

    // Get settings for expiry
    const settings = await ContractorSettings.findOne({ where: { tenantId } });
    const expiryDays = settings?.portalLinkExpiryDays || 7;

    // Create new magic link
    const newLink = await MagicLinkService.createMagicLink({
      tenantId,
      clientId: oldLink.clientId,
      quoteId: oldLink.quoteId,
      email: oldLink.email,
      phone: oldLink.phone,
      purpose: oldLink.purpose,
      expiryDays,
      isSingleUse: oldLink.isSingleUse,
      allowMultiJobAccess: oldLink.allowMultiJobAccess,
      metadata: {
        regeneratedFrom: oldLink.id,
        regeneratedBy: userId,
      },
    });

    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Magic link regenerated',
      userId,
      tenantId,
      entityType: 'MagicLink',
      entityId: newLink.magicLink.id,
      metadata: {
        oldLinkId: oldLink.id,
        clientName: oldLink.client?.name,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Send new magic link to customer
    try {
      await emailService.sendMagicLink({
        to: oldLink.email,
        customerName: oldLink.client?.name || 'Valued Customer',
        magicLink: newLink.link,
        companyName: settings?.companyName || 'Your Contractor',
        purpose: oldLink.purpose,
        quoteInfo: oldLink.quote
          ? {
              quoteNumber: oldLink.quote.quoteNumber,
              total: oldLink.quote.total,
            }
          : null,
        expiryHours: expiryDays * 24,
      });
    } catch (emailError) {
      console.error('Failed to send new magic link:', emailError);
    }

    res.json({
      success: true,
      message: 'New magic link generated and sent to customer',
      data: newLink.magicLink,
    });
  } catch (error) {
    console.error('Regenerate magic link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate magic link',
      error: error.message,
    });
  }
};

/**
 * Deactivate magic link manually
 * DELETE /api/v1/magic-links/:id
 */
exports.deactivateMagicLink = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const magicLink = await MagicLink.findOne({
      where: { id, tenantId },
      include: [{ model: Client, as: 'client' }],
    });

    if (!magicLink) {
      return res.status(404).json({
        success: false,
        message: 'Magic link not found',
      });
    }

    await magicLink.update({ revokedAt: new Date() });

    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Magic link deactivated manually',
      userId,
      tenantId,
      entityType: 'MagicLink',
      entityId: magicLink.id,
      metadata: {
        clientName: magicLink.client?.name,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Magic link deactivated successfully',
    });
  } catch (error) {
    console.error('Deactivate magic link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate magic link',
      error: error.message,
    });
  }
};

/**
 * Bulk extend expiring links
 * POST /api/v1/magic-links/bulk-extend
 */
exports.bulkExtendLinks = async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Find all expiring links
    const expiringLinks = await MagicLink.findAll({
      where: {
        tenantId,
        revokedAt: null,
        expiresAt: {
          [Op.gt]: new Date(),
          [Op.lte]: threeDaysFromNow,
        },
      },
    });

    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(days));

    // Update all expiring links
    await Promise.all(
      expiringLinks.map(link =>
        link.update({
          expiresAt: newExpiryDate,
        })
      )
    );

    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: `Bulk extended ${expiringLinks.length} magic links`,
      userId,
      tenantId,
      entityType: 'MagicLink',
      entityId: null,
      metadata: {
        count: expiringLinks.length,
        days,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Extended ${expiringLinks.length} magic links by ${days} days`,
      count: expiringLinks.length,
    });
  } catch (error) {
    console.error('Bulk extend links error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk extend links',
      error: error.message,
    });
  }
};

module.exports = exports;
