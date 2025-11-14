// controllers/leadFormController.js
const LeadForm = require('../models/LeadForm');
const Lead = require('../models/Lead');
const crypto = require('crypto');
const zipCodePricingService = require('../services/zipCodePricingService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { createAuditLog } = require('./auditLogController');

/**
 * Get all leads for a tenant
 * GET /api/leads
 */
const getLeads = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    const leads = await Lead.findAll({
      where: { tenantId },
      order: [['createdAt', 'DESC']],
      include: [{
        model: LeadForm,
        attributes: ['formTitle']
      }]
    });

    res.json({
      success: true,
      data: leads
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
        attributes: ['formTitle', 'formFields']
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
 * Update lead status or information
 * PUT /api/leads/:id
 */
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const updates = req.body;

    const lead = await Lead.findOne({
      where: { id, tenantId }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    await lead.update(updates);

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
 * Submit lead through form
 * POST /api/leads/:formId/submit
 */
const submitLead = async (req, res) => {
  try {
    const { formId } = req.params;
    const { name, email, phone, address, projectType, message, formData } = req.body;
    const tenantId = req.user.tenantId;

    // Validate form exists and belongs to tenant
    const form = await LeadForm.findOne({
      where: { id: formId, tenantId, isActive: true }
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Lead form not found or inactive'
      });
    }

    // Create lead
    const lead = await Lead.create({
      tenantId,
      formId,
      name,
      email,
      phone,
      address: address || null,
      projectType: projectType || null,
      message: message || null,
      formData,
      status: 'new',
      source: 'internal'
    });

    // Increment submission count
    await form.increment('submissionCount');

    res.status(201).json({
      success: true,
      message: 'Lead submitted successfully',
      data: {
        id: lead.id
      }
    });
  } catch (error) {
    console.error('Submit lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit lead. Please try again.'
    });
  }
};

/**
 * Submit lead through public form URL
 * POST /api/public/lead-forms/:publicUrl/submit
 */
const submitPublicLead = async (req, res) => {
  try {
    const { publicUrl } = req.params;
    const { name, email, phone, address, projectType, message, formData, photoUrls } = req.body;

    // Find form by public URL
    const form = await LeadForm.findOne({
      where: { publicUrl, isActive: true }
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Lead form not found or inactive'
      });
    }

    // Extract enhanced fields from formData
    const {
      firstName,
      lastName,
      zipCode,
      homeSize,
      roomCount,
      projectDetails,
      preferredContactMethod,
      bestTimeToContact,
      timeline,
      paintPreference,
      referralSource,
      agreedToTerms,
      utmSource,
      utmMedium,
      utmCampaign
    } = formData || {};

    // Calculate ballpark quote using AI pricing service
    let ballparkQuote = null;
    let pricingBreakdown = null;
    
    if (form.enableZipCodePricing && zipCode) {
      try {
        pricingBreakdown = zipCodePricingService.getPricingBreakdown({
          zipCode,
          homeSize,
          roomCount,
          projectType: projectType || 'interior'
        });
        ballparkQuote = pricingBreakdown.quote;
      } catch (pricingError) {
        console.error('Pricing calculation error:', pricingError);
        // Continue without ballpark quote
      }
    }

    // Create lead with all enhanced fields
    const lead = await Lead.create({
      tenantId: form.tenantId,
      leadFormId: form.id,
      // Basic fields (legacy compatibility)
      fullName: firstName && lastName ? `${firstName} ${lastName}` : name || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown',
      firstName,
      lastName,
      email,
      phone,
      address: address || null,
      projectType: projectType || null,
      message: message || null,
      // Enhanced fields
      zipCode,
      homeSize,
      roomCount,
      projectDetails,
      photoUrls,
      preferredContactMethod,
      bestTimeToContact,
      timeline,
      paintPreference,
      referralSource,
      agreedToTerms: agreedToTerms || false,
      ballparkQuote,
      // UTM tracking
      utmSource,
      utmMedium,
      utmCampaign,
      // Metadata
      formData,
      status: 'new',
      source: 'public'
    });

    // Increment submission count
    await form.increment('submissionCount');

    // Send email notifications (async, don't block response)
    if (form.sendConfirmationEmail && email) {
      emailService.sendLeadConfirmation({
        to: email,
        leadName: `${firstName || name}`,
        data: {
          ballparkQuote,
          quoteRange: pricingBreakdown?.range,
          companyName: process.env.APP_NAME || 'Our Team'
        }
      }).catch(err => console.error('Failed to send confirmation email:', err));

      // Send SMS confirmation if phone provided and preferredContactMethod includes text
      if (phone && preferredContactMethod === 'text') {
        smsService.sendLeadConfirmation({
          to: phone,
          leadName: firstName || name,
          ballparkQuote,
          quoteRange: pricingBreakdown?.range
        }).catch(err => console.error('Failed to send confirmation SMS:', err));
      }
    }

    if (form.sendInternalNotification && form.notificationEmails) {
      const recipients = Array.isArray(form.notificationEmails) 
        ? form.notificationEmails 
        : form.notificationEmails.split(',').map(e => e.trim());
      
      // Send email notification
      emailService.sendInternalNotification({
        to: recipients,
        lead,
        form
      }).catch(err => console.error('Failed to send internal notification:', err));

      // Send SMS notification to team if phone numbers configured
      if (process.env.TEAM_PHONE_NUMBERS) {
        const teamPhones = process.env.TEAM_PHONE_NUMBERS.split(',').map(p => p.trim());
        smsService.sendInternalNotification({
          to: teamPhones,
          lead
        }).catch(err => console.error('Failed to send internal SMS:', err));
      }
    }

    // Prepare response with ballpark quote
    const response = {
      success: true,
      message: form.thankYouMessage || 'Thank you! Your submission has been received. We will contact you soon.',
      data: {
        id: lead.id
      }
    };

    // Include ballpark quote in response if available
    if (ballparkQuote && pricingBreakdown) {
      response.data.ballparkQuote = ballparkQuote;
      response.data.quoteRange = pricingBreakdown.range;
      response.data.quoteMessage = pricingBreakdown.message;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Submit public lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit form. Please try again.'
    });
  }
};

/**
 * Get all lead forms for a tenant
 * GET /api/lead-forms
 */
const getLeadForms = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { isActive } = req.query;

    const where = { tenantId };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const forms = await LeadForm.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: forms
    });
  } catch (error) {
    console.error('Get lead forms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead forms'
    });
  }
};

/**
 * Get single lead form by ID
 * GET /api/lead-forms/:id
 */
const getLeadFormById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const form = await LeadForm.findOne({
      where: { id, tenantId }
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Lead form not found'
      });
    }

    res.json({
      success: true,
      data: form
    });
  } catch (error) {
    console.error('Get lead form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead form'
    });
  }
};

/**
 * Get lead form by public URL (public endpoint)
 * GET /api/public/lead-forms/:publicUrl
 */
const getPublicLeadForm = async (req, res) => {
  try {
    const { publicUrl } = req.params;

    const form = await LeadForm.findOne({
      where: { publicUrl, isActive: true },
      attributes: ['id', 'formTitle', 'formDescription', 'formFields', 'tenantId']
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Lead form not found or inactive'
      });
    }

    res.json({
      success: true,
      data: form
    });
  } catch (error) {
    console.error('Get public lead form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead form'
    });
  }
};

/**
 * Create new lead form
 * POST /api/lead-forms
 */
const createLeadForm = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      formName,
      formTitle,
      formDescription,
      formFields
    } = req.body;

    // Validation
    if (!formName || !formTitle) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['formName', 'formTitle']
      });
    }

    // Generate unique public URL
    const urlSlug = formName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    
    const randomString = crypto.randomBytes(4).toString('hex');
    const publicUrl = `${urlSlug}-${randomString}`;

    // Default form fields if not provided
    const defaultFields = [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'projectType', label: 'Project Type', type: 'select', options: ['Interior Painting', 'Exterior Painting', 'Both Interior & Exterior', 'Commercial', 'Other'], required: true },
      { name: 'message', label: 'Project Details', type: 'textarea', required: false }
    ];

    const form = await LeadForm.create({
      tenantId,
      formName,
      formTitle,
      formDescription,
      publicUrl,
      formFields: formFields || defaultFields,
      isActive: true,
      submissionCount: 0
    });

    // Audit log
    await createAuditLog({
      tenantId,
      userId: req.user?.id,
      action: 'Create Lead Form',
      category: 'system',
      entityType: 'LeadForm',
      entityId: form.id,
      changes: { formName, formTitle, publicUrl },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Lead form created successfully',
      data: form
    });
  } catch (error) {
    console.error('Create lead form error:', error);
    
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create lead form'
    });
  }
};

/**
 * Update lead form
 * PUT /api/lead-forms/:id
 */
const updateLeadForm = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const {
      formName,
      formTitle,
      formDescription,
      formFields,
      isActive
    } = req.body;

    const form = await LeadForm.findOne({
      where: { id, tenantId }
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Lead form not found'
      });
    }

    // Update form
    const changes = {};
    if (formName && formName !== form.formName) changes.formName = { old: form.formName, new: formName };
    if (formTitle && formTitle !== form.formTitle) changes.formTitle = { old: form.formTitle, new: formTitle };
    if (isActive !== undefined && isActive !== form.isActive) changes.isActive = { old: form.isActive, new: isActive };

    await form.update({
      formName: formName || form.formName,
      formTitle: formTitle || form.formTitle,
      formDescription: formDescription !== undefined ? formDescription : form.formDescription,
      formFields: formFields || form.formFields,
      isActive: isActive !== undefined ? isActive : form.isActive
    });

    // Audit log
    await createAuditLog({
      tenantId,
      userId: req.user?.id,
      action: 'Update Lead Form',
      category: 'system',
      entityType: 'LeadForm',
      entityId: form.id,
      changes,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Lead form updated successfully',
      data: form
    });
  } catch (error) {
    console.error('Update lead form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead form'
    });
  }
};

// Removed duplicate declarations of createLeadForm and updateLeadForm

/**
 * Delete lead form
 * DELETE /api/lead-forms/:id
 */
const deleteLeadForm = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const form = await LeadForm.findOne({
      where: { id, tenantId }
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Lead form not found'
      });
    }

    await form.destroy();

    // Audit log
    await createAuditLog({
      tenantId,
      userId: req.user?.id,
      action: 'Delete Lead Form',
      category: 'system',
      entityType: 'LeadForm',
      entityId: form.id,
      changes: { formName: form.formName, formTitle: form.formTitle },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Lead form deleted successfully'
    });
  } catch (error) {
    console.error('Delete lead form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead form'
    });
  }
};

// Removed redundant submitLeadForm function as we have submitPublicLead

module.exports = {
  getLeadForms,
  getLeadFormById,
  getPublicLeadForm,
  createLeadForm,
  updateLeadForm,
  deleteLeadForm,
  getLeads,
  getLeadById,
  submitLead,
  updateLead,
  deleteLead,
  submitPublicLead
};
