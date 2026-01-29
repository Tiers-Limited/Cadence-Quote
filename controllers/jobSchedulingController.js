// controllers/jobSchedulingController.js
// Handles job scheduling, status updates, and final payment

const Job = require('../models/Job');
const Client = require('../models/Client');
const User = require('../models/User');
const Quote = require('../models/Quote');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sequelize = require('../config/database');

/**
 * Schedule a job (Contractor)
 * POST /api/jobs/:id/schedule
 */
exports.scheduleJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      scheduledStartDate,
      scheduledEndDate,
      estimatedDuration,
      crewLead,
      crewMembers,
      specialInstructions,
    } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    
    const job = await Job.findOne({
      where: { id, tenantId },
      include: [{ model: Client, as: 'client' }],
    });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    // Validate dates
    if (!scheduledStartDate) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled start date is required',
      });
    }
    
    const startDate = new Date(scheduledStartDate);
    const endDate = scheduledEndDate ? new Date(scheduledEndDate) : null;
    
    if (endDate && endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be before start date',
      });
    }
    
    // Update job
    await job.update({
      scheduledStartDate: startDate,
      scheduledEndDate: endDate,
      estimatedDuration,
      crewLead,
      crewMembers: Array.isArray(crewMembers) ? JSON.stringify(crewMembers) : crewMembers,
      specialInstructions,
      status: 'scheduled',
    });
    
    // Create audit log
    await createAuditLog({
      category: 'job',
      action: 'Job scheduled',
      userId,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        scheduledStartDate: startDate,
        scheduledEndDate: endDate,
        crewLead,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification to customer
    if (job.client?.email) {
      try {
        await emailService.sendJobScheduledEmail(job.client.email, {
          customerName: job.client.name,
          jobNumber: job.jobNumber,
          scheduledStartDate: startDate,
          scheduledEndDate: endDate,
          estimatedDuration,
        }, { tenantId });
      } catch (emailError) {
        console.error('Error sending schedule email:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Job scheduled successfully',
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        scheduledStartDate: job.scheduledStartDate,
        scheduledEndDate: job.scheduledEndDate,
      },
    });
    
  } catch (error) {
    console.error('Schedule job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Reschedule a job (Contractor)
 * PUT /api/jobs/:id/reschedule
 */
exports.rescheduleJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      scheduledStartDate,
      scheduledEndDate,
      reason,
    } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    
    const job = await Job.findOne({
      where: { id, tenantId },
      include: [{ model: Client, as: 'client' }],
    });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    if (!['scheduled', 'in_progress'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled or in-progress jobs can be rescheduled',
      });
    }
    
    const oldStartDate = job.scheduledStartDate;
    const newStartDate = new Date(scheduledStartDate);
    const newEndDate = scheduledEndDate ? new Date(scheduledEndDate) : job.scheduledEndDate;
    
    await job.update({
      scheduledStartDate: newStartDate,
      scheduledEndDate: newEndDate,
    });
    
    // Create audit log
    await createAuditLog({
      category: 'job',
      action: 'Job rescheduled',
      userId,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        oldStartDate,
        newStartDate,
        reason,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification to customer
    if (job.client?.email) {
      try {
        await emailService.sendJobRescheduledEmail(job.client.email, {
          customerName: job.client.name,
          jobNumber: job.jobNumber,
          oldStartDate,
          newStartDate,
          newEndDate,
          reason,
        }, { tenantId });
      } catch (emailError) {
        console.error('Error sending reschedule email:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Job rescheduled successfully',
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        scheduledStartDate: job.scheduledStartDate,
        scheduledEndDate: job.scheduledEndDate,
      },
    });
    
  } catch (error) {
    console.error('Reschedule job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update job status (Contractor)
 * PUT /api/jobs/:id/status
 */
exports.updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    
    const job = await Job.findOne({
      where: { id, tenantId },
      include: [{ model: Client, as: 'client' }],
    });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'on_hold', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job status',
        validStatuses,
      });
    }
    
    const oldStatus = job.status;
    
    await job.update({
      status,
      completionNotes: status === 'completed' ? notes : job.completionNotes,
    });
    
    // Create audit log
    await createAuditLog({
      category: 'job',
      action: `Job status changed to ${status}`,
      userId,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        oldStatus,
        newStatus: status,
        notes,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification to customer for important status changes
    if (job.client?.email && ['in_progress', 'completed', 'on_hold', 'cancelled'].includes(status)) {
      try {
        await emailService.sendJobStatusUpdateEmail(job.client.email, {
          customerName: job.client.name,
          jobNumber: job.jobNumber,
          oldStatus,
          newStatus: status,
          notes,
        });
      } catch (emailError) {
        console.error('Error sending status update email:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: `Job status updated to ${status}`,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
      },
    });
    
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark job as completed and request final payment (Contractor)
 * POST /api/jobs/:id/complete
 */
exports.completeJob = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      completionNotes,
      crewLeadSignature,
      finalInvoiceAmount,
      actualMaterialCost,
      actualLaborCost,
    } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    
    const job = await Job.findOne({
      where: { id, tenantId },
      include: [
        { model: Client, as: 'client' },
        { model: Quote, as: 'quote' }
      ],
      transaction,
    });
    
    if (!job) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    if (job.status === 'completed') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Job is already marked as completed',
      });
    }
    
    // Calculate remaining balance
    const total = parseFloat(job.total || 0);
    const depositPaid = parseFloat(job.depositAmount || 0);
    const balanceRemaining = total - depositPaid;
    
    // Update job status
    await job.update({
      status: 'completed',
      completionNotes,
      crewLeadSignature,
      balanceRemaining,
      finalPaymentStatus: balanceRemaining > 0 ? 'pending' : 'not_required',
    }, { transaction });
    
    // CRITICAL: Mark the associated Quote as complete for Job Analytics
    if (job.quote) {
      const invoiceAmount = finalInvoiceAmount || total;
      await job.quote.markJobComplete(
        invoiceAmount,
        actualMaterialCost || null,
        actualLaborCost || null
      );
      await job.quote.save({ transaction });
    }
    
    await transaction.commit();
    
    // Create audit log
    await createAuditLog({
      category: 'job',
      action: 'Job marked as completed',
      userId,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        balanceRemaining,
        finalInvoiceAmount: job.quote?.finalInvoiceAmount || null,
        canCalculateAnalytics: job.quote?.canCalculateAnalytics() || false,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send final payment request to customer if balance remaining
    if (balanceRemaining > 0 && job.client?.email) {
      try {
          await emailService.sendFinalPaymentRequestEmail(job.client.email, {
            customerName: job.client.name,
            jobNumber: job.jobNumber,
            total,
            depositPaid,
            balanceRemaining,
          }, { tenantId });
      } catch (emailError) {
        console.error('Error sending final payment email:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Job completed successfully',
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        balanceRemaining,
        finalPaymentRequired: balanceRemaining > 0,
        quote: job.quote ? {
          id: job.quote.id,
          jobCompletedAt: job.quote.jobCompletedAt,
          finalInvoiceAmount: job.quote.finalInvoiceAmount,
          canCalculateAnalytics: job.quote.canCalculateAnalytics(),
        } : null,
      },
    });
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Complete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create payment intent for final payment (Customer)
 * POST /api/customer-portal/jobs/:id/create-final-payment
 */
exports.createFinalPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const job = await Job.findOne({
      where: { id, tenantId, clientId },
    });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Job must be completed before final payment',
      });
    }
    
    if (job.finalPaymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Final payment has already been made',
      });
    }
    
    const balanceRemaining = parseFloat(job.balanceRemaining || 0);
    
    if (balanceRemaining <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No remaining balance to pay',
      });
    }
    
    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(balanceRemaining * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        clientId: clientId,
        tenantId: tenantId,
        paymentType: 'final',
      },
      description: `Final payment for ${job.jobNumber} - ${job.customerName}`,
    });
    
    res.json({
      success: true,
      payment: {
        clientSecret: paymentIntent.client_secret,
        amount: balanceRemaining,
        currency: 'usd',
      },
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        balanceRemaining,
      },
    });
    
  } catch (error) {
    console.error('Create final payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Confirm final payment (Customer)
 * POST /api/customer-portal/jobs/:id/confirm-final-payment
 */
exports.confirmFinalPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { paymentIntentId } = req.body;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const job = await Job.findOne({
      where: { id, tenantId, clientId },
      transaction,
    });
    
    if (!job) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment not completed',
        paymentStatus: paymentIntent.status,
      });
    }
    
    // Verify payment matches job
    if (paymentIntent.metadata.jobId != job.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment does not match this job',
      });
    }
    
    // Calculate numeric amounts safely
    const amountReceived = (parseFloat(paymentIntent.amount_received || paymentIntent.amount || 0) || 0) / 100;
    const newDepositAmount = parseFloat(job.depositAmount || 0) + amountReceived;

    // Update job: mark payment as paid and close job
    await job.update({
      finalPaymentStatus: 'paid',
      finalPaymentDate: new Date(),
      finalPaymentTransactionId: paymentIntentId,
      balanceRemaining: 0,
      depositAmount: newDepositAmount,
      status: 'closed',
      actualEndDate: new Date(),
    }, { transaction });
    
    await transaction.commit();
    
    // Create audit log for final payment
    await createAuditLog({
      category: 'job',
      action: 'Final payment completed',
      userId: null,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        clientId,
        amount: amountReceived,
        transactionId: paymentIntentId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Create audit log for job closed
    await createAuditLog({
      category: 'job',
      action: 'job_closed',
      userId: null,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send receipt and completion emails
    try {
      const User = require('../models/User');
      const contractor = await User.findOne({ 
        where: { tenantId, isActive: true },
      });
      
      // Send receipt to customer
      await emailService.sendPaymentReceiptEmail(req.customer.email, {
        customerName: req.customer.name,
        jobNumber: job.jobNumber,
        amount: amountReceived,
        paymentDate: new Date(),
        transactionId: paymentIntentId,
      }, { tenantId });
      
      // Notify contractor
      if (contractor?.email) {
        await emailService.sendFinalPaymentReceivedEmail(contractor.email, {
          jobNumber: job.jobNumber,
          customerName: req.customer.name,
          amount: amountReceived,
        });

        // Notify contractor that job is closed
        await emailService.sendJobStatusUpdateEmail(contractor.email, {
          customerName: req.customer.name,
          jobNumber: job.jobNumber,
          oldStatus: 'completed',
          newStatus: 'closed',
          notes: 'Final payment received and job closed'
        }, { tenantId });
      }

      // Notify customer that job is closed
      await emailService.sendJobStatusUpdateEmail(req.customer.email, {
        customerName: req.customer.name,
        jobNumber: job.jobNumber,
        oldStatus: 'completed',
        newStatus: 'closed',
        notes: 'Thank you for your payment. Your job is now closed.'
      }, { tenantId });
    } catch (emailError) {
      console.error('Error sending payment emails:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Payment completed successfully! Thank you for your business.',
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        finalPaymentStatus: job.finalPaymentStatus,
        finalPaymentDate: job.finalPaymentDate,
      },
    });
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Confirm final payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get job details for customer
 * GET /api/customer-portal/jobs/:id
 */
exports.getJobDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const job = await Job.findOne({
      where: { id, tenantId, clientId },
      include: [
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'gbbSelectedTier', 'productStrategy', 'productSets', 'areas', 'breakdown', 'flatRateItems', 'pricingSchemeId'],
          include: [{
            model: require('../models/PricingScheme'),
            as: 'pricingScheme',
            attributes: ['id', 'name', 'type']
          }]
        },
      ],
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Build areas array from quote.productSets (if present) to aid frontend progress UI
    let areas = [];
    try {
      const ps = job.quote && job.quote.productSets ? (typeof job.quote.productSets === 'string' ? JSON.parse(job.quote.productSets || '[]') : job.quote.productSets) : [];
      if (Array.isArray(ps)) {
        areas = ps.map(p => ({
          id: p.areaId || p.id,
          name: p.areaName || p.name || `Area ${p.areaId || p.id || ''}`,
          surfaceType: p.surfaceType,
          sqft: p.sqft || p.areaSqft || null,
          quantity: p.sqft || p.quantity || null,
          unit: 'sqft',
        }));
      }
    } catch (e) {
      areas = [];
    }

    // Map address: Job stores a combined jobAddress field
    const address = {
      street: job.jobAddress || job.job_address || null,
      city: null,
      state: null,
      zipCode: null,
    };

    res.json({
      success: true,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        jobTitle: job.jobName,
        status: job.status,
        scheduledStartDate: job.scheduledStartDate,
        scheduledEndDate: job.scheduledEndDate,
        estimatedDuration: job.estimatedDuration,
        // Provide both legacy 'total' and the explicit 'totalAmount' used elsewhere
        total: job.totalAmount,
        totalAmount: job.totalAmount,
        depositAmount: job.depositAmount,
        depositPaid: !!job.depositPaid,
        depositPaidAt: job.depositPaidAt || null,
        balanceRemaining: job.balanceRemaining,
        finalPaymentStatus: job.finalPaymentStatus,
        finalPaymentDate: job.finalPaymentDate || null,
        quote: {
          id: job.quote?.id,
          quoteNumber: job.quote?.quoteNumber,
          selectedTier: job.quote?.selectedTier,
          productStrategy: job.quote?.productStrategy,
          areas: job.quote?.areas || areas,
          productSets: job.quote?.productSets || null,
          breakdown: job.quote?.breakdown || null,
          flatRateItems: job.quote?.flatRateItems || null,
          pricingSchemeId: job.quote?.pricingSchemeId || null,
          pricingScheme: job.quote?.pricingScheme || null
        },
        address,
        areaProgress: job.areaProgress || {},
        customerSelectionsComplete: job.customerSelectionsComplete || false,
        customerSelectionsSubmittedAt: job.customerSelectionsSubmittedAt || null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get job details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = exports;

