// optimization/database/DatabasePoolManager.js
// Optimized database connection pool management

const os = require('os');
const EventEmitter = require('events');
const IndexManager = require('./IndexManager');

/**
 * Database connection pool manager with dynamic sizing and health monitoring
 * Optimizes PostgreSQL connection pooling for concurrent request handling
 */
class DatabasePoolManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Dynamic pool sizing based on system resources
      poolSize: {
        min: 2,
        max: this.calculateOptimalMaxConnections(),
        idle: 30000,    // 30 seconds
        acquire: 60000, // 60 seconds
        evict: 1000     // 1 second
      },
      
      // Connection health monitoring
      healthCheck: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 5000    // 5 seconds
      },
      
      // Query timeout
      queryTimeout: 30000,
      
      // Retry configuration
      retry: {
        max: 3,
        backoff: 'exponential',
        baseDelay: 1000
      },
      
      // Index optimization
      indexOptimization: {
        enabled: true,
        autoCreate: process.env.NODE_ENV !== 'production'
      },
      
      ...config
    };
    
    this.metrics = {
      connections: {
        active: 0,
        idle: 0,
        waiting: 0,
        created: 0,
        destroyed: 0
      },
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        timeouts: 0
      },
      health: {
        status: 'unknown',
        lastCheck: null,
        consecutiveFailures: 0
      }
    };
    
    this.intervals = [];
    this.sequelize = null;
    this.indexManager = null;
  }
  
  /**
   * Calculate optimal maximum connections based on system resources
   */
  calculateOptimalMaxConnections() {
    const cpuCores = os.cpus().length;
    const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
    
    // Base calculation: 2-4 connections per CPU core
    let maxConnections = cpuCores * 3;
    
    // Adjust based on available memory
    if (totalMemoryGB < 2) {
      maxConnections = Math.min(maxConnections, 10);
    } else if (totalMemoryGB < 4) {
      maxConnections = Math.min(maxConnections, 15);
    } else if (totalMemoryGB >= 8) {
      maxConnections = Math.min(maxConnections, 30);
    }
    
    // Environment-specific adjustments
    if (process.env.NODE_ENV === 'production') {
      maxConnections = Math.max(maxConnections, 20);
    } else {
      maxConnections = Math.min(maxConnections, 10);
    }
    
    console.log(`📊 Calculated optimal max connections: ${maxConnections} (CPU cores: ${cpuCores}, Memory: ${totalMemoryGB.toFixed(1)}GB)`);
    
    return maxConnections;
  }
  
  /**
   * Initialize the database pool manager
   */
  async initialize() {
    console.log('🔗 Initializing Database Pool Manager...');
    
    // Get the existing Sequelize instance
    this.sequelize = require('../../config/database');
    
    // Apply optimized pool configuration
    await this.applyOptimizedPoolConfig();
    
    // Initialize index manager if enabled
    if (this.config.indexOptimization.enabled) {
      this.indexManager = new IndexManager(this.sequelize, this.config.indexOptimization);
      await this.indexManager.initialize();
    } else {
      console.log('⚠️  Index Manager disabled - skipping index optimization');
    }
    
    // Start health monitoring
    if (this.config.healthCheck.enabled) {
      this.startHealthMonitoring();
    }
    
    // Start metrics collection
    this.startMetricsCollection();
    
    console.log('✅ Database Pool Manager initialized');
  }
  
  /**
   * Apply optimized pool configuration to Sequelize
   */
  async applyOptimizedPoolConfig() {
    const currentConfig = this.sequelize.config;
    
    // Create optimized pool configuration
    const optimizedConfig = {
      ...currentConfig,
      pool: {
        max: this.config.poolSize.max,
        min: this.config.poolSize.min,
        idle: this.config.poolSize.idle,
        acquire: this.config.poolSize.acquire,
        evict: this.config.poolSize.evict,
        handleDisconnects: true,
        
        // Enhanced connection validation
        validate: (connection) => {
          return connection && !connection.connection?._ending;
        }
      },
      
      // Query timeout
      dialectOptions: {
        ...currentConfig.dialectOptions,
        statement_timeout: this.config.queryTimeout,
        query_timeout: this.config.queryTimeout
      },
      
      // Retry configuration
      retry: this.config.retry,
      
      // Enhanced logging for pool events
      logging: (sql, timing) => {
        this.metrics.queries.total++;
        
        // Track query performance for index optimization
        if (this.indexManager && timing) {
          this.indexManager.trackQuery(sql, timing);
        }
        
        if (timing) {
          this.emit('queryExecuted', {
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            duration: timing,
            timestamp: new Date()
          });
        }
      }
    };
    
    // Update Sequelize configuration safely
    try {
      Object.assign(this.sequelize.config, optimizedConfig);
      console.log(`🔧 Applied optimized pool config: min=${this.config.poolSize.min}, max=${this.config.poolSize.max}`);
    } catch (error) {
      console.warn('⚠️  Could not apply all pool configurations:', error.message);
      console.log(`🔧 Applied basic pool config: min=${this.config.poolSize.min}, max=${this.config.poolSize.max}`);
    }
  }
  
  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    const healthInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheck.interval);
    
    this.intervals.push(healthInterval);
    
    console.log('💓 Database health monitoring started');
  }
  
  /**
   * Perform database health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      // Simple query to test connection
      await this.sequelize.query('SELECT 1 as health_check', {
        timeout: this.config.healthCheck.timeout
      });
      
      const duration = Date.now() - startTime;
      
      this.metrics.health = {
        status: 'healthy',
        lastCheck: new Date(),
        consecutiveFailures: 0,
        responseTime: duration
      };
      
      this.emit('healthCheck', {
        status: 'healthy',
        duration,
        timestamp: new Date()
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.metrics.health.consecutiveFailures++;
      this.metrics.health.lastCheck = new Date();
      
      if (this.metrics.health.consecutiveFailures >= 3) {
        this.metrics.health.status = 'unhealthy';
      } else {
        this.metrics.health.status = 'degraded';
      }
      
      this.emit('healthCheck', {
        status: this.metrics.health.status,
        error: error.message,
        duration,
        consecutiveFailures: this.metrics.health.consecutiveFailures,
        timestamp: new Date()
      });
      
      console.warn(`⚠️  Database health check failed (${this.metrics.health.consecutiveFailures}/3):`, error.message);
    }
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    const metricsInterval = setInterval(() => {
      this.collectPoolMetrics();
    }, 10000); // Every 10 seconds
    
    this.intervals.push(metricsInterval);
  }
  
  /**
   * Collect current pool metrics
   */
  collectPoolMetrics() {
    if (!this.sequelize.connectionManager) return;
    
    const pool = this.sequelize.connectionManager.pool;
    
    if (pool) {
      // Safely access pool properties with fallbacks
      this.metrics.connections = {
        active: pool.used || pool._count || 0,
        idle: pool.available || pool._idle || 0,
        waiting: pool.pending || pool._pendingAcquires?.length || 0,
        created: this.metrics.connections.created,
        destroyed: this.metrics.connections.destroyed
      };
      
      this.emit('poolMetrics', {
        ...this.metrics.connections,
        timestamp: new Date()
      });
      
      // Check for pool exhaustion
      if (this.metrics.connections.waiting > 5) {
        this.emit('poolAlert', {
          type: 'high_wait_queue',
          waiting: this.metrics.connections.waiting,
          severity: 'warning'
        });
      }
      
      // Check for low utilization
      const utilization = this.metrics.connections.active / this.config.poolSize.max;
      if (utilization < 0.1 && this.metrics.connections.active > 0) {
        this.emit('poolAlert', {
          type: 'low_utilization',
          utilization,
          severity: 'info'
        });
      }
    }
  }
  
  /**
   * Get current pool health and metrics
   */
  async getHealth() {
    return {
      status: this.metrics.health.status,
      lastCheck: this.metrics.health.lastCheck,
      consecutiveFailures: this.metrics.health.consecutiveFailures,
      connections: { ...this.metrics.connections },
      queries: { ...this.metrics.queries },
      config: {
        maxConnections: this.config.poolSize.max,
        minConnections: this.config.poolSize.min,
        idleTimeout: this.config.poolSize.idle,
        acquireTimeout: this.config.poolSize.acquire
      },
      indexOptimization: this.indexManager ? {
        enabled: true,
        recommendations: this.indexManager.getRecommendations().total
      } : {
        enabled: false
      }
    };
  }
  
  /**
   * Get index optimization report
   */
  async getIndexReport() {
    if (!this.indexManager) {
      return { enabled: false, message: 'Index optimization not enabled' };
    }
    
    return await this.indexManager.getIndexHealthReport();
  }
  
  /**
   * Create recommended indexes (development only)
   */
  async createRecommendedIndexes() {
    if (!this.indexManager) {
      throw new Error('Index manager not initialized');
    }
    
    return await this.indexManager.createRecommendedIndexes();
  }
  
  /**
   * Get query performance statistics
   */
  getQueryStats() {
    if (!this.indexManager) {
      return { enabled: false };
    }
    
    return this.indexManager.getQueryStats();
  }
  
  /**
   * Get detailed pool statistics
   */
  getPoolStats() {
    const pool = this.sequelize.connectionManager?.pool;
    
    return {
      connections: { ...this.metrics.connections },
      queries: { ...this.metrics.queries },
      health: { ...this.metrics.health },
      pool: pool ? {
        size: pool.size || pool._count || 0,
        used: pool.used || pool._count || 0,
        available: pool.available || pool._idle || 0,
        pending: pool.pending || pool._pendingAcquires?.length || 0,
        max: pool.max || this.config.poolSize.max,
        min: pool.min || this.config.poolSize.min
      } : null,
      config: this.config
    };
  }
  
  /**
   * Recycle idle connections
   */
  async recycleIdleConnections() {
    console.log('🔄 Recycling idle database connections...');
    
    try {
      const pool = this.sequelize.connectionManager?.pool;
      if (pool && pool.available > this.config.poolSize.min) {
        // For newer Sequelize versions, use drain method if available
        if (typeof pool.drain === 'function') {
          await pool.drain();
        } else if (typeof pool.clear === 'function') {
          await pool.clear();
        } else {
          console.log('⚠️  Pool recycling not supported in this Sequelize version');
          return;
        }
        
        this.emit('connectionsRecycled', {
          timestamp: new Date(),
          previousIdle: this.metrics.connections.idle
        });
        
        console.log('✅ Idle connections recycled');
      }
    } catch (error) {
      console.error('❌ Failed to recycle connections:', error.message);
    }
  }
  
  /**
   * Execute query with enhanced monitoring
   */
  async executeQuery(sql, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.sequelize.query(sql, {
        timeout: this.config.queryTimeout,
        ...options
      });
      
      const duration = Date.now() - startTime;
      this.metrics.queries.successful++;
      
      this.emit('querySuccess', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        duration,
        resultCount: Array.isArray(result[0]) ? result[0].length : 0,
        timestamp: new Date()
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.queries.failed++;
      
      if (error.name === 'SequelizeTimeoutError') {
        this.metrics.queries.timeouts++;
      }
      
      this.emit('queryError', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        error: error.message,
        duration,
        timestamp: new Date()
      });
      
      throw error;
    }
  }
  
  /**
   * Shutdown the pool manager
   */
  async shutdown() {
    console.log('🔗 Shutting down Database Pool Manager...');
    
    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('✅ Database Pool Manager shutdown complete');
  }
}

module.exports = DatabasePoolManager;