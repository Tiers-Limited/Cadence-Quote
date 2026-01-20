// optimization/database/IndexManager.js
// Database index management and optimization

const { QueryTypes } = require('sequelize');

/**
 * Database index management system
 * Automatically creates and manages database indexes for optimal query performance
 */
class IndexManager {
  constructor(sequelize, config = {}) {
    this.sequelize = sequelize;
    this.config = {
      enabled: true,
      autoCreate: process.env.NODE_ENV !== 'production', // Only auto-create in dev
      analyzeThreshold: 1000, // Minimum query count to analyze
      performanceThreshold: 100, // Milliseconds - queries slower than this are candidates
      maxIndexesPerTable: 10,
      ...config
    };
    
    this.queryStats = new Map(); // Track query performance
    this.existingIndexes = new Map(); // Cache existing indexes
    this.recommendations = [];
    this.initialized = false;
  }
  
  /**
   * Initialize the index manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔍 Initializing Database Index Manager...');
      
      // Load existing indexes
      await this.loadExistingIndexes();
      
      // Analyze current query patterns (if enabled)
      if (this.config.enabled) {
        await this.analyzeQueryPatterns();
      }
      
      this.initialized = true;
      console.log('✅ Database Index Manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Index Manager:', error);
      throw error;
    }
  }
  
  /**
   * Load existing database indexes
   */
  async loadExistingIndexes() {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;
      
      const indexes = await this.sequelize.query(query, {
        type: QueryTypes.SELECT
      });
      
      // Group indexes by table
      for (const index of indexes) {
        const tableName = index.tablename;
        if (!this.existingIndexes.has(tableName)) {
          this.existingIndexes.set(tableName, []);
        }
        this.existingIndexes.get(tableName).push({
          name: index.indexname,
          definition: index.indexdef,
          columns: this.extractColumnsFromIndexDef(index.indexdef)
        });
      }
      
      console.log(`📊 Loaded ${indexes.length} existing indexes across ${this.existingIndexes.size} tables`);
      
    } catch (error) {
      console.error('Error loading existing indexes:', error);
    }
  }
  
  /**
   * Extract column names from index definition
   */
  extractColumnsFromIndexDef(indexDef) {
    const match = indexDef.match(/\((.*?)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim().replace(/"/g, ''));
    }
    return [];
  }
  
  /**
   * Analyze current query patterns to identify optimization opportunities
   */
  async analyzeQueryPatterns() {
    try {
      // Get slow queries from pg_stat_statements if available
      const slowQueries = await this.getSlowQueries();
      
      // Analyze table access patterns
      const tableStats = await this.getTableAccessStats();
      
      // Generate index recommendations
      this.generateIndexRecommendations(slowQueries, tableStats);
      
    } catch (error) {
      console.error('Error analyzing query patterns:', error);
    }
  }
  
  /**
   * Get slow queries from PostgreSQL statistics
   */
  async getSlowQueries() {
    try {
      // Check if pg_stat_statements extension is available
      const extensionCheck = await this.sequelize.query(
        "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'",
        { type: QueryTypes.SELECT }
      );
      
      if (extensionCheck.length === 0) {
        console.log('ℹ️  pg_stat_statements extension not available, skipping slow query analysis');
        return [];
      }
      
      const query = `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > $1
        ORDER BY mean_time DESC 
        LIMIT 50;
      `;
      
      return await this.sequelize.query(query, {
        bind: [this.config.performanceThreshold],
        type: QueryTypes.SELECT
      });
      
    } catch (error) {
      console.log('ℹ️  Could not access pg_stat_statements, using alternative analysis');
      return [];
    }
  }
  
  /**
   * Get table access statistics
   */
  async getTableAccessStats() {
    try {
      const query = `
        SELECT 
          schemaname,
          relname as tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY seq_scan DESC;
      `;
      
      return await this.sequelize.query(query, {
        type: QueryTypes.SELECT
      });
      
    } catch (error) {
      console.error('Error getting table access stats:', error);
      return [];
    }
  }
  
  /**
   * Generate index recommendations based on analysis
   */
  generateIndexRecommendations(slowQueries, tableStats) {
    this.recommendations = [];
    
    // Analyze table stats for sequential scan opportunities
    for (const stat of tableStats) {
      const tableName = stat.tablename;
      const seqScanRatio = stat.seq_scan / (stat.seq_scan + (stat.idx_scan || 1));
      
      // High sequential scan ratio indicates missing indexes
      if (seqScanRatio > 0.8 && stat.seq_scan > 100) {
        this.recommendations.push({
          type: 'missing_index',
          table: tableName,
          priority: 'high',
          reason: `High sequential scan ratio (${(seqScanRatio * 100).toFixed(1)}%)`,
          suggestion: `Consider adding indexes on frequently filtered columns for ${tableName}`,
          stats: {
            seqScans: stat.seq_scan,
            indexScans: stat.idx_scan || 0
          }
        });
      }
    }
    
    // Add common index recommendations based on application patterns
    this.addCommonIndexRecommendations();
    
    console.log(`💡 Generated ${this.recommendations.length} index recommendations`);
  }
  
  /**
   * Add common index recommendations based on typical application patterns
   */
  addCommonIndexRecommendations() {
    const commonIndexes = [
      // Multi-tenant application patterns
      {
        table: 'Quotes',
        columns: ['tenantId', 'status'],
        type: 'composite',
        reason: 'Multi-tenant filtering with status'
      },
      {
        table: 'Quotes',
        columns: ['tenantId', 'createdAt'],
        type: 'composite',
        reason: 'Multi-tenant with date ordering'
      },
      {
        table: 'Jobs',
        columns: ['tenantId', 'userId', 'status'],
        type: 'composite',
        reason: 'Multi-tenant user filtering with status'
      },
      {
        table: 'Jobs',
        columns: ['scheduledStartDate'],
        type: 'single',
        reason: 'Calendar and scheduling queries'
      },
      {
        table: 'ProductConfigs',
        columns: ['tenantId', 'isActive'],
        type: 'composite',
        reason: 'Active product filtering per tenant'
      },
      {
        table: 'GlobalColors',
        columns: ['brandId', 'isActive'],
        type: 'composite',
        reason: 'Brand-specific color filtering'
      },
      {
        table: 'CustomerSessions',
        columns: ['sessionToken'],
        type: 'single',
        reason: 'Session token lookups'
      },
      {
        table: 'MagicLinks',
        columns: ['token', 'expiresAt'],
        type: 'composite',
        reason: 'Magic link validation'
      }
    ];
    
    for (const indexRec of commonIndexes) {
      // Check if index already exists
      if (!this.indexExists(indexRec.table, indexRec.columns)) {
        this.recommendations.push({
          type: 'recommended_index',
          table: indexRec.table,
          columns: indexRec.columns,
          indexType: indexRec.type,
          priority: 'medium',
          reason: indexRec.reason,
          suggestion: `CREATE INDEX idx_${indexRec.table.toLowerCase()}_${indexRec.columns.join('_').toLowerCase()} ON "${indexRec.table}" (${indexRec.columns.map(c => `"${c}"`).join(', ')});`
        });
      }
    }
  }
  
  /**
   * Check if an index already exists for the given columns
   */
  indexExists(tableName, columns) {
    const tableIndexes = this.existingIndexes.get(tableName) || [];
    
    return tableIndexes.some(index => {
      const indexColumns = index.columns.map(c => c.toLowerCase());
      const targetColumns = columns.map(c => c.toLowerCase());
      
      // Check if all target columns are covered by this index
      return targetColumns.every(col => indexColumns.includes(col));
    });
  }
  
  /**
   * Create recommended indexes (development only)
   */
  async createRecommendedIndexes() {
    if (!this.config.autoCreate || process.env.NODE_ENV === 'production') {
      console.log('ℹ️  Index auto-creation disabled in production');
      return;
    }
    
    const highPriorityRecs = this.recommendations.filter(r => r.priority === 'high');
    
    if (highPriorityRecs.length === 0) {
      console.log('✅ No high-priority index recommendations to create');
      return;
    }
    
    console.log(`🔧 Creating ${highPriorityRecs.length} high-priority indexes...`);
    
    for (const rec of highPriorityRecs) {
      if (rec.suggestion && rec.suggestion.startsWith('CREATE INDEX')) {
        try {
          await this.sequelize.query(rec.suggestion);
          console.log(`✅ Created index: ${rec.suggestion}`);
        } catch (error) {
          console.error(`❌ Failed to create index for ${rec.table}:`, error.message);
        }
      }
    }
  }
  
  /**
   * Get index recommendations
   */
  getRecommendations() {
    return {
      total: this.recommendations.length,
      byPriority: {
        high: this.recommendations.filter(r => r.priority === 'high').length,
        medium: this.recommendations.filter(r => r.priority === 'medium').length,
        low: this.recommendations.filter(r => r.priority === 'low').length
      },
      recommendations: this.recommendations
    };
  }
  
  /**
   * Get existing indexes summary
   */
  getExistingIndexes() {
    const summary = {};
    
    for (const [tableName, indexes] of this.existingIndexes) {
      summary[tableName] = {
        count: indexes.length,
        indexes: indexes.map(idx => ({
          name: idx.name,
          columns: idx.columns
        }))
      };
    }
    
    return summary;
  }
  
  /**
   * Analyze index usage and identify unused indexes
   */
  async analyzeIndexUsage() {
    try {
      const query = `
        SELECT 
          schemaname,
          relname as tablename,
          indexrelname as indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan ASC;
      `;
      
      const indexStats = await this.sequelize.query(query, {
        type: QueryTypes.SELECT
      });
      
      // Identify potentially unused indexes
      const unusedIndexes = indexStats.filter(stat => 
        stat.idx_scan === 0 && !stat.indexname.includes('pkey')
      );
      
      return {
        totalIndexes: indexStats.length,
        unusedIndexes: unusedIndexes.length,
        unusedDetails: unusedIndexes
      };
      
    } catch (error) {
      console.error('Error analyzing index usage:', error);
      return null;
    }
  }
  
  /**
   * Get comprehensive index health report
   */
  async getIndexHealthReport() {
    const report = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      summary: {
        totalTables: this.existingIndexes.size,
        totalIndexes: Array.from(this.existingIndexes.values()).reduce((sum, indexes) => sum + indexes.length, 0),
        recommendations: this.recommendations.length
      },
      existingIndexes: this.getExistingIndexes(),
      recommendations: this.getRecommendations(),
      usage: await this.analyzeIndexUsage()
    };
    
    // Determine overall health status
    const highPriorityRecs = this.recommendations.filter(r => r.priority === 'high').length;
    if (highPriorityRecs > 5) {
      report.status = 'needs_attention';
    } else if (highPriorityRecs > 0) {
      report.status = 'fair';
    }
    
    return report;
  }
  
  /**
   * Track query performance for analysis
   */
  trackQuery(query, executionTime, resultCount = 0) {
    if (!this.config.enabled) return;
    
    const queryKey = this.normalizeQuery(query);
    
    if (!this.queryStats.has(queryKey)) {
      this.queryStats.set(queryKey, {
        query: queryKey,
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        totalRows: 0
      });
    }
    
    const stats = this.queryStats.get(queryKey);
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.totalRows += resultCount;
  }
  
  /**
   * Normalize query for tracking (remove specific values)
   */
  normalizeQuery(query) {
    return query
      .replace(/\$\d+/g, '?') // Replace parameter placeholders
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/'[^']*'/g, "'?'") // Replace string literals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const stats = Array.from(this.queryStats.values())
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 20); // Top 20 slowest queries
    
    return {
      totalQueries: this.queryStats.size,
      slowestQueries: stats,
      summary: {
        avgExecutionTime: stats.length > 0 
          ? stats.reduce((sum, s) => sum + s.avgTime, 0) / stats.length 
          : 0,
        totalExecutions: stats.reduce((sum, s) => sum + s.count, 0)
      }
    };
  }
}

module.exports = IndexManager;