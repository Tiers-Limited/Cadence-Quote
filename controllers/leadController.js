// controllers/leadController.js
const { sequelize } = require('../config/database');
const Lead = require('../models/Lead');
const LeadForm = require('../models/LeadForm');

/**
 * Get all leads for a tenant
 * GET /api/leads
 */
const getLeads = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { status, leadFormId, limit = 50, offset = 0 } = req.query;

    const where = { tenantId };
    
    // Apply filters
    if (status) where.status = status;
    if (leadFormId) where.leadFormId = leadFormId;

    const { count, rows: leads } = await Lead.findAndCountAll({
      where,
      include: [{
        model: LeadForm,
        attributes: ['id', 'formName', 'formTitle']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        leads,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leads'
    });
  }
};

/**
 * Get single lead by ID
 * GET /api/leads/:id
 */
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const lead = await Lead.findOne({
      where: { id, tenantId },
      include: [{
        model: LeadForm,
        attributes: ['id', 'formName', 'formTitle', 'publicUrl']
      }]
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead'
    });
  }
};

/**
 * Update lead status and notes
 * PUT /api/leads/:id
 */
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { status, notes } = req.body;

    const lead = await Lead.findOne({
      where: { id, tenantId }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Update lead
    await lead.update({
      status: status || lead.status,
      notes: notes !== undefined ? notes : lead.notes
    });

    res.json({
      success: true,
      message: 'Lead updated successfully',
      data: lead
    });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead'
    });
  }
};

/**
 * Delete lead
 * DELETE /api/leads/:id
 */
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const lead = await Lead.findOne({
      where: { id, tenantId }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    await lead.destroy();

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead'
    });
  }
};

/**
 * Get lead statistics
 * GET /api/leads/stats
 */
const getLeadStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Count by status
    const statusCounts = await Lead.findAll({
      where: { tenantId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Total leads
    const totalLeads = await Lead.count({ where: { tenantId } });

    // Recent leads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLeads = await Lead.count({
      where: {
        tenantId,
        createdAt: {
          [sequelize.Op.gte]: sevenDaysAgo
        }
      }
    });

    res.json({
      success: true,
      data: {
        total: totalLeads,
        recent: recentLeads,
        byStatus: statusCounts
      }
    });
  } catch (error) {
    console.error('Get lead stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead statistics'
    });
  }
};

module.exports = {
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats
};
