// services/performanceOptimizationService.js
/**
 * Performance Optimization Service
 * **Feature: cadence-quote-builder-update, Task 9.2**
 * **Validates: Requirements 9.2, 9.3**
 */

const { Op } = require('sequelize');

/**
 * Performance Optimization Service
 * Handles session isolation, query optimization, and performance monitoring
 */
class PerformanceOptimizationService {
  constructor() {
    this.sessionStore = new Map(); // In-memory session store for isolation
    this.queryMetrics = new Map(); // Query performance metrics
    this.concurrentUserLimit = 100; // Maximum concurrent users per tenant
    this.maxLineItems = 50; // Maximum line items per quote
  }

  /**
   * Create isolated session for concurrent users
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID
   * @param {string} quoteId - Quote ID (optional)
   * @returns {string} - Session ID
   */
  createIsolatedSession(tenantId, userId, quoteId = null) {
    const sessionId = `${tenantId}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData = {
      sessionId,
      tenantId,
      userId,
      quoteId,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      lockVersion: 1,
      isolatedData: new Map() // Isolated data store for this session
    };

    this.sessionStore.set(sessionId, sessionData);
    
    // Clean up old sessions
    this.cleanupExpiredSessions();
    
    return sessionId;
  }

  /**
   * Get isolated session data
   * @param {string} sessionId - Session ID
   * @returns {object|null} - Session data or null if not found
   */
  getSession(sessionId) {
    const session = this.sessionStore.get(sessionId);
    if (session && session.isActive) {
      session.lastActivity = new Date();
      return session;
    }
    return null;
  }

  /**
   * Update session data with optimistic locking
   * @param {string} sessionId - Session ID
   * @param {object} data - Data to store
   * @param {number} expectedVersion - Expected lock version
   * @returns {boolean} - Success status
   */
  updateSessionData(sessionId, data, expectedVersion) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Check optimistic lock
    if (expectedVersion && session.lockVersion !== expectedVersion) {
      throw new Error('Session data has been modified by another process');
    }

    // Update data
    Object.keys(data).forEach(key => {
      session.isolatedData.set(key, data[key]);
    });

    session.lockVersion += 1;
    session.lastActivity = new Date();
    
    return true;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    const expiredThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (now - session.lastActivity > expiredThreshold) {
        this.sessionStore.delete(sessionId);
      }
    }
  }

  /**
   * Check concurrent user limits
   * @param {string} tenantId - Tenant ID
   * @returns {boolean} - Whether tenant is within limits
   */
  checkConcurrentUserLimits(tenantId) {
    const activeSessions = Array.from(this.sessionStore.values())
      .filter(session => session.tenantId === tenantId && session.isActive);
    
    return activeSessions.length < this.concurrentUserLimit;
  }

  /**
   * Optimize quote query for large datasets
   * @param {object} queryOptions - Sequelize query options
   * @param {number} maxItems - Maximum items to return
   * @returns {object} - Optimized query options
   */
  optimizeQuoteQuery(queryOptions, maxItems = this.maxLineItems) {
    const optimized = { ...queryOptions };

    // Add pagination if not present
    if (!optimized.limit) {
      optimized.limit = Math.min(maxItems, 20);
    }

    // Ensure limit doesn't exceed maximum
    if (optimized.limit > maxItems) {
      optimized.limit = maxItems;
    }

    // Add offset if not present
    if (!optimized.offset) {
      optimized.offset = 0;
    }

    // Optimize includes to only fetch necessary data
    if (optimized.include) {
      optimized.include = optimized.include.map(include => ({
        ...include,
        attributes: include.attributes || this.getOptimalAttributes(include.model?.name)
      }));
    }

    // Add indexes hint for complex queries
    if (optimized.where) {
      optimized.benchmark = true; // Enable query benchmarking
    }

    return optimized;
  }

  /**
   * Get optimal attributes for different models
   * @param {string} modelName - Model name
   * @returns {array} - Optimal attributes
   */
  getOptimalAttributes(modelName) {
    const attributeMap = {
      'Quote': ['id', 'quoteNumber', 'customerName', 'total', 'status', 'createdAt', 'lastModified'],
      'PricingScheme': ['id', 'name', 'type', 'pricingRules'],
      'ContractorSettings': ['id', 'businessName', 'selectedProposalTemplate', 'proposalTemplateSettings'],
      'User': ['id', 'fullName', 'email'],
      'Client': ['id', 'name', 'email', 'phone']
    };

    return attributeMap[modelName] || undefined;
  }

  /**
   * Monitor query performance
   * @param {string} queryType - Type of query
   * @param {number} executionTime - Execution time in ms
   * @param {number} resultCount - Number of results returned
   */
  recordQueryMetrics(queryType, executionTime, resultCount) {
    if (!this.queryMetrics.has(queryType)) {
      this.queryMetrics.set(queryType, {
        totalQueries: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0,
        minTime: Infinity,
        totalResults: 0,
        averageResults: 0
      });
    }

    const metrics = this.queryMetrics.get(queryType);
    metrics.totalQueries += 1;
    metrics.totalTime += executionTime;
    metrics.averageTime = metrics.totalTime / metrics.totalQueries;
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
    metrics.minTime = Math.min(metrics.minTime, executionTime);
    metrics.totalResults += resultCount;
    metrics.averageResults = metrics.totalResults / metrics.totalQueries;

    // Log slow queries
    if (executionTime > 1000) { // Queries taking more than 1 second
      console.warn(`Slow query detected: ${queryType} took ${executionTime}ms`);
    }
  }

  /**
   * Get performance metrics
   * @returns {object} - Performance metrics
   */
  getPerformanceMetrics() {
    const activeSessions = this.sessionStore.size;
    const tenantSessionCounts = new Map();

    // Count sessions per tenant
    for (const session of this.sessionStore.values()) {
      if (session.isActive) {
        const count = tenantSessionCounts.get(session.tenantId) || 0;
        tenantSessionCounts.set(session.tenantId, count + 1);
      }
    }

    return {
      activeSessions,
      tenantSessionCounts: Object.fromEntries(tenantSessionCounts),
      queryMetrics: Object.fromEntries(this.queryMetrics),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Optimize database connection pool for concurrent users
   * @param {object} sequelize - Sequelize instance
   */
  optimizeConnectionPool(sequelize) {
    // Adjust pool settings based on concurrent user load
    const currentLoad = this.sessionStore.size;
    const optimalPoolSize = Math.min(Math.max(currentLoad * 0.1, 5), 20);

    // Note: This would typically be configured at startup
    // but can be adjusted dynamically if needed
    console.log(`Recommended pool size for current load (${currentLoad} sessions): ${optimalPoolSize}`);
  }

  /**
   * Validate quote complexity for performance
   * @param {object} quoteData - Quote data
   * @returns {object} - Validation result
   */
  validateQuoteComplexity(quoteData) {
    const warnings = [];
    const errors = [];

    // Check number of areas
    if (quoteData.areas && quoteData.areas.length > 10) {
      warnings.push(`Quote has ${quoteData.areas.length} areas (recommended: ≤10)`);
    }

    // Check total line items
    let totalLineItems = 0;
    if (quoteData.areas) {
      quoteData.areas.forEach(area => {
        if (area.items) {
          totalLineItems += area.items.length;
        }
      });
    }

    if (totalLineItems > this.maxLineItems) {
      errors.push(`Quote has ${totalLineItems} line items (maximum: ${this.maxLineItems})`);
    } else if (totalLineItems > this.maxLineItems * 0.8) {
      warnings.push(`Quote has ${totalLineItems} line items (approaching limit of ${this.maxLineItems})`);
    }

    // Check flat rate items complexity
    if (quoteData.flatRateItems) {
      const interiorItems = Object.keys(quoteData.flatRateItems.interior || {}).length;
      const exteriorItems = Object.keys(quoteData.flatRateItems.exterior || {}).length;
      const totalFlatRateItems = interiorItems + exteriorItems;

      if (totalFlatRateItems > 20) {
        warnings.push(`Quote has ${totalFlatRateItems} flat rate items (recommended: ≤20)`);
      }
    }

    // Check product sets complexity
    if (quoteData.productSets) {
      const productSetCount = Object.keys(quoteData.productSets).length;
      if (productSetCount > 15) {
        warnings.push(`Quote has ${productSetCount} product sets (recommended: ≤15)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complexity: {
        areas: quoteData.areas?.length || 0,
        lineItems: totalLineItems,
        flatRateItems: quoteData.flatRateItems ? 
          Object.keys(quoteData.flatRateItems.interior || {}).length + 
          Object.keys(quoteData.flatRateItems.exterior || {}).length : 0,
        productSets: quoteData.productSets ? Object.keys(quoteData.productSets).length : 0
      }
    };
  }

  /**
   * Create performance monitoring middleware
   * @returns {function} - Express middleware
   */
  createPerformanceMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Add session isolation if needed
      if (req.user && req.user.tenantId) {
        if (!this.checkConcurrentUserLimits(req.user.tenantId)) {
          return res.status(429).json({
            success: false,
            message: 'Too many concurrent users. Please try again later.',
            retryAfter: 60
          });
        }
      }

      // Monitor response time
      res.on('finish', () => {
        const executionTime = Date.now() - startTime;
        const queryType = `${req.method} ${req.route?.path || req.path}`;
        
        this.recordQueryMetrics(queryType, executionTime, 1);
        
        // Add performance headers
        res.set('X-Response-Time', `${executionTime}ms`);
        res.set('X-Active-Sessions', this.sessionStore.size.toString());
      });

      next();
    };
  }
}

// Create singleton instance
const performanceOptimizationService = new PerformanceOptimizationService();

module.exports = performanceOptimizationService;