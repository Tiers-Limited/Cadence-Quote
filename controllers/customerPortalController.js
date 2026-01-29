// controllers/customerPortalController.js
// Customer Portal Controller - Handles customer portal access and selections

const Quote = require('../models/Quote');
const Client = require('../models/Client');
const Tenant = require('../models/Tenant');
const { Op } = require('sequelize');
const { createAuditLog } = require('./auditLogController');
const documentService = require('../services/documentService');
const emailService = require('../services/emailService');
const MagicLinkService = require('../services/magicLinkService');
const CacheManager = require('../optimization/cache/CacheManager');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const path = require('path');
const fs = require('fs');

// Initialize cache manager
const cache = new CacheManager();
cache.initialize();

// Helper function to resolve product IDs to actual product names from database
async function resolveProductNamesFromIds(productIds, tenantId) {
  try {
    if (!productIds || productIds.length === 0) return new Map();
    
    const ProductConfig = require('../models/ProductConfig');
    const GlobalProduct = require('../models/GlobalProduct');
    const Brand = require('../models/Brand');
    
    const productConfigs = await ProductConfig.findAll({
      where: { 
        id: productIds,
        tenantId: tenantId 
      }
    });
    
    // Create lookup map supporting both custom and global products
    const productLookup = new Map();
    
    // Get global product IDs for non-custom products
    const globalProductIds = productConfigs
      .filter(pc => !pc.isCustom && pc.globalProductId)
      .map(pc => pc.globalProductId);
    
    let globalProducts = [];
    if (globalProductIds.length > 0) {
      globalProducts = await GlobalProduct.findAll({
        where: { id: globalProductIds },
        include: [{ model: Brand, as: 'brand' }]
      });
    }
    
    // Build lookup map
    productConfigs.forEach(config => {
      let productName;
      
      if (config.isCustom && config.customProduct) {
        // Custom product
        productName = config.customProduct.brandName 
          ? `${config.customProduct.brandName} ${config.customProduct.name}`
          : config.customProduct.name;
      } else if (config.globalProductId) {
        // Global product
        const globalProduct = globalProducts.find(gp => gp.id === config.globalProductId);
        if (globalProduct) {
          productName = globalProduct.brand 
            ? `${globalProduct.brand.name} ${globalProduct.name}` 
            : globalProduct.name;
        }
      }
      
      if (productName) {
        productLookup.set(config.id, productName);
      }
    });
    
    return productLookup;
  } catch (error) {
    console.warn('Failed to resolve product names from IDs:', error.message);
    return new Map();
  }
}

// Helper function to extract GBB options from productSets
function extractGBBOptionsFromProductSets(productSets) {
  try {
    let parsedProductSets = productSets || [];
    if (typeof parsedProductSets === 'string') {
      try { 
        parsedProductSets = JSON.parse(parsedProductSets); 
      } catch (e) { 
        parsedProductSets = []; 
      }
    }
    if (!Array.isArray(parsedProductSets)) parsedProductSets = [];

    const tiers = extractProductNamesFromProductSets(parsedProductSets);

    return {
      good: { price: null, features: Array.from(tiers.good) },
      better: { price: null, features: Array.from(tiers.better) },
      best: { price: null, features: Array.from(tiers.best) }
    };
  } catch (gbbErr) {
    console.warn('GBB invoice options build failed, continuing with defaults:', gbbErr?.message || gbbErr);
    return {};
  }
}

// Helper function to add tier pricing data to invoice data
function addTierPricingToInvoiceData(invoiceData, proposal) {
  const baseTotal = parseFloat(proposal.total || 0);
  const tierMultipliers = { good: 0.85, better: 1.0, best: 1.15 };
  const depositPercentage = 50;
  
  const tierPricing = {};
  Object.entries(tierMultipliers).forEach(([tier, multiplier]) => {
    const tierTotal = parseFloat((baseTotal * multiplier).toFixed(2));
    const tierDeposit = parseFloat((tierTotal * (depositPercentage / 100)).toFixed(2));
    
    tierPricing[tier] = {
      total: tierTotal,
      deposit: tierDeposit,
    };
    
    // Update gbbOptions with pricing if it exists
    if (invoiceData.gbbOptions && invoiceData.gbbOptions[tier]) {
      invoiceData.gbbOptions[tier].price = tierTotal;
    }
  });

  invoiceData.tiers = tierPricing;
  invoiceData.selectedTier = proposal.gbbSelectedTier?.toLowerCase() || null;
  
  return invoiceData;
}

// Helper function to extract product names from productSets (DEPRECATED - use resolveProductNamesFromIds instead)
function extractProductNamesFromProductSets(productSets) {
  const tiers = { good: new Set(), better: new Set(), best: new Set() };
  
  if (!Array.isArray(productSets)) return tiers;
  
  productSets.forEach(ps => {
    const products = ps.products || {};
    Object.entries(products).forEach(([tier, prod]) => {
      if (!tier || !tiers[tier]) return;
      
      let productName = null;
      
      // Extract product name from different possible structures
      if (typeof prod === 'string') {
        productName = prod;
      } else if (prod && typeof prod === 'object') {
        productName = prod.name || 
                    prod.productName || 
                    prod.globalProduct?.name ||
                    (prod.brandName && prod.productName ? `${prod.brandName} ${prod.productName}` : null) ||
                    (prod.id ? `Product ${prod.id}` : null);
      }
      
      if (productName && productName !== 'Not selected') {
        tiers[tier].add(productName);
      }
    });
  });
  
  return tiers;
}

// Helper function to extract product IDs from productSets for database lookup
function extractProductIdsFromProductSets(productSets, selectedTier = null) {
  const productIds = [];
  
  if (!Array.isArray(productSets)) return productIds;
  
  productSets.forEach(ps => {
    const products = ps.products || {};
    Object.entries(products).forEach(([tier, prod]) => {
      // If selectedTier is specified, only extract from that tier
      if (selectedTier && tier !== selectedTier) return;
      
      let productId = null;
      
      // Extract product ID from different possible structures
      if (prod && typeof prod === 'object' && prod.id) {
        productId = prod.id;
      }
      
      if (productId && !productIds.includes(productId)) {
        productIds.push(productId);
      }
    });
  });
  
  return productIds;
}

// Import optimization utilities
const { optimizationSystem } = require('../optimization');

// Cache keys for customer portal data
const CACHE_KEYS = {
  CUSTOMER_PROPOSALS: (customerId, filters) => `portal:proposals:${customerId}:${JSON.stringify(filters)}`,
  PROPOSAL_DETAIL: (customerId, proposalId) => `portal:proposal:${customerId}:${proposalId}`,
  TENANT_BRANDING: (tenantId) => `portal:branding:${tenantId}`,
  CUSTOMER_JOBS: (customerId) => `portal:jobs:${customerId}`,
  JOB_DETAIL: (customerId, jobId) => `portal:job:${customerId}:${jobId}`
};

// Cache TTL (5 minutes for dynamic data, 30 minutes for branding)
const CACHE_TTL = {
  PROPOSALS: 300,
  BRANDING: 1800,
  JOBS: 300
};

// ============================================================================
// MAGIC LINK AUTHENTICATION (Passwordless Access)
// ============================================================================

/**
 * Access portal via magic link
 * GET /api/customer-portal/access/:token
 * OPTIMIZED: Implements caching for tenant branding and parallel processing
 */
exports.accessPortal = async (req, res) => {
  try {
    const { token } = req.params;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Validate magic link
    const result = await MagicLinkService.validateMagicLink(token, ipAddress, userAgent);
    
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
        reason: result.reason,
      });
    }
    
    // OPTIMIZATION: Cache tenant branding data and execute audit log in parallel
    const [branding] = await Promise.all([
      // Get tenant branding with caching
      cache.cacheQuery(
        `tenant-branding:${result.magicLink.tenantId}`,
        async () => {
          // OPTIMIZATION: Use selective field loading
          const tenant = await Tenant.findByPk(result.magicLink.tenantId, {
            attributes: ['companyName', 'companyLogoUrl', 'email', 'phoneNumber']
          });
          
          return {
            companyName: tenant?.companyName || 'Your Contractor',
            logo: tenant?.companyLogoUrl || null,
            primaryColor: tenant?.brandColor || '#2563eb',
            email: tenant?.email || null,
            phone: tenant?.phoneNumber || null,
            website: tenant?.website || null,
          };
        },
        1800, // 30 minutes TTL (branding doesn't change often)
        [`tenant:${result.magicLink.tenantId}`, 'branding']
      ),
      
      // Create audit log in parallel (don't wait for it)
      createAuditLog({
        category: 'customer_portal',
        action: 'Portal accessed via magic link',
        userId: null,
        tenantId: result.magicLink.tenantId,
        entityType: 'MagicLink',
        entityId: result.magicLink.id,
        metadata: {
          clientId: result.client.id,
          clientEmail: result.client.email,
          purpose: result.magicLink.purpose,
        },
        ipAddress,
        userAgent,
      }).catch(error => {
        // Don't fail the request if audit log fails
        console.error('Audit log creation failed:', error);
      })
    ]);
    
    res.json({
      success: true,
      message: 'Access granted',
      session: {
        token: result.session.sessionToken,
        expiresAt: result.session.expiresAt,
        isVerified: result.session.isVerified,
      },
      client: {
        id: result.client.id,
        name: result.client.name,
        email: result.client.email,
        phone: result.client.phone,
      },
      branding,
      quote: result.quote ? {
        id: result.quote.id,
        quoteNumber: result.quote.quoteNumber,
        status: result.quote.status,
        total: result.quote.total,
      } : null,
      allowMultiJobAccess: result.magicLink.allowMultiJobAccess && !result.session.isVerified,
    });
    
  } catch (error) {
    console.error('Access portal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to access portal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Validate existing session
 * POST /api/customer-portal/validate-session
 * OPTIMIZED: Implements caching for tenant branding
 */
exports.validateSession = async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Session token is required',
      });
    }
    
    // Validate session
    const result = await MagicLinkService.validateSession(sessionToken, ipAddress, userAgent);
    
    if (!result.valid) {
      return res.status(401).json({
        success: false,
        message: result.message,
        reason: result.reason,
      });
    }
    
    // OPTIMIZATION: Get tenant branding with caching
    const branding = await cache.cacheQuery(
      `tenant-branding:${result.session.tenantId}`,
      async () => {
        // OPTIMIZATION: Use selective field loading
        const tenant = await Tenant.findByPk(result.session.tenantId, {
          attributes: ['companyName', 'companyLogoUrl', 'brandColor', 'email', 'phoneNumber', 'website']
        });
        
        return {
          companyName: tenant?.companyName || 'Your Contractor',
          logo: tenant?.companyLogoUrl || null,
          primaryColor: tenant?.brandColor || '#2563eb',
          email: tenant?.email || null,
          phone: tenant?.phoneNumber || null,
          website: tenant?.website || null,
        };
      },
      1800, // 30 minutes TTL
      [`tenant:${result.session.tenantId}`, 'branding']
    );
    
    res.json({
      success: true,
      session: {
        token: result.session.sessionToken,
        expiresAt: result.session.expiresAt,
        isVerified: result.session.isVerified,
      },
      client: {
        id: result.client.id,
        name: result.client.name,
        email: result.client.email,
        phone: result.client.phone,
      },
      branding,
    });
    
  } catch (error) {
    console.error('Validate session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Request OTP for multi-job access verification
 * POST /api/customer-portal/request-otp
 */
exports.requestOTP = async (req, res) => {
  try {
    const { sessionToken, method } = req.body; // method: 'email' or 'sms'
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Session token is required',
      });
    }
    
    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification method. Use "email" or "sms".',
      });
    }
    
    // Validate session
    const sessionResult = await MagicLinkService.validateSession(sessionToken, ipAddress, userAgent);
    
    if (!sessionResult.valid) {
      return res.status(401).json({
        success: false,
        message: sessionResult.message,
      });
    }
    
    const session = sessionResult.session;
    const client = sessionResult.client;
    
    // Check if already verified
    if (session.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Session is already verified for multi-job access.',
      });
    }
    
    // Determine target (email or phone)
    const target = method === 'email' ? client.email : client.phone;
    
    if (!target) {
      return res.status(400).json({
        success: false,
        message: method === 'email' 
          ? 'No email address on file.'
          : 'No phone number on file. Please use email verification.',
      });
    }
    
    // Create OTP
    const otp = await MagicLinkService.createOTPVerification({
      clientId: client.id,
      tenantId: session.tenantId,
      sessionId: session.id,
      method,
      target,
    });
    
    // Send OTP
    if (method === 'email') {
      // Get tenant for branding
      const tenant = await Tenant.findByPk(session.tenantId);
      
      await emailService.sendOTPEmail({
        to: target,
        code: otp.code,
        clientName: client.name,
        companyName: tenant?.companyName || 'Your Contractor',
        expiryMinutes: 10,
      });
      
      otp.deliveredAt = new Date();
      await otp.save();
    } else {
      // SMS implementation (requires SMS service like Twilio)
      // For now, return error
      return res.status(501).json({
        success: false,
        message: 'SMS verification is not yet implemented. Please use email verification.',
      });
    }
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'OTP verification requested',
      userId: null,
      tenantId: session.tenantId,
      entityType: 'CustomerSession',
      entityId: session.id,
      metadata: {
        clientId: client.id,
        method,
        target: method === 'email' ? target : '***' + target.slice(-4),
      },
      ipAddress,
      userAgent,
    });
    
    res.json({
      success: true,
      message: `Verification code sent to your ${method === 'email' ? 'email' : 'phone'}.`,
      method,
      target: method === 'email' 
        ? target.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email
        : '***' + target.slice(-4), // Mask phone
      expiresIn: 600, // 10 minutes in seconds
    });
    
  } catch (error) {
    console.error('Request OTP error:', error);
    
    if (error.message.includes('Too many OTP requests')) {
      return res.status(429).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify OTP and upgrade session to multi-job access
 * POST /api/customer-portal/verify-otp
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { sessionToken, code } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    if (!sessionToken || !code) {
      return res.status(400).json({
        success: false,
        message: 'Session token and verification code are required',
      });
    }
    
    // Validate session
    const sessionResult = await MagicLinkService.validateSession(sessionToken, ipAddress, userAgent);
    
    if (!sessionResult.valid) {
      return res.status(401).json({
        success: false,
        message: sessionResult.message,
      });
    }
    
    const session = sessionResult.session;
    
    // Verify OTP
    const result = await MagicLinkService.verifyOTP({
      code: code.toString(),
      sessionId: session.id,
      ipAddress,
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        reason: result.reason,
        attemptsRemaining: result.attemptsRemaining,
      });
    }
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'OTP verification successful - Multi-job access granted',
      userId: null,
      tenantId: session.tenantId,
      entityType: 'CustomerSession',
      entityId: session.id,
      metadata: {
        clientId: sessionResult.client.id,
        quoteCount: result.quoteIds.length,
      },
      ipAddress,
      userAgent,
    });
    
    res.json({
      success: true,
      message: 'Verification successful! You now have access to all your projects.',
      session: {
        token: result.session.sessionToken,
        expiresAt: result.session.expiresAt,
        isVerified: true,
      },
      quoteIds: result.quoteIds,
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get tenant branding
 * GET /api/customer-portal/branding/:tenantId
 * OPTIMIZED: Implements caching for tenant branding data
 */
exports.getBranding = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const cacheKey = CACHE_KEYS.TENANT_BRANDING(tenantId);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedBranding = await utils.cache?.get(cacheKey);
      
      if (cachedBranding) {
        return res.json({
          ...cachedBranding,
          cached: true
        });
      }
    }
    
    // OPTIMIZATION: Use selective field loading
    const tenant = await Tenant.findByPk(tenantId, {
      attributes: [
        'companyName',
        'companyLogoUrl',
        'brandColor',
        'email',
        'phoneNumber',
        'website',
        'businessAddress'
      ]
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Contractor not found',
      });
    }
    
    const result = {
      success: true,
      branding: {
        companyName: tenant.companyName || 'Your Contractor',
        logo: tenant.companyLogoUrl || null,
        primaryColor: tenant.brandColor || '#2563eb',
        email: tenant.email || null,
        phone: tenant.phoneNumber || null,
        website: tenant.website || null,
        address: tenant.businessAddress || null,
      },
    };

    // Cache the results (longer TTL for branding data)
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.BRANDING, {
        tags: [`tenant:${tenantId}`, 'branding']
      });
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Get branding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve branding',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================================
// EXISTING PORTAL FUNCTIONALITY (Below)
// ============================================================================

/**
 * Get all proposals for the logged-in customer with pagination and search
 * OPTIMIZED: Implements caching, selective field loading, and efficient pagination
 */
exports.getCustomerProposals = async (req, res) => {
  try {
    const customerId = req.user?.id || 212; // Use authenticated user or test ID
    const { page = 1, limit = 10, search = '', status = '' } = req.query;

    // Create cache key based on filters
    const filters = { page, limit, search, status };
    const cacheKey = CACHE_KEYS.CUSTOMER_PROPOSALS(customerId, filters);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedProposals = await utils.cache?.get(cacheKey);
      
      if (cachedProposals) {
        return res.json({
          ...cachedProposals,
          cached: true
        });
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const whereClause = {
      clientId: customerId,
      // Filter out draft quotes - customers should only see sent/accepted/declined/completed quotes
      status: {
        [Op.notIn]: ['draft']
      }
    };

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { quoteNumber: { [Op.iLike]: `%${search}%` } },
        { customerName: { [Op.iLike]: `%${search}%` } },
        { customerEmail: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add status filter (override the default not-draft filter if specific status requested)
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // OPTIMIZATION: Use selective field loading to reduce data transfer
    const { count, rows: proposals } = await Quote.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'id',
        'clientId',
        'quoteNumber',
        'customerName',
        'customerEmail',
        'status',
        'gbbSelectedTier',
        'depositVerified',
        'depositAmount',
        'finishStandardsAcknowledged',
        'portalOpen',
        'portalOpenedAt',
        'portalClosedAt',
        'selectionsComplete',
        'selectionsCompletedAt',
        'total',
        'validUntil',
        'createdAt',
        'acceptedAt',
        'declinedAt'
      ]
    });

    // OPTIMIZATION: Process data efficiently with minimal iterations
    const proposalsWithStatus = proposals.map(proposal => {
      const data = proposal.toJSON();
      
      // Check if quote is expired
      if (data.validUntil && new Date(data.validUntil) < new Date() && data.status === 'pending') {
        data.isExpired = true;
      }

      // Check if portal is expired
      if (data.portalOpen && data.portalOpenedAt) {
        // We'll check this against contractor settings in a moment
        data.portalExpired = false;
      }

      return data;
    });

    const result = {
      success: true,
      data: proposalsWithStatus,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.PROPOSALS, {
        tags: [`customer:${customerId}`, 'proposals']
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get customer proposals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

/**
 * Get detailed proposal information
 * OPTIMIZED: Implements caching and batch loading for proposal details
 */
exports.getProposalDetail = async (req, res) => {
  try {
    const { id } = req.params; // Route uses :id not :proposalId
    // Use req.customer from customerSessionAuth middleware
    const customerId = req.customer?.id;
    
    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found in session'
      });
    }

    // Try to get from cache first
    const cacheKey = CACHE_KEYS.PROPOSAL_DETAIL(customerId, id);
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedDetail = await utils.cache?.get(cacheKey);
      
      if (cachedDetail) {
        return res.json({
          ...cachedDetail,
          cached: true
        });
      }
    }

    const proposal = await Quote.findOne({
      where: { 
        id: id,
        clientId: customerId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // OPTIMIZATION: Batch load related data in parallel
    const [settings, proposalDefaults, enrichedProductSets, job] = await Promise.all([
      // Calculate tier pricing structure for customer portal
      require('../models/ContractorSettings').findOne({ 
        where: { tenantId: proposal.tenantId },
        attributes: ['depositPercentage']
      }),
      
      require('../models/ProposalDefaults').findOne({ 
        where: { tenantId: proposal.tenantId },
        attributes: ['defaultWelcomeMessage', 'interiorProcess', 'paymentTermsText']
      }),
      
      // OPTIMIZATION: Batch load product details to avoid N+1 queries
      (async () => {
        if (!proposal.productSets || proposal.productSets.length === 0) {
          return [];
        }

        const ProductConfig = require('../models/ProductConfig');
        
        // Collect all unique product IDs from all sets and tiers
        const allProductIds = new Set();
        proposal.productSets.forEach(set => {
          ['good', 'better', 'best'].forEach(tier => {
            const productId = set.products?.[tier];
            if (productId) {
              allProductIds.add(productId);
            }
          });
        });

        // OPTIMIZATION: Single batch query for all products
        const productConfigs = await ProductConfig.findAll({
          where: { id: Array.from(allProductIds) },
          attributes: ['id', 'globalProductId', 'isCustom', 'customProduct', 'sheens'],
          include: [
            {
              association: 'globalProduct',
              required: false,
              attributes: ['name'],
              include: [
                {
                  association: 'brand',
                  attributes: ['name']
                }
              ]
            }
          ]
        });

        // Create lookup map for O(1) access
        const productLookup = new Map();
        productConfigs.forEach(config => {
          let brandName, productName;
          
          if (config.isCustom && config.customProduct) {
            // Custom product
            brandName = config.customProduct.brandName || 'Custom';
            productName = config.customProduct.name || 'Custom Product';
          } else if (config.globalProduct) {
            // Global product
            brandName = config.globalProduct.brand?.name || 'Unknown';
            productName = config.globalProduct.name || 'Unknown';
          } else {
            brandName = 'Unknown';
            productName = 'Unknown';
          }
          
          productLookup.set(config.id, {
            id: config.id,
            productId: config.id,
            globalProductId: config.globalProductId,
            isCustom: config.isCustom || false,
            brandName: brandName,
            productName: productName,
            pricePerGallon: config.sheens?.[0]?.price || 0
          });
        });

        // OPTIMIZATION: Process sets efficiently using lookup map
        return proposal.productSets.map(set => {
          const enrichedProducts = {};
          
          ['good', 'better', 'best'].forEach(tier => {
            const productId = set.products?.[tier];
            if (productId) {
              enrichedProducts[tier] = productLookup.get(productId) || {
                id: productId,
                productName: 'Product not found'
              };
            }
          });
          
          return {
            ...set,
            products: enrichedProducts
          };
        });
      })(),
      
      // Include any Job created from this quote (if exists) so customer portal can show progress
      require('../models/Job').findOne({ 
        where: { quoteId: proposal.id, clientId: customerId },
        attributes: ['id', 'jobNumber', 'status', 'scheduledStartDate', 'scheduledEndDate']
      })
    ]);
    
    const depositPercentage = settings?.depositPercentage || 50;
    const baseTotal = parseFloat(proposal.total || 0);
    
    // OPTIMIZATION: Generate project scope efficiently
    const generateProjectScope = (areas) => {
      if (!areas || areas.length === 0) {
        return proposalDefaults?.interiorProcess || 'Project scope will be defined based on your requirements.';
      }

      const scopeParts = ['This project includes:\n'];
      
      areas.forEach((area, index) => {
        const areaName = area.name || `Area ${index + 1}`;
        const items = area.laborItems || area.items || [];
        const selectedItems = items.filter(item => item.selected);
        
        if (selectedItems.length > 0) {
          scopeParts.push(`**${areaName}:**`);
          
          selectedItems.forEach(item => {
            const qty = item.quantity || 0;
            
            // OPTIMIZATION: Use lookup table for unit conversion
            const unitMap = {
              'sqft': 'sq ft',
              'linear_foot': 'linear feet',
              'unit': 'units',
              'hour': 'hours'
            };
            
            let unit = unitMap[item.measurementUnit] || unitMap[item.unit] || 'items';
            
            const coats = item.numberOfCoats > 0 ? ` (${item.numberOfCoats} coat${item.numberOfCoats > 1 ? 's' : ''})` : '';
            
            scopeParts.push(`  ? ${item.categoryName}: ${qty} ${unit}${coats}`);
          });
          
          scopeParts.push(''); // Empty line
        }
      });

      return scopeParts.join('\n').trim();
    };
    
    // OPTIMIZATION: Pre-calculate tier multipliers
    const tierMultipliers = { good: 0.85, better: 1.0, best: 1.15 };
    const tiers = {};
    
    Object.entries(tierMultipliers).forEach(([tier, multiplier]) => {
      const tierTotal = parseFloat((baseTotal * multiplier).toFixed(2));
      const tierDeposit = parseFloat((tierTotal * (depositPercentage / 100)).toFixed(2));
      
      tiers[tier] = {
        total: tierTotal,
        deposit: tierDeposit,
        description: tier === 'good' ? 'Basic preparation focused on repainting the space cleanly. Spot patching only.' :
                    tier === 'better' ? 'Expanded surface preparation including feather sanding. Recommended for most homes.' :
                    'Advanced surface correction including skim coating. Best for luxury spaces.'
      };
    });

    // If tier is already selected, ensure depositAmount matches that tier
    let effectiveDepositAmount = proposal.depositAmount;
    if (proposal.gbbSelectedTier && tiers[proposal.gbbSelectedTier.toLowerCase()]) {
      effectiveDepositAmount = tiers[proposal.gbbSelectedTier.toLowerCase()].deposit;
    }

    const result = {
      success: true,
      data: {
        ...proposal.toJSON(),
        tiers,
        depositAmount: effectiveDepositAmount,
        // Customer portal display fields from ProposalDefaults (contractor-configurable)
        companyIntroduction: proposalDefaults?.defaultWelcomeMessage || 'Thank you for considering us for your painting project.',
        scope: generateProjectScope(proposal.areas),
        terms: proposalDefaults?.paymentTermsText || 'Standard payment terms apply.',
        // Pass complete data structures for transparency
        areas: proposal.areas || [],
        productSets: enrichedProductSets,
        job: job ? job.toJSON() : null
      }
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.PROPOSALS, {
        tags: [`customer:${customerId}`, 'proposal-details']
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get proposal detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal',
      error: error.message
    });
  }
};

/**
 * Accept proposal with tier selection
 */
exports.acceptProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedTier } = req.body;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id,
        clientId: customerId,
        tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or already processed'
      });
    }

    // Check if quote is still valid
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This quote has expired. Please contact your contractor.'
      });
    }

    // Calculate deposit amount based on selected tier
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({
      where: { tenantId: proposal.tenantId }
    });
    
    const depositPercentage = settings?.depositPercentage || 50;
    const baseTotal = parseFloat(proposal.total || 0);
    
    // Calculate tier pricing
    const tierMultipliers = {
      good: 0.85,
      better: 1.0,
      best: 1.15
    };
    
    const multiplier = tierMultipliers[selectedTier.toLowerCase()] || 1.0;
    const tierTotal = baseTotal * multiplier;
    const depositAmount = parseFloat((tierTotal * (depositPercentage / 100)).toFixed(2));

    // Update proposal status - mark as accepted but portal remains closed until deposit
    await proposal.update({
      status: 'accepted',
      gbbSelectedTier: selectedTier, // Fixed: use correct field name
      depositAmount,
      total: parseFloat(tierTotal.toFixed(2)), // Update total to match selected tier
      acceptedAt: new Date(),
      // Portal stays closed until deposit is verified
      portalOpen: false
    });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'proposal_accepted',
      category: 'quote',
      entityType: 'Quote',
      entityId: id,
      details: {
        selectedTier,
        proposalId: id,
        depositAmount
      },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send email notification to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findByPk(proposal.userId);
      if (contractor && contractor.email) {
        await emailService.sendProposalAcceptedEmail(contractor.email, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          customerEmail: client?.email || 'N/A',
          selectedTier: proposal.gbbSelectedTier,
          total: tierTotal,
          depositAmount,
          id: proposal.id
        });
      }
    } catch (emailError) {
      console.error('Error sending proposal accepted email:', emailError);
      // Don't fail the request if email fails
    }

    // OPTIMIZATION: Invalidate related caches
    await Promise.all([
      cache.invalidateByTags([`customer:${customerId}`, 'proposals', 'proposal-details']),
      cache.invalidateByTags([`tenant:${proposal.tenantId}`])
    ]);

    res.json({
      success: true,
      message: 'Proposal accepted successfully. Please proceed to deposit payment.',
      data: {
        id: proposal.id,
        status: proposal.status,
        depositAmount,
        selectedTier
      }
    });
  } catch (error) {
    console.error('Accept proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept proposal',
      error: error.message
    });
  }
};

/**
 * Decline proposal
 */
exports.declineProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id,
        clientId: customerId,
        tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or already processed'
      });
    }

    await proposal.update({
      status: 'declined',
      declinedAt: new Date(),
      notes: reason ? `Customer decline reason: ${reason}\n${proposal.notes || ''}` : proposal.notes
    });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'proposal_declined',
      category: 'quote',
      entityType: 'Quote',
      entityId: id,
      details: { proposalId: id, reason },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send email notification to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findByPk(proposal.userId);
      if (contractor && contractor.email) {
        await emailService.sendProposalDeclinedEmail(contractor.email, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          reason,
          id: proposal.id
        });
      }
    } catch (emailError) {
      console.error('Error sending proposal declined email:', emailError);
    }

    // OPTIMIZATION: Invalidate related caches
    await Promise.all([
      cache.invalidateByTags([`customer:${customerId}`, 'proposals', 'proposal-details']),
      cache.invalidateByTags([`tenant:${proposal.tenantId}`])
    ]);

    res.json({
      success: true,
      message: 'Proposal declined',
      data: proposal
    });
  } catch (error) {
    console.error('Decline proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline proposal',
      error: error.message
    });
  }
};
    

/**
 * Acknowledge finish standards
 */
exports.acknowledgeFinishStandards = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id,
        clientId: customerId,
        tenantId,
        depositVerified: true
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or deposit not verified'
      });
    }

    await proposal.update({
      finishStandardsAcknowledged: true,
      finishStandardsAcknowledgedAt: new Date()
    });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'finish_standards_acknowledged',
      category: 'quote',
      entityType: 'Quote',
      entityId: id,
      details: { proposalId: id },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    res.json({
      success: true,
      message: 'Finish standards acknowledged'
    });
  } catch (error) {
    console.error('Acknowledge finish standards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge',
      error: error.message
    });
  }
};

/**
 * Save area selections
 */
exports.saveAreaSelections = async (req, res) => {
  try {
    const { proposalId, areaId } = req.params;
    const { brandId, productId, colorId, customColor, sheen } = req.body;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        tenantId,
        portalOpen: true
      }
    });

    if (!proposal) {
      return res.status(403).json({
        success: false,
        message: 'Portal is closed or proposal not found'
      });
    }

    // Update area selections
    const areas = proposal.areas || [];
    const areaIndex = areas.findIndex(a => a.id === Number.parseInt(areaId));

    if (areaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    areas[areaIndex].selections = {
      brandId,
      productId,
      colorId,
      customColor,
      sheen,
      updatedAt: new Date()
    };

    await proposal.update({ areas });

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'area_selection_saved',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: {
        proposalId,
        areaId,
        brandId,
        productId,
        colorId,
        sheen
      },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    res.json({
      success: true,
      message: 'Selection saved successfully',
      data: areas[areaIndex]
    });
  } catch (error) {
    console.error('Save area selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save selections',
      error: error.message
    });
  }
};

/**
 * Submit all selections
 */
exports.submitAllSelections = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { selections } = req.body;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        tenantId,
        portalOpen: true
      }
    });

    if (!proposal) {
      return res.status(403).json({
        success: false,
        message: 'Portal is closed or proposal not found'
      });
    }

    // Get areas from proposal
    const areas = proposal.areas || [];
    
    // If selections are provided in new format (from ColorSelections component)
    if (selections && typeof selections === 'object') {
      // Update each area with its selections
      const updatedAreas = areas.map(area => {
        const areaSelection = selections[area.id];
        if (areaSelection) {
          return {
            ...area,
            selections: areaSelection
          };
        }
        return area;
      });

      // Validate all areas have complete selections
      const incomplete = updatedAreas.filter(area => {
        if (!area.selections) return true;
        const sel = area.selections;
        // Must have either a color selection or custom/other brand
        const hasColor = sel.colorId || sel.isCustom || sel.isOtherBrand;
        // Must have a sheen
        const hasSheen = sel.sheen;
        return !hasColor || !hasSheen;
      });

      if (incomplete.length > 0) {
        return res.status(400).json({
          success: false,
          message: `All areas must have complete selections. ${incomplete.length} area(s) incomplete.`,
          incompleteAreas: incomplete.map(a => a.name)
        });
      }

      // Save updated areas back to proposal
      await proposal.update({
        areas: updatedAreas,
        selectionsComplete: true,
        selectionsCompletedAt: new Date(),
        portalOpen: false
      });

      // Update corresponding Job if it exists
      const Job = require('../models/Job');
      const job = await Job.findOne({ where: { quoteId: proposalId } });
      if (job) {
        await job.update({
          customerSelectionsComplete: true,
          customerSelectionsSubmittedAt: new Date(),
          status: 'selections_complete'
        });
      }
    } else {
      // Old format validation (from ProductSelections component)
      const incomplete = areas.filter(area => !area.selections || !area.selections.productId);

      if (incomplete.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All areas must have complete selections'
        });
      }

      // Lock portal and mark selections complete
      await proposal.update({
        selectionsComplete: true,
        selectionsCompletedAt: new Date(),
        portalOpen: false
      });

      // Update corresponding Job if it exists
      const Job = require('../models/Job');
      const job = await Job.findOne({ where: { quoteId: proposalId } });
      if (job) {
        await job.update({
          customerSelectionsComplete: true,
          customerSelectionsSubmittedAt: new Date(),
          status: 'selections_complete'
        });
      }
    }

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'selections_submitted',
      category: 'quote',
      entityType: 'Quote',
      entityId: proposalId,
      details: { proposalId },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send email notification to contractor
    try {
      const contractor = await proposal.getUser();
      if (contractor && contractor.email) {
        await emailService.sendSelectionsCompletedEmail(contractor.email, {
          quoteNumber: proposal.quoteNumber,
          customerName: proposal.customerName,
          selectedTier: proposal.gbbSelectedTier,
          id: proposal.id
        });
      }
    } catch (emailError) {
      console.error('Error sending selections completed email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Selections submitted successfully'
    });
  } catch (error) {
    console.error('Submit selections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit selections',
      error: error.message
    });
  }
};

/**
 * Get available documents
 * UPDATED: Only shows proposal PDF to customers (job documents are contractor-only)
 */
exports.getDocuments = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const documents = [];

    // Proposal PDF - Always available to customers
    documents.push({
      type: 'proposal',
      title: 'Proposal',
      description: 'Your project proposal document',
      available: true,
      url: proposal.proposalPdfUrl,
      generatedAt: proposal.proposalPdfGeneratedAt,
      version: proposal.proposalPdfVersion || 1
    });
    
    // Invoice PDF - Available after deposit is paid
    if (proposal.depositVerified && proposal.invoicePdfUrl) {
      documents.push({
        type: 'invoice',
        title: 'Invoice',
        description: 'Your project invoice with selected tier pricing',
        available: true,
        url: proposal.invoicePdfUrl,
        generatedAt: proposal.invoicePdfGeneratedAt,
        depositPaid: true,
        selectedTier: proposal.gbbSelectedTier || null
      });
    }

    // NOTE: Material list, paint order, and work order are contractor-only documents
    // They are NOT shown in the customer portal per requirements

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
};

/**
 * Helper: enrich a Quote instance with area-level customer selections
 * so Work Order / Product Order / Material List PDFs have paint data.
 * Mirrors the logic used in customerSelectionsController auto-generation.
 */
async function buildEnrichedQuoteWithSelections(quoteInstance) {
  if (!quoteInstance) return quoteInstance;

  const quote = typeof quoteInstance.toJSON === 'function'
    ? quoteInstance.toJSON()
    : { ...quoteInstance };

  try {
    const CustomerSelection = require('../models/CustomerSelection');
    const selections = await CustomerSelection.findAll({
      where: { quoteId: quote.id },
    });

    const csMap = new Map();
    selections.forEach((r) => {
      const key = `${String(r.areaId || r.areaName)}::${String((r.surfaceType || '').trim().toLowerCase())}`;
      const existing = csMap.get(key);
      if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
        csMap.set(key, r);
      }
    });

    // Collect all product IDs that need to be resolved (from both customer selections and productSets)
    const productIdsToResolve = new Set();
    
    // Add product IDs from customer selections
    selections.forEach(sel => {
      if (sel.productId) {
        productIdsToResolve.add(sel.productId);
      }
    });
    
    // Add product IDs from productSets - THIS IS CRITICAL FOR DOCUMENTS
    if (quote.productSets) {
      let productSets;
      try {
        productSets = typeof quote.productSets === 'string' ? JSON.parse(quote.productSets) : quote.productSets;
        if (Array.isArray(productSets)) {
          productSets.forEach(ps => {
            const products = ps.products || {};
            // Add ALL tier products, not just the selected tier
            Object.values(products).forEach(productId => {
              if (productId && typeof productId === 'number') {
                productIdsToResolve.add(productId);
              }
            });
          });
        }
      } catch (e) {
        console.error('Error parsing productSets in buildEnrichedQuoteWithSelections:', e);
      }
    }

    // Resolve product names and sheen information from database
    let productLookup = new Map();
    let productSheenLookup = new Map();
    if (productIdsToResolve.size > 0) {
      try {
        const ProductConfig = require('../models/ProductConfig');
        const GlobalProduct = require('../models/GlobalProduct');
        const Brand = require('../models/Brand');
        
        const productConfigs = await ProductConfig.findAll({
          where: { 
            id: Array.from(productIdsToResolve),
            tenantId: quote.tenantId 
          }
        });
        
        // Get global product IDs for non-custom products
        const globalProductIds = productConfigs
          .filter(pc => !pc.isCustom && pc.globalProductId)
          .map(pc => pc.globalProductId);
        
        let globalProducts = [];
        if (globalProductIds.length > 0) {
          globalProducts = await GlobalProduct.findAll({
            where: { id: globalProductIds },
            include: [{ model: Brand, as: 'brand' }]
          });
        }
        
        // Create lookup maps supporting both custom and global products
        productConfigs.forEach(config => {
          let productName;
          
          if (config.isCustom && config.customProduct) {
            // Custom product
            const customProd = typeof config.customProduct === 'string' 
              ? JSON.parse(config.customProduct) 
              : config.customProduct;
            productName = customProd.brandName 
              ? `${customProd.brandName} ${customProd.name}`
              : customProd.name;
          } else if (config.globalProductId) {
            // Global product
            const globalProduct = globalProducts.find(gp => gp.id === config.globalProductId);
            if (globalProduct) {
              productName = globalProduct.brand 
                ? `${globalProduct.brand.name} ${globalProduct.name}` 
                : globalProduct.name;
            }
          }
          
          if (productName) {
            productLookup.set(config.id, productName);
          }
          
          // Extract sheen information
          if (config.sheens && Array.isArray(config.sheens) && config.sheens.length > 0) {
            // Get the first/default sheen
            const defaultSheen = config.sheens[0];
            if (defaultSheen && defaultSheen.sheen) {
              productSheenLookup.set(config.id, defaultSheen.sheen);
            }
          }
        });
        
      } catch (error) {
        console.error('Error resolving product names and sheens in buildEnrichedQuoteWithSelections:', error);
      }
    }

    let enrichedAreas = [];
    try {
      let ps = quote.productSets;
      if (typeof ps === 'string') ps = JSON.parse(ps || '[]');

      if (Array.isArray(ps) && ps.length > 0) {
        for (const p of ps) {
          const key = `${String(p.areaId || p.areaName)}::${String((p.surfaceType || '').trim().toLowerCase())}`;
          const sel = csMap.get(key);
          
          // Product comes from productSets based on selected tier
          // Customer selections only store color and sheen, NOT product
          let resolvedProductName = null;
          let resolvedProductId = null;
          
          // PRIMARY: Use productSets with the selected tier
          if (p.products && quote.gbbSelectedTier) {
            const tierProductId = p.products[quote.gbbSelectedTier.toLowerCase()];
            if (tierProductId && productLookup.has(tierProductId)) {
              resolvedProductName = productLookup.get(tierProductId);
              resolvedProductId = tierProductId;
            }
          }
          
          // FALLBACK 1: If no selected tier, try any tier from productSets
          if (!resolvedProductName && p.products) {
            const tiers = ['best', 'better', 'good']; // Try best first
            for (const tier of tiers) {
              const tierProductId = p.products[tier];
              if (tierProductId && productLookup.has(tierProductId)) {
                resolvedProductName = productLookup.get(tierProductId);
                resolvedProductId = tierProductId;
                break;
              }
            }
          }
          
          // FALLBACK 2: Try customer selection product (legacy support)
          if (!resolvedProductName && sel?.productId && productLookup.has(sel.productId)) {
            resolvedProductName = productLookup.get(sel.productId);
            resolvedProductId = sel.productId;
          }
          
          // FALLBACK 3: Try customer selection product name (legacy support)
          if (!resolvedProductName && sel?.productName && sel.productName !== 'null' && sel.productName.trim() !== '') {
            resolvedProductName = sel.productName;
          }
          
          // FINAL FALLBACK: Use placeholder
          if (!resolvedProductName) {
            resolvedProductName = 'Not selected';
          }
          
          // Sheen resolution priority:
          // 1. Customer selection sheen (what they actually picked)
          // 2. Product's default sheen from database
          let resolvedSheen = null;
          
          // PRIMARY: Use customer selection sheen (this is what they chose)
          if (sel?.sheen && sel.sheen !== 'Various Specialty Finishes' && sel.sheen.trim() !== '') {
            resolvedSheen = sel.sheen;
          }
          // FALLBACK: Use product's default sheen
          else if (resolvedProductId && productSheenLookup.has(resolvedProductId)) {
            resolvedSheen = productSheenLookup.get(resolvedProductId);
          }
          // Handle "Various Specialty Finishes" as valid if it's the product's actual sheen
          else if (resolvedProductId && productSheenLookup.has(resolvedProductId)) {
            const productSheen = productSheenLookup.get(resolvedProductId);
            if (productSheen === 'Various Specialty Finishes') {
              resolvedSheen = productSheen;
            }
          }
            
          enrichedAreas.push({
            name: p.areaName || p.name || `Area ${p.areaId || ''}`,
            surface: p.surfaceType,
            sqft: p.sqft || p.quantity || null,
            customerSelections: {
              product: resolvedProductName,
              sheen: resolvedSheen || 'Not specified',
              color: sel?.colorName || null,
              colorNumber: sel?.colorNumber || null,
              swatch: sel?.colorHex || null,
              quantityGallons: sel?.quantityGallons || null,
            },
          });
        }
      } else {
        // Handle case where there are customer selections but no productSets
        csMap.forEach((r) => {
          // Use database lookup for product name if available, otherwise fallback to stored name
          let resolvedProductName = null;
          let resolvedProductId = null;
          
          if (r.productId && productLookup.has(r.productId)) {
            resolvedProductName = productLookup.get(r.productId);
            resolvedProductId = r.productId;
          } else if (r.productName && r.productName !== 'null' && r.productName.trim() !== '') {
            resolvedProductName = r.productName;
          }
          
          const fallbackProduct = resolvedProductName || quote.defaultProductName || 'Not selected';
          
          // Determine sheen
          let resolvedSheen = null;
          if (resolvedProductId && productSheenLookup.has(resolvedProductId)) {
            resolvedSheen = productSheenLookup.get(resolvedProductId);
          } else if (r.sheen && r.sheen !== 'Various Specialty Finishes' && r.sheen.trim() !== '') {
            resolvedSheen = r.sheen;
          }
          
          enrichedAreas.push({
            name: r.areaName || `Area ${r.areaId || ''}`,
            surface: r.surfaceType,
            sqft: r.sqft || null,
            customerSelections: {
              product: fallbackProduct,
              sheen: resolvedSheen || 'Not specified',
              color: r.colorName || null,
              colorNumber: r.colorNumber || null,
              swatch: r.colorHex || null,
              quantityGallons: r.quantityGallons || null,
            },
          });
        });
      }
    } catch (e) {
      console.error('Error processing areas in buildEnrichedQuoteWithSelections:', e);
      enrichedAreas = [];
    }

    return { ...quote, areas: enrichedAreas };
  } catch (err) {
    console.error('buildEnrichedQuoteWithSelections failed:', err);
    return typeof quoteInstance.toJSON === 'function' ? quoteInstance.toJSON() : quoteInstance;
  }
}

/**
 * Download document
 * OPTIMIZED: Implements caching for PDF generation to improve performance
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { docType } = req.params;
    let customerId = req.customer?.id;
    let tenantId = req.customerTenantId;
    const { token } = req.query;

    // Support token-based access (magic link or session token) for downloads when Authorization header not present
    if (!customerId && token) {
      try {
        const MagicLinkService = require('../services/magicLinkService');
        
        // First try to validate as a session token (JWT)
        try {
          const sessionResult = await MagicLinkService.validateSession(token, req.ip, req.headers['user-agent']);
          if (sessionResult.valid) {
            customerId = sessionResult.client.id;
            tenantId = sessionResult.session.tenantId;
            console.log('? Document access via session token');
          }
        } catch (sessionErr) {
          // If session validation fails, try magic link validation
          console.log('Session token validation failed, trying magic link:', sessionErr.message);
          const result = await MagicLinkService.validateMagicLink(token, req.ip, req.headers['user-agent']);
          if (result.valid && result.magicLink) {
            customerId = result.magicLink.clientId;
            tenantId = result.magicLink.tenantId;
            console.log('? Document access via magic link token');
          } else if (!result.valid) {
            return res.status(401).json({ success: false, message: result.message });
          }
        }
      } catch (tokenErr) {
        console.error('Token validation error (download):', tokenErr);
        return res.status(401).json({ success: false, message: 'Invalid or expired link' });
      }
    }

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    // OPTIMIZATION: Check cache first for PDF documents
    const cacheKey = `pdf:${docType}:${proposalId}:${tenantId}`;
    
    
    
    if (req.cache) {
      const cached = await req.cache.get(cacheKey);
      if (cached) {
        console.log(`?? PDF cache hit for ${docType}:${proposalId}`);
        pdfBuffer = Buffer.from(cached.buffer);
        fileName = cached.fileName;
        
        // Set headers and send cached PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(pdfBuffer);
      }
    }

    // OPTIMIZATION: Batch load all required data
    const [proposal, job, contractor] = await Promise.all([
      Quote.findOne({
        where: { 
          id: proposalId,
          clientId: customerId,
          tenantId
        }
      }),
      
      // Get related job if exists
      require('../models/Job').findOne({
        where: { quoteId: proposalId, tenantId }
      }),
      
      // Get contractor info
      require('../models/Tenant').findByPk(tenantId)
    ]);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const contractorInfo = {
      companyName: contractor?.companyName || 'Professional Painting Co.',
      address: contractor?.address || '',
      phone: contractor?.phoneNumber || '',
      email: contractor?.email || '',
      logo: contractor?.companyLogoUrl || null
    };

    // Generate PDF based on docType
    let pdfBuffer;
    let fileName;
    
    try {
      switch (docType) {
        case 'invoice':
          // Generate invoice using invoice template service
          const invoiceTemplateService = require('../services/invoiceTemplateService');
          const ContractorSettings = require('../models/ContractorSettings');
          
          const settings = await ContractorSettings.findOne({ where: { tenantId } });
          
          const templateType = proposal.productStrategy === 'GBB' ? 'gbb' : 'single';
          const templateStyle = settings?.invoice_template_style || 'light';

        

          // Enrich for scope/materials generation (does not affect invoice pricing)
          const enrichedForInvoice = await buildEnrichedQuoteWithSelections(proposal);

          // Get scope of work from ProposalDefaults if not set on quote
          const ProposalDefaults = require('../models/ProposalDefaults');
          const proposalDefaults = await ProposalDefaults.findOne({ where: { tenantId } });
          
          const derivedScope = (proposal.scopeOfWork && proposal.scopeOfWork.length > 0)
            ? proposal.scopeOfWork
            : (proposalDefaults?.scopeOfWork 
                ? [proposalDefaults.scopeOfWork]
                : (proposal.jobScope ? [proposal.jobScope] : []));

          // Build a simple materials/selections list from enriched areas
          const materialsSelections = Array.isArray(enrichedForInvoice?.areas)
            ? enrichedForInvoice.areas
              .filter(a => a.customerSelections)
              .map(a => {
                const cs = a.customerSelections || {};
                const parts = [];
                
                // Add product name if available
                if (cs.product && cs.product !== 'Not selected') {
                  parts.push(cs.product);
                }
                
                // Add sheen if available
                if (cs.sheen) {
                  parts.push(cs.sheen);
                }
                
                // Add color info if available
                const colorParts = [];
                if (cs.color && cs.color !== 'Not selected') {
                  colorParts.push(cs.color);
                }
                if (cs.colorNumber) {
                  colorParts.push(cs.colorNumber);
                }
                if (colorParts.length > 0) {
                  parts.push(colorParts.join(' '));
                }
                
                return parts.length > 0 ? parts.join(' - ') : null;
              })
              .filter(Boolean)
            : [];
          
          // If no materials from customer selections, try to extract from productSets using helper function
          if (materialsSelections.length === 0 && proposal.productSets) {
            try {
              const selectedTier = proposal.gbbSelectedTier?.toLowerCase();
              const productIds = extractProductIdsFromProductSets(proposal.productSets, selectedTier);
              
              if (productIds.length > 0) {
                const productLookup = await resolveProductNamesFromIds(productIds, proposal.tenantId);
                productIds.forEach(productId => {
                  const productName = productLookup.get(productId);
                  if (productName) {
                    materialsSelections.push(productName);
                  }
                });
              }
              
              // If still no products found and we had a specific tier, try all tiers
              if (materialsSelections.length === 0 && selectedTier) {
                const allProductIds = extractProductIdsFromProductSets(proposal.productSets);
                if (allProductIds.length > 0) {
                  const productLookup = await resolveProductNamesFromIds(allProductIds, proposal.tenantId);
                  allProductIds.forEach(productId => {
                    const productName = productLookup.get(productId);
                    if (productName) {
                      materialsSelections.push(productName);
                    }
                  });
                }
              }
            } catch (error) {
              console.error('Error resolving product names from database:', error);
              // Fallback to old method if database lookup fails
              const extractedProducts = extractProductNamesFromProductSets(proposal.productSets);
              const selectedTier = proposal.gbbSelectedTier?.toLowerCase();
              
              if (selectedTier && extractedProducts[selectedTier]) {
                extractedProducts[selectedTier].forEach(productName => {
                  materialsSelections.push(productName);
                });
              } else {
                // Fallback to any available products
                ['better', 'good', 'best'].forEach(tier => {
                  if (extractedProducts[tier] && extractedProducts[tier].size > 0) {
                    extractedProducts[tier].forEach(productName => {
                      materialsSelections.push(productName);
                    });
                  }
                });
              }
            }
          }
          
          const invoiceData = {
            invoiceNumber: proposal.quoteNumber || `INV-${Date.now()}`,
            issueDate: new Date().toLocaleDateString('en-US'),
            dueDate: proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString('en-US') : null,
            projectName: proposal.jobTitle || `${proposal.customerName} Project`,
            projectAddress: [proposal.street, proposal.city, proposal.state, proposal.zipCode].filter(Boolean).join(', '),
            customerName: proposal.customerName,
            customerPhone: proposal.customerPhone,
            customerEmail: proposal.customerEmail,
            welcomeMessage: settings?.welcomeMessage || null,
            scopeOfWork: derivedScope,
            materialsSelections,
            estimatedDuration: proposal.estimatedDuration || null,
            estimatedStartDate: proposal.scheduledStartDate || null,
            selectedTier: proposal.gbbSelectedTier ? proposal.gbbSelectedTier.toUpperCase() : null,
 pricingItems: [
              {
                name: proposal.jobTitle || 'Project',
                qty: 1,
                rate: null,
                amount: parseFloat(proposal.total || 0),
              },
            ],
            projectInvestment: proposal.total,
            deposit: proposal.depositAmount,
            balance: (proposal.total || 0) - (proposal.depositAmount || 0),
            projectTerms: []
          };

          // If GBB invoice, extract gbbOptions from proposal.productSets
          if (templateType === 'gbb') {
            invoiceData.gbbOptions = extractGBBOptionsFromProductSets(proposal.productSets);
            
            // Add tier pricing data for GBB invoices
            addTierPricingToInvoiceData(invoiceData, proposal);
          }

          try {
            pdfBuffer = await invoiceTemplateService.generateInvoice({
              templateType,
              style: templateStyle,
              invoiceData,
              contractorInfo
            });

            if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
              console.error('Invoice PDF generation returned invalid buffer', { proposalId: proposal.id, templateType, templateStyle });
              throw new Error('Invalid PDF buffer');
            }
          } catch (invoiceErr) {
            console.error('Invoice generation failed, attempting safe fallback:', invoiceErr && invoiceErr.message);
            try {
              // Fallback: render single-item invoice HTML and convert to PDF
              const fallbackHtml = invoiceTemplateService.generateSingleItemInvoiceHTML({ style: templateStyle, invoiceData, contractorInfo });
              const { htmlToPdfBuffer } = require('../services/pdfService');
              const fallbackPdf = await htmlToPdfBuffer(fallbackHtml, { waitUntil: 'load' });
              if (!fallbackPdf || !Buffer.isBuffer(fallbackPdf)) {
                console.error('Fallback PDF generation also failed (invalid buffer)');
                return res.status(500).json({ success: false, message: 'Failed to generate invoice PDF (fallback failed)' });
              }

              pdfBuffer = fallbackPdf;
              console.warn('Fallback invoice PDF generated successfully');
            } catch (fallbackErr) {
              console.error('Fallback invoice PDF generation failed:', fallbackErr && fallbackErr.message);
              
              // Final fallback: Return a simple text response with invoice data
              const textInvoice = `
INVOICE - ${proposal.quoteNumber}

Company: ${contractorInfo.companyName}
Customer: ${proposal.customerName}
Email: ${proposal.customerEmail}

Project Total: $${proposal.total}
Status: ${proposal.status}

Generated: ${new Date().toLocaleDateString()}

Note: PDF generation is temporarily unavailable. Please contact us for a formatted invoice.
              `.trim();
              
              res.setHeader('Content-Type', 'text/plain');
              res.setHeader('Content-Disposition', `attachment; filename="Invoice-${proposal.quoteNumber}.txt"`);
              return res.send(textInvoice);
            }
          }

          fileName = `Invoice-${proposal.quoteNumber}.pdf`;
          break;

        case 'work_order':
          if (!proposal.selectionsComplete && proposal.status !== 'deposit_paid') {
            return res.status(400).json({
              success: false,
              message: 'Work order not available until selections are complete'
            });
          }
          const workOrderService = require('../services/workOrderService');
          const enrichedForWorkOrder = await buildEnrichedQuoteWithSelections(proposal);
          pdfBuffer = await workOrderService.generateWorkOrder({
            job: job || {},
            quote: enrichedForWorkOrder,
            contractorInfo
          });
          fileName = `WorkOrder-${job?.jobNumber || proposal.quoteNumber}.pdf`;
          break;

        case 'product_order':
          if (!proposal.selectionsComplete && proposal.status !== 'deposit_paid') {
            return res.status(400).json({
              success: false,
              message: 'Product order form not available until selections are complete'
            });
          }
          const productOrderService = require('../services/workOrderService');
          const enrichedForProductOrder = await buildEnrichedQuoteWithSelections(proposal);
          pdfBuffer = await productOrderService.generateProductOrderForm({
            job: job || {},
            quote: enrichedForProductOrder,
            contractorInfo
          });
          fileName = `ProductOrder-${job?.jobNumber || proposal.quoteNumber}.pdf`;
          break;

        case 'material_list':
          if (!proposal.selectionsComplete && proposal.status !== 'deposit_paid') {
            return res.status(400).json({
              success: false,
              message: 'Material list not available until selections are complete'
            });
          }
          const materialListService = require('../services/workOrderService');
          const enrichedForMaterialList = await buildEnrichedQuoteWithSelections(proposal);
          pdfBuffer = await materialListService.generateMaterialList({
            job: job || {},
            quote: enrichedForMaterialList,
            contractorInfo
          });
          fileName = `MaterialList-${job?.jobNumber || proposal.quoteNumber}.pdf`;
          break;

        case 'proposal':
          // Check if proposal PDF already exists
          if (proposal.proposalPdfUrl) {
            // Use existing PDF
            const fs = require('fs').promises;
            const path = require('path');
            const pdfPath = path.join(__dirname, '..', proposal.proposalPdfUrl);
            
            try {
              pdfBuffer = await fs.readFile(pdfPath);
              fileName = `Proposal-${proposal.quoteNumber}.pdf`;
            } catch (readError) {
              console.warn('[CustomerPortal] Existing PDF not found, regenerating:', readError.message);
              // Fall through to generation if file doesn't exist
            }
          }
          
          // Generate new PDF if no existing one or read failed
          if (!pdfBuffer) {
            const documentGenerationService = require('../services/documentGenerationService');
            const result = await documentGenerationService.generateProposalPDF(proposal.id, tenantId);
            
            if (!result.success) {
              // If validation fails, fall back to invoice template as proposal
              console.warn('[CustomerPortal] Proposal PDF generation failed, using invoice template:', result.error);
              const invoiceTemplateService = require('../services/invoiceTemplateService');
              const ContractorSettings = require('../models/ContractorSettings');
              
              const settings = await ContractorSettings.findOne({ where: { tenantId } });
              const templateType = proposal.productStrategy === 'GBB' ? 'gbb' : 'single';
              const templateStyle = settings?.invoice_template_style || 'light';
              
              const invoiceData = {
                invoiceNumber: proposal.quoteNumber,
                issueDate: new Date().toLocaleDateString('en-US'),
                projectName: proposal.jobTitle || `${proposal.customerName} Project`,
                projectAddress: [proposal.street, proposal.city, proposal.state, proposal.zipCode].filter(Boolean).join(', '),
                customerName: proposal.customerName,
                customerPhone: proposal.customerPhone,
                customerEmail: proposal.customerEmail,
                pricingItems: [{
                  name: proposal.jobTitle || 'Project',
                  qty: 1,
                  amount: parseFloat(proposal.total || 0)
                }],
                projectInvestment: proposal.total,
                deposit: proposal.depositAmount,
                balance: (proposal.total || 0) - (proposal.depositAmount || 0)
              };
              
              pdfBuffer = await invoiceTemplateService.generateInvoice({
                templateType,
                style: templateStyle,
                invoiceData,
                contractorInfo
              });
            } else {
              // Read the generated PDF file
              const fs = require('fs').promises;
              const path = require('path');
              const pdfPath = path.join(__dirname, '..', result.pdfUrl);
              pdfBuffer = await fs.readFile(pdfPath);
            }
            
            fileName = `Proposal-${proposal.quoteNumber}.pdf`;
          }
          break;
          
        case 'invoice':
          // Invoice is only available after deposit is paid
          if (!proposal.depositVerified) {
            return res.status(403).json({
              success: false,
              message: 'Invoice not available until deposit is paid'
            });
          }
          
          // Check if invoice PDF already exists
          if (proposal.invoicePdfUrl) {
            // Use existing PDF
            const fs = require('fs').promises;
            const path = require('path');
            const pdfPath = path.join(__dirname, '..', proposal.invoicePdfUrl);
            
            try {
              pdfBuffer = await fs.readFile(pdfPath);
              fileName = `Invoice-${proposal.quoteNumber}.pdf`;
            } catch (readError) {
              console.warn('[CustomerPortal] Existing invoice PDF not found, regenerating:', readError.message);
              // Fall through to generation if file doesn't exist
            }
          }
          
          // Generate new invoice if no existing one or read failed
          if (!pdfBuffer) {
            const invoiceTemplateService = require('../services/invoiceTemplateService');
            const ContractorSettings = require('../models/ContractorSettings');
            const Tenant = require('../models/Tenant');
            
            const [settings, tenant] = await Promise.all([
              ContractorSettings.findOne({ where: { tenantId } }),
              Tenant.findByPk(tenantId)
            ]);
            
            // Determine tier pricing
            let tierTotal = parseFloat(proposal.total || 0);
            let tierDeposit = parseFloat(proposal.depositAmount || 0);
            
            if (proposal.productStrategy === 'GBB' && proposal.gbbTierPricing) {
              const tiers = typeof proposal.gbbTierPricing === 'string' 
                ? JSON.parse(proposal.gbbTierPricing) 
                : proposal.gbbTierPricing;
              
              const selectedTier = proposal.gbbSelectedTier || 'better';
              const tier = tiers[selectedTier];
              
              if (tier) {
                tierTotal = parseFloat(tier.total || tierTotal);
                tierDeposit = parseFloat(tier.deposit || tierDeposit);
              }
            }
            
            const templateType = proposal.productStrategy === 'GBB' ? 'gbb' : 'single';
            const templateStyle = settings?.invoiceTemplateStyle || 'light';
            
            const invoiceData = {
              invoiceNumber: proposal.quoteNumber,
              issueDate: new Date().toLocaleDateString('en-US'),
              projectName: `${proposal.customerName} Project`,
              projectAddress: [proposal.street, proposal.city, proposal.state, proposal.zipCode].filter(Boolean).join(', '),
              customerName: proposal.customerName,
              customerPhone: proposal.customerPhone,
              customerEmail: proposal.customerEmail,
              selectedTier: proposal.gbbSelectedTier || null,
              pricingItems: [{
                name: 'Project Total',
                qty: 1,
                amount: tierTotal
              }],
              projectInvestment: tierTotal,
              deposit: tierDeposit,
              balance: tierTotal - tierDeposit,
              depositPaid: true,
              depositPaidDate: proposal.depositPaidAt ? new Date(proposal.depositPaidAt).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US'),
            };
            
            const updatedContractorInfo = {
              name: tenant?.companyName || contractorInfo.name,
              email: tenant?.email || contractorInfo.email,
              phone: tenant?.phoneNumber || contractorInfo.phone,
              address: tenant?.businessAddress || contractorInfo.address,
              logo: tenant?.companyLogoUrl || contractorInfo.logo,
            };
            
            pdfBuffer = await invoiceTemplateService.generateInvoice({
              templateType,
              style: templateStyle,
              invoiceData,
              contractorInfo: updatedContractorInfo
            });
            
            fileName = `Invoice-${proposal.quoteNumber}.pdf`;
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid document type'
          });
      }

      // OPTIMIZATION: Cache the generated PDF for 30 minutes
      if (req.cache && pdfBuffer) {
        await req.cache.set(cacheKey, {
          buffer: pdfBuffer.toString('base64'), // Store as base64 string
          fileName
        }, 1800, { // 30 minutes TTL
          tags: [`tenant:${tenantId}`, `proposal:${proposalId}`, 'pdf']
        });
        console.log(`?? PDF cached for ${docType}:${proposalId}`);
      }

      // Set headers for PDF response (download)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate document',
        error: pdfError.message
      });
    }
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: error.message
    });
  }
};

/**
 * View document (inline PDF viewing)
 * GET /api/customer-portal/proposals/:proposalId/documents/:docType/view
 * Note: This endpoint can be accessed with query param ?token=XXX for iframe viewing
 */
exports.viewDocument = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { docType } = req.params;
    const { token } = req.query; // Support token query param for iframe access
    
    let customerId = null;
    let tenantId = req.customerTenantId;

    // If token provided, validate it first (for iframe viewing)
    if (token) {
      try {
        const MagicLinkService = require('../services/magicLinkService');
        
        // First try to validate as a session token (JWT)
        try {
          const sessionResult = await MagicLinkService.validateSession(token, req.ip, req.headers['user-agent']);
          if (sessionResult.valid) {
            customerId = sessionResult.client.id;
            tenantId = sessionResult.session.tenantId;
            console.log('? Document view via session token');
          }
        } catch (sessionErr) {
          // If session validation fails, try magic link validation
          console.log('Session token validation failed, trying magic link:', sessionErr.message);
          const result = await MagicLinkService.validateMagicLink(token, req.ip, req.headers['user-agent']);
          console.log('Magic link validation result (view):', result);
          if (result.valid && result.magicLink) {
            customerId = result.magicLink.clientId;
          const sessionQuote = await Quote.findOne({
            where: { id: proposalId, clientId: result.magicLink.clientId }
          });
          
          if (sessionQuote) {
            customerId = result.magicLink.clientId;
            tenantId = result.magicLink.tenantId;
          }
        }
    }
      } catch (tokenError) {
        console.error('Token validation error:', tokenError);
      }
    }

    if (!customerId) {
      res.status(401).set('Content-Type', 'text/html');
      return res.send(`<html><body style="font-family: Arial, Helvetica, sans-serif; padding: 40px;"><h2>Authentication required</h2><p>No valid session or token was provided. Please access your portal link again to view documents.</p></body></html>`);
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        tenantId
      }
    });

    if (!proposal) {
      res.status(404).set('Content-Type', 'text/html');
      return res.send(`<html><body style="font-family: Arial, Helvetica, sans-serif; padding: 40px;"><h2>Document not found</h2><p>The requested proposal or document could not be found. Please check the link or contact support.</p></body></html>`);
    }

    // Get related job if exists
    const Job = require('../models/Job');
    const job = await Job.findOne({
      where: { quoteId: proposal.id, tenantId }
    });

    // Get contractor info
    const Tenant = require('../models/Tenant');
    const contractor = await Tenant.findByPk(tenantId);
    const contractorInfo = {
      companyName: contractor?.companyName || 'Professional Painting Co.',
      address: contractor?.address || '',
      phone: contractor?.phoneNumber || '',
      email: contractor?.email || '',
      logo: contractor?.companyLogoUrl || null
    };

    // Generate PDF (same logic as download)
    let pdfBuffer;
    
    try {
      switch (docType) {
        case 'invoice':
          const invoiceTemplateService = require('../services/invoiceTemplateService');
          const ContractorSettings = require('../models/ContractorSettings');
          const settings = await ContractorSettings.findOne({ where: { tenantId } });
          
          const templateType = proposal.productStrategy === 'GBB' ? 'gbb' : 'single';
          const templateStyle = settings?.invoice_template_style || 'light';
          
          // Enrich for scope/materials generation (does not affect invoice pricing)
          const enrichedForInvoice = await buildEnrichedQuoteWithSelections(proposal);

          // Get scope of work from ProposalDefaults if not set on quote
          const ProposalDefaults = require('../models/ProposalDefaults');
          const proposalDefaults = await ProposalDefaults.findOne({ where: { tenantId } });
          
          const derivedScope = (proposal.scopeOfWork && proposal.scopeOfWork.length > 0)
            ? proposal.scopeOfWork
            : (proposalDefaults?.scopeOfWork 
                ? [proposalDefaults.scopeOfWork]
                : (proposal.jobScope ? [proposal.jobScope] : []));

          // Build a simple materials/selections list from enriched areas
          const materialsSelections = Array.isArray(enrichedForInvoice?.areas)
            ? enrichedForInvoice.areas
              .filter(a => a.customerSelections)
              .map(a => {
                const cs = a.customerSelections || {};
                const parts = [];
                
                // Add product name if available
                if (cs.product && cs.product !== 'Not selected') {
                  parts.push(cs.product);
                }
                
                // Add sheen if available
                if (cs.sheen) {
                  parts.push(cs.sheen);
                }
                
                // Add color info if available
                const colorParts = [];
                if (cs.color && cs.color !== 'Not selected') {
                  colorParts.push(cs.color);
                }
                if (cs.colorNumber) {
                  colorParts.push(cs.colorNumber);
                }
                if (colorParts.length > 0) {
                  parts.push(colorParts.join(' '));
                }
                
                return parts.length > 0 ? parts.join(' ? ') : null;
              })
              .filter(Boolean)
            : [];
          
          // If no materials from customer selections, try to extract from productSets using helper function
          if (materialsSelections.length === 0 && proposal.productSets) {
            try {
              const selectedTier = proposal.gbbSelectedTier?.toLowerCase();
              const productIds = extractProductIdsFromProductSets(proposal.productSets, selectedTier);
              
              if (productIds.length > 0) {
                const productLookup = await resolveProductNamesFromIds(productIds, proposal.tenantId);
                productIds.forEach(productId => {
                  const productName = productLookup.get(productId);
                  if (productName) {
                    materialsSelections.push(productName);
                  }
                });
              }
              
              // If still no products found and we had a specific tier, try all tiers
              if (materialsSelections.length === 0 && selectedTier) {
                const allProductIds = extractProductIdsFromProductSets(proposal.productSets);
                if (allProductIds.length > 0) {
                  const productLookup = await resolveProductNamesFromIds(allProductIds, proposal.tenantId);
                  allProductIds.forEach(productId => {
                    const productName = productLookup.get(productId);
                    if (productName) {
                      materialsSelections.push(productName);
                    }
                  });
                }
              }
            } catch (error) {
              console.error('Error resolving product names from database:', error);
              // Fallback to old method if database lookup fails
              const extractedProducts = extractProductNamesFromProductSets(proposal.productSets);
              const selectedTier = proposal.gbbSelectedTier?.toLowerCase();
              
              if (selectedTier && extractedProducts[selectedTier]) {
                extractedProducts[selectedTier].forEach(productName => {
                  materialsSelections.push(productName);
                });
              } else {
                // Fallback to any available products
                ['better', 'good', 'best'].forEach(tier => {
                  if (extractedProducts[tier] && extractedProducts[tier].size > 0) {
                    extractedProducts[tier].forEach(productName => {
                      materialsSelections.push(productName);
                    });
                  }
                });
              }
            }
          }
          
          const invoiceData = {
            invoiceNumber: proposal.quoteNumber || `INV-${Date.now()}`,
            issueDate: new Date().toLocaleDateString('en-US'),
            dueDate: proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString('en-US') : null,
            projectName: proposal.jobTitle || `${proposal.customerName} Project`,
            projectAddress: [proposal.street, proposal.city, proposal.state, proposal.zipCode].filter(Boolean).join(', '),
            customerName: proposal.customerName,
            customerPhone: proposal.customerPhone,
            customerEmail: proposal.customerEmail,
            welcomeMessage: settings?.welcomeMessage || null,
            scopeOfWork: derivedScope,
            materialsSelections,
            estimatedDuration: proposal.estimatedDuration || null,
            estimatedStartDate: proposal.scheduledStartDate || null,
            selectedTier: proposal.gbbSelectedTier ? proposal.gbbSelectedTier.toUpperCase() : null,
 pricingItems: [
              {
                name: proposal.jobTitle || 'Project',
                qty: 1,
                rate: null,
                amount: parseFloat(proposal.total || 0),
              },
            ],
            projectInvestment: proposal.total,
            deposit: proposal.depositAmount,
            balance: (proposal.total || 0) - (proposal.depositAmount || 0),
            projectTerms: []
          };

          // If GBB invoice, extract gbbOptions from proposal.productSets
          if (templateType === 'gbb') {
            invoiceData.gbbOptions = extractGBBOptionsFromProductSets(proposal.productSets);
            
            // Add tier pricing data for GBB invoices
            addTierPricingToInvoiceData(invoiceData, proposal);
          }

          try {
            pdfBuffer = await invoiceTemplateService.generateInvoice({
              templateType,
              style: templateStyle,
              invoiceData,
              contractorInfo
            });

            if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
              console.error('Invoice PDF generation returned invalid buffer (view)', { proposalId: proposal.id, templateType, templateStyle });
              throw new Error('Invalid PDF buffer');
            }
          } catch (invoiceErr) {
            console.error('Invoice generation failed for view, attempting fallback:', invoiceErr && invoiceErr.message);
            try {
              // Fallback: render single-item invoice HTML and convert to PDF
              const fallbackHtml = invoiceTemplateService.generateSingleItemInvoiceHTML({ style: templateStyle, invoiceData, contractorInfo });
              const { htmlToPdfBuffer } = require('../services/pdfService');
              const fallbackPdf = await htmlToPdfBuffer(fallbackHtml, { waitUntil: 'load' });
              if (!fallbackPdf || !Buffer.isBuffer(fallbackPdf)) {
                console.error('Fallback PDF generation also failed (invalid buffer) for view');
                return res.status(500).json({ success: false, message: 'Failed to generate invoice PDF (fallback failed)' });
              }

              pdfBuffer = fallbackPdf;
              console.warn('Fallback invoice PDF generated successfully for view');
            } catch (fallbackErr) {
              console.error('Fallback invoice PDF generation failed for view:', fallbackErr && fallbackErr.message);
              return res.status(500).json({ success: false, message: 'Failed to generate invoice PDF' });
            }
          }

          break;

        case 'work_order':
          if (!proposal.selectionsComplete && proposal.status !== 'deposit_paid') {
            return res.status(400).json({
              success: false,
              message: 'Work order not available until selections are complete'
            });
          }
          const workOrderService = require('../services/workOrderService');
          const enrichedForWorkOrder = await buildEnrichedQuoteWithSelections(proposal);
          pdfBuffer = await workOrderService.generateWorkOrder({
            job: job || {},
            quote: enrichedForWorkOrder,
            contractorInfo
          });
          break;

        case 'product_order':
          if (!proposal.selectionsComplete && proposal.status !== 'deposit_paid') {
            return res.status(400).json({
              success: false,
              message: 'Product order form not available until selections are complete'
            });
          }
          const productOrderService = require('../services/workOrderService');
          const enrichedForProductOrder = await buildEnrichedQuoteWithSelections(proposal);
          pdfBuffer = await productOrderService.generateProductOrderForm({
            job: job || {},
            quote: enrichedForProductOrder,
            contractorInfo
          });
          break;

        case 'material_list':
          if (!proposal.selectionsComplete && proposal.status !== 'deposit_paid') {
            return res.status(400).json({
              success: false,
              message: 'Material list not available until selections are complete'
            });
          }
          const materialListService = require('../services/workOrderService');
          const enrichedForMaterialList = await buildEnrichedQuoteWithSelections(proposal);
          pdfBuffer = await materialListService.generateMaterialList({
            job: job || {},
            quote: enrichedForMaterialList,
            contractorInfo
          });
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid document type'
          });
      }

      // Set headers for inline PDF viewing
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      
      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate document',
        error: pdfError.message
      });
    }
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).set('Content-Type', 'text/html');
    const message = process.env.NODE_ENV === 'development' ? (`<pre>${error.message}</pre>`) : '';
    return res.send(`<html><body style="font-family: Arial, Helvetica, sans-serif; padding: 40px;"><h2>Failed to generate document</h2><p>The server encountered an error generating this document. Please contact support.</p>${message}</body></html>`);
  }
};

/**
 * Create Stripe payment intent for deposit
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id,
        clientId: customerId,
        tenantId,
        status: 'accepted'
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or not accepted'
      });
    }

    // Calculate deposit amount (use depositAmount field or calculate from total)
    const depositAmount = proposal.depositAmount || (proposal.total * 0.5); // 50% default

    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deposit amount'
      });
    }

    // Create Stripe payment intent
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(depositAmount * 100), // Amount in cents
        currency: 'usd',
        metadata: {
          proposalId: proposal.id,
          quoteNumber: proposal.quoteNumber,
          customerId: customerId,
          customerEmail: proposal.customerEmail,
          selectedTier: proposal.gbbSelectedTier
        },
        automatic_payment_methods: {
          enabled: true,
        }
      });

      res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          amount: depositAmount,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
        }
      });
    } catch (stripeError) {
      console.error('Stripe payment intent error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        error: stripeError.message
      });
    }
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
};

/**
 * Verify deposit payment and open customer portal
 * Called after successful Stripe payment
 * Implements idempotency and comprehensive error handling
 */
exports.verifyDepositAndOpenPortal = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentIntentId } = req.body;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    // Validate input
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id,
        clientId: customerId,
        tenantId,
        status: 'accepted'
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found or not in accepted status'
      });
    }

    // IDEMPOTENCY CHECK: If deposit already verified with same transaction ID, return success
    if (proposal.depositVerified && proposal.depositTransactionId === paymentIntentId) {
      return res.json({
        success: true,
        message: 'Deposit already verified for this payment',
        data: {
          portalOpen: proposal.portalOpen,
          portalExpiresAt: proposal.portalClosedAt,
          portalDurationDays: Math.ceil((new Date(proposal.portalClosedAt) - new Date(proposal.portalOpenedAt)) / (1000 * 60 * 60 * 24)),
          redirectTo: `/portal/finish-standards/${id}`,
          alreadyProcessed: true
        }
      });
    }

    // EDGE CASE: Deposit verified but different transaction ID (possible fraud/error)
    if (proposal.depositVerified && proposal.depositTransactionId !== paymentIntentId) {
      console.error(`Payment verification conflict: Proposal ${id} already has transaction ${proposal.depositTransactionId}, attempted ${paymentIntentId}`);
      return res.status(409).json({
        success: false,
        message: 'Deposit has already been verified with a different payment. Please contact support.',
        code: 'PAYMENT_CONFLICT'
      });
    }

    // Verify payment intent with Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // COMPREHENSIVE STATUS CHECKS
      if (paymentIntent.status === 'succeeded') {
        // Payment successful - continue processing
        console.log(`Payment ${paymentIntentId} verified as succeeded`);
      } else if (paymentIntent.status === 'processing') {
        // Payment still processing - ask customer to wait
        return res.status(202).json({
          success: false,
          message: 'Payment is still processing. Please wait a moment and try again.',
          code: 'PAYMENT_PROCESSING',
          status: 'processing'
        });
      } else if (paymentIntent.status === 'requires_payment_method') {
        // Payment failed - needs new payment method
        return res.status(400).json({
          success: false,
          message: 'Payment failed. Please try again with a different payment method.',
          code: 'PAYMENT_FAILED',
          status: 'requires_payment_method'
        });
      } else if (paymentIntent.status === 'canceled') {
        // Payment canceled
        return res.status(400).json({
          success: false,
          message: 'Payment was canceled. Please try again.',
          code: 'PAYMENT_CANCELED',
          status: 'canceled'
        });
      } else {
        // Unknown status
        console.error(`Unexpected payment status: ${paymentIntent.status}`);
        return res.status(400).json({
          success: false,
          message: `Payment status is ${paymentIntent.status}. Please contact support.`,
          code: 'PAYMENT_UNEXPECTED_STATUS',
          status: paymentIntent.status
        });
      }

      // SECURITY: Verify payment amount matches expected deposit
      const expectedAmountCents = Math.round(proposal.depositAmount * 100);
      if (paymentIntent.amount !== expectedAmountCents) {
        console.error(`Payment amount mismatch: Expected ${expectedAmountCents}, got ${paymentIntent.amount}`);
        return res.status(400).json({
          success: false,
          message: 'Payment amount does not match expected deposit. Please contact support.',
          code: 'AMOUNT_MISMATCH'
        });
      }

      // SECURITY: Verify payment metadata matches proposal
      if (paymentIntent.metadata.proposalId !== id.toString()) {
        console.error(`Payment metadata mismatch: Expected proposal ${id}, got ${paymentIntent.metadata.proposalId}`);
        return res.status(400).json({
          success: false,
          message: 'Payment does not match this proposal. Please contact support.',
          code: 'PROPOSAL_MISMATCH'
        });
      }

    } catch (stripeError) {
      console.error('Stripe verification error:', stripeError);
      
      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment information. Please try again.',
          code: 'INVALID_PAYMENT_INTENT'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment with Stripe. Please try again.',
        error: stripeError.message,
        code: 'STRIPE_VERIFICATION_ERROR'
      });
    }

    // Get contractor settings for portal duration
    const ContractorSettings = require('../models/ContractorSettings');
    const settings = await ContractorSettings.findOne({
      where: { tenantId: proposal.tenantId }
    });

    const portalDurationDays = settings?.portalDurationDays || 14;
    const portalExpiresAt = new Date();
    portalExpiresAt.setDate(portalExpiresAt.getDate() + portalDurationDays);

    // CRITICAL: Use transaction for atomic update with rollback capability
    const sequelize = proposal.sequelize;
    const transaction = await sequelize.transaction();

    try {
      // Use Phase 1 status flow for deposit_paid transition
      const StatusFlowService = require('../services/statusFlowService');
      try {
        await StatusFlowService.handlePaymentSuccess(
          proposal.id,
          paymentIntentId,
          {
            tenantId,
            userId: null, // Automated
            transaction
          }
        );

        // Reload proposal to get updated status
        await proposal.reload({ transaction });

        // Open portal after deposit is paid
        await proposal.update({
          portalOpen: true,
          portalOpenedAt: new Date(),
          portalClosedAt: portalExpiresAt, // Set when portal should auto-close
        }, { transaction });
      } catch (statusError) {
        console.error('Status transition error:', statusError);
        // Fallback to direct update if status flow fails
        await proposal.update({
          depositVerified: true,
          depositVerifiedAt: new Date(),
          depositPaymentMethod: 'stripe',
          depositTransactionId: paymentIntentId,
          portalOpen: true,
          portalOpenedAt: new Date(),
          portalClosedAt: portalExpiresAt,
          status: 'deposit_paid'
        }, { transaction });
      }

      // CRITICAL: CREATE JOB RECORD (Quote ? Job transition)
      // This is the key pipeline hand-off from quoting to job management
      const Job = require('../models/Job');
      
      // Generate unique job number
      const jobCount = await Job.count({ 
        where: { tenantId: proposal.tenantId },
        transaction 
      });
      const jobNumber = `JOB-${new Date().getFullYear()}-${String(jobCount + 1).padStart(4, '0')}`;
      
      // Create job from accepted quote
      const job = await Job.create({
        tenantId: proposal.tenantId,
        userId: proposal.userId,
        clientId: proposal.clientId,
        quoteId: proposal.id,
        jobNumber,
        jobName: `${proposal.customerName} - ${proposal.jobType || 'Painting'} Project`,
        customerName: proposal.customerName,
        customerEmail: proposal.customerEmail,
        customerPhone: proposal.customerPhone || null,
        jobAddress: proposal.propertyAddress || proposal.serviceAddress || null,
        status: proposal.selectionsComplete ? 'selections_complete' : 'deposit_paid', // Set status based on selections
        totalAmount: proposal.total,
        depositAmount: proposal.depositAmount,
        depositPaid: true,
        depositPaidAt: new Date(),
        balanceRemaining: proposal.total - proposal.depositAmount,
        selectedTier: proposal.gbbSelectedTier,
        jobType: proposal.jobType || 'interior',
        customerSelectionsComplete: proposal.selectionsComplete || false,
        customerSelectionsSubmittedAt: proposal.selectionsCompletedAt || null,
        portalExpiresAt: portalExpiresAt,
        materialListGenerated: false,
        workOrderGenerated: false,
        areaProgress: {} // Initialize empty area progress tracking
      }, { transaction });

      console.log(`Job ${jobNumber} created successfully from proposal ${id}`);

      // Commit transaction - all changes saved atomically
      await transaction.commit();
      console.log(`Proposal ${id} deposit verified, portal opened, and Job ${jobNumber} created successfully`);
      
    } catch (dbError) {
      // ROLLBACK: Database update failed, rollback transaction
      await transaction.rollback();
      console.error('Database update failed, transaction rolled back:', dbError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process payment verification. Your payment was successful but portal could not be opened. Please contact support.',
        code: 'DATABASE_UPDATE_FAILED',
        error: dbError.message,
        paymentIntentId // Include for support reference
      });
    }

    // Fetch client info for audit log
    const client = await Client.findByPk(customerId);

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId: proposal.tenantId,
      action: 'deposit_verified',
      category: 'quote',
      entityType: 'Quote',
      entityId: id,
      details: {
        proposalId: id,
        paymentIntentId,
        amount: paymentIntent.amount / 100,
        portalExpiresAt
      },
      metadata: {
        clientId: customerId,
        clientEmail: client?.email,
        clientName: client?.name
      },
      req
    });

    // Send confirmation email to customer with portal link
    try {
      await emailService.sendDepositVerifiedEmail(proposal.customerEmail, {
        customerName: proposal.customerName,
        quoteNumber: proposal.quoteNumber,
        id: proposal.id,
        depositAmount: proposal.depositAmount
      }, { tenantId: proposal.tenantId });
    } catch (emailError) {
      console.error('Error sending deposit verified email:', emailError);
    }

    res.json({
      success: true,
      message: 'Deposit verified! Your customer portal is now open.',
      data: {
        portalOpen: true,
        portalExpiresAt,
        portalDurationDays,
        redirectTo: `/portal/finish-standards/${id}`
      }
    });
  } catch (error) {
    console.error('Verify deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify deposit',
      error: error.message
    });
  }
};

/**
 * Check payment status for recovery/debugging
 * Allows customer to check if their payment succeeded without triggering new processing
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { paymentIntentId } = req.query;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const status = {
      proposalId: proposal.id,
      proposalStatus: proposal.status,
      depositVerified: proposal.depositVerified,
      portalOpen: proposal.portalOpen,
      transactionId: proposal.depositTransactionId
    };

    // If payment intent ID provided, check with Stripe
    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        status.stripeStatus = paymentIntent.status;
        status.stripeAmount = paymentIntent.amount / 100;
        status.stripeCreated = new Date(paymentIntent.created * 1000);
        
        // Check if matches our records
        status.transactionMatches = proposal.depositTransactionId === paymentIntentId;
      } catch (stripeError) {
        status.stripeError = stripeError.message;
      }
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};

/**
 * Check portal status and auto-lock if expired
 */
exports.checkPortalStatus = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const proposal = await Quote.findOne({
      where: { 
        id: proposalId,
        clientId: customerId,
        tenantId
      }
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Check if portal should be auto-locked
    let portalStatus = {
      isOpen: proposal.portalOpen,
      expiresAt: proposal.portalClosedAt,
      isExpired: false,
      selectionsComplete: proposal.selectionsComplete
    };

    if (proposal.portalOpen && proposal.portalClosedAt) {
      const now = new Date();
      const expiryDate = new Date(proposal.portalClosedAt);
      
      if (now > expiryDate) {
        // Auto-lock portal
        await proposal.update({
          portalOpen: false,
          portalClosedAt: now
        });

        portalStatus.isOpen = false;
        portalStatus.isExpired = true;

        // Notify contractor
        try {
          const User = require('../models/User');
          const contractor = await User.findByPk(proposal.userId);
          if (contractor && contractor.email) {
            await emailService.sendPortalExpiredEmail(contractor.email, {
              quoteNumber: proposal.quoteNumber,
              customerName: proposal.customerName,
              proposalId: proposal.id
            });
          }
        } catch (emailError) {
          console.error('Error sending portal expired email:', emailError);
        }
      }
    }

    res.json({
      success: true,
      data: portalStatus
    });
  } catch (error) {
    console.error('Check portal status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check portal status',
      error: error.message
    });
  }
};

/**
 * Get all sheens for product selection
 */
exports.getSheens = async (req, res) => {
  try {
    // Return standard paint sheens
    const sheens = [
      { id: 1, name: 'Flat', description: 'No sheen, hides imperfections' },
      { id: 2, name: 'Matte', description: 'Low sheen, minimal light reflection' },
      { id: 3, name: 'Eggshell', description: 'Slight sheen, easy to clean' },
      { id: 4, name: 'Satin', description: 'Soft sheen, durable' },
      { id: 5, name: 'Semi-Gloss', description: 'Noticeable sheen, moisture resistant' },
      { id: 6, name: 'Gloss', description: 'High shine, very durable' }
    ];

    res.json({
      success: true,
      data: sheens
    });
  } catch (error) {
    console.error('Get sheens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sheens',
      error: error.message
    });
  }
};

// Tier upgrade - create additional payment intent
exports.upgradeTier = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { newTier, additionalAmount } = req.body;
    const clientId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!clientId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    if (!['good', 'better', 'best'].includes(newTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier selection'
      });
    }

    const quote = await Quote.findOne({
      where: { id: proposalId, clientId, tenantId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!quote.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Initial deposit must be paid before upgrading tier'
      });
    }

    // Store upgrade request in quote
    await quote.update({
      pendingTierUpgrade: newTier,
      tierUpgradeAmount: additionalAmount
    });

    res.json({
      success: true,
      message: 'Tier upgrade request created',
      data: {
        proposalId,
        newTier,
        additionalAmount
      }
    });
  } catch (error) {
    console.error('Upgrade tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process tier upgrade',
      error: error.message
    });
  }
};

// Request tier change (downgrade or upgrade approval)
exports.requestTierChange = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { newTier, reason } = req.body;
    const clientId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!clientId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    if (!['good', 'better', 'best'].includes(newTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier selection'
      });
    }

    const quote = await Quote.findOne({
      where: { id: proposalId, clientId, tenantId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!quote.depositVerified) {
      return res.status(400).json({
        success: false,
        message: 'Tier is not locked yet. You can change it freely before deposit payment.'
      });
    }

    // Create a tier change request (can be stored in quote or separate table)
    await quote.update({
      tierChangeRequest: newTier,
      tierChangeReason: reason,
      tierChangeRequestedAt: new Date()
    });

    // TODO: Send notification to contractor about tier change request

    res.json({
      success: true,
      message: 'Tier change request submitted successfully. Your contractor will review it.',
      data: {
        proposalId,
        requestedTier: newTier,
        currentTier: quote.gbbSelectedTier
      }
    });
  } catch (error) {
    console.error('Request tier change error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit tier change request',
      error: error.message
    });
  }
};


/**
 * Get all jobs for customer (quotes that have been converted to jobs)
 * OPTIMIZED: Implements caching and selective field loading
 */
exports.getCustomerJobs = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;
    
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.CUSTOMER_JOBS(customerId);
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

    const Job = require('../models/Job');

    const whereClause = { clientId: customerId };
    if (tenantId) whereClause.tenantId = tenantId;

    // OPTIMIZATION: Use selective field loading and eager loading
    const jobs = await Job.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'areas', 'gbbSelectedTier']
        }
      ],
      attributes: [
        'quoteId',
        'id',
        'jobNumber',
        'jobName',
        'status',
        'scheduledStartDate',
        'scheduledEndDate',
        'estimatedDuration',
        'actualStartDate',
        'actualEndDate',
        'customerSelectionsComplete',
        'areaProgress',
        'totalAmount',
        'depositAmount',
        'createdAt'
      ]
    });

    const result = {
      success: true,
      data: jobs
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL.JOBS, {
        tags: [`customer:${customerId}`, 'jobs']
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get customer jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
};

/**
 * Get job detail with progress for customer
 * OPTIMIZED: Implements caching and selective field loading
 */
exports.getJobDetail = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;
    const { jobId } = req.params;
    
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.JOB_DETAIL(customerId, jobId);
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedDetail = await utils.cache?.get(cacheKey);
      
      if (cachedDetail) {
        return res.json({
          ...cachedDetail,
          cached: true
        });
      }
    }

    const Job = require('../models/Job');

    // OPTIMIZATION: Use selective field loading and eager loading
    const job = await Job.findOne({
      where: { 
        id: jobId, 
        clientId: customerId 
      },
      include: [
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber', 'areas', 'gbbSelectedTier', 'breakdown', 'flatRateItems', 'productSets', 'pricingSchemeId'],
          include: [{
            model: require('../models/PricingScheme'),
            as: 'pricingScheme',
            attributes: ['id', 'name', 'type']
          }]
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone']
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
        tags: [`customer:${customerId}`, 'job-details']
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get job detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job details',
      error: error.message
    });
  }
};

/**
 * Get job calendar events for current customer (view-only)
 * GET /api/customer-portal/jobs/calendar
 */
exports.getCustomerJobCalendar = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    const tenantId = req.customerTenantId;
    const Job = require('../models/Job');

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const jobs = await Job.findAll({
      where: {
        clientId: customerId,
        ...(tenantId ? { tenantId } : {}),
        // Only show scheduled / in progress / completed
        status: ['scheduled', 'in_progress', 'completed']
      },
      attributes: [
        'id',
        'jobNumber',
        'jobName',
        'status',
        'scheduledStartDate',
        'scheduledEndDate',
        'estimatedDuration',
        'actualStartDate',
        'actualEndDate',
        'customerName'
      ],
      order: [['scheduledStartDate', 'ASC']]
    });

    const events = jobs.map(job => ({
      id: job.id,
      title: `${job.jobNumber} - ${job.customerName}`,
      start: job.scheduledStartDate || job.actualStartDate,
      end: job.scheduledEndDate || job.actualEndDate || job.scheduledStartDate || job.actualStartDate,
      status: job.status,
      duration: job.estimatedDuration,
      jobNumber: job.jobNumber,
      customerName: job.customerName
    })).filter(e => e.start); // only with dates

    return res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get customer job calendar error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch job calendar',
      error: error.message
    });
  }
};

// ============================================================================
// QUOTE MANAGEMENT (Magic Link Session Based)
// ============================================================================

/**
 * Get all accessible quotes for current session
 * GET /api/customer-portal/quotes
 */
exports.getQuotes = async (req, res) => {
  try {
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    const isVerified = req.isVerifiedCustomer;
    
    // Build query based on verification status
    const whereClause = {
      tenantId,
      clientId,
      // Filter out draft quotes - customers should only see sent/accepted/declined/completed quotes
      status: {
        [Op.notIn]: ['draft']
      }
    };
    
    // If not verified, only show quote from magic link (first/only quoteId in session)
    const primaryQuoteId = Array.isArray(req.customerSession.quoteIds) ? req.customerSession.quoteIds[0] : null;
    
    if (!isVerified) {
      if (primaryQuoteId) {
        whereClause.id = primaryQuoteId;
      } else {
        // Emergency fallback: if no primary quote ID, find the most recent quote for this client
        // This handles edge cases where session might not have proper quote IDs
        console.warn('?? No primary quote ID found in session for unverified customer');
        
        const allClientQuotes = await Quote.findAll({
          where: { tenantId, clientId, },
          attributes: ['id', 'quoteNumber', 'status', 'createdAt'],
          order: [['createdAt', 'DESC']],
          limit: 1
        });
        
        if (allClientQuotes.length === 1) {
          whereClause.id = allClientQuotes[0].id;
          console.log('?? Using fallback quote ID:', allClientQuotes[0].id);
          
          // Update the session to include this quote ID for future requests
          if (req.customerSession) {
            try {
              req.customerSession.quoteIds = [allClientQuotes[0].id];
              await req.customerSession.save();
            } catch (error) {
              console.error('Failed to update session:', error);
            }
          }
        }
      }
    }
    
    const quotes = await Quote.findAll({
      where: whereClause,
      attributes: [
        'id',
        'quoteNumber',
        'status',
        'total',
        'createdAt',
        'updatedAt',
        'jobType',
        'jobCategory',
        // Customer portal fields
        'depositAmount',
        'depositVerified',
        'gbbSelectedTier',
        'portalOpen',
        'selectionsComplete'
      ],
      order: [['createdAt', 'DESC']],
    });

    // Attach jobId for quotes that have an associated job
    const Job = require('../models/Job');
    const quoteIds = quotes.map(q => q.id);
    const jobs = await Job.findAll({ where: { quoteId: quoteIds }, attributes: ['id', 'quoteId'] });
    const jobLookup = {};
    jobs.forEach(j => { jobLookup[j.quoteId] = j.id; });

    const quotesWithJob = quotes.map(q => {
      const qObj = q.toJSON ? q.toJSON() : q;
      qObj.jobId = jobLookup[qObj.id] || null;
      return qObj;
    });

    res.json({
      success: true,
      quotes: quotesWithJob,
      isVerified,
      count: quotesWithJob.length,
    });
    
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get specific quote details
 * GET /api/customer-portal/quotes/:id
 */
exports.getQuoteDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    const isVerified = req.isVerifiedCustomer;
    
    // Build query - restrict to specific quote if not verified
    const whereClause = {
      id,
      tenantId,
      clientId,
    };
    
    // If not verified, only allow access to quote from magic link (first/only quoteId in session)
    const primaryQuoteId = Array.isArray(req.customerSession.quoteIds) ? req.customerSession.quoteIds[0] : null;
    if (!isVerified && primaryQuoteId) {
      if (parseInt(id) !== primaryQuoteId) {
        return res.status(403).json({
          success: false,
          message: 'Verification required to access other quotes. Please complete OTP verification.',
          code: 'VERIFICATION_REQUIRED',
        });
      }
    }
    
    const quote = await Quote.findOne({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'email', 'phone', 'address'],
        },
      ],
    });
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found or access denied',
      });
    }
    
    res.json({
      success: true,
      quote,
      isVerified,
    });
    
  } catch (error) {
    console.error('Get quote details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quote details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Approve a quote
 * POST /api/customer-portal/quotes/:id/approve
 */
exports.approveQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { signature, comments } = req.body;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    const isVerified = req.isVerifiedCustomer;
    
    // Build query
    const whereClause = {
      id,
      tenantId,
      clientId,
    };
    
    // If not verified, only allow access to quote from magic link (first/only quoteId in session)
    const primaryQuoteId = Array.isArray(req.customerSession.quoteIds) ? req.customerSession.quoteIds[0] : null;
    if (!isVerified && primaryQuoteId) {
      if (parseInt(id) !== primaryQuoteId) {
        return res.status(403).json({
          success: false,
          message: 'Verification required to approve other quotes',
          code: 'VERIFICATION_REQUIRED',
        });
      }
    }
    
    const quote = await Quote.findOne({ where: whereClause });
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found or access denied',
      });
    }
    
    // Check if quote can be approved
    if (quote.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Quote is already approved',
      });
    }
    
    if (quote.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve a declined quote',
      });
    }
    
    // Update quote using Phase 1 status flow (automated)
    const StatusFlowService = require('../services/statusFlowService');
    await StatusFlowService.transitionQuoteStatus(
      quote,
      'accepted', // Phase 1: accepted (not approved)
      {
        userId: null, // Customer action
        tenantId,
        isAdmin: false, // Automated customer action
        req
      }
    );
    
    // Update signature and comments separately
    await quote.update({
      customerSignature: signature,
      customerComments: comments,
    });
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Quote approved by customer',
      userId: null,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientId,
        clientEmail: req.customer.email,
        comments,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification email to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findOne({ 
        where: { tenantId, role: 'admin', isActive: true } 
      });
      
      if (contractor?.email) {
        await emailService.sendQuoteApprovedEmail(contractor.email, {
          quoteNumber: quote.quoteNumber,
          customerName: req.customer.name,
          customerEmail: req.customer.email,
          total: quote.total,
          comments,
        });
      }
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Don't fail the request if email fails
    }
    
    res.json({
      success: true,
      message: 'Quote approved successfully',
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        approvedAt: quote.approvedAt,
      },
    });
    
  } catch (error) {
    console.error('Approve quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve quote',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Reject a quote
 * POST /api/customer-portal/quotes/:id/reject
 */
exports.rejectQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, comments } = req.body;
    const clientId = req.customer.id;
    const tenantId = req.customerTenantId;
    const isVerified = req.isVerifiedCustomer;
    
    // Build query
    const whereClause = {
      id,
      tenantId,
      clientId,
    };
    
    // If not verified, only allow access to quote from magic link (first/only quoteId in session)
    const primaryQuoteId = Array.isArray(req.customerSession.quoteIds) ? req.customerSession.quoteIds[0] : null;
    if (!isVerified && primaryQuoteId) {
      if (parseInt(id) !== primaryQuoteId) {
        return res.status(403).json({
          success: false,
          message: 'Verification required to reject other quotes',
          code: 'VERIFICATION_REQUIRED',
        });
      }
    }
    
    const quote = await Quote.findOne({ where: whereClause });
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found or access denied',
      });
    }
    
    // Check if quote can be rejected
    if (quote.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: 'Quote is already rejected',
      });
    }
    
    if (quote.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an approved quote',
      });
    }
    
    // Update quote using Phase 1 status flow (automated)
    const StatusFlowService = require('../services/statusFlowService');
    await StatusFlowService.transitionQuoteStatus(
      quote,
      'declined', // Phase 1: declined/rejected
      {
        userId: null, // Customer action
        tenantId,
        isAdmin: false, // Automated customer action
        reason,
        req
      }
    );
    
    // Update comments separately
    await quote.update({
      customerComments: comments,
    });
    
    // Create audit log
    await createAuditLog({
      category: 'customer_portal',
      action: 'Quote rejected by customer',
      userId: null,
      tenantId,
      entityType: 'Quote',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientId,
        clientEmail: req.customer.email,
        reason,
        comments,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Send notification email to contractor
    try {
      const User = require('../models/User');
      const contractor = await User.findOne({ 
        where: { tenantId, role: 'admin', isActive: true } 
      });
      
      if (contractor?.email) {
        await emailService.sendQuoteRejectedEmail(contractor.email, {
          quoteNumber: quote.quoteNumber,
          customerName: req.customer.name,
          customerEmail: req.customer.email,
          total: quote.total,
          reason,
          comments,
        });
      }
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Don't fail the request if email fails
    }
    
    res.json({
      success: true,
      message: 'Quote rejected successfully',
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        declinedAt: quote.declinedAt,
      },
    });
    
  } catch (error) {
    console.error('Reject quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject quote',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark quote as viewed by customer
 * POST /api/customer-portal/quotes/:id/view
 */
exports.markQuoteViewed = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.customer?.id;
    const tenantId = req.customerTenantId;

    if (!clientId) {
      return res.status(401).json({
        success: false,
        message: 'Customer ID not found'
      });
    }

    const quote = await Quote.findOne({
      where: { id, clientId, tenantId }
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Mark as viewed using Phase 1 status flow
    const StatusFlowService = require('../services/statusFlowService');
    try {
      await StatusFlowService.transitionQuoteStatus(
        quote,
        'viewed',
        {
          userId: null, // Customer action
          tenantId,
          isAdmin: false, // Automated
          req
        }
      );
      await quote.reload(); // Reload to get updated status and viewedAt
    } catch (statusError) {
      // If status flow fails (e.g., already viewed), try direct method as fallback
      await quote.markAsViewed();
      await quote.reload();
    }

    // Create audit log
    await createAuditLog({
      userId: null,
      tenantId,
      action: 'quote_viewed',
      category: 'quote',
      entityType: 'Quote',
      entityId: id,
      details: { clientId, quoteNumber: quote.quoteNumber },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      message: 'Quote marked as viewed',
      viewedAt: quote.viewedAt
    });
  } catch (error) {
    console.error('Mark quote viewed error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark quote as viewed',
      error: error.message
    });
  }
};

module.exports = exports;



