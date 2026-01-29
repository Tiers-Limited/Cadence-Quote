// optimization/cache/CacheManager.js
// Multi-level caching system with Redis and in-memory cache

const Redis = require('ioredis');
const EventEmitter = require('events');

/**
 * Multi-level cache manager
 * Implements L1 (memory) and L2 (Redis) caching with intelligent invalidation
 */
class CacheManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      defaultTTL: 300, // 5 minutes
      maxMemoryMB: 100,
      
      // Redis configuration
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        keyPrefix: 'cadence:',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      },
      
      // Memory cache configuration
      memory: {
        enabled: true,
        maxSize: 1000, // Maximum number of entries
        ttl: 60 // 1 minute for memory cache
      },
      
      // Cache strategies
      strategies: {
        writeThrough: true,    // Update cache and database simultaneously
        cacheAside: true,      // Load data into cache on cache miss
        ttlBased: true,        // Time-based cache invalidation
        eventBased: true       // Event-based cache invalidation
      },
      
      ...config
    };
    
    // L1 Cache (In-Memory)
    this.memoryCache = new Map();
    this.memoryCacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0
    };
    
    // L2 Cache (Redis)
    this.redisClient = null;
    this.redisStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    
    // Cache tags for invalidation
    this.tagMap = new Map(); // tag -> Set of keys
    
    // Cleanup intervals
    this.intervals = [];
  }
  
  /**
   * Initialize cache manager
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('📦 Cache Manager disabled');
      return;
    }
    
    console.log('📦 Initializing Cache Manager...');
    
    try {
      // Initialize Redis connection (non-blocking)
      await this.initializeRedis();
      
      // Start memory cache cleanup
      this.startMemoryCacheCleanup();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      console.log('✅ Cache Manager initialized');
      
    } catch (error) {
      console.warn('⚠️  Cache Manager initialization had issues, continuing with reduced functionality:', error.message);
      
      // Don't disable caching completely, just continue without Redis
      console.log('📦 Cache Manager running in memory-only mode');
    }
  }
  
  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    // Skip Redis if no host is configured
    if (!this.config.redis.host || this.config.redis.host === 'localhost') {
    //   console.log('⚠️  Redis host not configured or set to localhost, skipping Redis initialization');
      console.log('📦 Cache Manager will use memory-only caching');
      return;
    }
    
    try {
      this.redisClient = new Redis({
        ...this.config.redis,
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryDelayOnFailover: 100
      });
      
      // Redis event handlers
      this.redisClient.on('connect', () => {
        console.log('🔗 Redis connected');
      });
      
      this.redisClient.on('ready', () => {
        console.log('✅ Redis ready');
      });
      
      this.redisClient.on('error', (error) => {
        console.error('❌ Redis error:', error.message);
        this.redisStats.errors++;
        this.emit('redisError', error);
      });
      
      this.redisClient.on('close', () => {
        console.warn('⚠️  Redis connection closed');
      });
      
      this.redisClient.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });
      
      // Test Redis connection with timeout
      const connectionPromise = this.redisClient.ping();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);
      console.log('✅ Redis connection tested successfully');
      
    } catch (error) {
      console.warn('⚠️  Redis connection failed, falling back to memory-only cache:', error.message);
      if (this.redisClient) {
        this.redisClient.disconnect();
        this.redisClient = null;
      }
    }
  }
  
  /**
   * Get value from cache (L1 -> L2 -> null)
   */
  async get(key, options = {}) {
    if (!this.config.enabled) return null;
    
    const cacheKey = this.buildKey(key);
    
    try {
      // Try L1 cache first (memory)
      if (this.config.memory.enabled) {
        const memoryResult = this.getFromMemory(cacheKey);
        if (memoryResult !== null) {
          this.memoryCacheStats.hits++;
          this.emit('cacheHit', { level: 'L1', key: cacheKey });
          return memoryResult;
        }
        this.memoryCacheStats.misses++;
      }
      
      // Try L2 cache (Redis)
      if (this.redisClient) {
        const redisResult = await this.getFromRedis(cacheKey);
        if (redisResult !== null) {
          this.redisStats.hits++;
          
          // Populate L1 cache
          if (this.config.memory.enabled) {
            this.setInMemory(cacheKey, redisResult, this.config.memory.ttl);
          }
          
          this.emit('cacheHit', { level: 'L2', key: cacheKey });
          return redisResult;
        }
        this.redisStats.misses++;
      }
      
      this.emit('cacheMiss', { key: cacheKey });
      return null;
      
    } catch (error) {
      console.error('Cache get error:', error);
      this.emit('cacheError', { operation: 'get', key: cacheKey, error });
      return null;
    }
  }
  
  /**
   * Set value in cache (L1 + L2)
   */
  async set(key, value, ttl = null, options = {}) {
    if (!this.config.enabled) return false;
    
    const cacheKey = this.buildKey(key);
    const cacheTTL = ttl || this.config.defaultTTL;
    const tags = options.tags || [];
    
    try {
      // Set in L1 cache (memory)
      if (this.config.memory.enabled) {
        this.setInMemory(cacheKey, value, Math.min(cacheTTL, this.config.memory.ttl));
        this.memoryCacheStats.sets++;
      }
      
      // Set in L2 cache (Redis)
      if (this.redisClient) {
        await this.setInRedis(cacheKey, value, cacheTTL);
        this.redisStats.sets++;
      }
      
      // Handle cache tags
      if (tags.length > 0) {
        this.addCacheTags(cacheKey, tags);
      }
      
      this.emit('cacheSet', { key: cacheKey, ttl: cacheTTL, tags });
      return true;
      
    } catch (error) {
      console.error('Cache set error:', error);
      this.emit('cacheError', { operation: 'set', key: cacheKey, error });
      return false;
    }
  }
  
  /**
   * Delete value from cache
   */
  async delete(key) {
    if (!this.config.enabled) return false;
    
    const cacheKey = this.buildKey(key);
    
    try {
      // Delete from L1 cache
      if (this.config.memory.enabled) {
        this.deleteFromMemory(cacheKey);
        this.memoryCacheStats.deletes++;
      }
      
      // Delete from L2 cache
      if (this.redisClient) {
        await this.deleteFromRedis(cacheKey);
        this.redisStats.deletes++;
      }
      
      // Remove from tag map
      this.removeCacheTags(cacheKey);
      
      this.emit('cacheDelete', { key: cacheKey });
      return true;
      
    } catch (error) {
      console.error('Cache delete error:', error);
      this.emit('cacheError', { operation: 'delete', key: cacheKey, error });
      return false;
    }
  }
  
  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags) {
    if (!this.config.enabled || !Array.isArray(tags)) return false;
    
    const keysToInvalidate = new Set();
    
    // Collect all keys with these tags
    for (const tag of tags) {
      const taggedKeys = this.tagMap.get(tag);
      if (taggedKeys) {
        taggedKeys.forEach(key => keysToInvalidate.add(key));
      }
    }
    
    // Delete all tagged keys
    const deletePromises = Array.from(keysToInvalidate).map(key => this.delete(key));
    await Promise.all(deletePromises);
    
    this.emit('cacheInvalidation', { tags, keysInvalidated: keysToInvalidate.size });
    
    console.log(`🗑️  Invalidated ${keysToInvalidate.size} cache entries for tags: ${tags.join(', ')}`);
    
    return true;
  }
  
  /**
   * Clear all cache
   */
  async clear() {
    if (!this.config.enabled) return false;
    
    try {
      // Clear L1 cache
      if (this.config.memory.enabled) {
        this.memoryCache.clear();
        this.memoryCacheStats.size = 0;
      }
      
      // Clear L2 cache
      if (this.redisClient) {
        await this.redisClient.flushdb();
      }
      
      // Clear tag map
      this.tagMap.clear();
      
      this.emit('cacheClear');
      console.log('🗑️  All cache cleared');
      
      return true;
      
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }
  
  /**
   * Get from memory cache
   */
  getFromMemory(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      this.memoryCacheStats.size--;
      return null;
    }
    
    // Update access count
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.value;
  }
  
  /**
   * Set in memory cache
   */
  setInMemory(key, value, ttl) {
    // Check memory limits
    if (this.memoryCache.size >= this.config.memory.maxSize) {
      this.evictLRU();
    }
    
    const entry = {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + (ttl * 1000),
      accessCount: 0,
      size: this.estimateSize(value)
    };
    
    this.memoryCache.set(key, entry);
    this.memoryCacheStats.size++;
  }
  
  /**
   * Delete from memory cache
   */
  deleteFromMemory(key) {
    if (this.memoryCache.delete(key)) {
      this.memoryCacheStats.size--;
      return true;
    }
    return false;
  }
  
  /**
   * Get from Redis cache
   */
  async getFromRedis(key) {
    if (!this.redisClient) return null;
    
    const result = await this.redisClient.get(key);
    if (!result) return null;
    
    try {
      return JSON.parse(result);
    } catch (error) {
      console.error('Redis JSON parse error:', error);
      return null;
    }
  }
  
  /**
   * Set in Redis cache
   */
  async setInRedis(key, value, ttl) {
    if (!this.redisClient) return false;
    
    const serialized = JSON.stringify(value);
    
    if (ttl > 0) {
      await this.redisClient.setex(key, ttl, serialized);
    } else {
      await this.redisClient.set(key, serialized);
    }
    
    return true;
  }
  
  /**
   * Delete from Redis cache
   */
  async deleteFromRedis(key) {
    if (!this.redisClient) return false;
    
    const result = await this.redisClient.del(key);
    return result > 0;
  }
  
  /**
   * Build cache key with prefix
   */
  buildKey(key) {
    return `${this.config.redis.keyPrefix}${key}`;
  }
  
  /**
   * Add cache tags
   */
  addCacheTags(key, tags) {
    for (const tag of tags) {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag).add(key);
    }
  }
  
  /**
   * Remove cache tags
   */
  removeCacheTags(key) {
    for (const [tag, keys] of this.tagMap.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagMap.delete(tag);
      }
    }
  }
  
  /**
   * Evict least recently used entries from memory cache
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.memoryCacheStats.size--;
      this.emit('cacheEviction', { key: oldestKey, reason: 'LRU' });
    }
  }
  
  /**
   * Estimate memory size of value
   */
  estimateSize(value) {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate
    } catch {
      return 100; // Default size
    }
  }
  
  /**
   * Start memory cache cleanup
   */
  startMemoryCacheCleanup() {
    const cleanupInterval = setInterval(() => {
      this.cleanupExpiredMemoryEntries();
    }, 60000); // Every minute
    
    this.intervals.push(cleanupInterval);
  }
  
  /**
   * Clean up expired memory entries
   */
  cleanupExpiredMemoryEntries() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
      this.memoryCacheStats.size--;
    }
    
    if (expiredKeys.length > 0) {
      this.emit('cacheCleanup', { expiredKeys: expiredKeys.length });
    }
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    const metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Every 30 seconds
    
    this.intervals.push(metricsInterval);
  }
  
  /**
   * Collect cache metrics
   */
  collectMetrics() {
    const memoryHitRate = this.memoryCacheStats.hits + this.memoryCacheStats.misses > 0
      ? (this.memoryCacheStats.hits / (this.memoryCacheStats.hits + this.memoryCacheStats.misses)) * 100
      : 0;
    
    const redisHitRate = this.redisStats.hits + this.redisStats.misses > 0
      ? (this.redisStats.hits / (this.redisStats.hits + this.redisStats.misses)) * 100
      : 0;
    
    this.emit('cacheMetrics', {
      memory: {
        ...this.memoryCacheStats,
        hitRate: memoryHitRate
      },
      redis: {
        ...this.redisStats,
        hitRate: redisHitRate
      },
      tags: this.tagMap.size,
      timestamp: new Date()
    });
  }
  
  /**
   * Cache wrapper for database queries with automatic invalidation
   * ENHANCEMENT: Added intelligent cache keys and query pattern analysis
   */
  async cacheQuery(key, queryFn, ttlSeconds = 300, tags = []) {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute query and cache result
      const result = await queryFn();
      await this.set(key, result, ttlSeconds, { tags });
      
      return result;
    } catch (error) {
      console.error('Cache query wrapper error:', error);
      // Return query result even if caching fails
      return await queryFn();
    }
  }
  
  /**
   * Advanced query result caching with pattern analysis
   * OPTIMIZATION: Intelligent cache key generation and query optimization
   */
  async cacheQueryWithPattern(queryPattern, params, queryFn, options = {}) {
    const {
      ttl = 300,
      tags = [],
      keyPrefix = 'query',
      enablePatternAnalysis = true,
      maxCacheSize = 1000
    } = options;
    
    // Generate intelligent cache key based on query pattern and parameters
    const cacheKey = this.generateQueryCacheKey(keyPrefix, queryPattern, params);
    
    try {
      // Check cache first
      const cached = await this.get(cacheKey);
      if (cached !== null) {
        // Track cache hit for pattern analysis
        if (enablePatternAnalysis) {
          this.trackQueryPattern(queryPattern, 'hit');
        }
        return cached;
      }
      
      // Execute query
      const startTime = Date.now();
      const result = await queryFn();
      const executionTime = Date.now() - startTime;
      
      // Cache the result
      await this.set(cacheKey, result, ttl, { tags });
      
      // Track query pattern for optimization analysis
      if (enablePatternAnalysis) {
        this.trackQueryPattern(queryPattern, 'miss', {
          executionTime,
          resultSize: this.estimateSize(result),
          params: Object.keys(params || {})
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Query caching error:', error);
      // Track error for pattern analysis
      if (enablePatternAnalysis) {
        this.trackQueryPattern(queryPattern, 'error', { error: error.message });
      }
      // Return query result even if caching fails
      return await queryFn();
    }
  }
  
  /**
   * Generate intelligent cache key for queries
   */
  generateQueryCacheKey(prefix, pattern, params) {
    // Create a hash of the query pattern and parameters
    const crypto = require('crypto');
    const paramString = JSON.stringify(params || {}, Object.keys(params || {}).sort());
    const hash = crypto.createHash('md5').update(pattern + paramString).digest('hex');
    return `${prefix}:${hash}`;
  }
  
  /**
   * Track query patterns for optimization analysis
   */
  trackQueryPattern(pattern, event, metadata = {}) {
    if (!this.queryPatterns) {
      this.queryPatterns = new Map();
    }
    
    if (!this.queryPatterns.has(pattern)) {
      this.queryPatterns.set(pattern, {
        hits: 0,
        misses: 0,
        errors: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0,
        lastUsed: Date.now(),
        frequency: 0
      });
    }
    
    const stats = this.queryPatterns.get(pattern);
    stats.frequency++;
    stats.lastUsed = Date.now();
    
    switch (event) {
      case 'hit':
        stats.hits++;
        break;
      case 'miss':
        stats.misses++;
        if (metadata.executionTime) {
          stats.totalExecutionTime += metadata.executionTime;
          stats.avgExecutionTime = stats.totalExecutionTime / stats.misses;
        }
        break;
      case 'error':
        stats.errors++;
        break;
    }
  }
  
  /**
   * Get query pattern analysis and optimization suggestions
   */
  getQueryPatternAnalysis() {
    if (!this.queryPatterns) {
      return { patterns: [], suggestions: [] };
    }
    
    const patterns = Array.from(this.queryPatterns.entries()).map(([pattern, stats]) => ({
      pattern,
      ...stats,
      hitRate: stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0,
      errorRate: stats.frequency > 0 ? (stats.errors / stats.frequency) * 100 : 0
    }));
    
    // Generate optimization suggestions
    const suggestions = [];
    
    patterns.forEach(p => {
      if (p.hitRate < 20 && p.frequency > 10) {
        suggestions.push({
          type: 'low_hit_rate',
          pattern: p.pattern,
          message: `Query pattern has low cache hit rate (${p.hitRate.toFixed(1)}%). Consider increasing TTL or reviewing cache invalidation strategy.`
        });
      }
      
      if (p.avgExecutionTime > 1000 && p.hitRate < 50) {
        suggestions.push({
          type: 'slow_query',
          pattern: p.pattern,
          message: `Slow query (${p.avgExecutionTime.toFixed(0)}ms avg) with low cache hit rate. Consider query optimization or longer TTL.`
        });
      }
      
      if (p.errorRate > 5) {
        suggestions.push({
          type: 'high_error_rate',
          pattern: p.pattern,
          message: `High error rate (${p.errorRate.toFixed(1)}%). Review query implementation and error handling.`
        });
      }
    });
    
    return { patterns, suggestions };
  }
  
  /**
   * Batch cache multiple queries
   * OPTIMIZATION: Execute multiple queries in parallel and cache results
   */
  async batchCacheQueries(queries) {
    const results = await Promise.allSettled(
      queries.map(async ({ key, queryFn, ttl, tags }) => {
        try {
          return await this.cacheQuery(key, queryFn, ttl, tags);
        } catch (error) {
          console.error(`Batch query error for key ${key}:`, error);
          throw error;
        }
      })
    );
    
    return results.map((result, index) => ({
      key: queries[index].key,
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }
  
  /**
   * Preload cache with frequently used queries
   * OPTIMIZATION: Warm cache with common queries during low-traffic periods
   */
  async preloadCache(preloadQueries) {
    console.log(`🔥 Preloading cache with ${preloadQueries.length} queries...`);
    
    const results = await this.batchCacheQueries(preloadQueries);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`🔥 Cache preload complete: ${successful} successful, ${failed} failed`);
    
    return { successful, failed, results };
  }
  
  /**
   * Smart cache warming based on query patterns
   * OPTIMIZATION: Automatically warm cache for frequently used queries
   */
  async smartCacheWarming() {
    if (!this.queryPatterns) return;
    
    const patterns = Array.from(this.queryPatterns.entries())
      .filter(([_, stats]) => stats.frequency > 5 && stats.hitRate < 80)
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 10); // Top 10 patterns
    
    console.log(`🧠 Smart cache warming for ${patterns.length} query patterns...`);
    
    // This would need to be implemented with actual query functions
    // For now, just log the patterns that would benefit from warming
    patterns.forEach(([pattern, stats]) => {
      console.log(`🧠 Pattern "${pattern}" - Frequency: ${stats.frequency}, Hit Rate: ${stats.hitRate.toFixed(1)}%`);
    });
  }

  /**
   * Get cache middleware for Express
   */
  getMiddleware() {
    return (req, res, next) => {
      // Add cache utilities to request
      req.cache = {
        get: (key, options) => this.get(key, options),
        set: (key, value, ttl, options) => this.set(key, value, ttl, options),
        delete: (key) => this.delete(key),
        invalidateByTags: (tags) => this.invalidateByTags(tags)
      };
      
      next();
    };
  }
  
  /**
   * Get cache health and statistics
   * ENHANCEMENT: Added query pattern analysis and optimization suggestions
   */
  async getHealth() {
    const memoryUsage = process.memoryUsage();
    const queryAnalysis = this.getQueryPatternAnalysis();
    
    return {
      enabled: this.config.enabled,
      redis: {
        connected: this.redisClient ? this.redisClient.status === 'ready' : false,
        stats: { ...this.redisStats }
      },
      memory: {
        stats: { ...this.memoryCacheStats },
        usage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        }
      },
      tags: this.tagMap.size,
      queryPatterns: {
        total: queryAnalysis.patterns.length,
        topPatterns: queryAnalysis.patterns
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 5),
        suggestions: queryAnalysis.suggestions
      },
      config: {
        defaultTTL: this.config.defaultTTL,
        maxMemoryMB: this.config.maxMemoryMB
      }
    };
  }
  
  /**
   * Shutdown cache manager
   */
  async shutdown() {
    console.log('📦 Shutting down Cache Manager...');
    
    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Close Redis connection
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    // Clear memory cache
    this.memoryCache.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('✅ Cache Manager shutdown complete');
  }
}

module.exports = CacheManager;