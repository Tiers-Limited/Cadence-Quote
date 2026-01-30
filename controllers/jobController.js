// controllers/jobController.js
// Controller for managing jobs (created from accepted quotes after deposit payment)

const Job = require('../models/Job');
const Quote = require('../models/Quote');
const Client = require('../models/Client');
const { Op } = require('sequelize');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');
const path = require('path');
const fs = require('fs');

// Import optimization utilities
const { optimizationSystem } = require('../optimization');
const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');


// Cache keys for job data
const CACHE_KEYS = {
  JOB_LIST: (tenantId, userId, filters) => `jobs:list:${tenantId}:${userId}:${JSON.stringify(filters)}`,
  JOB_DETAIL: (tenantId, jobId) => `jobs:detail:${tenantId}:${jobId}`,
  JOB_STATS: (tenantId, userId) => `jobs:stats:${tenantId}:${userId}`,
  JOB_CALENDAR: (tenantId, userId, dateRange) => `jobs:calendar:${tenantId}:${userId}:${JSON.stringify(dateRange)}`
};

// Cache TTL (5 minutes for dynamic data, 15 minutes for stats)
const CACHE_TTL = {
  JOBS: 300,
  STATS: 900
};

/**
 * Get all jobs for contractor with filtering and pagination
 * OPTIMIZED: Implements caching, efficient filtering, and selective field loading
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

    // Create cache key based on filters
    const filters = { status, page, limit, sortBy, sortOrder, search };
    const cacheKey = CACHE_KEYS.JOB_LIST(tenantId, userId, filters);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedJobs = await utils.cache?.get(cacheKey);
      
      if (cachedJobs) {
        return res.json({
          ...cachedJobs,
          cached: true
        });
      }
    }

    // Build where clause with optimized filtering
    const where = { tenantId, userId };
    
    if (status && status !== 'all') {
      where.status = status;
    }

    // OPTIMIZATION: Use efficient search with indexed fields
    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { customerEmail: { [Op.like]: `%${search}%` } }
      ];
    }

    // Pagination
    const offset = (page - 1) * limit;

    // OPTIMIZATION: Use selective field loading and eager loading to eliminate N+1 queries
    const { count, rows: jobs } = await Job.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone', 'street', 'state', 'city', 'zip']
        },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'areas']
        }
      ],
      // OPTIMIZATION: Use raw queries where possible for better performance
      raw: false // Keep as false since we need associations
    });

    const result = {
      success: true,
      data: jobs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.JOBS, {
        tags: [`tenant:${tenantId}`, `user:${userId}`, 'jobs']
      });
    }

    res.json(result);
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
 * OPTIMIZED: Implements caching and selective field loading
 */
exports.getJobById = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    // Try to get from cache first
    const cacheKey = CACHE_KEYS.JOB_DETAIL(tenantId, jobId);
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedJob = await utils.cache?.get(cacheKey);
      
      if (cachedJob) {
        return res.json({
          ...cachedJob,
          cached: true
        });
      }
    }

    // OPTIMIZATION: Use selective field loading and eager loading
    const job = await Job.findOne({
      where: { id: jobId, tenantId },
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone', 'street', 'state', 'city', 'zip']
        },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'areas', 'breakdown', 'flatRateItems','gbbSelectedTier', 'productSets', 'pricingSchemeId'],
          include: [{
            model: require('../models/PricingScheme'),
            as: 'pricingScheme',
            attributes: ['id', 'name', 'type']
          }]
        }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const result = {
      success: true,
      data: job
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.JOBS, {
        tags: [`tenant:${tenantId}`, 'job-details']
      });
    }

    res.json(result);
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
 * Supports all pricing schemes: production_based, rate_based, turnkey, flat_rate_unit
 */
exports.updateAreaProgress = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { areaId, itemKey, status } = req.body; // itemKey for flat rate items
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
        attributes: ['id', 'quoteNumber', 'areas', 'flatRateItems', 'productSets', 'pricingSchemeId'],
        include: [{
          model: require('../models/PricingScheme'),
          as: 'pricingScheme',
          attributes: ['id', 'name', 'type']
        }]
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
    
    // Use itemKey for flat rate items, areaId for others
    const progressKey = itemKey || areaId;
    
    areaProgress[progressKey] = {
      status,
      updatedAt: new Date(),
      itemKey: itemKey || null, // Store itemKey for flat rate items
      areaId: areaId || null
    };

    // Mark the JSON field as changed so Sequelize saves it
    job.changed('areaProgress', true);
    await job.update({ areaProgress });

    // Auto-complete job if all items are marked completed
    let jobStatusUpdate = null;
    const pricingSchemeType = job.quote?.pricingScheme?.type;
    
    let allCompleted = false;
    
    if (pricingSchemeType === 'flat_rate_unit') {
      // Check flat rate items completion
      const flatRateItems = job.quote.flatRateItems || {};
      const allItems = [];
      
      if (flatRateItems.interior) {
        Object.keys(flatRateItems.interior).forEach(key => {
          if (flatRateItems.interior[key] > 0) {
            allItems.push(`interior_${key}`);
          }
        });
      }
      
      if (flatRateItems.exterior) {
        Object.keys(flatRateItems.exterior).forEach(key => {
          if (flatRateItems.exterior[key] > 0) {
            allItems.push(`exterior_${key}`);
          }
        });
      }
      
      allCompleted = allItems.length > 0 && allItems.every(itemKey => {
        const entry = areaProgress[itemKey];
        return entry && entry.status === 'completed';
      });
      
    } else if (pricingSchemeType === 'turnkey' || pricingSchemeType === 'sqft_turnkey') {
      // For turnkey, check if the single "whole_house" item is completed
      const entry = areaProgress['whole_house'];
      allCompleted = entry && entry.status === 'completed';
      
    } else {
      // For production_based and rate_based, check areas
      if (job.quote && Array.isArray(job.quote.areas) && job.quote.areas.length > 0) {
        allCompleted = job.quote.areas.every(area => {
          const key = String(area.id);
          const entry = areaProgress[key] || areaProgress[area.id];
          return entry && entry.status === 'completed';
        });
      }
    }

    if (allCompleted && job.status !== 'completed') {
      jobStatusUpdate = {
        status: 'completed',
        actualEndDate: job.actualEndDate || new Date()
      };
      await job.update(jobStatusUpdate);
    }

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      tenantId,
      action: 'area_progress_updated',
      category: 'job',
      entityType: 'Job',
      entityId: jobId,
      details: { areaId, itemKey, status, ...(jobStatusUpdate || {}) },
      req
    });

    // Invalidate cache for this job
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cacheKey = CACHE_KEYS.JOB_DETAIL(tenantId, jobId);
      await utils.cache?.delete(cacheKey);
      
      // Also invalidate customer cache if exists
      if (job.clientId) {
        const customerCacheKey = CACHE_KEYS.JOB_DETAIL(job.clientId, jobId);
        await utils.cache?.delete(customerCacheKey);
      }
    }

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
 * OPTIMIZED: Implements caching and efficient date range filtering
 */
exports.getJobCalendar = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Create cache key based on date range
    const dateRange = { startDate, endDate };
    const cacheKey = CACHE_KEYS.JOB_CALENDAR(tenantId, userId, dateRange);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedCalendar = await utils.cache?.get(cacheKey);
      
      if (cachedCalendar) {
        return res.json({
          ...cachedCalendar,
          cached: true
        });
      }
    }

    const where = {
      tenantId,
      userId,
      status: { [Op.in]: ['scheduled', 'in_progress', 'completed'] }
    };

    // OPTIMIZATION: Use efficient date range filtering with indexed fields
    if (startDate && endDate) {
      where.scheduledStartDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    // OPTIMIZATION: Use selective field loading for calendar data
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
      order: [['scheduledStartDate', 'ASC']],
      raw: true // Use raw queries for better performance
    });

    // OPTIMIZATION: Process data efficiently
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

    const result = {
      success: true,
      data: events
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.JOBS, {
        tags: [`tenant:${tenantId}`, `user:${userId}`, 'job-calendar']
      });
    }

    res.json(result);
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
 * OPTIMIZED: Implements caching and efficient aggregation queries
 */
exports.getJobStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    // Try to get from cache first
    const cacheKey = CACHE_KEYS.JOB_STATS(tenantId, userId);
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedStats = await utils.cache?.get(cacheKey);
      
      if (cachedStats) {
        return res.json({
          ...cachedStats,
          cached: true
        });
      }
    }

    // OPTIMIZATION: Use parallel queries for better performance
    const [
      total,
      depositPaid,
      scheduled,
      inProgress,
      completed,
      selectionsNeeded
    ] = await Promise.all([
      Job.count({ where: { tenantId, userId } }),
      Job.count({ where: { tenantId, userId, status: 'deposit_paid' } }),
      Job.count({ where: { tenantId, userId, status: 'scheduled' } }),
      Job.count({ where: { tenantId, userId, status: 'in_progress' } }),
      Job.count({ where: { tenantId, userId, status: 'completed' } }),
      Job.count({ 
        where: { 
          tenantId, 
          userId, 
          customerSelectionsComplete: false,
          status: 'deposit_paid'
        } 
      })
    ]);

    const result = {
      success: true,
      data: {
        total,
        depositPaid,
        scheduled,
        inProgress,
        completed,
        selectionsNeeded
      }
    };

    // Cache the results (longer TTL for stats)
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.STATS, {
        tags: [`tenant:${tenantId}`, `user:${userId}`, 'job-stats']
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job statistics',
      error: error.message
    });
  }
};

/**
 * GET /api/jobs/:jobId/customer-selections
 * Get customer selections for a job
 */
exports.getCustomerSelections = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({
      where: {
        id: jobId,
        tenantId
      },
      include: [{
        model: Quote,
        as: 'quote',
        attributes: ['id', 'quoteNumber', 'productSets', 'productStrategy', 'pricingSchemeId'],
        include: [{
          model: require('../models/PricingScheme'),
          as: 'pricingScheme',
          attributes: ['id', 'name', 'type']
        }]
      }]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if customer has completed selections
    if (!job.customerSelectionsComplete) {
      return res.json({
        success: true,
        data: [],
        message: 'Customer has not completed selections yet'
      });
    }

    // Get customer selections from CustomerSelection model
    const CustomerSelection = require('../models/CustomerSelection');
    const ProductConfig = require('../models/ProductConfig');
    const GlobalProduct = require('../models/GlobalProduct');
    const Brand = require('../models/Brand');
    
    const selections = await CustomerSelection.findAll({
      where: {
        quoteId: job.quoteId,
        tenantId
      },
      order: [['areaId', 'ASC']]
    });

    // Parse productSets to get product information
    let productSets = job.quote.productSets;
    if (typeof productSets === 'string') {
      try {
        productSets = JSON.parse(productSets);
      } catch (e) {
        productSets = [];
      }
    }
    if (!Array.isArray(productSets)) {
      productSets = [];
    }

    // IMPORTANT: Use selectedTier from Job model (saved during deposit payment)
    // This is the tier the customer selected and paid for
    const selectedTier = job.selectedTier || 'better';
    const productStrategy = job.quote.productStrategy;

    console.info(`[getCustomerSelections] Job ${jobId}: selectedTier=${selectedTier}, productStrategy=${productStrategy}`);
    console.info(`[getCustomerSelections] ProductSets count: ${productSets.length}`);

    // Build a map of areaId/surfaceType to product info
    const productMap = new Map();
    const productIds = new Set();

    for (const productSet of productSets) {
      const areaId = productSet.areaId || productSet.id;
      const surfaceType = productSet.surfaceType || productSet.type || 'general';
      const products = productSet.products || {};

      let productId = null;
      if (productStrategy === 'GBB') {
        // Use the tier from Job model (customer's selected tier)
        productId = products[selectedTier];
      } else {
        productId = products.single || products.good || products.better || products.best;
      }

      if (productId) {
        // Create multiple keys for better matching
        // Key 1: areaId_surfaceType (for numeric areaIds)
        if (areaId) {
          const key1 = `${areaId}_${surfaceType}`;
          productMap.set(key1, productId);
          console.info(`[getCustomerSelections] Mapped key1: ${key1} -> productId: ${productId}`);
        }
        
        // Key 2: just surfaceType (for flat rate items without numeric areaId)
        productMap.set(surfaceType, productId);
        console.info(`[getCustomerSelections] Mapped key2: ${surfaceType} -> productId: ${productId}`);
        
        // Key 3: normalized surfaceType (lowercase, no spaces)
        const normalizedSurface = String(surfaceType).toLowerCase().replace(/\s+/g, '');
        productMap.set(normalizedSurface, productId);
        console.info(`[getCustomerSelections] Mapped key3: ${normalizedSurface} -> productId: ${productId}`);
        
        productIds.add(productId);
      }
    }

    // Fetch all product configs in one query
    const productConfigs = await ProductConfig.findAll({
      where: { id: Array.from(productIds) },
      include: [
        {
          model: GlobalProduct,
          as: 'globalProduct',
          include: [{
            model: Brand,
            as: 'brand',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    // Create a map of productId to product details
    const productDetailsMap = new Map();
    productConfigs.forEach(config => {
      const productName = config.isCustom && config.customProduct 
        ? config.customProduct.name 
        : config.globalProduct?.name || 'Unknown Product';
      
      const brandName = config.isCustom && config.customProduct
        ? config.customProduct.brandName
        : config.globalProduct?.brand?.name || '';

      productDetailsMap.set(config.id, {
        productName,
        brandName
      });
    });

    // Format selections for display with product information
    const formattedSelections = selections.map(selection => {
      // Try to find product info from productSets using multiple key strategies
      let productId = null;
      
      // Strategy 1: Try areaId_surfaceType (for numeric areaIds)
      if (selection.areaId) {
        const key1 = `${selection.areaId}_${selection.surfaceType}`;
        productId = productMap.get(key1);
        console.info(`[getCustomerSelections] Lookup key1: ${key1} -> ${productId ? 'FOUND' : 'NOT FOUND'}`);
      }
      
      // Strategy 2: Try just surfaceType (for flat rate items)
      if (!productId && selection.surfaceType) {
        productId = productMap.get(selection.surfaceType);
        console.info(`[getCustomerSelections] Lookup key2: ${selection.surfaceType} -> ${productId ? 'FOUND' : 'NOT FOUND'}`);
      }
      
      // Strategy 3: Try normalized surfaceType (lowercase, no spaces)
      if (!productId && selection.surfaceType) {
        const normalizedSurface = String(selection.surfaceType).toLowerCase().replace(/\s+/g, '');
        productId = productMap.get(normalizedSurface);
        console.info(`[getCustomerSelections] Lookup key3: ${normalizedSurface} -> ${productId ? 'FOUND' : 'NOT FOUND'}`);
      }
      
      const productDetails = productId ? productDetailsMap.get(productId) : null;

      return {
        areaId: selection.areaId,
        areaName: selection.areaName,
        surfaceType: selection.surfaceType,
        productName: productDetails?.productName || selection.productName || 'Not specified',
        brandName: productDetails?.brandName || '',
        colorName: selection.colorName,
        colorCode: selection.colorNumber,
        colorHex: selection.colorHex,
        sheen: selection.sheen,
        notes: selection.customerNotes
      };
    });

    res.json({
      success: true,
      data: formattedSelections,
      selectedTier: job.selectedTier // Include selected tier in response
    });

  } catch (error) {
    console.error('[JobController] Error getting customer selections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer selections',
      error: error.message
    });
  }
};

module.exports = exports;


/**
 * GET /api/jobs/:jobId/documents
 * Get job documents (material list, paint order, work order)
 * Only available after quote acceptance and deposit payment
 */
exports.getJobDocuments = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({
      where: {
        id: jobId,
        tenantId
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if quote has been accepted and deposit paid
    if (!job.depositPaid) {
      return res.status(403).json({
        success: false,
        message: 'Job documents will be available after the customer accepts the quote and pays the deposit.',
        documentsAvailable: false
      });
    }

    const documents = {
      materialList: {
        url: job.materialListUrl,
        available: !!job.materialListUrl,
        title: 'Material List'
      },
      paintOrder: {
        url: job.paintOrderUrl,
        available: !!job.paintOrderUrl,
        title: 'Paint Product Order'
      },
      workOrder: {
        url: job.workOrderUrl,
        available: !!job.workOrderUrl,
        title: 'Work Order'
      },
      generatedAt: job.documentsGeneratedAt
    };

    res.json({
      success: true,
      documents,
      documentsAvailable: true
    });

  } catch (error) {
    console.error('[JobController] Error getting job documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job documents',
      error: error.message
    });
  }
};

/**
 * POST /api/jobs/:jobId/documents/generate
 * Trigger job document generation
 * Called after quote acceptance and deposit payment
 */
exports.generateJobDocuments = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({
      where: {
        id: jobId,
        tenantId
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if deposit has been paid
    if (!job.depositPaid) {
      return res.status(403).json({
        success: false,
        message: 'Job documents can only be generated after deposit payment'
      });
    }

    // Import document generation service
    const documentGenerationService = require('../services/documentGenerationService');

    // Generate job documents
    const result = await documentGenerationService.generateJobDocuments(job.quoteId, jobId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Job document generation failed',
        errors: result.errors
      });
    }

    res.json({
      success: true,
      documents: result.documents,
      message: 'Job documents generated successfully'
    });

  } catch (error) {
    console.error('[JobController] Error generating job documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate job documents',
      error: error.message
    });
  }
};

/**
 * GET /api/jobs/:jobId/documents/:documentType
 * Download a specific job document
 * documentType: material-list, paint-order, work-order
 */
exports.downloadJobDocument = async (req, res) => {
  try {
    const { jobId, documentType } = req.params;
    const tenantId = req.user.tenantId;

    const job = await Job.findOne({
      where: {
        id: jobId,
        tenantId
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if deposit has been paid
    if (!job.depositPaid) {
      return res.status(403).json({
        success: false,
        message: 'Job documents are not available until deposit is paid'
      });
    }

    // Get document URL based on type
    let documentUrl;
    let filename;

    switch (documentType) {
      case 'material-list':
        documentUrl = job.materialListUrl;
        filename = `material-list-${jobId}.pdf`;
        break;
      case 'paint-order':
        documentUrl = job.paintOrderUrl;
        filename = `paint-order-${jobId}.pdf`;
        break;
      case 'work-order':
        documentUrl = job.workOrderUrl;
        filename = `work-order-${jobId}.pdf`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid document type'
        });
    }

    if (!documentUrl) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or not yet generated'
      });
    }

    // Serve the file directly
    const filePath = path.join(__dirname, '..', documentUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Document file not found on server'
      });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send the file
    res.sendFile(filePath);

  } catch (error) {
    console.error('[JobController] Error downloading job document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: error.message
    });
  }
};


/**
 * Quote Acceptance Trigger
 * Called when a quote is accepted and deposit is paid
 * Generates job documents automatically
 */
exports.onQuoteAcceptance = async (quoteId, jobId) => {
  try {
    console.log(`[JobController] Quote acceptance trigger for quote ${quoteId}, job ${jobId}`);

    // Import document generation service
    const documentGenerationService = require('../services/documentGenerationService');

    // Generate job documents
    const result = await documentGenerationService.generateJobDocuments(quoteId, jobId);

    if (result.success) {
      console.log(`[JobController] Job documents generated successfully for job ${jobId}`);
      
      // Update job with document URLs (already done in documentGenerationService)
      // Just log success
      return {
        success: true,
        documents: result.documents
      };
    } else {
      // Log errors and notify contractor
      console.error(`[JobController] Job document generation failed for job ${jobId}:`, result.errors);
      
      // TODO: Send notification to contractor about document generation failure
      // await notifyContractor(jobId, 'Document generation failed');
      
      return {
        success: false,
        errors: result.errors
      };
    }

  } catch (error) {
    console.error('[JobController] Error in quote acceptance trigger:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
