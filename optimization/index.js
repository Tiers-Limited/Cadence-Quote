// optimization/index.js
// Core optimization infrastructure and interfaces

const PerformanceMonitor = require('./performance/PerformanceMonitor');
const QueryOptimizer = require('./query/QueryOptimizer');
const CacheManager = require('./cache/CacheManager');
const ResponseOptimizer = require('./response/ResponseOptimizer');
const DatabasePoolManager = require('./database/DatabasePoolManager');

/**
 * Main optimization system orchestrator
 * Coordinates all optimization components
 */
class OptimizationSystem {
  constructor(config = {}) {
    this.config = {
      // Performance monitoring
      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 minute
        alertThresholds: {
          responseTime: 2000, // 2 seconds
          dbQueryTime: 1000,  // 1 second
          cacheHitRate: 0.8   // 80%
        }
      },
      
      // Database optimization
      database: {
        poolSize: {
          min: 2,
          max: process.env.NODE_ENV === 'production' ? 20 : 10
        },
        queryTimeout: 30000,
        enableQueryCache: true
      },
      
      // Caching configuration
      cache: {
        enabled: true,
        defaultTTL: 300, // 5 minutes
        maxMemoryMB: 100,
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        }
      },
      
      // Response optimization
      response: {
        compression: {
          enabled: true,
          threshold: 1024, // 1KB
          level: 6
        },
        fieldSelection: true,
        maxResponseSize: 10 * 1024 * 1024 // 10MB
      },
      
      ...config
    };
    
    this.components = {};
    this.initialized = false;
  }
  
  /**
   * Initialize all optimization components
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🚀 Initializing API Optimization System...');
      
      // Initialize performance monitoring first
      this.components.performanceMonitor = new PerformanceMonitor(this.config.monitoring);
      await this.components.performanceMonitor.initialize();
      
      // Initialize database pool manager
      this.components.databasePool = new DatabasePoolManager(this.config.database);
      await this.components.databasePool.initialize();
      
      // Initialize cache manager
      if (this.config.cache.enabled) {
        this.components.cacheManager = new CacheManager(this.config.cache);
        await this.components.cacheManager.initialize();
      }
      
      // Initialize query optimizer
      this.components.queryOptimizer = new QueryOptimizer({
        cacheManager: this.components.cacheManager,
        performanceMonitor: this.components.performanceMonitor
      });
      
      // Initialize response optimizer
      this.components.responseOptimizer = new ResponseOptimizer(this.config.response);
      
      this.initialized = true;
      console.log('✅ API Optimization System initialized successfully');
      
      // Start performance monitoring
      this.components.performanceMonitor.startMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to initialize optimization system:', error);
      throw error;
    }
  }
  
  /**
   * Get optimization middleware for Express
   */
  getMiddleware() {
    if (!this.initialized) {
      throw new Error('Optimization system not initialized. Call initialize() first.');
    }
    
    return {
      // Performance monitoring middleware
      performanceMonitoring: this.components.performanceMonitor.getMiddleware(),
      
      // Response compression middleware
      compression: this.components.responseOptimizer.getCompressionMiddleware(),
      
      // Cache middleware
      cache: this.components.cacheManager ? this.components.cacheManager.getMiddleware() : null,
      
      // Query optimization middleware
      queryOptimization: this.components.queryOptimizer.getMiddleware()
    };
  }
  
  /**
   * Get optimization utilities for controllers
   */
  getUtils() {
    if (!this.initialized) {
      throw new Error('Optimization system not initialized. Call initialize() first.');
    }
    
    return {
      cache: this.components.cacheManager,
      queryOptimizer: this.components.queryOptimizer,
      responseOptimizer: this.components.responseOptimizer,
      performanceMonitor: this.components.performanceMonitor
    };
  }
  
  /**
   * Get system health and metrics
   */
  async getSystemHealth() {
    if (!this.initialized) return { status: 'not_initialized' };
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {}
    };
    
    // Database pool health
    if (this.components.databasePool) {
      health.components.database = await this.components.databasePool.getHealth();
    }
    
    // Cache health
    if (this.components.cacheManager) {
      health.components.cache = await this.components.cacheManager.getHealth();
    }
    
    // Performance metrics
    if (this.components.performanceMonitor) {
      health.components.performance = await this.components.performanceMonitor.getMetrics();
    }
    
    return health;
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down optimization system...');
    
    if (this.components.performanceMonitor) {
      await this.components.performanceMonitor.shutdown();
    }
    
    if (this.components.cacheManager) {
      await this.components.cacheManager.shutdown();
    }
    
    if (this.components.databasePool) {
      await this.components.databasePool.shutdown();
    }
    
    console.log('✅ Optimization system shutdown complete');
  }
}

// Export singleton instance
const optimizationSystem = new OptimizationSystem();

module.exports = {
  OptimizationSystem,
  optimizationSystem
};