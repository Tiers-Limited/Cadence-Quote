// controllers/pricingSchemeController.js
const PricingScheme = require('../models/PricingScheme');
const { createAuditLog } = require('./auditLogController');
const bcrypt = require('bcryptjs');
// Cache removed



/**
 * Get all pricing schemes for a tenant
 * GET /api/pricing-schemes
 * OPTIMIZED: Removed caching (user request), kept field selection and raw queries
 */
const getPricingSchemes = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { isActive } = req.query;

        // Build where clause with tenant filtering
        const where = { tenantId };

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        console.time('DB Query: getPricingSchemes');
        const schemes = await PricingScheme.findAll({
            where,
            attributes: ['id', 'name', 'type', 'description', 'isDefault', 'isActive', 'isPinProtected', 'protectionMethod', 'pricingRules', 'createdAt', 'updatedAt'],
            order: [['isDefault', 'DESC'], ['name', 'ASC']],
            raw: true
        });
        console.timeEnd('DB Query: getPricingSchemes');

        return res.json({
            success: true,
            data: schemes
        });
    } catch (error) {
        console.error('Get pricing schemes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve pricing schemes'
        });
    }
};

/**
 * Get single pricing scheme by ID
 * GET /api/pricing-schemes/:id
 * OPTIMIZED: Removed caching, added raw query
 */
const getPricingSchemeById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const scheme = await PricingScheme.findOne({
            where: { id, tenantId },
            raw: true
        });

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Pricing scheme not found'
            });
        }

        return res.json({
            success: true,
            data: scheme
        });
    } catch (error) {
        console.error('Get pricing scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve pricing scheme'
        });
    }
};



/**
 * Create new pricing scheme
 * POST /api/pricing-schemes
 */
const createPricingScheme = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const {
            name,
            type,
            description,
            isDefault,
            pricingRules,
            isPinProtected,
            protectionPin,
            protectionMethod
        } = req.body;

        // Validation
        if (!name || !type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['name', 'type']
            });
        }

        // Validate pricing model type
        const validTypes = [
            'turnkey', 'rate_based_sqft', 'production_based', 'flat_rate_unit',
            // Legacy support
            'sqft_turnkey', 'sqft_labor_paint', 'hourly_time_materials', 'unit_pricing', 'room_flat_rate'
        ];

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid pricing type. Must be one of: ${validTypes.filter(t => !t.includes('_')).join(', ')}`
            });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await PricingScheme.update(
                { isDefault: false },
                { where: { tenantId, isDefault: true } }
            );
        }

        // Set default rules if not provided
        const defaultRules = {
            includeMaterials: true,
            coverage: 350,
            applicationMethod: 'roll',
            coats: 2,
            costPerGallon: 40,
            ...(pricingRules || {}),
        };

        // Hash PIN if provided
        let hashedPin = null;
        if (isPinProtected && protectionPin && protectionMethod === 'pin') {
            hashedPin = await bcrypt.hash(protectionPin, 10);
        }

        const scheme = await PricingScheme.create({
            tenantId,
            name,
            type,
            description,
            isDefault: isDefault || false,
            isActive: true,
            pricingRules: defaultRules,
            isPinProtected: isPinProtected || false,
            protectionPin: hashedPin,
            protectionMethod: isPinProtected ? protectionMethod : null
        });



        // Audit log
        await createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'Create Pricing Scheme',
            category: 'pricing',
            entityType: 'PricingScheme',
            entityId: scheme.id,
            changes: { name, type, isDefault },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.status(201).json({
            success: true,
            message: 'Pricing scheme created successfully',
            data: scheme
        });
    } catch (error) {
        console.error('Create pricing scheme error:', error);

        if (error.name === 'SequelizeValidationError') {
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
            message: 'Failed to create pricing scheme'
        });
    }
};

/**
 * Update pricing scheme
 * PUT /api/pricing-schemes/:id
 */
const updatePricingScheme = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const {
            name,
            type,
            description,
            isDefault,
            isActive,
            pricingRules,
            isPinProtected,
            protectionPin,
            protectionMethod
        } = req.body;

        // Get verification PIN from header for security
        let verificationPin = req.headers['x-verification-pin'];

        // Debug logging
        console.log('Verification PIN type:', typeof verificationPin);
        console.log('Verification PIN value:', verificationPin);

        const scheme = await PricingScheme.findOne({
            where: { id, tenantId }
        });

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Pricing scheme not found'
            });
        }

        // Check protection based on method
        if (scheme.isPinProtected) {
            if (scheme.protectionMethod === 'pin') {
                if (!verificationPin) {
                    return res.status(403).json({
                        success: false,
                        message: 'PIN verification required',
                        requiresPin: true,
                        protectionMethod: 'pin'
                    });
                }

                // Ensure verificationPin is a string and not an object
                if (typeof verificationPin === 'object') {
                    console.error('Verification PIN is an object:', verificationPin);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid PIN format'
                    });
                }

                const pinToVerify = String(verificationPin).trim();
                const isPinValid = await bcrypt.compare(pinToVerify, scheme.protectionPin);
                if (!isPinValid) {
                    return res.status(403).json({
                        success: false,
                        message: 'Invalid PIN',
                        requiresPin: true,
                        protectionMethod: 'pin'
                    });
                }
            } else if (scheme.protectionMethod === '2fa') {
                // TODO: Implement 2FA verification
                // For now, we'll allow the update but log it
                console.log('2FA verification required - not yet implemented');
            }
        }

        // If setting as default, unset other defaults
        if (isDefault && !scheme.isDefault) {
            await PricingScheme.update(
                { isDefault: false },
                { where: { tenantId, isDefault: true } }
            );
        }

        // Update scheme
        const changes = {};
        if (name && name !== scheme.name) changes.name = { old: scheme.name, new: name };
        if (isDefault !== undefined && isDefault !== scheme.isDefault) changes.isDefault = { old: scheme.isDefault, new: isDefault };
        if (isActive !== undefined && isActive !== scheme.isActive) changes.isActive = { old: scheme.isActive, new: isActive };

        // Hash new PIN if provided
        let hashedPin = scheme.protectionPin;
        if (isPinProtected && protectionPin && protectionMethod === 'pin') {
            hashedPin = await bcrypt.hash(protectionPin, 10);
        } else if (isPinProtected === false) {
            hashedPin = null;
        }

        // Determine protection method
        let finalProtectionMethod = scheme.protectionMethod;
        if (isPinProtected !== undefined) {
            finalProtectionMethod = isPinProtected ? protectionMethod : null;
        }

        await scheme.update({
            name: name || scheme.name,
            type: type || scheme.type,
            description: description ?? scheme.description,
            isDefault: isDefault ?? scheme.isDefault,
            isActive: isActive ?? scheme.isActive,
            pricingRules: pricingRules ?? scheme.pricingRules,
            isPinProtected: isPinProtected ?? scheme.isPinProtected,
            protectionPin: hashedPin,
            protectionMethod: finalProtectionMethod
        });



        // Audit log
        await createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'Update Pricing Scheme',
            category: 'pricing',
            entityType: 'PricingScheme',
            entityId: scheme.id,
            changes,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Pricing scheme updated successfully',
            data: scheme
        });
    } catch (error) {
        console.error('Update pricing scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update pricing scheme'
        });
    }
};

/**
 * Delete pricing scheme
 * DELETE /api/pricing-schemes/:id
 */
const deletePricingScheme = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const scheme = await PricingScheme.findOne({
            where: { id, tenantId }
        });

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Pricing scheme not found'
            });
        }

        // Don't allow deleting the default scheme
        if (scheme.isDefault) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete the default pricing scheme. Set another scheme as default first.'
            });
        }

        await scheme.destroy();



        // Audit log
        await createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'Delete Pricing Scheme',
            category: 'pricing',
            entityType: 'PricingScheme',
            entityId: scheme.id,
            changes: { name: scheme.name, type: scheme.type },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Pricing scheme deleted successfully'
        });
    } catch (error) {
        console.error('Delete pricing scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete pricing scheme'
        });
    }
};

/**
 * Set pricing scheme as default
 * PUT /api/pricing-schemes/:id/set-default
 */
const setDefaultScheme = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const scheme = await PricingScheme.findOne({
            where: { id, tenantId }
        });

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Pricing scheme not found'
            });
        }

        // Unset all other defaults
        await PricingScheme.update(
            { isDefault: false },
            { where: { tenantId, isDefault: true } }
        );

        // Set this as default
        await scheme.update({ isDefault: true });



        // Audit log
        await createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'Set Default Pricing Scheme',
            category: 'pricing',
            entityType: 'PricingScheme',
            entityId: scheme.id,
            changes: { name: scheme.name, isDefault: true },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Default pricing scheme updated',
            data: scheme
        });
    } catch (error) {
        console.error('Set default scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set default scheme'
        });
    }
};

module.exports = {
    getPricingSchemes,
    getPricingSchemeById,
    createPricingScheme,
    updatePricingScheme,
    deletePricingScheme,
    setDefaultScheme
};
