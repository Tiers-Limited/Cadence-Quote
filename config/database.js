// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config(); 

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging:  true,
    timezone: '+00:00', // Force UTC timezone
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 10000, // 10 seconds timeout
      // --- ADDED SSL CONFIGURATION BELOW ---
      ssl: {
        // AWS RDS requires SSL/encryption. 
        // We set rejectUnauthorized to false because the node-postgres 
        // driver doesn't automatically trust the RDS root certificate
        // unless you download it and provide the path.
        // For development/testing, setting this to false works.
        // For production, it's best to configure the proper certificate path.
        rejectUnauthorized: false
      },
      // --- END OF ADDED SSL CONFIGURATION ---
      useUTC: true, // Force UTC
    },
    retry: {
      max: 3 // Retry connection 3 times
    }
  }
);

// Test connection with better error handling
sequelize.authenticate()
  .then(() => {
    console.log('✓ Database connected successfully');
    console.log(`✓ Connected to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
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