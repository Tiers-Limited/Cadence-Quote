// optimization/query/QueryOptimizer.js
// Query optimization engine with N+1 elimination and batch loading

const DataLoader = require('dataloader');
const { Op } = require('sequelize');

/**
 * Query optimization engine
 * Eliminates N+1 queries and optimizes database interactions
 */
class QueryOptimizer {
  constructor(options = {}) {
    this.cacheManager = options.cacheManager;
    this.performanceMonitor = options.performanceMonitor;
    
    // DataLoader instances for batch loading
    this.loaders = new Map();
    
    // Query pattern analysis
    this.queryPatterns = new Map();
    this.preparedStatements = new Map();
    
    // N+1 detection
    this.queryTracker = {
      enabled: true,
      threshold: 5, // Detect when same query pattern executes > 5 times
      timeWindow: 1000 // Within 1 second
    };
    
    this.recentQueries = [];
  }
  
  /**
   * Create optimized includes for Sequelize queries
   * Eliminates N+1 queries through strategic eager loading
   */
  optimizeIncludes(model, associations = []) {
    const includes = [];
    
    for (const association of associations) {
      if (typeof association === 'string') {
        // Simple association
        includes.push({
          association,
          required: false, // LEFT JOIN instead of INNER JOIN
          separate: false  // Prevent separate queries
        });
      } else if (typeof association === 'object') {
        // Complex association with nested includes
        const optimizedAssoc = {
          ...association,
          required: association.required || false,
          separate: false
        };
        
        // Recursively optimize nested includes
        if (association.include) {
          optimizedAssoc.include = this.optimizeIncludes(
            association.model || association.association,
            association.include
          );
        }
        
        includes.push(optimizedAssoc);
      }
    }
    
    return includes;
  }
  
  /**
   * Create DataLoader for batch loading
   */
  createBatchLoader(key, batchLoadFn, options = {}) {
    if (this.loaders.has(key)) {
      return this.loaders.get(key);
    }
    
    const loader = new DataLoader(batchLoadFn, {
      maxBatchSize: options.maxBatchSize || 100,
      batchScheduleFn: options.batchScheduleFn || ((callback) => process.nextTick(callback)),
      cacheKeyFn: options.cacheKeyFn || ((key) => key),
      cacheMap: options.cacheMap,
      ...options
    });
    
    this.loaders.set(key, loader);
    return loader;
  }
  
  /**
   * Batch load related records to prevent N+1 queries
   */
  async batchLoad(ids, loader) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    
    const startTime = Date.now();
    
    try {
      const results = await loader.loadMany(ids);
      const duration = Date.now() - startTime;
      
      // Record performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordQueryMetric({
          query: `BatchLoad(${loader.constructor.name})`,
          executionTime: duration,
          resultCount: results.length,
          cacheHit: false,
          endpoint: 'batch_loader'
        });
      }
      
      return results;
    } catch (error) {
      console.error('Batch load error:', error);
      throw error;
    }
  }
  
  /**
   * Create common batch loaders for the application
   */
  createCommonLoaders() {
    // Product Config batch loader
    this.createBatchLoader('productConfigs', async (ids) => {
      const ProductConfig = require('../../models/ProductConfig');
      const configs = await ProductConfig.findAll({
        where: { id: { [Op.in]: ids } },
        include: [{
          association: 'globalProduct',
          include: [{ association: 'brand' }]
        }]
      });
      
      // Return in same order as requested IDs
      return ids.map(id => configs.find(config => config.id === id) || null);
    });
    
    // Client batch loader
    this.createBatchLoader('clients', async (ids) => {
      const Client = require('../../models/Client');
      const clients = await Client.findAll({
        where: { id: { [Op.in]: ids } }
      });
      
      return ids.map(id => clients.find(client => client.id === id) || null);
    });
    
    // User batch loader
    this.createBatchLoader('users', async (ids) => {
      const User = require('../../models/User');
      const users = await User.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ['id', 'fullName', 'email']
      });
      
      return ids.map(id => users.find(user => user.id === id) || null);
    });
    
    // Pricing Scheme batch loader
    this.createBatchLoader('pricingSchemes', async (ids) => {
      const PricingScheme = require('../../models/PricingScheme');
      const schemes = await PricingScheme.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ['id', 'name', 'type', 'description', 'pricingRules']
      });
      
      return ids.map(id => schemes.find(scheme => scheme.id === id) || null);
    });
    
    // Contractor Settings batch loader
    this.createBatchLoader('contractorSettings', async (tenantIds) => {
      const ContractorSettings = require('../../models/ContractorSettings');
      const settings = await ContractorSettings.findAll({
        where: { tenantId: { [Op.in]: tenantIds } }
      });
      
      return tenantIds.map(tenantId => settings.find(setting => setting.tenantId === tenantId) || null);
    });
  }
  
  /**
   * Get batch loader by key
   */
  getLoader(key) {
    return this.loaders.get(key);
  }
  
  /**
   * Clear all loader caches
   */
  clearLoaderCaches() {
    for (const loader of this.loaders.values()) {
      loader.clearAll();
    }
  }
  
  /**
   * Detect N+1 query patterns
   */
  detectN1Patterns(query, endpoint) {
    if (!this.queryTracker.enabled) return;
    
    const now = Date.now();
    const querySignature = this.getQuerySignature(query);
    
    // Add to recent queries
    this.recentQueries.push({
      signature: querySignature,
      query,
      endpoint,
      timestamp: now
    });
    
    // Clean old queries outside time window
    this.recentQueries = this.recentQueries.filter(
      q => now - q.timestamp <= this.queryTracker.timeWindow
    );
    
    // Count occurrences of this query pattern
    const occurrences = this.recentQueries.filter(
      q => q.signature === querySignature && q.endpoint === endpoint
    ).length;
    
    // Detect N+1 pattern
    if (occurrences >= this.queryTracker.threshold) {
      this.emitN1Warning({
        querySignature,
        endpoint,
        occurrences,
        timeWindow: this.queryTracker.timeWindow,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
      });
    }
  }
  
  /**
   * Generate query signature for pattern detection
   */
  getQuerySignature(query) {
    // Normalize query by removing specific values
    return query
      .replace(/\$\d+/g, '$?') // Replace parameter placeholders
      .replace(/\d+/g, 'N')    // Replace numbers
      .replace(/'.+?'/g, "'?'") // Replace string literals
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim()
      .toLowerCase();
  }
  
  /**
   * Emit N+1 warning
   */
  emitN1Warning(warning) {
    console.warn(`🚨 N+1 Query Pattern Detected:`, warning);
    
    if (this.performanceMonitor) {
      this.performanceMonitor.emit('n1Pattern', warning);
    }
  }
  
  /**
   * Create prepared statement with enhanced caching and optimization
   * ENHANCEMENT: Added automatic parameter type detection and query optimization
   */
  createPreparedStatement(key, query, params = [], options = {}) {
    if (this.preparedStatements.has(key)) {
      const stmt = this.preparedStatements.get(key);
      stmt.useCount++;
      stmt.lastUsed = new Date();
      return stmt;
    }
    
    const {
      maxUses = 1000,
      ttl = 3600000, // 1 hour
      enableOptimization = true,
      cacheResults = false,
      resultCacheTTL = 300 // 5 minutes
    } = options;
    
    // Analyze query for optimization opportunities
    const analysis = enableOptimization ? this.analyzeQueryPattern(query) : null;
    
    const statement = {
      key,
      query,
      params,
      analysis,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 1,
      maxUses,
      ttl,
      cacheResults,
      resultCache: new Map(),
      resultCacheTTL,
      
      execute: async (sequelize, executeParams = params) => {
        const startTime = Date.now();
        
        try {
          // Check result cache if enabled
          if (this.cacheResults) {
            const cacheKey = JSON.stringify(executeParams);
            const cached = this.resultCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.resultCacheTTL) {
              return cached.result;
            }
          }
          
          // Validate parameter count
          const expectedParams = (query.match(/\$\d+/g) || []).length;
          if (executeParams.length !== expectedParams) {
            console.warn(`Parameter count mismatch for prepared statement ${key}: expected ${expectedParams}, got ${executeParams.length}`);
          }
          
          const result = await sequelize.query(query, {
            replacements: executeParams,
            type: sequelize.QueryTypes.SELECT
          });
          
          const duration = Date.now() - startTime;
          
          // Cache result if enabled
          if (this.cacheResults) {
            const cacheKey = JSON.stringify(executeParams);
            this.resultCache.set(cacheKey, {
              result,
              timestamp: Date.now()
            });
            
            // Clean old cache entries
            if (this.resultCache.size > 100) {
              this.cleanResultCache();
            }
          }
          
          // Update usage statistics
          this.useCount++;
          this.lastUsed = new Date();
          
          if (this.performanceMonitor) {
            this.performanceMonitor.recordQueryMetric({
              query: `PreparedStatement(${key})`,
              executionTime: duration,
              resultCount: result.length,
              cacheHit: false,
              endpoint: 'prepared_statement'
            });
          }
          
          return result;
        } catch (error) {
          console.error(`Prepared statement execution failed (${key}):`, error);
          throw error;
        }
      },
      
      // Clean old result cache entries
      cleanResultCache: function() {
        const now = Date.now();
        for (const [key, cached] of this.resultCache.entries()) {
          if (now - cached.timestamp > this.resultCacheTTL) {
            this.resultCache.delete(key);
          }
        }
      },
      
      // Check if statement should be evicted
      shouldEvict: function() {
        const now = Date.now();
        return (
          this.useCount >= this.maxUses ||
          (now - this.createdAt.getTime()) > this.ttl ||
          (now - this.lastUsed.getTime()) > (this.ttl / 2) // Evict if unused for half TTL
        );
      },
      
      // Get statement statistics
      getStats: function() {
        return {
          key: this.key,
          useCount: this.useCount,
          createdAt: this.createdAt,
          lastUsed: this.lastUsed,
          resultCacheSize: this.resultCache.size,
          analysis: this.analysis,
          age: Date.now() - this.createdAt.getTime()
        };
      }
    };
    
    this.preparedStatements.set(key, statement);
    
    // Schedule cleanup check
    setTimeout(() => {
      this.cleanupPreparedStatements();
    }, 60000); // Check every minute
    
    return statement;
  }
  
  /**
   * Get prepared statement by key
   */
  getPreparedStatement(key) {
    const stmt = this.preparedStatements.get(key);
    if (stmt && !stmt.shouldEvict()) {
      return stmt;
    } else if (stmt) {
      // Remove expired statement
      this.preparedStatements.delete(key);
    }
    return null;
  }
  
  /**
   * Clean up expired prepared statements
   */
  cleanupPreparedStatements() {
    const toDelete = [];
    
    for (const [key, stmt] of this.preparedStatements.entries()) {
      if (stmt.shouldEvict()) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => {
      this.preparedStatements.delete(key);
    });
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} expired prepared statements`);
    }
  }
  
  /**
   * Create common prepared statements for the application
   */
  createCommonPreparedStatements() {
    // User lookup by ID
    this.createPreparedStatement(
      'user_by_id',
      'SELECT id, fullName, email FROM "Users" WHERE id = $1',
      ['id'],
      { cacheResults: true, resultCacheTTL: 600000 } // 10 minutes
    );
    
    // Product config by tenant and active status
    this.createPreparedStatement(
      'product_configs_by_tenant',
      'SELECT * FROM "ProductConfigs" WHERE "tenantId" = $1 AND "isActive" = $2',
      ['tenantId', 'isActive'],
      { cacheResults: true, resultCacheTTL: 300000 } // 5 minutes
    );
    
    // Quote by ID and tenant
    this.createPreparedStatement(
      'quote_by_id_tenant',
      'SELECT * FROM "Quotes" WHERE id = $1 AND "tenantId" = $2',
      ['id', 'tenantId'],
      { cacheResults: true, resultCacheTTL: 180000 } // 3 minutes
    );
    
    // Client by email and tenant
    this.createPreparedStatement(
      'client_by_email_tenant',
      'SELECT * FROM "Clients" WHERE email = $1 AND "tenantId" = $2',
      ['email', 'tenantId'],
      { cacheResults: true, resultCacheTTL: 300000 } // 5 minutes
    );
    
    // Contractor settings by tenant
    this.createPreparedStatement(
      'contractor_settings_by_tenant',
      'SELECT * FROM "ContractorSettings" WHERE "tenantId" = $1',
      ['tenantId'],
      { cacheResults: true, resultCacheTTL: 600000 } // 10 minutes
    );
    
    console.log('📋 Created common prepared statements');
  }
  
  /**
   * Get prepared statement optimization suggestions
   */
  getPreparedStatementSuggestions() {
    const suggestions = [];
    const stats = Array.from(this.preparedStatements.values()).map(stmt => stmt.getStats());
    
    // Find frequently used statements that could benefit from longer TTL
    const frequentStatements = stats.filter(s => s.useCount > 100);
    frequentStatements.forEach(stmt => {
      if (stmt.analysis && stmt.analysis.estimatedCost > 3) {
        suggestions.push({
          type: 'increase_ttl',
          statement: stmt.key,
          message: `High-cost statement "${stmt.key}" used ${stmt.useCount} times. Consider increasing TTL.`
        });
      }
    });
    
    // Find statements with low usage that could be removed
    const lowUsageStatements = stats.filter(s => s.useCount < 5 && s.age > 3600000); // 1 hour old
    lowUsageStatements.forEach(stmt => {
      suggestions.push({
        type: 'remove_unused',
        statement: stmt.key,
        message: `Statement "${stmt.key}" has low usage (${stmt.useCount} uses). Consider removing.`
      });
    });
    
    // Find statements that could benefit from result caching
    const noCacheStatements = stats.filter(s => !s.resultCacheSize && s.useCount > 50);
    noCacheStatements.forEach(stmt => {
      suggestions.push({
        type: 'enable_result_cache',
        statement: stmt.key,
        message: `Frequently used statement "${stmt.key}" could benefit from result caching.`
      });
    });
    
    return suggestions;
  }
  
  /**
   * Analyze query patterns and provide optimization suggestions
   */
  analyzeQueryPattern(query) {
    const analysis = {
      query,
      type: this.getQueryType(query),
      tables: this.extractTables(query),
      columns: this.extractColumns(query),
      hasJoins: /\s+JOIN\s+/i.test(query),
      hasSubqueries: /\(\s*SELECT\s+/i.test(query),
      estimatedCost: this.estimateQueryCost(query),
      recommendations: []
    };
    
    // Generate recommendations
    if (analysis.hasJoins && analysis.tables.length > 3) {
      analysis.recommendations.push('Consider breaking complex joins into smaller queries with batch loading');
    }
    
    if (analysis.hasSubqueries) {
      analysis.recommendations.push('Consider replacing subqueries with JOINs or separate queries');
    }
    
    if (!analysis.hasJoins && analysis.type === 'SELECT') {
      analysis.recommendations.push('Consider adding appropriate indexes for WHERE clauses');
    }
    
    return analysis;
  }
  
  /**
   * Get query type (SELECT, INSERT, UPDATE, DELETE)
   */
  getQueryType(query) {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    return 'UNKNOWN';
  }
  
  /**
   * Extract table names from query
   */
  extractTables(query) {
    const tables = [];
    const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+["`]?(\w+)["`]?/gi;
    let match;
    
    while ((match = tableRegex.exec(query)) !== null) {
      if (!tables.includes(match[1])) {
        tables.push(match[1]);
      }
    }
    
    return tables;
  }
  
  /**
   * Extract column names from query
   */
  extractColumns(query) {
    const columns = [];
    
    // Simple extraction - could be enhanced
    const selectMatch = query.match(/SELECT\s+(.*?)\s+FROM/i);
    if (selectMatch) {
      const columnsPart = selectMatch[1];
      if (columnsPart !== '*') {
        const columnList = columnsPart.split(',').map(col => col.trim().replace(/["`]/g, ''));
        columns.push(...columnList);
      }
    }
    
    return columns;
  }
  
  /**
   * Estimate query cost (simple heuristic)
   */
  estimateQueryCost(query) {
    let cost = 1;
    
    // Add cost for joins
    const joinCount = (query.match(/\s+JOIN\s+/gi) || []).length;
    cost += joinCount * 2;
    
    // Add cost for subqueries
    const subqueryCount = (query.match(/\(\s*SELECT\s+/gi) || []).length;
    cost += subqueryCount * 3;
    
    // Add cost for ORDER BY
    if (/ORDER\s+BY/i.test(query)) {
      cost += 1;
    }
    
    // Add cost for GROUP BY
    if (/GROUP\s+BY/i.test(query)) {
      cost += 2;
    }
    
    return cost;
  }
  
  /**
   * Get middleware for Express to track queries
   */
  getMiddleware() {
    return (req, res, next) => {
      // Store original query method
      const originalQuery = req.app.locals.sequelize?.query;
      
      if (originalQuery) {
        req.app.locals.sequelize.query = (...args) => {
          const query = args[0];
          const endpoint = `${req.method} ${req.route?.path || req.path}`;
          
          // Detect N+1 patterns
          this.detectN1Patterns(query, endpoint);
          
          // Call original query method
          return originalQuery.apply(req.app.locals.sequelize, args);
        };
        
        // Restore original method after request
        res.on('finish', () => {
          req.app.locals.sequelize.query = originalQuery;
        });
      }
      
      next();
    };
  }
  
  /**
   * Get optimization statistics
   * ENHANCEMENT: Added detailed prepared statement analytics
   */
  getStats() {
    const preparedStmtStats = Array.from(this.preparedStatements.values()).map(stmt => stmt.getStats());
    
    return {
      loaders: {
        count: this.loaders.size,
        keys: Array.from(this.loaders.keys())
      },
      preparedStatements: {
        count: this.preparedStatements.size,
        totalUses: preparedStmtStats.reduce((sum, stmt) => sum + stmt.useCount, 0),
        avgUsesPerStatement: preparedStmtStats.length > 0 
          ? preparedStmtStats.reduce((sum, stmt) => sum + stmt.useCount, 0) / preparedStmtStats.length 
          : 0,
        topStatements: preparedStmtStats
          .sort((a, b) => b.useCount - a.useCount)
          .slice(0, 5)
          .map(stmt => ({ key: stmt.key, useCount: stmt.useCount, age: stmt.age })),
        suggestions: this.getPreparedStatementSuggestions()
      },
      queryPatterns: {
        count: this.queryPatterns.size,
        recentQueries: this.recentQueries.length
      },
      n1Detection: {
        enabled: this.queryTracker.enabled,
        threshold: this.queryTracker.threshold,
        timeWindow: this.queryTracker.timeWindow
      }
    };
  }
}

module.exports = QueryOptimizer;