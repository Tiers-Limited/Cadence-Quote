// config/database.js
const { Sequelize } = require('sequelize');
const os = require('os');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false, // Set to console.log to debug slow queries
        timezone: '+00:00',

        pool: {
            max: 50,
            min: 10,
            acquire: 90000,
            idle: 300000, // Keep connections alive for 5 minutes
            evict: 30000, // Check for idle connections every 30 seconds
            handleDisconnects: true
        },

        dialectOptions: {
            connectTimeout: 20000, // Increase connection timeout for high-latency networks
            ssl: {
                rejectUnauthorized: false
            },
            useUTC: true,
        },

        // Enhanced retry configuration
        retry: {
            max: 5,
            backoff: 'exponential'
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
        const pool = sequelize.connectionManager.pool;
        console.log('✓ Database connected successfully');
        console.log(`✓ Connected to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
        console.log(`✓ Connection pool active (min: 10, max: 20)`);

        // Log pool events for monitoring
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