// controllers/settingsController.js
const ContractorSettings = require('../models/ContractorSettings');
const Tenant = require('../models/Tenant');
const Quote = require('../models/Quote');
const { createAuditLog } = require('./auditLogController');




/**
 * Get contractor settings
 * GET /api/settings
 */
const getSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        let settings = await ContractorSettings.findOne({
            where: { tenantId },
            include: [{
                model: Tenant,
                attributes: ['id', 'companyName', 'email', 'phoneNumber', 'businessAddress', 'tradeType', 'companyLogoUrl', 'defaultEmailMessage']
            }]
        });

        // If no settings exist, create default settings
        if (!settings) {
            settings = await ContractorSettings.create({
                tenantId,
                defaultMarkupPercentage: 30.00,
                taxRatePercentage: 8.25,
                depositPercentage: 50.00,
                paymentTerms: '- 50% deposit required to begin work\n- Remaining balance due upon completion\n- Net 30 payment terms for approved commercial accounts',
                warrantyTerms: '- 2-year warranty on all interior work\n- 5-year warranty on exterior work\n- Warranty covers peeling, cracking, and fading under normal conditions',
                generalTerms: '- All work performed by licensed and insured contractors\n- Customer responsible for moving furniture and personal items\n- Weather delays may affect exterior project timelines',
                businessHours: 'Monday-Friday: 8:00 AM - 6:00 PM',
                quoteValidityDays: 30
            });

            // Reload with tenant info
            settings = await ContractorSettings.findOne({
                where: { tenantId },
                include: [{
                    model: Tenant,
                    attributes: ['id', 'companyName', 'email', 'phoneNumber', 'businessAddress', 'tradeType', 'companyLogoUrl', 'defaultEmailMessage']
                }]
            });
        }

        // Add default values for fields that might not exist in DB yet
        const responseData = settings.toJSON();
        if (!responseData.overheadPercentage) {
            responseData.overheadPercentage = 10.00;
        }
        if (!responseData.profitMarginPercentage) {
            responseData.profitMarginPercentage = 35.00;
        }
        if (!responseData.portalDurationDays) {
            responseData.portalDurationDays = 14;
        }
        if (responseData.portalAutoLock === undefined || responseData.portalAutoLock === null) {
            responseData.portalAutoLock = true;
        }

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve settings'
        });
    }
};

/**
 * Update company information
 * PUT /api/settings/company
 */
// const updateCompanyInfo = async (req, res) => {
//   try {
//     const tenantId = req.user.tenantId;
//     const {
//       companyName,
//       email,
//       phoneNumber,
//       businessAddress,
//       tradeType
//     } = req.body;

//     const tenant = await Tenant.findByPk(tenantId);
//     if (!tenant) {
//       return res.status(404).json({
//         success: false,
//         message: 'Tenant not found'
//       });
//     }

//     await tenant.update({
//       companyName: companyName || tenant.companyName,
//       email: email || tenant.email,
//       phoneNumber: phoneNumber || tenant.phoneNumber,
//       businessAddress: businessAddress !== undefined ? businessAddress : tenant.businessAddress,
//       tradeType: tradeType || tenant.tradeType
//     });

//     res.json({
//       success: true,
//       message: 'Company information updated successfully',
//       data: tenant
//     });
//   } catch (error) {
//     console.error('Update company info error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update company information'
//     });
//   }
// };

/**
 * Update contractor settings
 * PUT /api/settings
 */
const updateSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const {
            defaultMarkupPercentage,
            taxRatePercentage,
            depositPercentage,
            paymentTerms,
            warrantyTerms,
            generalTerms,
            businessHours,
            quoteValidityDays,
            portalDurationDays,
            portalAutoLock,
            portalLinkExpiryDays,
            portalLinkMaxExpiryDays,
            portalAutoCleanup,
            portalAutoCleanupDays,
            portalRequireOTPForMultiJob,
            defaultEmailMessage,
            // Pricing Engine fields
            laborMarkupPercent,
            materialMarkupPercent,
            overheadPercent,
            netProfitPercent,
            defaultBillableLaborRate,
            // Production rates
            productionRates,
            // Flat rate unit prices
            flatRateUnitPrices,
            // Billable labor rates
            billableLaborRates,
            // Turnkey rates
            turnkeyInteriorRate,
            turnkeyExteriorRate,
            // Proposal template settings
            selectedProposalTemplate,
            proposalTemplateSettings
        } = req.body;

        // Validate pricing engine percentages
        const validatePercentage = (value, fieldName, min = 0, max = 100) => {
            if (value !== undefined && value !== null) {
                const num = parseFloat(value);
                if (isNaN(num) || num < min || num > max) {
                    throw new Error(`${fieldName} must be a number between ${min} and ${max}`);
                }
            }
        };

        // Validate markup and percentage fields
        validatePercentage(laborMarkupPercent, 'Labor markup percentage');
        validatePercentage(materialMarkupPercent, 'Material markup percentage');
        validatePercentage(overheadPercent, 'Overhead percentage');
        validatePercentage(netProfitPercent, 'Net profit percentage');
        validatePercentage(taxRatePercentage, 'Tax rate percentage');
        validatePercentage(depositPercentage, 'Deposit percentage');

        // Validate rates
        if (defaultBillableLaborRate !== undefined && (isNaN(parseFloat(defaultBillableLaborRate)) || parseFloat(defaultBillableLaborRate) < 0)) {
            throw new Error('Default billable labor rate must be a positive number');
        }
        if (turnkeyInteriorRate !== undefined && (isNaN(parseFloat(turnkeyInteriorRate)) || parseFloat(turnkeyInteriorRate) < 0)) {
            throw new Error('Turnkey interior rate must be a positive number');
        }
        if (turnkeyExteriorRate !== undefined && (isNaN(parseFloat(turnkeyExteriorRate)) || parseFloat(turnkeyExteriorRate) < 0)) {
            throw new Error('Turnkey exterior rate must be a positive number');
        }

        // Validate proposal template settings
        if (selectedProposalTemplate !== undefined) {
            const validTemplates = ['classic-professional', 'modern-minimal', 'detailed-comprehensive', 'simple-budget'];
            if (!validTemplates.includes(selectedProposalTemplate)) {
                console.warn(`Invalid template ID: ${selectedProposalTemplate}, will use default`);
            }
        }

        if (proposalTemplateSettings !== undefined) {
            if (proposalTemplateSettings.colorScheme) {
                const validColors = ['blue', 'green', 'orange', 'purple', 'gray'];
                if (!validColors.includes(proposalTemplateSettings.colorScheme)) {
                    console.warn(`Invalid color scheme: ${proposalTemplateSettings.colorScheme}, will use default`);
                }
            }
        }

        let settings = await ContractorSettings.findOne({
            where: { tenantId }
        });

        if (!settings) {
            // Create if doesn't exist
            settings = await ContractorSettings.create({
                tenantId,
                defaultMarkupPercentage: defaultMarkupPercentage || 30.00,
                taxRatePercentage: taxRatePercentage || 8.25,
                depositPercentage: depositPercentage || 50.00,
                paymentTerms,
                warrantyTerms,
                generalTerms,
                businessHours,
                quoteValidityDays: quoteValidityDays || 30,
                // Pricing Engine fields
                laborMarkupPercent: laborMarkupPercent || 0.00,
                materialMarkupPercent: materialMarkupPercent || 0.00,
                overheadPercent: overheadPercent || 0.00,
                netProfitPercent: netProfitPercent || 0.00,
                defaultBillableLaborRate: defaultBillableLaborRate || 0.00,
                // Production rates
                productionRates: productionRates || {},
                // Flat rate unit prices
                flatRateUnitPrices: flatRateUnitPrices || {},
                // Billable labor rates
                billableLaborRates: billableLaborRates || { 1: 50.00, 2: 50.00, 3: 50.00 },
                // Turnkey rates
                turnkeyInteriorRate: turnkeyInteriorRate || 0.00,
                turnkeyExteriorRate: turnkeyExteriorRate || 0.00,
                // Proposal template settings
                selectedProposalTemplate: selectedProposalTemplate || 'professional',
                proposalTemplateSettings: proposalTemplateSettings || {
                    showCompanyLogo: true,
                    showAreaBreakdown: true,
                    showProductDetails: true,
                    showWarrantySection: true,
                    colorScheme: 'blue'
                }
            });
        } else {
            // Prepare update data
            const updateData = {
                defaultMarkupPercentage: defaultMarkupPercentage !== undefined ? defaultMarkupPercentage : settings.defaultMarkupPercentage,
                taxRatePercentage: taxRatePercentage !== undefined ? taxRatePercentage : settings.taxRatePercentage,
                depositPercentage: depositPercentage !== undefined ? depositPercentage : settings.depositPercentage,
                paymentTerms: paymentTerms !== undefined ? paymentTerms : settings.paymentTerms,
                warrantyTerms: warrantyTerms !== undefined ? warrantyTerms : settings.warrantyTerms,
                generalTerms: generalTerms !== undefined ? generalTerms : settings.generalTerms,
                businessHours: businessHours !== undefined ? businessHours : settings.businessHours,
                quoteValidityDays: quoteValidityDays !== undefined ? quoteValidityDays : settings.quoteValidityDays,
                portalDurationDays: portalDurationDays !== undefined ? portalDurationDays : settings.portalDurationDays,
                portalAutoLock: portalAutoLock !== undefined ? portalAutoLock : settings.portalAutoLock,
                portalLinkExpiryDays: portalLinkExpiryDays !== undefined ? portalLinkExpiryDays : settings.portalLinkExpiryDays,
                portalLinkMaxExpiryDays: portalLinkMaxExpiryDays !== undefined ? portalLinkMaxExpiryDays : settings.portalLinkMaxExpiryDays,
                portalAutoCleanup: portalAutoCleanup !== undefined ? portalAutoCleanup : settings.portalAutoCleanup,
                portalAutoCleanupDays: portalAutoCleanupDays !== undefined ? portalAutoCleanupDays : settings.portalAutoCleanupDays,
                portalRequireOTPForMultiJob: portalRequireOTPForMultiJob !== undefined ? portalRequireOTPForMultiJob : settings.portalRequireOTPForMultiJob
            };

            // Add pricing engine fields if provided
            if (laborMarkupPercent !== undefined) updateData.laborMarkupPercent = laborMarkupPercent;
            if (materialMarkupPercent !== undefined) updateData.materialMarkupPercent = materialMarkupPercent;
            if (overheadPercent !== undefined) updateData.overheadPercent = overheadPercent;
            if (netProfitPercent !== undefined) updateData.netProfitPercent = netProfitPercent;
            if (defaultBillableLaborRate !== undefined) updateData.defaultBillableLaborRate = defaultBillableLaborRate;

            // Add production rates if provided
            if (productionRates !== undefined) updateData.productionRates = productionRates;

            // Add flat rate unit prices if provided
            if (flatRateUnitPrices !== undefined) updateData.flatRateUnitPrices = flatRateUnitPrices;

            // Add billable labor rates if provided
            if (billableLaborRates !== undefined) updateData.billableLaborRates = billableLaborRates;

            // Add turnkey rates if provided
            if (turnkeyInteriorRate !== undefined) updateData.turnkeyInteriorRate = turnkeyInteriorRate;
            if (turnkeyExteriorRate !== undefined) updateData.turnkeyExteriorRate = turnkeyExteriorRate;

            // Add proposal template settings if provided
            if (selectedProposalTemplate !== undefined) updateData.selectedProposalTemplate = selectedProposalTemplate;
            if (proposalTemplateSettings !== undefined) updateData.proposalTemplateSettings = proposalTemplateSettings;

            // Update existing
            await settings.update(updateData);
        }

        // Update email message in tenant if provided
        if (defaultEmailMessage) {
            const tenant = await Tenant.findByPk(tenantId);
            if (tenant) {
                await tenant.update({
                    defaultEmailMessage: defaultEmailMessage
                });
            }
        }

        // Check if pricing-related fields were updated to trigger quote recalculation
        const pricingFieldsUpdated = [
            laborMarkupPercent,
            materialMarkupPercent,
            overheadPercent,
            netProfitPercent,
            defaultBillableLaborRate,
            turnkeyInteriorRate,
            turnkeyExteriorRate,
            productionRates,
            flatRateUnitPrices,
            billableLaborRates
        ].some(field => field !== undefined);

        // If pricing fields were updated, trigger recalculation for draft quotes
        if (pricingFieldsUpdated) {
            try {
                await triggerQuoteRecalculation(tenantId);
            } catch (recalcError) {
                console.error('Quote recalculation error:', recalcError);
                // Don't fail the settings update if recalculation fails
            }
        }

        // Invalidate settings cache so next read gets fresh data
        await invalidateSettingsCache(tenantId);

        // Audit log
        await createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'Update Settings',
            category: 'system',
            entityType: 'ContractorSettings',
            entityId: settings.id,
            changes: req.body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
};

/**
 * Update company info
 * PUT /api/settings/company
 */
const updateCompanyInfo = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const {
            companyName,
            email,
            phoneNumber,
            businessAddress,
            tradeType,
            companyLogoUrl
        } = req.body;

        const tenant = await Tenant.findByPk(tenantId);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const changes = {};
        if (companyName && companyName !== tenant.companyName) changes.companyName = { old: tenant.companyName, new: companyName };
        if (email && email !== tenant.email) changes.email = { old: tenant.email, new: email };
        if (phoneNumber && phoneNumber !== tenant.phoneNumber) changes.phoneNumber = { old: tenant.phoneNumber, new: phoneNumber };
        if (companyLogoUrl && companyLogoUrl !== tenant.companyLogoUrl) changes.companyLogoUrl = { old: tenant.companyLogoUrl, new: companyLogoUrl };

        await tenant.update({
            companyName: companyName || tenant.companyName,
            email: email || tenant.email,
            phoneNumber: phoneNumber || tenant.phoneNumber,
            businessAddress: businessAddress !== undefined ? businessAddress : tenant.businessAddress,
            tradeType: tradeType || tenant.tradeType,
            companyLogoUrl: companyLogoUrl !== undefined ? companyLogoUrl : tenant.companyLogoUrl
        });

        // Invalidate settings cache (company info is included in settings response)
        await invalidateSettingsCache(tenantId);

        // Audit log
        await createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'Update Company Info',
            category: 'tenant',
            entityType: 'Tenant',
            entityId: tenant.id,
            changes,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Company information updated successfully',
            data: tenant
        });
    } catch (error) {
        console.error('Update company info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company information'
        });
    }
};

/**
 * Trigger recalculation for draft quotes when markup rules change
 * @param {number} tenantId - The tenant ID
 */
async function triggerQuoteRecalculation(tenantId) {
    try {
        // Find all draft quotes for this tenant
        const draftQuotes = await Quote.findAll({
            where: {
                tenantId,
                status: 'draft'
            },
            attributes: ['id', 'quoteNumber', 'pricingSchemeId', 'areas', 'productSets', 'homeSqft', 'jobScope']
        });

        if (draftQuotes.length === 0) {
            console.log(`No draft quotes found for tenant ${tenantId} - skipping recalculation`);
            return;
        }

        console.log(`Triggering recalculation for ${draftQuotes.length} draft quotes for tenant ${tenantId}`);

        // Import the pricing calculation function
        const { calculatePricing, applyMarkupsAndTax } = require('../utils/pricingCalculator');
        const PricingScheme = require('../models/PricingScheme');

        // Get updated contractor settings
        const settings = await ContractorSettings.findOne({
            where: { tenantId }
        });

        if (!settings) {
            console.warn(`No contractor settings found for tenant ${tenantId}`);
            return;
        }

        // Recalculate each draft quote
        for (const quote of draftQuotes) {
            try {
                // Skip quotes without sufficient data
                if (!quote.pricingSchemeId || (!quote.areas && !quote.homeSqft)) {
                    continue;
                }

                // Get pricing scheme
                const pricingScheme = await PricingScheme.findByPk(quote.pricingSchemeId);
                if (!pricingScheme) {
                    continue;
                }

                // Prepare calculation parameters similar to calculateQuotePricing function
                const schemeType = pricingScheme.type;
                const rules = pricingScheme.pricingRules || {};

                // Map legacy types to new types
                const modelMap = {
                    'sqft_turnkey': 'turnkey',
                    'sqft_labor_paint': 'rate_based_sqft',
                    'hourly_time_materials': 'production_based',
                    'unit_pricing': 'flat_rate_unit',
                    'room_flat_rate': 'flat_rate_unit',
                };

                const model = modelMap[schemeType] || schemeType;

                // Merge rules with settings
                const mergedRules = {
                    ...rules,
                    // Turnkey rates from contractor settings
                    interiorRate: settings.turnkeyInteriorRate || 3.50,
                    exteriorRate: settings.turnkeyExteriorRate || 3.50,

                    // Production rates from contractor settings
                    productionRates: settings.productionRates || {},
                    billableLaborRate: settings.defaultBillableLaborRate || 50,

                    // Flat rate unit prices from contractor settings
                    unitPrices: settings.flatRateUnitPrices || {},
                };

                // Transform areas data if available
                const transformedAreas = (quote.areas || []).map(area => {
                    const items = area.laborItems || area.items || [];
                    const selectedItems = items.filter(item => item.selected);

                    return {
                        name: area.name || 'Unnamed Area',
                        items: selectedItems.map(item => ({
                            categoryName: item.categoryName,
                            quantity: parseFloat(item.quantity) || 0,
                            measurementUnit: item.measurementUnit || 'sqft',
                            laborRate: parseFloat(item.laborRate) || 0,
                            numberOfCoats: parseInt(item.numberOfCoats) || 2,
                        }))
                    };
                }).filter(area => area.items.length > 0);

                // Calculate base pricing
                const params = {
                    model,
                    rules: mergedRules,
                    areas: transformedAreas,
                    homeSqft: quote.homeSqft || 0,
                    jobScope: quote.jobScope || 'interior',
                };

                const basePricing = calculatePricing(params);

                // Apply markups, overhead, profit, and tax with updated settings
                const finalPricing = applyMarkupsAndTax(basePricing, {
                    laborMarkupPercent: parseFloat(settings.laborMarkupPercent) || 0,
                    materialMarkupPercent: parseFloat(settings.materialMarkupPercent) || 0,
                    overheadPercent: parseFloat(settings.overheadPercent) || 0,
                    profitMarginPercent: parseFloat(settings.netProfitPercent) || 0,
                    taxRatePercentage: parseFloat(settings.taxRatePercentage) || 0,
                    depositPercent: parseFloat(settings.depositPercentage) || 0,
                });

                // Update quote with recalculated pricing
                await quote.update({
                    subtotal: finalPricing.subtotal,
                    laborTotal: finalPricing.laborTotal,
                    materialTotal: finalPricing.materialTotal,
                    laborMarkupPercent: finalPricing.laborMarkupPercent || 0,
                    laborMarkupAmount: finalPricing.laborMarkupAmount || 0,
                    materialMarkupPercent: finalPricing.materialMarkupPercent || 0,
                    materialMarkupAmount: finalPricing.materialMarkupAmount || 0,
                    overheadPercent: finalPricing.overheadPercent || 0,
                    overheadAmount: finalPricing.overhead || 0,
                    profitMarginPercent: finalPricing.profitMarginPercent || 0,
                    profitAmount: finalPricing.profitAmount || 0,
                    markup: finalPricing.markupAmount,
                    markupPercent: finalPricing.markupPercent,
                    tax: finalPricing.tax,
                    taxPercent: finalPricing.taxPercent,
                    total: finalPricing.total,
                    totalSqft: finalPricing.totalSqft,
                    breakdown: finalPricing.breakdown,
                    lastModified: new Date(),
                    autoSaveVersion: (quote.autoSaveVersion || 0) + 1
                });

                console.log(`Recalculated quote ${quote.quoteNumber} - New total: $${finalPricing.total}`);
            } catch (quoteError) {
                console.error(`Error recalculating quote ${quote.quoteNumber}:`, quoteError);
                // Continue with other quotes
            }
        }

        console.log(`Completed recalculation for tenant ${tenantId}`);
    } catch (error) {
        console.error('Error in triggerQuoteRecalculation:', error);
        throw error;
    }
}

/**
 * Get available proposal templates
 * GET /api/settings/templates
 */
const getAvailableTemplates = async (req, res) => {
    try {
        const templateService = require('../services/templateService');
        const templates = templateService.getAvailableTemplates();

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve templates'
        });
    }
};

/**
 * Save contractor's template preference
 * POST /api/settings/template
 */
const saveTemplatePreference = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { templateId } = req.body;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                message: 'Template ID is required'
            });
        }

        // Validate template ID
        const validTemplates = ['classic-professional', 'modern-minimal', 'detailed-comprehensive', 'simple-budget'];
        if (!validTemplates.includes(templateId)) {
            console.warn(`Invalid template ID: ${templateId}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID. Must be one of: classic-professional, modern-minimal, detailed-comprehensive, simple-budget'
            });
        }

        const templateService = require('../services/templateService');
        const result = await templateService.saveContractorTemplate(tenantId, templateId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || 'Failed to save template preference'
            });
        }

        // Audit log
        await createAuditLog({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            action: 'Update Template Preference',
            category: 'settings',
            entityType: 'ContractorSettings',
            entityId: tenantId,
            changes: { templateId },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        // Invalidate settings cache (template preference is part of settings)
        await invalidateSettingsCache(tenantId);

        res.json({
            success: true,
            message: 'Template preference saved successfully'
        });
    } catch (error) {
        console.error('Save template preference error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to save template preference'
        });
    }
};

/**
 * Generate template preview HTML
 * POST /api/settings/template/preview
 */
const generateTemplatePreview = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { templateId, colorScheme } = req.body;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                message: 'Template ID is required'
            });
        }

        // Validate template ID
        const validTemplates = ['classic-professional', 'modern-minimal', 'detailed-comprehensive', 'simple-budget'];
        if (!validTemplates.includes(templateId)) {
            console.warn(`Invalid template ID for preview: ${templateId}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID'
            });
        }

        // Validate color scheme
        if (colorScheme) {
            const validColors = ['blue', 'green', 'orange', 'purple', 'gray'];
            if (!validColors.includes(colorScheme)) {
                console.warn(`Invalid color scheme for preview: ${colorScheme}`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid color scheme'
                });
            }
        }

        // Get contractor settings for company info
        const settings = await ContractorSettings.findOne({
            where: { tenantId },
            include: [{
                model: Tenant,
                attributes: ['companyName', 'email', 'phoneNumber', 'businessAddress', 'companyLogoUrl']
            }]
        });

        // Import template service
        const { generatePreviewData, renderProposalHtml } = require('../services/proposalTemplate');

        // Generate preview data with contractor's company info
        const contractorInfo = settings?.Tenant ? {
            company: {
                name: settings.Tenant.companyName,
                phone: settings.Tenant.phoneNumber,
                email: settings.Tenant.email,
                addressLine1: settings.Tenant.businessAddress,
                addressLine2: '',
                logoUrl: settings.Tenant.companyLogoUrl
            }
        } : {};

        const previewData = generatePreviewData(contractorInfo);

        // Render template with preview data
        const html = renderProposalHtml(previewData, {
            templateId: templateId || 'classic-professional',
            colorScheme: colorScheme || 'blue'
        });

        res.json({
            success: true,
            data: {
                html,
                templateId,
                colorScheme
            }
        });
    } catch (error) {
        console.error('Generate template preview error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to generate template preview'
        });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    updateCompanyInfo,
    getAvailableTemplates,
    saveTemplatePreference,
    generateTemplatePreview
};
