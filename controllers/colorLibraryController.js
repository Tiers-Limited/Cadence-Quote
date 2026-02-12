const { Op } = require('sequelize');
const XLSX = require('xlsx');
const fs = require('fs').promises;
const ColorLibrary = require('../models/ColorLibrary');
const { createAuditLog } = require('./auditLogController');
// Cache deleted for optimization

// Helper to invalidate color cache for a tenant
// Cache invalidation removed for optimization
const invalidateColorCache = async (tenantId) => {
    // No-op
};

const colorLibraryController = {
    // Get colors by brand (case-insensitive match)
    // OPTIMIZED: Added in-memory caching (10 min TTL)
    getColorsByBrand: async (req, res) => {
        try {
            const { brand } = req.params;
            const tenantId = req.tenant.id;


            // Direct DB query - Cache removed for optimization
            const colors = await ColorLibrary.findAll({
                where: {
                    tenantId,
                    brand: { [Op.iLike]: `%${brand}%` }
                },
                order: [['name', 'ASC']]
            });
            const result = { success: true, data: colors };

            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Get colors by family/collection (case-insensitive)
    // OPTIMIZED: Added in-memory caching (10 min TTL)
    getColorsByFamily: async (req, res) => {
        try {
            const { family } = req.params;
            const tenantId = req.tenant.id;


            // Direct DB query - Cache removed for optimization
            const colors = await ColorLibrary.findAll({
                where: {
                    tenantId,
                    colorFamily: { [Op.iLike]: `%${family}%` }
                },
                order: [['name', 'ASC']]
            });
            const result = { success: true, data: colors };

            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Get all colors for tenant
    // OPTIMIZED: Added in-memory caching (10 min TTL)
    getAllColors: async (req, res) => {
        try {
            const tenantId = req.tenant.id;
            const result = { success: true, data: colors };

            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Get a single color
    getColor: async (req, res) => {
        try {
            const color = await ColorLibrary.findOne({
                where: {
                    id: req.params.id,
                    tenantId: req.tenant.id
                }
            });

            if (!color) {
                return res.status(404).json({ success: false, error: 'Color not found' });
            }

            res.json({ success: true, data: color });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Create a new color
    createColor: async (req, res) => {
        try {
            const color = await ColorLibrary.create({
                ...req.body,
                tenantId: req.tenant.id
            });

            // Audit log
            await createAuditLog({
                tenantId: req.tenant.id,
                userId: req.user?.id,
                action: 'Create Color',
                category: 'color',
                entityType: 'ColorLibrary',
                entityId: color.id,
                changes: { name: color.name, code: color.code, brand: color.brand },
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });

            // Invalidate color cache
            await invalidateColorCache(req.tenant.id);

            res.status(201).json({ success: true, data: color });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    },

    // Bulk create colors (expects array in body)
    createColorsBulk: async (req, res) => {
        try {
            const rows = Array.isArray(req.body) ? req.body : [];
            if (!rows.length) return res.status(400).json({ success: false, error: 'No data provided' });

            const toCreate = rows.map(r => ({
                name: r.name,
                code: r.code,
                brand: r.brand || null,
                colorFamily: r.colorFamily || null,
                hexValue: r.hexValue || null,
                locator: r.locator || null,
                red: r.red !== undefined && r.red !== null && r.red !== '' ? Number(r.red) : null,
                green: r.green !== undefined && r.green !== null && r.green !== '' ? Number(r.green) : null,
                blue: r.blue !== undefined && r.blue !== null && r.blue !== '' ? Number(r.blue) : null,
                isCustomMatch: !!r.isCustomMatch,
                notes: r.notes || null,
                tenantId: req.tenant.id
            }));

            const created = await ColorLibrary.bulkCreate(toCreate, { validate: true });

            // Audit log
            await createAuditLog({
                tenantId: req.tenant.id,
                userId: req.user?.id,
                action: 'Bulk Create Colors',
                category: 'color',
                entityType: 'ColorLibrary',
                changes: { count: created.length },
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });

            // Invalidate color cache
            await invalidateColorCache(req.tenant.id);

            res.status(201).json({ success: true, data: created });
        } catch (error) {
            console.error('Bulk create error', error);
            res.status(400).json({ success: false, error: error.message });
        }
    },

    // Update a color
    updateColor: async (req, res) => {
        try {
            const [updated] = await ColorLibrary.update(req.body, {
                where: {
                    id: req.params.id,
                    tenantId: req.tenant.id
                }
            });

            if (!updated) {
                return res.status(404).json({ success: false, error: 'Color not found' });
            }

            const color = await ColorLibrary.findOne({ where: { id: req.params.id, tenantId: req.tenant.id } });

            // Audit log
            await createAuditLog({
                tenantId: req.tenant.id,
                userId: req.user?.id,
                action: 'Update Color',
                category: 'color',
                entityType: 'ColorLibrary',
                entityId: color.id,
                changes: req.body,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });

            // Invalidate color cache
            await invalidateColorCache(req.tenant.id);

            res.json({ success: true, data: color });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    },

    // Delete a color
    deleteColor: async (req, res) => {
        try {
            const color = await ColorLibrary.findOne({ where: { id: req.params.id, tenantId: req.tenant.id } });

            const deleted = await ColorLibrary.destroy({
                where: {
                    id: req.params.id,
                    tenantId: req.tenant.id
                }
            });

            if (deleted && color) {
                // Audit log
                await createAuditLog({
                    tenantId: req.tenant.id,
                    userId: req.user?.id,
                    action: 'Delete Color',
                    category: 'color',
                    entityType: 'ColorLibrary',
                    entityId: color.id,
                    changes: { name: color.name, code: color.code },
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                });
            }

            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Color not found' });
            }

            // Invalidate color cache
            await invalidateColorCache(req.tenant.id);

            res.json({ success: true, message: 'Color deleted successfully' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Upload an Excel/CSV file (via multer) and import colors server-side
    uploadColorsFromFile: async (req, res) => {
        try {
            if (!req.file || !req.file.path) return res.status(400).json({ success: false, error: 'No file uploaded' });
            const filePath = req.file.path;

            // Read workbook
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            // Map headers to fields based on first row
            const headers = rawJson[0];
            const keyMap = {
                code: Object.keys(headers).find(k => headers[k] === 'COLOR #') || '__EMPTY',
                name: Object.keys(headers).find(k => headers[k] === 'COLOR NAME') || '__EMPTY_1',
                locator: Object.keys(headers).find(k => headers[k] === 'LOCATOR #') || '__EMPTY_2',
                red: Object.keys(headers).find(k => headers[k] === 'RED') || '__EMPTY_3',
                green: Object.keys(headers).find(k => headers[k] === 'GREEN') || '__EMPTY_4',
                blue: Object.keys(headers).find(k => headers[k] === 'BLUE') || '__EMPTY_5',
                hexValue: Object.keys(headers).find(k => headers[k] === 'HEX') || '__EMPTY_6',
                colorFamily: Object.keys(headers).find(k => headers[k] === 'COLOR') || '__EMPTY_7'
            };

            // Process data rows (skip header row)
            const mapped = rawJson.slice(1).map(row => {
                const hex = row[keyMap.hexValue]
                    ? (row[keyMap.hexValue].toString().trim().startsWith('#')
                        ? row[keyMap.hexValue].toString().trim()
                        : `#${row[keyMap.hexValue].toString().trim()}`)
                    : '';

                return {
                    code: row[keyMap.code] || '',
                    name: row[keyMap.name] || '',
                    locator: row[keyMap.locator] || '',
                    red: row[keyMap.red] !== undefined && row[keyMap.red] !== null && row[keyMap.red] !== ''
                        ? Number(row[keyMap.red])
                        : null,
                    green: row[keyMap.green] !== undefined && row[keyMap.green] !== null && row[keyMap.green] !== ''
                        ? Number(row[keyMap.green])
                        : null,
                    blue: row[keyMap.blue] !== undefined && row[keyMap.blue] !== null && row[keyMap.blue] !== ''
                        ? Number(row[keyMap.blue])
                        : null,
                    hexValue: hex,
                    colorFamily: row[keyMap.colorFamily] || '',
                    brand: '', // Not present in provided headers
                    isCustomMatch: false, // Not present in provided headers
                    tenantId: req.tenant.id
                };
            });

            // Persist to database
            const created = await ColorLibrary.bulkCreate(mapped, { validate: true });

            // Remove temp file
            try { await fs.unlink(filePath); } catch (e) { console.warn('Failed to delete temp file', filePath, e.message); }

            // Invalidate color cache
            await invalidateColorCache(req.tenant.id);

            res.status(201).json({ success: true, data: created });
        } catch (error) {
            console.error('Upload/import error', error);
            // Attempt to clean uploaded file if present
            if (req.file && req.file.path) {
                try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
            }
            res.status(400).json({ success: false, error: error.message });
        }
    }
};

module.exports = colorLibraryController;