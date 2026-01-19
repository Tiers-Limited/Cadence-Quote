// controllers/customerSelectionsController.js
// Handles customer product/color/sheen selections

const Quote = require('../models/Quote');
const Job = require('../models/Job');
const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');
const { createAuditLog } = require('./auditLogController');
const emailService = require('../services/emailService');
const workOrderService = require('../services/workOrderService');
const sequelize = require('../config/database');

/**
 * Get selection options for a quote
 * GET /api/customer-portal/proposals/:id/selection-options
 */
exports.getSelectionOptions = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
    });
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }
    
    // Check if portal is open
    if (!quote.portalOpen) {
      return res.status(403).json({
        success: false,
        message: 'Selection portal is not yet open. Please complete deposit payment first.',
        code: 'PORTAL_CLOSED',
      });
    }
    
    // Check if portal has expired
    if (quote.portalExpiresAt && new Date(quote.portalExpiresAt) < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Selection portal has expired. Please contact contractor.',
        code: 'PORTAL_EXPIRED',
      });
    }
    
    // Check if selections are locked
    if (quote.selectionsComplete && quote.selectionsLockedAt) {
      return res.status(403).json({
        success: false,
        message: 'Selections are already submitted and locked.',
        code: 'SELECTIONS_LOCKED',
      });
    }
    
    // Parse productSets to get available options
    let productSets = quote.productSets;
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
    
    // Get selected tier for GBB
    const selectedTier = quote.selectedTier || 'good';
    
    // Build selection options by extracting product IDs and batch-loading product configs
    const options = [];

    // Collect productIds first (minimize DB round-trips)
    const productIdSet = new Set();
    for (const productSet of productSets) {
      const products = productSet.products || {};
      let productId = null;
      if (quote.productStrategy === 'GBB') {
        productId = products[selectedTier];
      } else {
        productId = products.single || products.good || products.better || products.best;
      }
      if (productId) productIdSet.add(productId);
    }

    const productIds = Array.from(productIdSet);

    // Bulk fetch all referenced ProductConfig records with their GlobalProduct -> Brand
    let productConfigsMap = new Map();
    if (productIds.length > 0) {
      const productConfigs = await ProductConfig.findAll({
        where: { id: productIds },
        include: [
          {
            model: GlobalProduct,
            as: 'globalProduct',
            include: [{ model: Brand, as: 'brand' }],
          },
        ],
      });
      productConfigs.forEach(pc => productConfigsMap.set(pc.id, pc));
    }

    for (const productSet of productSets) {
      const areaId = productSet.areaId;
      const areaName = productSet.areaName;
      const surfaceType = productSet.surfaceType;
      const products = productSet.products || {};

      let productId = null;
      if (quote.productStrategy === 'GBB') {
        productId = products[selectedTier];
      } else {
        productId = products.single || products.good || products.better || products.best;
      }

      if (!productId) {
        console.warn(`No product found for ${surfaceType} in area ${areaName}`);
        continue;
      }

      const productConfig = productConfigsMap.get(productId);
      if (!productConfig || !productConfig.globalProduct) {
        console.warn(`Product ${productId} not found (bulk fetch)`);
        continue;
      }

      const product = productConfig.globalProduct;
      const brand = product.brand;

      // Normalize sheens to an array of sheen names for frontend's Select component
      const sheenOptions = (productConfig.sheens || []).map(s => (typeof s === 'string' ? s : s.sheen));

      options.push({
        areaId,
        areaName,
        surfaceType,
        product: {
          id: productConfig.id,
          name: product.name,
          brand: brand?.name || 'Unknown',
          brandId: brand?.id || null,
          fullName: `${brand?.name || ''} ${product.name}`.trim(),
        },
        // Colors will be fetched by the frontend via /customer-portal/colors?brandId=xxx
        availableSheens: sheenOptions,
      });
    }
    
    // Get existing selections if any
    const CustomerSelection = require('../models/CustomerSelection');
    const existingSelections = await CustomerSelection.findAll({
      where: { quoteId: quote.id },
    });
    
    // Merge existing selections (match both areaId && surfaceType, or fallback to areaName + surfaceType)
    const selections = options.map(option => {
      const existing = existingSelections.find(s => {
        const matchByIdAndSurface = s.areaId && option.areaId && String(s.areaId) === String(option.areaId) && s.surfaceType === option.surfaceType;
        const sAreaName = (s.areaName || '').trim().toLowerCase();
        const oAreaName = (option.areaName || '').trim().toLowerCase();
        const matchByNameAndSurface = sAreaName && oAreaName && s.surfaceType === option.surfaceType && sAreaName === oAreaName;
        return matchByIdAndSurface || matchByNameAndSurface;
      });

      return {
        ...option,
        selectedColor: existing?.colorName || null,
        selectedColorId: existing?.colorId || null,
        selectedColorHex: existing?.colorHex || null,
        selectedSheen: existing?.sheen || null,
        customerNotes: existing?.customerNotes || null,
      };
    });
    
    // Calculate days remaining (null if not set)
    let daysRemaining = null;
    if (quote.portalExpiresAt) {
      const expiresAt = new Date(quote.portalExpiresAt);
      const now = new Date();
      if (!isNaN(expiresAt.getTime())) {
        daysRemaining = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
      }
    }

    res.json({
      success: true,
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        selectedTier,
        portalOpen: quote.portalOpen,
        portalExpiresAt: quote.portalExpiresAt,
        daysRemaining,
        selectionsComplete: quote.selectionsComplete || false,
      },
      selections,
      totalAreas: selections.length,
      completedAreas: selections.filter(s => s.selectedColor && s.selectedSheen).length,
    });
    
  } catch (error) {
    console.error('Get selection options error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve selection options',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Save customer selections (partial or complete)
 * POST /api/customer-portal/proposals/:id/selections
 */
exports.saveSelections = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { selections } = req.body; // Array of { areaId, surfaceType, color, sheen, notes }
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
      transaction,
    });
    
    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    // Selected tier used for GBB product strategy
    const selectedTier = quote.selectedTier || 'good';
    
    // Validate portal status
    if (!quote.portalOpen) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Selection portal is not open',
      });
    }
    
    if (quote.portalExpiresAt && new Date(quote.portalExpiresAt) < new Date()) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Selection portal has expired',
      });
    }
    
    if (quote.selectionsComplete && quote.selectionsLockedAt) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Selections are already locked',
      });
    }
    
    // Validate selections array
    if (!Array.isArray(selections) || selections.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Selections array is required',
      });
    }
    
    // Save or update each selection (use an in-memory lookup for deterministic matching)
    const CustomerSelection = require('../models/CustomerSelection');
    // Load existing selections for this quote (transactionally) to avoid DB matching pitfalls
    let existingSelections = await CustomerSelection.findAll({ where: { quoteId: quote.id }, transaction });
    const savedRecords = [];

    for (const selection of selections) {
      const { areaId, areaName, surfaceType, color, sheen, notes } = selection;

      if (!surfaceType || (!areaId && !areaName)) {
        continue; // Skip invalid entries
      }

      // Resolve areaName if missing (try productSets or quote.areas)
      let resolvedAreaName = areaName || null;
      if (!resolvedAreaName && areaId) {
        try {
          const ps = Array.isArray(quote.productSets) ? quote.productSets : (typeof quote.productSets === 'string' ? JSON.parse(quote.productSets || '[]') : []);
          const found = ps.find(p => String(p.areaId) === String(areaId) || String(p.id) === String(areaId));
          if (found) resolvedAreaName = found.areaName || found.name || null;
        } catch (e) {
          // ignore parse errors
        }
      }

      // Last-resort fallback to ensure NOT NULL constraint
      if (!resolvedAreaName) {
        resolvedAreaName = areaId ? `Area ${areaId}` : 'Unknown Area';
        console.warn(`Resolved missing areaName for selection: using fallback "${resolvedAreaName}" (quote ${quote.id})`);
      }

      // Normalize areaName and surfaceType for matching
      const normalizedAreaName = String(resolvedAreaName).trim();
      const normalizedSurface = String(surfaceType).trim().toLowerCase();

      // Normalize color input: accept {id,name,code,hexValue} or id or name
      let colorId = null;
      let colorName = null;
      let colorNumber = null;
      let colorHex = null;

      if (color && typeof color === 'object') {
        colorId = color.id || null;
        colorName = color.name || null;
        colorNumber = color.code || color.number || null;
        colorHex = color.hexValue || color.hex || null;
      } else if (color && !isNaN(parseInt(color))) {
        colorId = parseInt(color);
      } else if (color && typeof color === 'string') {
        colorName = color;
      }

      console.info(`CustomerSelections: processing selection for quote ${quote.id}: areaId=${areaId}, areaName="${normalizedAreaName}", surface="${normalizedSurface}", colorId=${colorId}, colorName=${colorName}`);

      // Find existing selection by areaId+surface OR areaName+surface (case-insensitive)
      let record = existingSelections.find(s => {
        const sSurface = String(s.surfaceType || '').trim().toLowerCase();
        const matchByIdAndSurface = s.areaId && areaId && String(s.areaId) === String(areaId) && sSurface === normalizedSurface;
        const sAreaName = (s.areaName || '').trim().toLowerCase();
        const matchByNameAndSurface = sAreaName && normalizedAreaName.toLowerCase() && sSurface === normalizedSurface && sAreaName === normalizedAreaName.toLowerCase();
        return matchByIdAndSurface || matchByNameAndSurface;
      });

      if (record) console.info(`CustomerSelections: matched existing record id=${record.id} (area=${record.areaName}, surface=${record.surfaceType})`);

      if (record) {
        // Use explicit assignment so provided values are applied even if falsy
        await record.update({
          areaId: areaId !== undefined ? areaId : record.areaId,
          areaName: normalizedAreaName,
          colorId: colorId !== undefined ? colorId : record.colorId,
          colorName: colorName !== undefined ? colorName : record.colorName,
          colorNumber: colorNumber !== undefined ? colorNumber : record.colorNumber,
          colorHex: colorHex !== undefined ? colorHex : record.colorHex,
          sheen: sheen !== undefined ? sheen : record.sheen,
          customerNotes: notes !== undefined ? notes : record.customerNotes,
          selectedAt: new Date(),
          updatedAt: new Date(),
        }, { transaction });

        // Reload to ensure instance contains DB values
        await record.reload({ transaction });

        console.info(`CustomerSelections: updated record id=${record.id} -> colorId=${record.colorId}, colorName=${record.colorName}, hex=${record.colorHex}`);

        // Update in-memory cache
        const idx = existingSelections.findIndex(e => e.id === record.id);
        if (idx >= 0) existingSelections[idx] = record;
      } else {
        record = await CustomerSelection.create({
          quoteId: quote.id,
          tenantId,
          clientId,
          areaId: areaId || null,
          areaName: normalizedAreaName,
          surfaceType,
          productId: null,
          productName: null,
          colorId: colorId || null,
          colorName: colorName || null,
          colorNumber: colorNumber || null,
          colorHex: colorHex || null,
          sheen: sheen || null,
          customerNotes: notes || null,
          selectedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }, { transaction });

        // Reload to ensure instance contains DB values
        await record.reload({ transaction });

        console.info(`CustomerSelections: created record id=${record.id} -> colorId=${record.colorId}, colorName=${record.colorName}, hex=${record.colorHex}`);

        // Add to in-memory cache
        existingSelections.push(record);
      }

      savedRecords.push(record);
    }

    // Commit and return saved selections for verification
    await transaction.commit();
    const persisted = await CustomerSelection.findAll({ where: { quoteId: quote.id } });

    // Debug: log what we just saved and corresponding persisted rows for verification
    try {
      savedRecords.forEach(r => console.info(`CustomerSelections: savedRecord id=${r.id}, areaId=${r.areaId}, surface=${r.surfaceType}, colorId=${r.colorId}, colorName=${r.colorName}, hex=${r.colorHex}`));
      savedRecords.forEach(r => {
        const match = persisted.find(p => String(p.areaId || '') === String(r.areaId || '') && String((p.surfaceType || '').trim().toLowerCase()) === String((r.surfaceType || '').trim().toLowerCase()));
        console.info(`CustomerSelections: persisted match for saved record id=${r.id} -> matchId=${match ? match.id : 'none'}, colorId=${match ? match.colorId : 'n/a'}, colorName=${match ? match.colorName : 'n/a'}, hex=${match ? match.colorHex : 'n/a'}`);
      });
    } catch (dbgErr) {
      console.warn('CustomerSelections: debug log failed', dbgErr);
    }

    // Build merged selection objects to match getSelectionOptions shape (include product info)
    // Parse productSets
    let ps = quote.productSets;
    if (typeof ps === 'string') {
      try {
        ps = JSON.parse(ps);
      } catch (e) {
        ps = [];
      }
    }
    if (!Array.isArray(ps)) ps = [];

    // Collect product IDs
    const pidSet = new Set();
    for (const productSet of ps) {
      const products = productSet.products || {};
      let pid = null;
      if (quote.productStrategy === 'GBB') pid = products[selectedTier];
      else pid = products.single || products.good || products.better || products.best;
      if (pid) pidSet.add(pid);
    }
    const pids = Array.from(pidSet);

    // Bulk fetch product configs
    const productConfigs = pids.length > 0 ? await ProductConfig.findAll({
      where: { id: pids },
      include: [
        {
          model: GlobalProduct,
          as: 'globalProduct',
          include: [{ model: Brand, as: 'brand' }],
        },
      ],
    }) : [];
    const pcMap = new Map();
    productConfigs.forEach(pc => pcMap.set(pc.id, pc));

    // Build options
    const options = [];
    for (const productSet of ps) {
      const areaId = productSet.areaId;
      const areaName = productSet.areaName;
      const surfaceType = productSet.surfaceType;
      const products = productSet.products || {};

      let productId = null;
      if (quote.productStrategy === 'GBB') productId = products[selectedTier];
      else productId = products.single || products.good || products.better || products.best;

      if (!productId) continue;
      const productConfig = pcMap.get(productId);
      if (!productConfig || !productConfig.globalProduct) continue;

      const product = productConfig.globalProduct;
      const brand = product.brand;
      const sheenOptions = (productConfig.sheens || []).map(s => (typeof s === 'string' ? s : s.sheen));

      options.push({
        areaId,
        areaName,
        surfaceType,
        product: {
          id: productConfig.id,
          name: product.name,
          brand: brand?.name || 'Unknown',
          brandId: brand?.id || null,
          fullName: `${brand?.name || ''} ${product.name}`.trim(),
        },
        availableSheens: sheenOptions,
      });
    }

    // Merge with persisted selections
    const merged = options.map(opt => {
      const oSurface = String(opt.surfaceType || '').trim().toLowerCase();
      const oAreaName = (opt.areaName || '').trim().toLowerCase();

      // find all persisted candidates for this area/surface
      const candidates = persisted.filter(p => {
        const pSurface = String(p.surfaceType || '').trim().toLowerCase();
        const matchByIdAndSurface = p.areaId && opt.areaId && String(p.areaId) === String(opt.areaId) && pSurface === oSurface;
        const pAreaName = (p.areaName || '').trim().toLowerCase();
        const matchByNameAndSurface = pAreaName && oAreaName && pSurface === oSurface && pAreaName === oAreaName;
        return matchByIdAndSurface || matchByNameAndSurface;
      });

      let existing = null;
      if (candidates.length === 1) {
        existing = candidates[0];
      } else if (candidates.length > 1) {
        // Prefer a candidate that matches one of the recently saved records (if any)
        const savedIds = savedRecords.map(r => String(r.id));
        const bySavedId = candidates.find(c => savedIds.includes(String(c.id)));
        if (bySavedId) {
          existing = bySavedId;
        } else {
          // fallback: pick the most recently updated record
          existing = candidates.reduce((best, cur) => {
            const bestTs = best && best.updatedAt ? new Date(best.updatedAt).getTime() : 0;
            const curTs = cur && cur.updatedAt ? new Date(cur.updatedAt).getTime() : 0;
            return curTs > bestTs ? cur : best;
          }, candidates[0]);
        }
        console.info(`CustomerSelections: multiple persisted candidates for area="${opt.areaName}" surface="${opt.surfaceType}"; chosen id=${existing.id}`);
      }

      return {
        ...opt,
        selectedColor: existing?.colorName || null,
        selectedColorId: existing?.colorId || null,
        selectedColorHex: existing?.colorHex || null,
        selectedSheen: existing?.sheen || null,
        customerNotes: existing?.customerNotes || null,
      };
    });

    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Customer selections saved',
      userId: null,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientId,
        selectionsCount: savedRecords.length,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Selections saved successfully',
      saved: savedRecords.length,
      selections: merged,
    });
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Save selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save selections',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Submit and lock selections (converts quote to job)
 * POST /api/customer-portal/proposals/:id/submit-selections
 */
exports.submitSelections = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    
    const quote = await Quote.findOne({
      where: { id, tenantId, clientId },
      transaction,
    });
    
    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }
    
    // Validate portal status
    if (!quote.portalOpen) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Selection portal is not open',
      });
    }
    
    if (quote.selectionsComplete) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Selections are already submitted',
      });
    }
    
    // Check if all required selections are complete
    const CustomerSelection = require('../models/CustomerSelection');
    const selections = await CustomerSelection.findAll({
      where: { quoteId: quote.id },
      transaction,
    });
    
    // Count how many areas need selections (from productSets)
    let productSets = quote.productSets;
    if (typeof productSets === 'string') {
      try {
        productSets = JSON.parse(productSets);
      } catch (e) {
        productSets = [];
      }
    }
    const totalAreas = Array.isArray(productSets) ? productSets.length : 0;
    
    // Evaluate completeness per area+surface using best available record (prefer records with color+sheen)
    const selectionMap = new Map();
    const scoreRecord = (rec) => {
      let score = 0;
      if (rec.colorId || rec.colorName) score += 2;
      if (rec.sheen) score += 1;
      const ts = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
      // small tie-breaker on timestamp
      return { score, ts };
    };

    for (const s of selections) {
      const key = `${String(s.areaId || s.areaName)}::${String((s.surfaceType || '').trim().toLowerCase())}`;
      const existing = selectionMap.get(key);
      if (!existing) {
        selectionMap.set(key, s);
      } else {
        const a = scoreRecord(existing);
        const b = scoreRecord(s);
        if (b.score > a.score || (b.score === a.score && b.ts > a.ts)) {
          selectionMap.set(key, s);
        }
      }
    }

    // Check each required productSet area/surface has a fully completed selection
    const incompleteAreas = [];
    for (const productSet of productSets) {
      const aId = productSet.areaId;
      const aName = productSet.areaName;
      const surf = String(productSet.surfaceType || '').trim().toLowerCase();
      const key = `${String(aId || aName)}::${surf}`;
      const best = selectionMap.get(key);

      // Debug: list candidates for this productSet
      const candidates = selections.filter(s => {
        const sKey = `${String(s.areaId || s.areaName)}::${String((s.surfaceType || '').trim().toLowerCase())}`;
        return sKey === key;
      });
      console.info(`CustomerSelections: submit-check area="${aName}" surface="${productSet.surfaceType}" key="${key}" candidates=${candidates.length} best=${best ? `id=${best.id || 'n/a'} colorId=${best.colorId || best.colorName || 'n/a'} sheen=${best.sheen || 'n/a'}` : 'none'}`);

      if (!best || !(best.colorId || best.colorName) || !best.sheen) {
        incompleteAreas.push({ areaId: aId, areaName: aName, surfaceType: productSet.surfaceType });
      }
    }

    if (incompleteAreas.length > 0) {
      console.info(`CustomerSelections: submit validations failed, incomplete areas: ${incompleteAreas.length}`);
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Please complete all selections. ${incompleteAreas.length} areas are incomplete.`,
        incomplete: incompleteAreas,
      });
    }
    
    // Lock selections
    await quote.update({
      selectionsComplete: true,
      selectionsCompletedAt: new Date(),
      selectionsLockedAt: new Date(),
      customerSelectionsComplete: true,
      portalOpen: false,
      portalClosedAt: new Date(),
    }, { transaction });
    
    // Create Job record
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
      transaction,
    });

    // Determine contractor user to assign the job to (prefer active tenant user, fallback to quote.userId)
    const User = require('../models/User');
    let contractorUser = await User.findOne({ where: { tenantId, isActive: true }, transaction });
    const assignedUserId = contractorUser ? contractorUser.id : (quote.userId || null);

    const jobNumber = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const jobName = quote.jobTitle || `${quote.customerName} - Project`;
    const totalAmount = parseFloat(quote.total || 0) || 0.00;
    const depositAmount = parseFloat(quote.depositAmount || 0) || 0.00;

    // Ensure we don't create duplicate Job records for the same quote.
    // Jobs are normally created at deposit verification time. If a Job already exists,
    // update it to reflect completed selections. Otherwise create a new Job with
    // selections marked complete.
    let job = await Job.findOne({ where: { quoteId: quote.id }, transaction });
    const jobPayload = {
      tenantId,
      userId: assignedUserId,
      clientId: quote.clientId,
      quoteId: quote.id,
      jobNumber,
      jobName,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail || '',
      customerPhone: quote.customerPhone || null,
      jobAddress: `${quote.street || ''} ${quote.city || ''} ${quote.state || ''} ${quote.zipCode || ''}`.trim() || null,
      totalAmount,
      depositAmount,
      depositPaid: !!quote.depositVerified,
      balanceRemaining: totalAmount - depositAmount,
    };

    if (job) {
      // Update existing job to mark selections complete
      await job.update({
        ...jobPayload,
        status: 'selections_complete',
        customerSelectionsComplete: true,
        customerSelectionsSubmittedAt: new Date(),
      }, { transaction });
      await job.reload({ transaction });
    } else {
      // Create a new job representing completed selections
      job = await Job.create({
        ...jobPayload,
        status: 'selections_complete',
        customerSelectionsComplete: true,
        customerSelectionsSubmittedAt: new Date(),
      }, { transaction });
    }
    
    await transaction.commit();
    
    // Generate work documents asynchronously (don't block response)
    if (settings?.auto_generate_documents !== false) {
      setImmediate(async () => {
        try {
          // Enrich quote with per-area selections (fallback when quote.areas is missing)
          const CustomerSelection = require('../models/CustomerSelection');
          const cs = await CustomerSelection.findAll({ where: { quoteId: quote.id } });
          console.log("Customer Selection",cs)
          // Build quick lookup by area+surface
          const csMap = new Map();
          cs.forEach(r => {
            const key = `${String(r.areaId || r.areaName)}::${String((r.surfaceType || '').trim().toLowerCase())}`;
            // prefer most recent record for the key
            const existing = csMap.get(key);
            if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
              csMap.set(key, r);
            }
          });

          // Build areas from productSets if available, else from CustomerSelection rows
          let enrichedAreas = [];
          try {
            let ps = quote.productSets;
            if (typeof ps === 'string') ps = JSON.parse(ps || '[]');
            if (Array.isArray(ps) && ps.length > 0) {
              for (const p of ps) {
                const key = `${String(p.areaId || p.areaName)}::${String((p.surfaceType || '').trim().toLowerCase())}`;
                const sel = csMap.get(key);
                enrichedAreas.push({
                  name: p.areaName || p.name || `Area ${p.areaId || ''}`,
                  surface: p.surfaceType,
                  sqft: p.sqft || null,
                  customerSelections: sel ? {
                    product: sel.productName || null,
                    sheen: sel.sheen || null,
                    color: sel.colorName || null,
                    colorNumber: sel.colorNumber || null,
                    swatch: sel.colorHex || null,
                  } : null,
                });
              }
            } else {
              // Fallback: iterate over csMap
              csMap.forEach((r, key) => {
                enrichedAreas.push({
                  name: r.areaName || `Area ${r.areaId || ''}`,
                  surface: r.surfaceType,
                  sqft: r.sqft || null,
                  customerSelections: {
                    product: r.productName || null,
                    sheen: r.sheen || null,
                    color: r.colorName || null,
                    colorNumber: r.colorNumber || null,
                    swatch: r.colorHex || null,
                  }
                });
              });
            }
          } catch (e) {
            enrichedAreas = [];
          }

          const enrichedQuote = { ...quote, areas: enrichedAreas };

          await workOrderService.generateWorkOrder({ job, quote: enrichedQuote, contractorInfo: settings });
          await workOrderService.generateProductOrderForm({ job, quote: enrichedQuote, contractorInfo: settings });
          await workOrderService.generateMaterialList({ job, quote: enrichedQuote, contractorInfo: settings });
          console.log(`✅ Work documents auto-generated for job ${job.jobNumber}`);
        } catch (docError) {
          console.error('Error auto-generating documents:', docError);
        }
      });
    }
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Customer selections submitted - Job created',
      userId: null,
      tenantId,
      entityType: 'Job',
      entityId: job.id,
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        jobNumber: job.jobNumber,
        clientId,
        selectionsCount: selections.length,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notifications
    try {
      const User = require('../models/User');
      const contractor = await User.findOne({ 
        where: { tenantId, isActive: true },
      });
      
      if (contractor?.email) {
        await emailService.sendSelectionsCompleteEmail(contractor.email, {
          jobNumber: job.jobNumber,
          quoteNumber: quote.quoteNumber,
          customerName: req.customer.name,
          customerEmail: req.customer.email,
        });
      }
      
      // Send confirmation to customer
      await emailService.sendSelectionsConfirmationEmail(req.customer.email, {
        customerName: req.customer.name,
        jobNumber: job.jobNumber,
        quoteNumber: quote.quoteNumber,
      }, { tenantId });
    } catch (emailError) {
      console.error('Error sending selection emails:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Selections submitted successfully! Your project is now scheduled for work.',
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        selectionsComplete: true,
        selectionsCompletedAt: quote.selectionsCompletedAt,
      },
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        totalAmount: job.totalAmount,
        depositAmount: job.depositAmount,
        depositPaid: job.depositPaid,
        balanceRemaining: job.balanceRemaining,
      },
    });
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Submit selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit selections',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = exports;
