// optimization/pagination/PaginationHandler.js
// Efficient pagination handler with cursor-based pagination and performance optimizations

const { Op } = require('sequelize');

/**
 * Efficient pagination handler
 * Implements cursor-based pagination for consistent performance
 */
class PaginationHandler {
  constructor(options = {}) {
    this.config = {
      defaultLimit: 20,
      maxLimit: 100,
      enableCursorPagination: true,
      enableOffsetPagination: true,
      cacheCountQueries: true,
      countCacheTTL: 300, // 5 minutes
      ...options
    };
    
    this.cacheManager = options.cacheManager;
    this.performanceMonitor = options.performanceMonitor;
    
    // Count query cache
    this.countCache = new Map();
  }
  
  /**
   * Create cursor-based pagination for consistent performance
   * OPTIMIZATION: Uses cursor-based pagination to avoid OFFSET performance issues
   */
  async paginateCursor(model, options = {}) {
    const {
      cursor,
      limit = this.config.defaultLimit,
      direction = 'forward', // 'forward' or 'backward'
      cursorField = 'id',
      where = {},
      include = [],
      order = [[cursorField, 'ASC']],
      attributes
    } = options;
    
    const actualLimit = Math.min(limit, this.config.maxLimit);
    const startTime = Date.now();
    
    try {
      // Build cursor condition
      let cursorCondition = {};
      if (cursor) {
        const operator = direction === 'forward' 
          ? (order[0][1] === 'ASC' ? Op.gt : Op.lt)
          : (order[0][1] === 'ASC' ? Op.lt : Op.gt);
        
        cursorCondition = {
          [cursorField]: {
            [operator]: cursor
          }
        };
      }
      
      // Combine where conditions
      const finalWhere = {
        ...where,
        ...cursorCondition
      };
      
      // Fetch records with one extra to determine if there are more
      const records = await model.findAll({
        where: finalWhere,
        include,
        order,
        limit: actualLimit + 1,
        attributes
      });
      
      const hasMore = records.length > actualLimit;
      const data = hasMore ? records.slice(0, actualLimit) : records;
      
      // Generate cursors
      const nextCursor = data.length > 0 ? data[data.length - 1][cursorField] : null;
      const prevCursor = data.length > 0 ? data[0][cursorField] : null;
      
      const duration = Date.now() - startTime;
      
      // Record performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordQueryMetric({
          query: `CursorPagination(${model.name})`,
          executionTime: duration,
          resultCount: data.length,
          cacheHit: false,
          endpoint: 'cursor_pagination'
        });
      }
      
      return {
        data,
        pagination: {
          type: 'cursor',
          hasMore,
          nextCursor: hasMore ? nextCursor : null,
          prevCursor: cursor ? prevCursor : null,
          limit: actualLimit,
          direction
        },
        meta: {
          executionTime: duration,
          cursorField
        }
      };
      
    } catch (error) {
      console.error('Cursor pagination error:', error);
      throw error;
    }
  }
  
  /**
   * Create offset-based pagination with optimizations
   * OPTIMIZATION: Includes count caching and efficient count operations
   */
  async paginateOffset(model, options = {}) {
    const {
      page = 1,
      limit = this.config.defaultLimit,
      where = {},
      include = [],
      order = [['id', 'ASC']],
      attributes,
      includeCount = true,
      cacheKey
    } = options;
    
    const actualLimit = Math.min(limit, this.config.maxLimit);
    const offset = (page - 1) * actualLimit;
    const startTime = Date.now();
    
    try {
      // Execute count and data queries in parallel
      const [data, totalCount] = await Promise.all([
        // Data query
        model.findAll({
          where,
          include,
          order,
          limit: actualLimit,
          offset,
          attributes
        }),
        
        // Count query (with caching if enabled)
        includeCount ? this.getCount(model, where, cacheKey) : Promise.resolve(null)
      ]);
      
      const duration = Date.now() - startTime;
      
      // Calculate pagination metadata
      const totalPages = totalCount ? Math.ceil(totalCount / actualLimit) : null;
      const hasNextPage = totalCount ? page < totalPages : data.length === actualLimit;
      const hasPrevPage = page > 1;
      
      // Record performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordQueryMetric({
          query: `OffsetPagination(${model.name})`,
          executionTime: duration,
          resultCount: data.length,
          cacheHit: false,
          endpoint: 'offset_pagination'
        });
      }
      
      return {
        data,
        pagination: {
          type: 'offset',
          page,
          limit: actualLimit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
          offset
        },
        meta: {
          executionTime: duration
        }
      };
      
    } catch (error) {
      console.error('Offset pagination error:', error);
      throw error;
    }
  }
  
  /**
   * Get count with caching to avoid expensive count operations
   * OPTIMIZATION: Caches count queries to improve performance
   */
  async getCount(model, where = {}, cacheKey = null) {
    if (!this.config.cacheCountQueries) {
      return await model.count({ where });
    }
    
    // Generate cache key if not provided
    const key = cacheKey || this.generateCountCacheKey(model.name, where);
    
    // Try cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get(key);
      if (cached !== null) {
        return cached;
      }
    } else {
      // Use local cache if no cache manager
      const cached = this.countCache.get(key);
      if (cached && Date.now() - cached.timestamp < this.config.countCacheTTL * 1000) {
        return cached.count;
      }
    }
    
    // Execute count query
    const startTime = Date.now();
    const count = await model.count({ where });
    const duration = Date.now() - startTime;
    
    // Cache the result
    if (this.cacheManager) {
      await this.cacheManager.set(key, count, this.config.countCacheTTL, {
        tags: [`model:${model.name}`, 'count']
      });
    } else {
      // Use local cache
      this.countCache.set(key, {
        count,
        timestamp: Date.now()
      });
      
      // Clean local cache periodically
      if (this.countCache.size > 100) {
        this.cleanCountCache();
      }
    }
    
    // Record performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordQueryMetric({
        query: `Count(${model.name})`,
        executionTime: duration,
        resultCount: 1,
        cacheHit: false,
        endpoint: 'count_query'
      });
    }
    
    return count;
  }
  
  /**
   * Generate cache key for count queries
   */
  generateCountCacheKey(modelName, where) {
    const crypto = require('crypto');
    const whereString = JSON.stringify(where, Object.keys(where).sort());
    const hash = crypto.createHash('md5').update(whereString).digest('hex');
    return `count:${modelName}:${hash}`;
  }
  
  /**
   * Clean local count cache
   */
  cleanCountCache() {
    const now = Date.now();
    const ttlMs = this.config.countCacheTTL * 1000;
    
    for (const [key, cached] of this.countCache.entries()) {
      if (now - cached.timestamp > ttlMs) {
        this.countCache.delete(key);
      }
    }
  }
  
  /**
   * Smart pagination that chooses the best strategy
   * OPTIMIZATION: Automatically selects cursor or offset based on query characteristics
   */
  async paginateSmart(model, options = {}) {
    const {
      page,
      cursor,
      limit = this.config.defaultLimit,
      where = {},
      order = [['id', 'ASC']]
    } = options;
    
    // Use cursor pagination if cursor is provided or for deep pagination
    if (cursor || (page && page > 10)) {
      return await this.paginateCursor(model, {
        ...options,
        cursor: cursor || this.generateCursorFromPage(page, limit, order[0][0])
      });
    }
    
    // Use offset pagination for shallow pagination
    return await this.paginateOffset(model, options);
  }
  
  /**
   * Generate cursor from page number (for smart pagination)
   */
  generateCursorFromPage(page, limit, cursorField) {
    // This is a simplified implementation
    // In practice, you'd need to query for the actual cursor value
    return (page - 1) * limit;
  }
  
  /**
   * Create pagination middleware for Express
   */
  getMiddleware() {
    return (req, res, next) => {
      // Parse pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || this.config.defaultLimit;
      const cursor = req.query.cursor;
      const direction = req.query.direction || 'forward';
      
      // Validate parameters
      if (page < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page must be greater than 0'
        });
      }
      
      if (limit > this.config.maxLimit) {
        return res.status(400).json({
          success: false,
          message: `Limit cannot exceed ${this.config.maxLimit}`
        });
      }
      
      // Add pagination utilities to request
      req.pagination = {
        page,
        limit,
        cursor,
        direction,
        paginate: (model, options = {}) => {
          return this.paginateSmart(model, {
            page,
            limit,
            cursor,
            direction,
            ...options
          });
        },
        paginateCursor: (model, options = {}) => {
          return this.paginateCursor(model, {
            cursor,
            limit,
            direction,
            ...options
          });
        },
        paginateOffset: (model, options = {}) => {
          return this.paginateOffset(model, {
            page,
            limit,
            ...options
          });
        }
      };
      
      next();
    };
  }
  
  /**
   * Invalidate count cache for a model
   */
  async invalidateCountCache(modelName, tags = []) {
    if (this.cacheManager) {
      await this.cacheManager.invalidateByTags([`model:${modelName}`, 'count', ...tags]);
    } else {
      // Clear local cache entries for this model
      for (const key of this.countCache.keys()) {
        if (key.includes(modelName)) {
          this.countCache.delete(key);
        }
      }
    }
  }
  
  /**
   * Get pagination statistics
   */
  getStats() {
    return {
      config: {
        defaultLimit: this.config.defaultLimit,
        maxLimit: this.config.maxLimit,
        enableCursorPagination: this.config.enableCursorPagination,
        enableOffsetPagination: this.config.enableOffsetPagination,
        cacheCountQueries: this.config.cacheCountQueries
      },
      countCache: {
        size: this.countCache.size,
        ttl: this.config.countCacheTTL
      }
    };
  }
  
  /**
   * Create common pagination utilities
   */
  createUtils() {
    return {
      paginate: (model, options) => this.paginateSmart(model, options),
      paginateCursor: (model, options) => this.paginateCursor(model, options),
      paginateOffset: (model, options) => this.paginateOffset(model, options),
      getCount: (model, where, cacheKey) => this.getCount(model, where, cacheKey),
      invalidateCountCache: (modelName, tags) => this.invalidateCountCache(modelName, tags)
    };
  }
}

module.exports = PaginationHandler;