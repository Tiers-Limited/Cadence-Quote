// optimization/response/ResponseOptimizer.js
// Response payload optimization and compression

const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);

/**
 * Response optimization engine
 * Optimizes API response payloads and serialization
 */
class ResponseOptimizer {
  constructor(config = {}) {
    this.config = {
      compression: {
        enabled: true,
        threshold: 1024, // 1KB
        level: 6,
        algorithms: ['gzip', 'deflate']
      },
      fieldSelection: true,
      maxResponseSize: 10 * 1024 * 1024, // 10MB
      streaming: {
        enabled: true,
        chunkSize: 1000
      },
      ...config
    };
    
    this.compressionStats = {
      requests: 0,
      compressed: 0,
      bytesOriginal: 0,
      bytesCompressed: 0,
      avgCompressionRatio: 0
    };
  }
  
  /**
   * Select specific fields from response data
   */
  selectFields(data, fields) {
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.selectFieldsFromObject(item, fields));
    } else if (typeof data === 'object' && data !== null) {
      return this.selectFieldsFromObject(data, fields);
    }
    
    return data;
  }
  
  /**
   * Select fields from a single object
   */
  selectFieldsFromObject(obj, fields) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = {};
    
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields (e.g., 'user.name')
        this.setNestedField(result, field, this.getNestedField(obj, field));
      } else {
        // Handle simple fields
        if (obj.hasOwnProperty(field)) {
          result[field] = obj[field];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get nested field value
   */
  getNestedField(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  /**
   * Set nested field value
   */
  setNestedField(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    if (value !== undefined) {
      target[lastKey] = value;
    }
  }
  
  /**
   * Optimize nested objects by limiting depth and removing circular references
   */
  optimizeNestedObjects(data, maxDepth = 5, currentDepth = 0, seen = new WeakSet()) {
    if (currentDepth >= maxDepth) {
      return '[Max depth reached]';
    }
    
    if (data === null || typeof data !== 'object') {
      return data;
    }
    
    // Handle circular references
    if (seen.has(data)) {
      return '[Circular reference]';
    }
    
    seen.add(data);
    
    if (Array.isArray(data)) {
      return data.map(item => 
        this.optimizeNestedObjects(item, maxDepth, currentDepth + 1, seen)
      );
    }
    
    const optimized = {};
    for (const [key, value] of Object.entries(data)) {
      optimized[key] = this.optimizeNestedObjects(value, maxDepth, currentDepth + 1, seen);
    }
    
    seen.delete(data);
    return optimized;
  }
  
  /**
   * Check if response size exceeds threshold
   */
  checkResponseSize(data) {
    const size = this.estimateResponseSize(data);
    
    if (size > this.config.maxResponseSize) {
      console.warn(`⚠️  Large response detected: ${(size / 1024 / 1024).toFixed(2)}MB`);
      return {
        oversized: true,
        size,
        maxSize: this.config.maxResponseSize,
        recommendation: 'Consider implementing pagination or field selection'
      };
    }
    
    return { oversized: false, size };
  }
  
  /**
   * Estimate response size in bytes
   */
  estimateResponseSize(data) {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch (error) {
      console.error('Error estimating response size:', error);
      return 0;
    }
  }
  
  /**
   * Compress response data
   */
  async compressResponse(data, acceptEncoding = '') {
    if (!this.config.compression.enabled) {
      return { compressed: false, data };
    }
    
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
    const originalSize = Buffer.byteLength(jsonData, 'utf8');
    
    // Skip compression for small responses
    if (originalSize < this.config.compression.threshold) {
      return { compressed: false, data: jsonData, originalSize };
    }
    
    this.compressionStats.requests++;
    
    try {
      let compressedData;
      let algorithm;
      
      // Choose compression algorithm based on Accept-Encoding header
      if (acceptEncoding.includes('gzip') && this.config.compression.algorithms.includes('gzip')) {
        compressedData = await gzip(jsonData, { level: this.config.compression.level });
        algorithm = 'gzip';
      } else if (acceptEncoding.includes('deflate') && this.config.compression.algorithms.includes('deflate')) {
        compressedData = await deflate(jsonData, { level: this.config.compression.level });
        algorithm = 'deflate';
      } else {
        return { compressed: false, data: jsonData, originalSize };
      }
      
      const compressedSize = compressedData.length;
      const compressionRatio = (originalSize - compressedSize) / originalSize;
      
      // Update statistics
      this.compressionStats.compressed++;
      this.compressionStats.bytesOriginal += originalSize;
      this.compressionStats.bytesCompressed += compressedSize;
      this.compressionStats.avgCompressionRatio = 
        (this.compressionStats.bytesOriginal - this.compressionStats.bytesCompressed) / 
        this.compressionStats.bytesOriginal;
      
      return {
        compressed: true,
        data: compressedData,
        algorithm,
        originalSize,
        compressedSize,
        compressionRatio,
        savings: originalSize - compressedSize
      };
      
    } catch (error) {
      console.error('Compression error:', error);
      return { compressed: false, data: jsonData, originalSize, error: error.message };
    }
  }
  
  /**
   * Stream large response in chunks
   */
  async* streamLargeResponse(data, chunkSize = null) {
    if (!this.config.streaming.enabled || !Array.isArray(data)) {
      yield data;
      return;
    }
    
    const size = chunkSize || this.config.streaming.chunkSize;
    
    for (let i = 0; i < data.length; i += size) {
      const chunk = data.slice(i, i + size);
      yield {
        data: chunk,
        meta: {
          chunk: Math.floor(i / size) + 1,
          totalChunks: Math.ceil(data.length / size),
          hasMore: i + size < data.length
        }
      };
    }
  }
  
  /**
   * Optimize JSON serialization with advanced features
   * ENHANCEMENT: Added streaming serialization and memory-efficient processing
   */
  optimizeJsonSerialization(data, options = {}) {
    const {
      maxDepth = 10,
      dateFormat = 'iso',
      removeNulls = false,
      removeUndefined = true,
      customTransformers = {},
      enableStreaming = false,
      memoryLimit = 50 * 1024 * 1024 // 50MB
    } = options;
    
    // Check if data is too large for memory-efficient processing
    const estimatedSize = this.estimateResponseSize(data);
    if (estimatedSize > memoryLimit && enableStreaming) {
      return this.streamJsonSerialization(data, options);
    }
    
    let currentDepth = 0;
    const seen = new WeakSet();
    
    return JSON.stringify(data, (key, value) => {
      // Track depth to prevent stack overflow
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        
        if (currentDepth >= maxDepth) {
          return '[Max depth exceeded]';
        }
        
        seen.add(value);
        currentDepth++;
      }
      
      // Remove undefined values
      if (removeUndefined && value === undefined) {
        return undefined;
      }
      
      // Remove null values if requested
      if (removeNulls && value === null) {
        return undefined;
      }
      
      // Handle dates efficiently
      if (value instanceof Date) {
        switch (dateFormat) {
          case 'iso':
            return value.toISOString();
          case 'timestamp':
            return value.getTime();
          case 'unix':
            return Math.floor(value.getTime() / 1000);
          default:
            return value.toISOString();
        }
      }
      
      // Handle BigInt
      if (typeof value === 'bigint') {
        return value.toString();
      }
      
      // Apply custom transformers
      if (customTransformers[key]) {
        try {
          return customTransformers[key](value);
        } catch (error) {
          console.warn(`Custom transformer error for key "${key}":`, error.message);
          return value;
        }
      }
      
      // Clean up tracking for objects
      if (typeof value === 'object' && value !== null && seen.has(value)) {
        seen.delete(value);
        currentDepth--;
      }
      
      return value;
    });
  }
  
  /**
   * Stream JSON serialization for very large objects
   * OPTIMIZATION: Memory-efficient serialization for large datasets
   */
  async* streamJsonSerialization(data, options = {}) {
    const { chunkSize = 1000 } = options;
    
    if (Array.isArray(data)) {
      yield '{"data":[';
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const serializedChunk = chunk.map(item => 
          this.optimizeJsonSerialization(item, { ...options, enableStreaming: false })
        ).join(',');
        
        if (i > 0) yield ',';
        yield serializedChunk;
      }
      
      yield '],"meta":{"total":' + data.length + ',"streamed":true}}';
    } else {
      // For non-array objects, fall back to regular serialization
      yield this.optimizeJsonSerialization(data, { ...options, enableStreaming: false });
    }
  }
  
  /**
   * Fast JSON serialization for simple objects
   * OPTIMIZATION: Bypasses JSON.stringify for better performance on simple objects
   */
  fastJsonSerialize(obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return '"' + obj.replace(/"/g, '\\"') + '"';
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (obj instanceof Date) return '"' + obj.toISOString() + '"';
    
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.fastJsonSerialize(item)).join(',') + ']';
    }
    
    if (typeof obj === 'object') {
      const pairs = [];
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          pairs.push('"' + key + '":' + this.fastJsonSerialize(value));
        }
      }
      return '{' + pairs.join(',') + '}';
    }
    
    return JSON.stringify(obj);
  }
  
  /**
   * Optimize response for specific content types
   * OPTIMIZATION: Content-type specific optimizations
   */
  optimizeByContentType(data, contentType = 'application/json') {
    switch (contentType) {
      case 'application/json':
        return this.optimizeJsonResponse(data);
      case 'text/csv':
        return this.optimizeCsvResponse(data);
      case 'application/xml':
        return this.optimizeXmlResponse(data);
      default:
        return data;
    }
  }
  
  /**
   * Optimize JSON response specifically
   */
  optimizeJsonResponse(data) {
    // Remove empty objects and arrays
    const cleaned = this.removeEmptyValues(data);
    
    // Optimize nested objects
    const optimized = this.optimizeNestedObjects(cleaned, 8);
    
    // Use fast serialization for simple objects
    if (this.isSimpleObject(optimized)) {
      return this.fastJsonSerialize(optimized);
    }
    
    return this.optimizeJsonSerialization(optimized);
  }
  
  /**
   * Remove empty values from response
   */
  removeEmptyValues(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeEmptyValues(item)).filter(item => 
        item !== null && item !== undefined && 
        !(Array.isArray(item) && item.length === 0) &&
        !(typeof item === 'object' && Object.keys(item).length === 0)
      );
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = this.removeEmptyValues(value);
        if (cleanedValue !== null && cleanedValue !== undefined &&
            !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
            !(typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0)) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    }
    
    return obj;
  }
  
  /**
   * Check if object is simple (no nested objects/arrays)
   */
  isSimpleObject(obj) {
    if (typeof obj !== 'object' || obj === null) return true;
    
    if (Array.isArray(obj)) {
      return obj.every(item => typeof item !== 'object' || item === null);
    }
    
    return Object.values(obj).every(value => 
      typeof value !== 'object' || value === null || value instanceof Date
    );
  }
  
  /**
   * Get compression middleware for Express
   */
  getCompressionMiddleware() {
    return async (req, res, next) => {
      // Store original json method
      const originalJson = res.json;
      
      res.json = async function(data) {
        try {
          // Check response size
          const sizeCheck = this.parent.checkResponseSize(data);
          
          if (sizeCheck.oversized) {
            res.setHeader('X-Response-Size-Warning', 'true');
            res.setHeader('X-Response-Size', sizeCheck.size);
            console.warn(`⚠️  Oversized response on ${req.method} ${req.path}: ${(sizeCheck.size / 1024 / 1024).toFixed(2)}MB`);
          }
          
          // Apply field selection if requested
          let responseData = data;
          const fields = req.query.fields;
          if (fields && this.parent.config.fieldSelection) {
            const fieldArray = fields.split(',').map(f => f.trim());
            responseData = this.parent.selectFields(data, fieldArray);
          }
          
          // Optimize nested objects
          responseData = this.parent.optimizeNestedObjects(responseData);
          
          // Compress response
          const acceptEncoding = req.headers['accept-encoding'] || '';
          const compressionResult = await this.parent.compressResponse(responseData, acceptEncoding);
          
          if (compressionResult.compressed) {
            res.setHeader('Content-Encoding', compressionResult.algorithm);
            res.setHeader('X-Original-Size', compressionResult.originalSize);
            res.setHeader('X-Compressed-Size', compressionResult.compressedSize);
            res.setHeader('X-Compression-Ratio', (compressionResult.compressionRatio * 100).toFixed(1) + '%');
            
            res.setHeader('Content-Type', 'application/json');
            res.end(compressionResult.data);
          } else {
            // Use original json method for uncompressed responses
            originalJson.call(this, responseData);
          }
          
        } catch (error) {
          console.error('Response optimization error:', error);
          // Fallback to original method
          originalJson.call(this, data);
        }
      }.bind({ parent: this });
      
      next();
    };
  }
  
  /**
   * Create response optimization utilities
   */
  createUtils() {
    return {
      selectFields: (data, fields) => this.selectFields(data, fields),
      optimizeNested: (data, maxDepth) => this.optimizeNestedObjects(data, maxDepth),
      checkSize: (data) => this.checkResponseSize(data),
      compress: (data, encoding) => this.compressResponse(data, encoding),
      stream: (data, chunkSize) => this.streamLargeResponse(data, chunkSize)
    };
  }
  
  /**
   * Get compression statistics
   */
  getCompressionStats() {
    return {
      ...this.compressionStats,
      compressionRate: this.compressionStats.requests > 0 
        ? (this.compressionStats.compressed / this.compressionStats.requests) * 100 
        : 0,
      avgSavings: this.compressionStats.compressed > 0
        ? (this.compressionStats.bytesOriginal - this.compressionStats.bytesCompressed) / this.compressionStats.compressed
        : 0
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.compressionStats = {
      requests: 0,
      compressed: 0,
      bytesOriginal: 0,
      bytesCompressed: 0,
      avgCompressionRatio: 0
    };
  }
}

module.exports = ResponseOptimizer;