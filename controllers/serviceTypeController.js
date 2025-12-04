// controllers/serviceTypeController.js
// Controller for service types management

const ServiceType = require('../models/ServiceType');
const { createAuditLog } = require('./auditLogController');
const { Op } = require('sequelize');

/**
 * Get all service types
 * GET /api/service-types
 */
exports.getAllServiceTypes = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { serviceType, search } = req.query;

    const where = { tenantId, isActive: true };

    if (serviceType) {
      where.serviceType = serviceType;
    }

    if (search) {
      where[Op.or] = [
        { displayName: { [Op.iLike]: `%${search}%` } },
        { subType: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const serviceTypes = await ServiceType.findAll({
      where,
      order: [
        ['displayOrder', 'ASC'],
        ['displayName', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: serviceTypes
    });
  } catch (error) {
    console.error('Get service types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service types',
      error: error.message
    });
  }
};

/**
 * Get service type by ID
 * GET /api/service-types/:id
 */
exports.getServiceTypeById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const serviceType = await ServiceType.findOne({
      where: { id, tenantId }
    });

    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found'
      });
    }

    res.json({
      success: true,
      data: serviceType
    });
  } catch (error) {
    console.error('Get service type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service type',
      error: error.message
    });
  }
};

/**
 * Create service type
 * POST /api/service-types
 */
exports.createServiceType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const {
      serviceType,
      subType,
      displayName,
      laborRateType,
      laborRate,
      prepRequirements,
      prepIncluded,
      prepAddOnCost,
      durationEstimate,
      crewSizeDefault,
      productivityRate,
      description,
      displayOrder
    } = req.body;

    // Validation
    if (!serviceType || !subType || !displayName || !laborRateType || laborRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Service type, subType, displayName, laborRateType, and laborRate are required'
      });
    }

    const newServiceType = await ServiceType.create({
      tenantId,
      serviceType,
      subType,
      displayName,
      laborRateType,
      laborRate,
      prepRequirements,
      prepIncluded: prepIncluded !== undefined ? prepIncluded : true,
      prepAddOnCost,
      durationEstimate,
      crewSizeDefault: crewSizeDefault || 2,
      productivityRate,
      description,
      displayOrder,
      isActive: true
    });

    await createAuditLog({
      category: 'settings',
      action: 'Service type created',
      userId,
      tenantId,
      entityType: 'ServiceType',
      entityId: newServiceType.id,
      metadata: { displayName },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      message: 'Service type created successfully',
      data: newServiceType
    });
  } catch (error) {
    console.error('Create service type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service type',
      error: error.message
    });
  }
};

/**
 * Update service type
 * PUT /api/service-types/:id
 */
exports.updateServiceType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    const serviceType = await ServiceType.findOne({
      where: { id, tenantId }
    });

    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found'
      });
    }

    await serviceType.update(updateData);

    await createAuditLog({
      category: 'settings',
      action: 'Service type updated',
      userId,
      tenantId,
      entityType: 'ServiceType',
      entityId: serviceType.id,
      metadata: { displayName: serviceType.displayName },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Service type updated successfully',
      data: serviceType
    });
  } catch (error) {
    console.error('Update service type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service type',
      error: error.message
    });
  }
};

/**
 * Delete service type (soft delete)
 * DELETE /api/service-types/:id
 */
exports.deleteServiceType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { id } = req.params;

    const serviceType = await ServiceType.findOne({
      where: { id, tenantId }
    });

    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found'
      });
    }

    await serviceType.update({ isActive: false });

    await createAuditLog({
      category: 'settings',
      action: 'Service type deleted',
      userId,
      tenantId,
      entityType: 'ServiceType',
      entityId: serviceType.id,
      metadata: { displayName: serviceType.displayName },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Service type deleted successfully'
    });
  } catch (error) {
    console.error('Delete service type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service type',
      error: error.message
    });
  }
};

/**
 * Initialize default service types for tenant
 * POST /api/service-types/initialize-defaults
 */
exports.initializeDefaults = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const defaultServiceTypes = [
      // Interior Painting
      {
        serviceType: 'interior_painting',
        subType: 'Walls',
        displayName: 'Interior Walls',
        laborRateType: 'per_sqft',
        laborRate: 0.85,
        prepRequirements: 'Sanding, priming, drop cloths',
        prepIncluded: true,
        durationEstimate: '2-4 days for 500 sq ft',
        crewSizeDefault: 2,
        productivityRate: 250,
        displayOrder: 1
      },
      {
        serviceType: 'interior_painting',
        subType: 'Ceilings',
        displayName: 'Interior Ceilings',
        laborRateType: 'per_sqft',
        laborRate: 0.95,
        prepRequirements: 'Drop cloths, sanding',
        prepIncluded: true,
        durationEstimate: '1-2 days for 500 sq ft',
        crewSizeDefault: 2,
        productivityRate: 200,
        displayOrder: 2
      },
      {
        serviceType: 'interior_painting',
        subType: 'Trim/Baseboards',
        displayName: 'Trim & Baseboards',
        laborRateType: 'per_sqft',
        laborRate: 1.25,
        prepRequirements: 'Caulking, sanding, masking',
        prepIncluded: true,
        durationEstimate: '2-3 days for 500 sq ft',
        crewSizeDefault: 2,
        productivityRate: 150,
        displayOrder: 3
      },
      {
        serviceType: 'interior_painting',
        subType: 'Doors/Cabinets',
        displayName: 'Doors & Cabinets',
        laborRateType: 'per_unit',
        laborRate: 45,
        prepRequirements: 'Hardware removal, degreasing, sanding',
        prepIncluded: true,
        durationEstimate: '3-5 days for 10 cabinets',
        crewSizeDefault: 1,
        displayOrder: 4
      },
      // Exterior Painting
      {
        serviceType: 'exterior_painting',
        subType: 'Siding',
        displayName: 'Exterior Siding',
        laborRateType: 'per_sqft',
        laborRate: 1.50,
        prepRequirements: 'Power washing, caulking, scraping',
        prepIncluded: true,
        prepAddOnCost: 0.50,
        durationEstimate: '3-5 days for 1000 sq ft',
        crewSizeDefault: 3,
        productivityRate: 200,
        displayOrder: 5
      },
      {
        serviceType: 'exterior_painting',
        subType: 'Trim',
        displayName: 'Exterior Trim',
        laborRateType: 'per_sqft',
        laborRate: 1.75,
        prepRequirements: 'Scraping, caulking, sanding',
        prepIncluded: true,
        durationEstimate: '2-3 days',
        crewSizeDefault: 2,
        productivityRate: 150,
        displayOrder: 6
      },
      // Specialty Services
      {
        serviceType: 'specialty_services',
        subType: 'Epoxy Flooring',
        displayName: 'Epoxy Flooring',
        laborRateType: 'per_sqft',
        laborRate: 3.50,
        prepRequirements: 'Surface testing, ventilation setup',
        prepIncluded: true,
        durationEstimate: '1-3 days for 500 sq ft',
        crewSizeDefault: 2,
        productivityRate: 300,
        displayOrder: 7
      },
      // Prep & Finishing
      {
        serviceType: 'prep_finishing',
        subType: 'Priming Only',
        displayName: 'Priming Only',
        laborRateType: 'per_sqft',
        laborRate: 0.40,
        prepRequirements: 'Dust control, masking',
        prepIncluded: true,
        durationEstimate: '1 day for 500 sq ft',
        crewSizeDefault: 2,
        productivityRate: 350,
        displayOrder: 8
      }
    ];

    const created = [];
    for (const serviceData of defaultServiceTypes) {
      const existing = await ServiceType.findOne({
        where: {
          tenantId,
          serviceType: serviceData.serviceType,
          subType: serviceData.subType
        }
      });

      if (!existing) {
        const service = await ServiceType.create({
          tenantId,
          ...serviceData,
          isActive: true
        });
        created.push(service);
      }
    }

    await createAuditLog({
      category: 'settings',
      action: 'Default service types initialized',
      userId,
      tenantId,
      entityType: 'ServiceType',
      metadata: { count: created.length },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `Initialized ${created.length} default service types`,
      data: created
    });
  } catch (error) {
    console.error('Initialize defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize default service types',
      error: error.message
    });
  }
};

module.exports = exports;
