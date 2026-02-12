// controllers/laborCategoryController.js
const LaborCategory = require('../models/LaborCategory');
const LaborRate = require('../models/LaborRate');
const { createAuditLog } = require('./auditLogController');
// CacheManager removed for optimization

/**
 * Get all labor categories (global predefined list)
 * GET /api/v1/labor-categories
 * Query params: jobType (optional) - 'interior' or 'exterior'
 */
/**
 * Get all labor categories (global predefined list)
 * GET /api/v1/labor-categories
 * Query params: jobType (optional) - 'interior' or 'exterior'
 */
exports.getAllCategories = async (req, res) => {
    try {
        const { jobType } = req.query;

        // Direct DB query - Cache removed for optimization
        // Build where clause
        const where = { isActive: true };
        if (jobType) {
            where.categoryType = jobType;
        }

        console.time('DB Query: getAllCategories');
        const categories = await LaborCategory.findAll({
            where,
            attributes: ['id', 'categoryName', 'categoryType', 'measurementUnit', 'displayOrder', 'description'],
            order: [['displayOrder', 'ASC'], ['categoryName', 'ASC']],
            raw: true
        });
        console.timeEnd('DB Query: getAllCategories');

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Get labor categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch labor categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Initialize default labor categories (system use only)
 * POST /api/v1/labor-categories/initialize
 */
exports.initializeCategories = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;

        const defaultCategories = [
            // Interior Categories (1-7)
            {
                categoryName: 'Walls',
                categoryType: 'interior',
                measurementUnit: 'sqft',
                displayOrder: 1,
                description: 'Standard interior wall painting surface, calculated per square foot.'
            },
            {
                categoryName: 'Ceilings',
                categoryType: 'interior',
                measurementUnit: 'sqft',
                displayOrder: 2,
                description: 'Overhead painting surface, calculated per square foot.'
            },
            {
                categoryName: 'Trim',
                categoryType: 'interior',
                measurementUnit: 'linear_foot',
                displayOrder: 3,
                description: 'Baseboards, casings, and misc trim, calculated per linear foot.'
            },
            {
                categoryName: 'Doors',
                categoryType: 'interior',
                measurementUnit: 'unit',
                displayOrder: 4,
                description: 'Interior door painting (both sides), calculated per unit.'
            },
            {
                categoryName: 'Cabinets',
                categoryType: 'interior',
                measurementUnit: 'unit',
                displayOrder: 5,
                description: 'Cabinet doors, drawers, and frames, calculated per unit.'
            },
            {
                categoryName: 'Drywall Repair',
                categoryType: 'interior',
                measurementUnit: 'hour',
                displayOrder: 6,
                description: 'Patching, sanding, and repairs, calculated per hour.'
            },
            {
                categoryName: 'Accent Walls',
                categoryType: 'interior',
                measurementUnit: 'sqft',
                displayOrder: 7,
                description: 'Feature walls requiring separate pricing, per square foot.'
            },

            // Exterior Categories (8-14)
            {
                categoryName: 'Exterior Walls',
                categoryType: 'exterior',
                measurementUnit: 'sqft',
                displayOrder: 8,
                description: 'Siding, stucco, or paneling surfaces, calculated per square foot.'
            },
            {
                categoryName: 'Exterior Trim',
                categoryType: 'exterior',
                measurementUnit: 'linear_foot',
                displayOrder: 9,
                description: 'Exterior trim boards, fascia boards, and detail work, per linear foot.'
            },
            {
                categoryName: 'Exterior Doors',
                categoryType: 'exterior',
                measurementUnit: 'unit',
                displayOrder: 10,
                description: 'Front and exterior door painting, per unit.'
            },
            {
                categoryName: 'Shutters',
                categoryType: 'exterior',
                measurementUnit: 'unit',
                displayOrder: 11,
                description: 'Exterior shutters removed and painted, per unit.'
            },
            {
                categoryName: 'Decks & Railings',
                categoryType: 'exterior',
                measurementUnit: 'sqft',
                displayOrder: 12,
                description: 'Deck surfaces and handrails, per square foot.'
            },
            {
                categoryName: 'Soffit & Fascia',
                categoryType: 'exterior',
                measurementUnit: 'linear_foot',
                displayOrder: 13,
                description: 'Overhangs and fascia surfaces requiring prep and paint, per linear foot.'
            },
            {
                categoryName: 'Prep Work',
                categoryType: 'exterior',
                measurementUnit: 'hour',
                displayOrder: 14,
                description: 'Scraping, sanding, caulking, and other prep tasks, per hour.'
            }
        ];

        // Bulk create or update
        for (const category of defaultCategories) {
            await LaborCategory.findOrCreate({
                where: { categoryName: category.categoryName },
                defaults: category
            });
        }

        await createAuditLog({
            category: 'system',
            action: 'Labor categories initialized',
            userId,
            tenantId,
            entityType: 'LaborCategory',
            details: `Initialized ${defaultCategories.length} labor categories`
        });

        res.json({
            success: true,
            message: 'Labor categories initialized successfully',
            count: defaultCategories.length
        });
    } catch (error) {
        console.error('Initialize categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get contractor's labor rates for all categories
 * GET /api/v1/labor-rates
 */
exports.getLaborRates = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { jobType } = req.query; // Get jobType from query params

        // Direct DB query - Cache removed for optimization
        const categoryWhere = { isActive: true };
        if (jobType) {
            categoryWhere.categoryType = jobType;
        }

        console.time('DB Query: getLaborRates');
        const rates = await LaborRate.findAll({
            where: { tenantId, isActive: true },
            attributes: ['id', 'rate', 'laborCategoryId', 'tenantId'],
            include: [{
                model: LaborCategory,
                as: 'category',
                where: categoryWhere,
                attributes: ['id', 'categoryName', 'categoryType', 'measurementUnit', 'displayOrder', 'description']
            }],
            order: [[{ model: LaborCategory, as: 'category' }, 'displayOrder', 'ASC']],
            raw: true,
            nest: true
        });
        console.timeEnd('DB Query: getLaborRates');

        res.json({
            success: true,
            data: rates
        });
    } catch (error) {
        console.error('Get labor rates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch labor rates',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update or create labor rate for a category
 * PUT /api/v1/labor-rates/:categoryId
 */
exports.updateLaborRate = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;
        const { categoryId } = req.params;
        const { rate } = req.body;

        if (rate === undefined || rate === null) {
            return res.status(400).json({
                success: false,
                message: 'Rate is required'
            });
        }

        // Verify category exists
        const category = await LaborCategory.findByPk(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Labor category not found'
            });
        }

        // Update or create labor rate
        const [laborRate, created] = await LaborRate.findOrCreate({
            where: { tenantId, laborCategoryId: categoryId },
            defaults: { rate, isActive: true }
        });

        if (!created) {
            await laborRate.update({ rate });
        }

        // Cache invalidation removed for optimization
        // await cache.invalidateByTags(['labor-rates', `tenant:${tenantId}`]);

        await createAuditLog({
            category: 'system',
            action: created ? 'Labor rate created' : 'Labor rate updated',
            userId,
            tenantId,
            entityType: 'LaborRate',
            entityId: laborRate.id,
            details: `${category.categoryName}: $${rate}/${category.measurementUnit}`
        });

        // Fetch updated rate with category
        const updatedRate = await LaborRate.findByPk(laborRate.id, {
            include: [{ model: LaborCategory, as: 'category' }]
        });

        res.json({
            success: true,
            data: updatedRate,
            message: 'Labor rate updated successfully'
        });
    } catch (error) {
        console.error('Update labor rate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update labor rate',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Bulk update labor rates
 * POST /api/v1/labor-rates/bulk
 */
exports.bulkUpdateRates = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;
        const { rates } = req.body; // Array of { categoryId, rate }

        if (!Array.isArray(rates)) {
            return res.status(400).json({
                success: false,
                message: 'Rates must be an array'
            });
        }

        // Prepare data for bulk upsert
        const upsertData = rates.map(({ categoryId, rate }) => ({
            tenantId,
            laborCategoryId: categoryId,
            rate,
            isActive: true
        }));

        // Perform bulk create with update on duplicate
        // Note: 'updateOnDuplicate' is a MySQL/MariaDB specific option in some Sequelize versions,
        // but works for Postgres if configured correctly or using upsert. 
        // For universal compatibility, we can use bulkCreate with updateOnDuplicate if the dialect supports it.
        // Assuming Postgres/MySQL here.

        await LaborRate.bulkCreate(upsertData, {
            updateOnDuplicate: ['rate', 'updatedAt']
        });

        // Cache invalidation removed for optimization
        // await cache.invalidateByTags(['labor-rates', `tenant:${tenantId}`]);

        await createAuditLog({
            category: 'system',
            action: 'Bulk labor rates update',
            userId,
            tenantId,
            entityType: 'LaborRate',
            details: `Updated ${rates.length} labor rates`
        });

        res.json({
            success: true,
            message: 'Labor rates updated successfully',
            data: { count: rates.length }
        });
    } catch (error) {
        console.error('Bulk update rates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update labor rates',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = exports;
