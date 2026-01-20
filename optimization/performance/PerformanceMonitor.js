// optimization/performance/PerformanceMonitor.js
// Performance monitoring and metrics collection

const EventEmitter = require('events');

/**
 * Performance monitoring system
 * Collects metrics on API response times, database queries, and cache performance
 */
class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      metricsInterval: 60000, // 1 minute
      alertThresholds: {
        responseTime: 2000, // 2 seconds
        dbQueryTime: 1000,  // 1 second
        cacheHitRate: 0.8   // 80%
      },
      maxMetricsHistory: 1000,
      ...config
    };
    
    this.metrics = {
      requests: new Map(), // endpoint -> metrics
      queries: [],
      cache: {
        hits: 0,
        misses: 0,
        operations: []
      },
      system: {
        startTime: Date.now(),
        totalRequests: 0,
        totalErrors: 0
      }
    };
    
    this.intervals = [];
  }
  
  async initialize() {
    if (!this.config.enabled) return;
    
    console.log('📊 Initializing Performance Monitor...');
    
    // Start metrics collection interval
    const metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkAlertThresholds();
    }, this.config.metricsInterval);
    
    this.intervals.push(metricsInterval);
    
    console.log('✅ Performance Monitor initialized');
  }
  
  /**
   * Express middleware for request performance monitoring
   */
  getMiddleware() {
    if (!this.config.enabled) {
      return (req, res, next) => next();
    }
    
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      const endpoint = `${req.method} ${req.route?.path || req.path}`;
      
      // Track request start
      this.metrics.system.totalRequests++;
      
      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Record metrics
        this.recordRequestMetric({
          endpoint,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
        
        // Call original end
        originalEnd.apply(res, args);
      };
      
      // Track errors
      res.on('error', (error) => {
        this.metrics.system.totalErrors++;
        this.recordError({
          endpoint,
          error: error.message,
          timestamp: new Date()
        });
      });
      
      next();
    };
  }
  
  /**
   * Record request performance metric
   */
  recordRequestMetric(metric) {
    const { endpoint } = metric;
    
    if (!this.metrics.requests.has(endpoint)) {
      this.metrics.requests.set(endpoint, {
        totalRequests: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errorCount: 0,
        statusCodes: new Map(),
        recentRequests: []
      });
    }
    
    const endpointMetrics = this.metrics.requests.get(endpoint);
    
    // Update aggregated metrics
    endpointMetrics.totalRequests++;
    endpointMetrics.totalResponseTime += metric.responseTime;
    endpointMetrics.minResponseTime = Math.min(endpointMetrics.minResponseTime, metric.responseTime);
    endpointMetrics.maxResponseTime = Math.max(endpointMetrics.maxResponseTime, metric.responseTime);
    
    // Track status codes
    const statusCode = metric.statusCode.toString();
    endpointMetrics.statusCodes.set(statusCode, (endpointMetrics.statusCodes.get(statusCode) || 0) + 1);
    
    // Track errors
    if (metric.statusCode >= 400) {
      endpointMetrics.errorCount++;
    }
    
    // Keep recent requests for detailed analysis
    endpointMetrics.recentRequests.push(metric);
    if (endpointMetrics.recentRequests.length > 100) {
      endpointMetrics.recentRequests.shift();
    }
    
    // Emit performance event for real-time monitoring
    this.emit('requestMetric', metric);
  }
  
  /**
   * Record database query performance
   */
  recordQueryMetric(queryMetric) {
    this.metrics.queries.push({
      ...queryMetric,
      timestamp: new Date()
    });
    
    // Keep only recent queries
    if (this.metrics.queries.length > this.config.maxMetricsHistory) {
      this.metrics.queries.shift();
    }
    
    this.emit('queryMetric', queryMetric);
  }
  
  /**
   * Record cache operation
   */
  recordCacheOperation(operation) {
    if (operation.hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
    
    this.metrics.cache.operations.push({
      ...operation,
      timestamp: new Date()
    });
    
    // Keep only recent operations
    if (this.metrics.cache.operations.length > this.config.maxMetricsHistory) {
      this.metrics.cache.operations.shift();
    }
    
    this.emit('cacheOperation', operation);
  }
  
  /**
   * Record error
   */
  recordError(error) {
    this.emit('error', error);
  }
  
  /**
   * Get current performance metrics
   */
  async getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.system.startTime;
    
    // Calculate endpoint statistics
    const endpointStats = [];
    for (const [endpoint, metrics] of this.metrics.requests) {
      const avgResponseTime = metrics.totalRequests > 0 
        ? metrics.totalResponseTime / metrics.totalRequests 
        : 0;
      
      const errorRate = metrics.totalRequests > 0 
        ? (metrics.errorCount / metrics.totalRequests) * 100 
        : 0;
      
      // Calculate percentiles for recent requests
      const recentTimes = metrics.recentRequests.map(r => r.responseTime).sort((a, b) => a - b);
      const p95 = recentTimes.length > 0 ? recentTimes[Math.floor(recentTimes.length * 0.95)] : 0;
      const p99 = recentTimes.length > 0 ? recentTimes[Math.floor(recentTimes.length * 0.99)] : 0;
      
      endpointStats.push({
        endpoint,
        totalRequests: metrics.totalRequests,
        avgResponseTime: Math.round(avgResponseTime),
        minResponseTime: metrics.minResponseTime === Infinity ? 0 : Math.round(metrics.minResponseTime),
        maxResponseTime: Math.round(metrics.maxResponseTime),
        p95ResponseTime: Math.round(p95),
        p99ResponseTime: Math.round(p99),
        errorRate: Math.round(errorRate * 100) / 100,
        statusCodes: Object.fromEntries(metrics.statusCodes),
        requestsPerMinute: this.calculateRequestsPerMinute(metrics.recentRequests)
      });
    }
    
    // Sort by total requests
    endpointStats.sort((a, b) => b.totalRequests - a.totalRequests);
    
    // Calculate cache hit rate
    const totalCacheOps = this.metrics.cache.hits + this.metrics.cache.misses;
    const cacheHitRate = totalCacheOps > 0 
      ? (this.metrics.cache.hits / totalCacheOps) * 100 
      : 0;
    
    // Calculate recent query performance
    const recentQueries = this.metrics.queries.slice(-100);
    const avgQueryTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length
      : 0;
    
    // Calculate slowest queries
    const slowestQueries = recentQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5)
      .map(q => ({
        query: q.query?.substring(0, 100) + (q.query?.length > 100 ? '...' : ''),
        executionTime: Math.round(q.executionTime),
        timestamp: q.timestamp
      }));
    
    return {
      system: {
        uptime,
        totalRequests: this.metrics.system.totalRequests,
        totalErrors: this.metrics.system.totalErrors,
        errorRate: this.metrics.system.totalRequests > 0 
          ? (this.metrics.system.totalErrors / this.metrics.system.totalRequests) * 100 
          : 0,
        requestsPerSecond: this.calculateRequestsPerSecond()
      },
      endpoints: endpointStats,
      database: {
        totalQueries: this.metrics.queries.length,
        avgQueryTime: Math.round(avgQueryTime),
        slowestQueries,
        recentQueries: recentQueries.slice(-10)
      },
      cache: {
        hitRate: Math.round(cacheHitRate * 100) / 100,
        totalHits: this.metrics.cache.hits,
        totalMisses: this.metrics.cache.misses,
        recentOperations: this.metrics.cache.operations.slice(-10)
      },
      alerts: this.getActiveAlerts()
    };
  }
  
  /**
   * Calculate requests per minute for an endpoint
   */
  calculateRequestsPerMinute(recentRequests) {
    const oneMinuteAgo = Date.now() - 60000;
    const recentCount = recentRequests.filter(r => 
      new Date(r.timestamp).getTime() > oneMinuteAgo
    ).length;
    return recentCount;
  }
  
  /**
   * Calculate overall requests per second
   */
  calculateRequestsPerSecond() {
    const oneMinuteAgo = Date.now() - 60000;
    let totalRecentRequests = 0;
    
    for (const [, metrics] of this.metrics.requests) {
      totalRecentRequests += metrics.recentRequests.filter(r => 
        new Date(r.timestamp).getTime() > oneMinuteAgo
      ).length;
    }
    
    return Math.round((totalRecentRequests / 60) * 100) / 100;
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts() {
    const alerts = [];
    const thresholds = this.config.alertThresholds;
    
    // Check endpoint response times
    for (const [endpoint, metrics] of this.metrics.requests) {
      const avgResponseTime = metrics.totalRequests > 0 
        ? metrics.totalResponseTime / metrics.totalRequests 
        : 0;
      
      if (avgResponseTime > thresholds.responseTime) {
        alerts.push({
          type: 'slow_endpoint',
          endpoint,
          avgResponseTime: Math.round(avgResponseTime),
          threshold: thresholds.responseTime,
          severity: avgResponseTime > thresholds.responseTime * 2 ? 'critical' : 'warning'
        });
      }
      
      // Check error rate
      const errorRate = metrics.totalRequests > 0 
        ? (metrics.errorCount / metrics.totalRequests) * 100 
        : 0;
      
      if (errorRate > 5) { // 5% error rate threshold
        alerts.push({
          type: 'high_error_rate',
          endpoint,
          errorRate: Math.round(errorRate * 100) / 100,
          threshold: 5,
          severity: errorRate > 10 ? 'critical' : 'warning'
        });
      }
    }
    
    // Check cache hit rate
    const totalCacheOps = this.metrics.cache.hits + this.metrics.cache.misses;
    const cacheHitRate = totalCacheOps > 0 
      ? (this.metrics.cache.hits / totalCacheOps) 
      : 1;
    
    if (cacheHitRate < thresholds.cacheHitRate && totalCacheOps > 10) {
      alerts.push({
        type: 'low_cache_hit_rate',
        hitRate: Math.round(cacheHitRate * 100),
        threshold: Math.round(thresholds.cacheHitRate * 100),
        severity: cacheHitRate < thresholds.cacheHitRate * 0.5 ? 'critical' : 'warning'
      });
    }
    
    return alerts;
  }
  
  /**
   * Collect system-level metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.emit('systemMetrics', {
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      cpu: cpuUsage,
      timestamp: new Date()
    });
  }
  
  /**
   * Check alert thresholds and emit alerts
   */
  checkAlertThresholds() {
    const thresholds = this.config.alertThresholds;
    
    // Check endpoint response times
    for (const [endpoint, metrics] of this.metrics.requests) {
      const avgResponseTime = metrics.totalRequests > 0 
        ? metrics.totalResponseTime / metrics.totalRequests 
        : 0;
      
      if (avgResponseTime > thresholds.responseTime) {
        this.emit('alert', {
          type: 'slow_endpoint',
          endpoint,
          avgResponseTime,
          threshold: thresholds.responseTime,
          severity: 'warning'
        });
      }
    }
    
    // Check cache hit rate
    const totalCacheOps = this.metrics.cache.hits + this.metrics.cache.misses;
    const cacheHitRate = totalCacheOps > 0 
      ? (this.metrics.cache.hits / totalCacheOps) 
      : 1;
    
    if (cacheHitRate < thresholds.cacheHitRate) {
      this.emit('alert', {
        type: 'low_cache_hit_rate',
        hitRate: cacheHitRate,
        threshold: thresholds.cacheHitRate,
        severity: 'warning'
      });
    }
  }
  
  /**
   * Start monitoring
   */
  startMonitoring() {
    console.log('📈 Performance monitoring started');
    
    // Log alerts to console
    this.on('alert', (alert) => {
      console.warn(`⚠️  Performance Alert: ${alert.type}`, alert);
    });
  }
  
  /**
   * Shutdown monitoring
   */
  async shutdown() {
    console.log('📊 Shutting down Performance Monitor...');
    
    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('✅ Performance Monitor shutdown complete');
  }
}

module.exports = PerformanceMonitor;