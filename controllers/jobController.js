// controllers/jobController.js
// Controller for managing jobs (created from accepted quotes after deposit payment)

const Job = require('../models/Job');
const Quote = require('../models/Quote');
const Client = require('../models/Client');
const { Op } = require('sequelize');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');

/**
 * Get all jobs for contractor with filtering and pagination
 */
exports.getAllJobs = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search
    } = req.query;

    // Build where clause
    const where = { tenantId, userId };
    
    if (status && status !== 'all') {
      where.status = status;
    }

    // Search filter
    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { customerEmail: { [Op.like]: `%${search}%` } }
      ];
    }

    // Pagination
    const offset = (page - 1) * limit;

    const { count, rows: jobs } = await Job.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone',"street","state","city","zip" ]
        },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'areas']
        }
      ]
    });

    res.json({
      success: true,
      data: jobs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
};

/**
 * Get single job by ID
 */
exports.getJobById = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({
      where: { id: jobId, tenantId },
      include: [
        {
          model: Client,
          as: 'client',
          attributes:['id', 'name', 'email', 'phone',"street","state","city","zip" ]
        },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'areas', 'breakdown']
        }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job',
      error: error.message
    });
  }
};

/**
 * Update job scheduling (start date, end date, duration)
 * Manual scheduling by contractor - Phase 1
 */
exports.updateJobSchedule = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;
    const {
      scheduledStartDate,
      scheduledEndDate,
      estimatedDuration,
      assignedCrewMembers,
      crewNotes
    } = req.body;

    const job = await Job.findOne({
      where: { id: jobId, tenantId }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Update scheduling info
    const updates = {};
    if (scheduledStartDate) updates.scheduledStartDate = new Date(scheduledStartDate);
    if (scheduledEndDate) updates.scheduledEndDate = new Date(scheduledEndDate);
    if (estimatedDuration) updates.estimatedDuration = estimatedDuration;
    if (assignedCrewMembers) updates.assignedCrewMembers = assignedCrewMembers;
    if (crewNotes !== undefined) updates.crewNotes = crewNotes;
    
    // If scheduling for first time, update status
    if (scheduledStartDate && job.status === 'selections_complete') {
      updates.status = 'scheduled';
    }

    await job.update(updates);

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      tenantId,
      action: 'job_scheduled',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: updates,
      req
    });

    // Notify customer that job has been scheduled (use contractor-owned message + signature)
    try {
      const client = await Client.findByPk(job.clientId);
      if (client && client.email) {
        await emailService.sendJobScheduledEmail(client.email, {
          jobNumber: job.jobNumber,
          customerName: job.customerName,
          scheduledStartDate: updates.scheduledStartDate || job.scheduledStartDate,
          scheduledEndDate: updates.scheduledEndDate || job.scheduledEndDate,
          jobId: job.id
        }, { tenantId, contractorMessage: null });
      }
    } catch (notifyErr) {
      console.error('Error sending job scheduled email:', notifyErr);
    }

    res.json({
      success: true,
      message: 'Job schedule updated successfully',
      data: job
    });
  } catch (error) {
    console.error('Update job schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job schedule',
      error: error.message
    });
  }
};

/**
 * Approve customer selections (contractor action)
 * PATCH /api/jobs/:jobId/approve-selections
 */
exports.approveSelections = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({ where: { id: jobId, tenantId }, include: [{ model: Quote, as: 'quote' }] });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Append approval note and timestamp
    const note = `[Selections Approved by ${req.user.name || req.user.email} at ${new Date().toISOString()}]\n`;
    const contractorNotes = (job.contractorNotes || '') + note;
    await job.update({ contractorNotes });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      tenantId,
      action: 'selections_approved',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: { quoteId: job.quoteId },
      req
    });

    // Notify customer using contractor-owned default message + signature
    try {
      const client = await Client.findByPk(job.clientId);
      if (client && client.email) {
        await emailService.sendSelectionsApprovedEmail(client.email, {
          jobNumber: job.jobNumber,
          quoteNumber: job.quoteId,
          customerName: job.customerName,
          jobId: job.id
        }, { tenantId });
      }
    } catch (notifyErr) {
      console.error('Error sending selections approved email:', notifyErr);
    }

    res.json({ success: true, message: 'Customer selections approved', data: { jobId } });
  } catch (error) {
    console.error('Approve selections error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve selections', error: error.message });
  }
};

/**
 * Toggle job visibility in customer portal (contractor action)
 * PATCH /api/jobs/:jobId/visibility
 * Body: { visible: true|false }
 */
exports.setJobVisibility = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { visible } = req.body;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({ where: { id: jobId, tenantId } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    // Update associated quote.portalOpen to control visibility
    const QuoteModel = require('../models/Quote');
    const quote = await QuoteModel.findByPk(job.quoteId);
    if (!quote) return res.status(404).json({ success: false, message: 'Related proposal not found' });

    await quote.update({ portalOpen: !!visible, portalOpenedAt: visible ? new Date() : quote.portalOpenedAt, portalClosedAt: visible ? quote.portalClosedAt : new Date() });

    await createAuditLog({
      userId: req.user.id,
      tenantId,
      action: 'job_visibility_changed',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: { visible },
      req
    });

    res.json({ success: true, message: 'Job visibility updated', data: { visible } });
  } catch (error) {
    console.error('Set job visibility error:', error);
    res.status(500).json({ success: false, message: 'Failed to update visibility', error: error.message });
  }
};

/**
 * Update job status
 */
exports.updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, notes, scheduledStartDate, scheduledEndDate, reason } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const job = await Job.findOne({
      where: { id: jobId, tenantId }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Use Phase 1 status flow for manual statuses
    const StatusFlowService = require('../services/statusFlowService');
    
    try {
      await StatusFlowService.transitionJobStatus(job, status, {
        userId,
        tenantId,
        isAdmin: true, // Contractor is admin for their jobs
        scheduledStartDate,
        scheduledEndDate,
        reason,
        req
      });

      // Update notes separately if provided
      if (notes) {
        await job.update({ contractorNotes: notes });
      }

      await job.reload();

      res.json({
        success: true,
        message: 'Job status updated successfully',
        data: job
      });
    } catch (flowError) {
      // Return validation error from status flow
      return res.status(400).json({
        success: false,
        message: flowError.message || 'Invalid status transition'
      });
    }
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status',
      error: error.message
    });
  }
};

/**
 * Update area progress for job progress tracker
 */
exports.updateAreaProgress = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { areaId, status } = req.body;
    const tenantId = req.user.tenantId;

    const validStatuses = ['not_started', 'prepped', 'in_progress', 'touch_ups', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid area status'
      });
    }

    const job = await Job.findOne({
      where: { id: jobId, tenantId },
      include: [{ 
        model: Quote, 
        as: 'quote', 
        attributes: ['id', 'quoteNumber', 'areas'] 
      }]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Update area progress JSON
    const areaProgress = job.areaProgress || {};
    areaProgress[areaId] = {
      status,
      updatedAt: new Date()
    };

    // Mark the JSON field as changed so Sequelize saves it
    job.changed('areaProgress', true);
    await job.update({ areaProgress });

    // Auto-complete job if all areas are marked completed
    let jobStatusUpdate = null;
    if (job.quote && Array.isArray(job.quote.areas) && job.quote.areas.length > 0) {
      const allCompleted = job.quote.areas.every(area => {
        const key = String(area.id);
        const entry = areaProgress[key] || areaProgress[area.id];
        return entry && entry.status === 'completed';
      });

      if (allCompleted && job.status !== 'completed') {
        jobStatusUpdate = {
          status: 'completed',
          actualEndDate: job.actualEndDate || new Date()
        };
        await job.update(jobStatusUpdate);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      tenantId,
      action: 'area_progress_updated',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: { areaId, status, ...(jobStatusUpdate || {}) },
      req
    });

    res.json({
      success: true,
      message: jobStatusUpdate
        ? 'Area progress updated and job marked completed'
        : 'Area progress updated successfully',
      data: { 
        areaProgress: job.areaProgress,
        ...(jobStatusUpdate || {})
      }
    });
  } catch (error) {
    console.error('Update area progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update area progress',
      error: error.message
    });
  }
};

/**
 * Record lost job intelligence (for declined/expired quotes)
 */
exports.recordLostJobReason = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { lostReason, lostReasonDetails } = req.body;
    const tenantId = req.user.tenantId;

    const validReasons = [
      'budget_mismatch',
      'chose_competitor',
      'timing_changed',
      'scope_misalignment',
      'confidence_issues',
      'project_paused',
      'other'
    ];

    if (!validReasons.includes(lostReason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lost reason'
      });
    }

    const job = await Job.findOne({
      where: { id: jobId, tenantId }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Only allow for jobs that are not approved/paid
    if (['deposit_paid', 'in_progress', 'completed'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot record lost reason for approved/active jobs'
      });
    }

    await job.update({
      lostReason,
      lostReasonDetails,
      lostAt: new Date(),
      status: 'canceled'
    });

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      tenantId,
      action: 'job_lost_recorded',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: { lostReason, lostReasonDetails },
      req
    });

    res.json({
      success: true,
      message: 'Lost job reason recorded successfully',
      data: job
    });
  } catch (error) {
    console.error('Record lost job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record lost job reason',
      error: error.message
    });
  }
};

/**
 * Get job calendar events (for calendar view)
 */
exports.getJobCalendar = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const where = {
      tenantId,
      userId,
      status: { [Op.in]: ['scheduled', 'in_progress', 'completed'] }
    };

    // Optional date range filter
    if (startDate && endDate) {
      where.scheduledStartDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const jobs = await Job.findAll({
      where,
      attributes: [
        'id',
        'jobNumber',
        'jobName',
        'customerName',
        'status',
        'scheduledStartDate',
        'scheduledEndDate',
        'estimatedDuration',
        'actualStartDate',
        'actualEndDate'
      ],
      order: [['scheduledStartDate', 'ASC']]
    });

    // Format for calendar
    const events = jobs.map(job => ({
      id: job.id,
      title: `${job.jobNumber} - ${job.customerName}`,
      start: job.scheduledStartDate || job.actualStartDate,
      end: job.scheduledEndDate || job.actualEndDate,
      status: job.status,
      duration: job.estimatedDuration,
      jobNumber: job.jobNumber,
      customerName: job.customerName
    }));

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get job calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job calendar',
      error: error.message
    });
  }
};

/**
 * Get job statistics for dashboard
 */
exports.getJobStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const stats = {
      total: await Job.count({ where: { tenantId, userId } }),
      depositPaid: await Job.count({ where: { tenantId, userId, status: 'deposit_paid' } }),
      scheduled: await Job.count({ where: { tenantId, userId, status: 'scheduled' } }),
      inProgress: await Job.count({ where: { tenantId, userId, status: 'in_progress' } }),
      completed: await Job.count({ where: { tenantId, userId, status: 'completed' } }),
      selectionsNeeded: await Job.count({ 
        where: { 
          tenantId, 
          userId, 
          customerSelectionsComplete: false,
          status: 'deposit_paid'
        } 
      })
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job statistics',
      error: error.message
    });
  }
};

module.exports = exports;
