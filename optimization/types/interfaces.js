// optimization/types/interfaces.js
// TypeScript-style interfaces and type definitions for optimization system

/**
 * @typedef {Object} PoolConfig
 * @property {number} min - Minimum connections (2-5)
 * @property {number} max - Maximum connections (CPU cores * 2-4)
 * @property {number} idle - Idle timeout (30000ms)
 * @property {number} acquire - Acquire timeout (60000ms)
 * @property {number} evict - Eviction interval (1000ms)
 * @property {boolean} handleDisconnects - Handle disconnects automatically
 */

/**
 * @typedef {Object} CacheEntry
 * @property {string} key - Cache key
 * @property {*} value - Cached value
 * @property {number} ttl - Time to live in seconds
 * @property {Date} createdAt - Creation timestamp
 * @property {number} accessCount - Number of times accessed
 * @property {string[]} tags - Cache tags for invalidation
 */

/**
 * @typedef {Object} QueryMetrics
 * @property {string} query - SQL query string
 * @property {number} executionTime - Execution time in milliseconds
 * @property {number} resultCount - Number of results returned
 * @property {boolean} cacheHit - Whether result came from cache
 * @property {Date} timestamp - Query timestamp
 * @property {string} endpoint - API endpoint that triggered query
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {string} endpoint - API endpoint
 * @property {number} responseTime - Response time in milliseconds
 * @property {number} dbQueryTime - Database query time in milliseconds
 * @property {number} cacheHitRate - Cache hit rate (0-1)
 * @property {number} requestCount - Number of requests
 * @property {number} errorRate - Error rate (0-1)
 * @property {Date} timestamp - Metrics timestamp
 */

/**
 * @typedef {Object} IndexConfig
 * @property {string} tableName - Database table name
 * @property {string[]} columns - Columns to index
 * @property {string} type - Index type (btree, hash, gin, etc.)
 * @property {boolean} unique - Whether index is unique
 * @property {string} [where] - WHERE clause for partial index
 */

/**
 * @typedef {Object} CompositeIndexConfig
 * @property {string} tableName - Database table name
 * @property {string[]} columns - Columns in composite index
 * @property {string} name - Index name
 * @property {boolean} unique - Whether index is unique
 * @property {string} [where] - WHERE clause for partial index
 */

/**
 * @typedef {Object} PartialIndexConfig
 * @property {string} tableName - Database table name
 * @property {string[]} columns - Columns to index
 * @property {string} where - WHERE clause for partial index
 * @property {string} name - Index name
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Task ID
 * @property {string} type - Task type
 * @property {*} data - Task data
 * @property {number} priority - Task priority (1-10)
 * @property {Date} createdAt - Task creation time
 * @property {number} [retries] - Number of retries
 * @property {Date} [executeAt] - When to execute task
 */

/**
 * @typedef {Object} QueueMetrics
 * @property {number} pending - Number of pending tasks
 * @property {number} active - Number of active tasks
 * @property {number} completed - Number of completed tasks
 * @property {number} failed - Number of failed tasks
 * @property {number} throughput - Tasks per second
 */

/**
 * @typedef {Object} BatchLoader
 * @property {Function} load - Load function that takes array of keys
 * @property {number} [maxBatchSize] - Maximum batch size
 * @property {number} [batchScheduleFn] - Batch scheduling function
 */

/**
 * @typedef {Object} PreparedStatement
 * @property {string} query - SQL query
 * @property {*[]} params - Query parameters
 * @property {Function} execute - Execute function
 * @property {Date} createdAt - Statement creation time
 * @property {number} useCount - Number of times used
 */

/**
 * @typedef {Object} QueryAnalysis
 * @property {string} query - Original query
 * @property {string} type - Query type (SELECT, INSERT, UPDATE, DELETE)
 * @property {string[]} tables - Tables involved
 * @property {string[]} columns - Columns accessed
 * @property {boolean} hasJoins - Whether query has JOINs
 * @property {boolean} hasSubqueries - Whether query has subqueries
 * @property {number} estimatedCost - Estimated query cost
 * @property {string[]} recommendations - Optimization recommendations
 */

/**
 * @typedef {Object} OptimizationConfig
 * @property {Object} monitoring - Performance monitoring config
 * @property {Object} database - Database optimization config
 * @property {Object} cache - Caching configuration
 * @property {Object} response - Response optimization config
 */

/**
 * @typedef {Object} SystemHealth
 * @property {string} status - Overall system status
 * @property {Date} timestamp - Health check timestamp
 * @property {Object} components - Component health status
 */

// Export for JSDoc type checking
module.exports = {
  // This file is used for type definitions only
  // No runtime exports needed
};