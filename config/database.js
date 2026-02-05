// config/database.js
const { Sequelize } = require('sequelize');
const os = require('os');
require('dotenv').config(); 

// Calculate optimal pool size based on system resources
function calculateOptimalPoolSize() {
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
  
  return {
    min: 2,
    max: maxConnections,
    idle: 30000,    // 30 seconds
    acquire: 60000, // 60 seconds
    evict: 1000     // 1 second
  };
}

const optimizedPool = calculateOptimalPoolSize();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    timezone: '+00:00', // Force UTC timezone
    
    // Optimized connection pool configuration
    pool: {
      max: optimizedPool.max,
      min: optimizedPool.min,
      acquire: optimizedPool.acquire,
      idle: optimizedPool.idle,
      evict: optimizedPool.evict,
      handleDisconnects: true,
      
      // Enhanced connection validation
      validate: (connection) => {
        return connection && !connection.connection._ending;
      }
    },
    
    dialectOptions: {
      connectTimeout: 10000, // 10 seconds timeout
      statement_timeout: 0, // Unlimited - no timeout for sync operations
    
      
      // SSL configuration for AWS RDS
      ssl: {
        rejectUnauthorized: false
      },
      useUTC: true, // Force UTC
    },
    
    // Enhanced retry configuration
    retry: {
      max: 3,
      backoff: 'exponential',
      report: (message, obj) => {
        // console.warn('Database retry:', message, obj);
      }
    },
    
    // Query optimization
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  }
);

// Test connection with better error handling and pool monitoring
sequelize.authenticate()
  .then(() => {
    console.log('✓ Database connected successfully');
    console.log(`✓ Connected to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    console.log(`✓ Optimized pool: min=${optimizedPool.min}, max=${optimizedPool.max}`);
    
    // Log pool events for monitoring (if available)
    const pool = sequelize.connectionManager.pool;
    if (pool && typeof pool.on === 'function') {
      pool.on('createSuccess', () => {
        console.log('🔗 Database connection created');
      });
      
      pool.on('destroySuccess', () => {
        console.log('🔗 Database connection destroyed');
      });
      
      pool.on('createError', (err) => {
        console.error('❌ Database connection creation failed:', err.message);
      });
    } else {
      console.log('📊 Pool event monitoring not available for this Sequelize version');
    }
  })
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
    console.error('\nPossible solutions:');
    console.error('1. Check AWS RDS Security Group allows your IP address');
    console.error('2. Verify database credentials in .env file');
    console.error('3. Ensure RDS is publicly accessible (if needed)');
    console.error('4. Check VPC and network settings');
    console.error('5. For local development, consider using a local PostgreSQL instance');
    console.error('6. **Ensure client is connecting with SSL/TLS (added to config/database.js)**');
    console.error('\nServer will continue running, but database operations will fail.');
  });

module.exports = sequelize;