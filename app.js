// Load environment variables FIRST
require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sequelize = require('./config/database');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const dotenv = require('dotenv');
dotenv.config();

// Import optimization system
const { optimizationSystem } = require('./optimization');

// Import routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const paymentsRouter = require('./routes/payments');
const brandsRouter = require('./routes/brands');
const adminRouter = require('./routes/admin');
const subscriptionsRouter = require('./routes/subscriptions');
const webhooksRouter = require('./routes/webhooks');
const mobileRouter = require('./routes/mobile'); // Mobile API parent router (auth + quote)
const contractorRouter = require('./routes/contractorRouter'); // NEW FEATURE: Contractor product configs
const quotesRouter = require('./routes/quotes'); // NEW FEATURE: Quote Builder optimized APIs
const quoteBuilderRouter = require('./routes/quoteBuilder'); // NEW FEATURE: Enhanced Quote Builder
const proposalDefaultsRouter = require('./routes/proposalDefaults'); // NEW FEATURE: Proposal Defaults
const gbbDefaultsRouter = require('./routes/gbbDefaults'); // NEW FEATURE: GBB Product Defaults
const serviceTypesRouter = require('./routes/serviceTypes'); // NEW FEATURE: Service Types
const surfaceTypesRouter = require('./routes/surfaceTypes'); // NEW FEATURE: Surface Types
const globalProductsRouter = require('./routes/globalProducts'); // Global Products API
const laborCategoriesRouter = require('./routes/laborCategories'); // Labor Categories & Rates
const customerPortalRouter = require('./routes/customerPortal'); // Customer Portal (LEGACY - JWT auth)
const customerPortalAccessRouter = require('./routes/customerPortalRoutes'); // Customer Portal (NEW - Magic link auth)
const contractorPortalRouter = require('./routes/contractorPortal'); // Contractor Portal Management
const clientAuthRouter = require('./routes/clientAuth'); // Client Authentication
const jobsRouter = require('./routes/jobs'); // Jobs Management
const magicLinkManagementRouter = require('./routes/magicLinkManagement'); // Magic Link Management (Contractor)
const proposalAcceptanceRouter = require('./routes/proposalAcceptance');
const adminStatusRouter = require('./routes/adminStatus'); // Admin Status Management (Phase 1) // Proposal Acceptance (Customer)
const customerSelectionsRouter = require('./routes/customerSelections'); // Customer Selections
const jobSchedulingRouter = require('./routes/jobScheduling'); // Job Scheduling & Management
const jobAnalyticsRouter = require('./routes/jobAnalytics'); // Job Analytics & Profit Margin Tracking
const gbbSettingsRouter = require('./routes/gbbSettings'); // GBB Pricing Tiers Settings
const settingsRouter = require('./routes/settings'); // Contractor Settings & Templates
// Import middleware
const { resolveTenant } = require('./middleware/tenantResolver');
// Load all models and associations
const { User, Tenant, Subscription, Payment } = require('./models');

const app = express();

// Initialize Passport
require('./config/passport')(passport);
app.use(passport.initialize());

// Middleware
// Configure helmet but allow iframe embedding from the frontend dev origin for document previews.
const helmetOptions = {
  // Disable frameguard so we can control frame-ancestors via CSP (modern browsers prefer CSP over X-Frame-Options)
  frameguard: false,
  // Disable the default CSP to avoid conflicting policies; we'll set a permissive frame-ancestors header below for dev.
  contentSecurityPolicy: false
};
app.use(helmet(helmetOptions));  // Security headers with frameguard disabled
app.use(cors());  // Enable CORS for frontend

// Allow iframe embedding from the frontend dev server (adjust via CLIENT_ORIGIN env var in other environments)
app.use((req, res, next) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  // Use CSP frame-ancestors to allow iframe embedding from the client origin and self
  res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${clientOrigin}`);
  next();
});

// Webhook routes MUST come before JSON parser (needs raw body)
app.use('/api/v1/webhooks', webhooksRouter);

// Increase allowed request body size to handle larger imports/uploads.
// Make this configurable via the BODY_PARSER_LIMIT environment variable (e.g. '10mb', '50mb').
const bodyParserLimit = process.env.BODY_PARSER_LIMIT || '10mb';
app.use(express.json({ limit: bodyParserLimit }));
app.use(express.urlencoded({ limit: bodyParserLimit, extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000  // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize optimization system
optimizationSystem.initialize().catch(error => {
  console.error('Failed to initialize optimization system:', error);
});

// Add optimization middleware (after initialization)
app.use((req, res, next) => {
  // Add optimization utilities to request object
  if (optimizationSystem.initialized) {
    const utils = optimizationSystem.getUtils();
    req.optimization = utils;
  }
  next();
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
// Note: express.json/urlencoded already configured above with increased limits.
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Serve temporary PDF files (job documents, proposals, etc.)
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Health check endpoint (before tenant resolution)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Optimization system health endpoint
app.get('/health/optimization', async (req, res) => {
  try {
    const health = await optimizationSystem.getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get optimization system health',
      error: error.message
    });
  }
});

// Optimization metrics endpoint
app.get('/metrics/optimization', async (req, res) => {
  try {
    if (!optimizationSystem.initialized) {
      return res.status(503).json({
        status: 'not_initialized',
        message: 'Optimization system not initialized'
      });
    }

    const utils = optimizationSystem.getUtils();
    const metrics = {
      performance: await utils.performanceMonitor.getMetrics(),
      cache: utils.cache ? await utils.cache.getHealth() : { enabled: false },
      database: utils.queryOptimizer ? await utils.queryOptimizer.getStats() : { enabled: false }
    };

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get optimization metrics',
      error: error.message
    });
  }
});

// Database index report endpoint (development only)
app.get('/metrics/indexes', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        status: 'forbidden',
        message: 'Index metrics not available in production'
      });
    }

    if (!optimizationSystem.initialized) {
      return res.status(503).json({
        status: 'not_initialized',
        message: 'Optimization system not initialized'
      });
    }

    const utils = optimizationSystem.getUtils();
    const indexReport = await utils.performanceMonitor.getIndexReport?.() || { enabled: false };

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      indexReport
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get index report',
      error: error.message
    });
  }
});

// Initialize optimization system and apply middleware
(async () => {
  try {
    await optimizationSystem.initialize();
    console.log('✓ API Optimization System initialized');
    
    // Apply optimization middleware
    const middleware = optimizationSystem.getMiddleware();
    
    // Apply performance monitoring middleware
    if (middleware.performanceMonitoring) {
      app.use(middleware.performanceMonitoring);
    }
    
    // Apply compression middleware
    if (middleware.compression) {
      app.use(middleware.compression);
    }
    
    // Apply cache middleware (if available)
    if (middleware.cache) {
      app.use(middleware.cache);
    }
    
    console.log('✓ Optimization middleware applied');
  } catch (error) {
    console.error('⚠️  Failed to initialize optimization system:', error.message);
    console.log('ℹ  Server will continue without optimizations');
  }
})();

// Apply tenant resolution middleware (skips public routes)
// app.use(resolveTenant);

// Mount routes
app.use('/', indexRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/mbl', mobileRouter); // Mobile API (auth + quote sub-routes)
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/brands', brandsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/subscriptions', subscriptionsRouter);
app.use('/api/v1/contractor', contractorRouter); // Contractor product configs
app.use('/api/v1/quotes', quotesRouter); // Quote Builder APIs
app.use('/api/v1/quote-builder', quoteBuilderRouter); // Enhanced Quote Builder
app.use('/api/v1/proposal-defaults', proposalDefaultsRouter); // Proposal Defaults
app.use('/api/v1/gbb-defaults', gbbDefaultsRouter); // GBB Product Defaults
app.use('/api/v1/service-types', serviceTypesRouter); // Service Types
app.use('/api/v1/surface-types', surfaceTypesRouter); // Surface Types
app.use('/api/v1/global-products', globalProductsRouter); // Global Products API
app.use('/api/v1/labor-categories', laborCategoriesRouter); // Labor Categories & Rates
app.use('/api/v1/customer', customerPortalRouter); // Customer Portal (LEGACY - JWT auth, deprecated)
app.use('/api/customer-portal', customerPortalAccessRouter); // Customer Portal (NEW - Magic link/session auth)
app.use('/api/customer-portal/proposals', proposalAcceptanceRouter); // Proposal Acceptance with Payment
app.use('/api/customer-portal/proposals', customerSelectionsRouter); // Customer Product Selections
app.use('/api/v1/contractor-portal', contractorPortalRouter); // Contractor Portal Management
app.use('/api/v1/client-auth', clientAuthRouter); // Client Authentication
app.use('/api/v1/jobs', jobsRouter); // Jobs Management (CRUD)
app.use('/api/jobs', jobSchedulingRouter); // Job Scheduling & Status Updates
app.use('/api/v1/cadence-pulse', magicLinkManagementRouter); // Magic Link Management (Contractor)
app.use('/api/v1/job-analytics', jobAnalyticsRouter); // Job Analytics & Profit Margin Tracking
app.use('/api/v1/settings/gbb', gbbSettingsRouter); // GBB Pricing Tiers Settings
app.use('/api/v1/settings', settingsRouter); // Contractor Settings & Templates
app.use('/api/v1/admin/status', adminStatusRouter); // Admin Status Management (Phase 1)
app.use('/api/v1', apiRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// Sync DB on start (use migrations in prod)
// Wrapped in async to handle errors gracefully
(async () => {
  try {
    // Sync database with alter to update schema changes
    const syncOptions = process.env.NODE_ENV === 'development' 
      ? { alter: true } // Alter tables to match models
      : { force: false };
    
    console.log('🔄 Syncing database with options:', syncOptions);
    await sequelize.sync(syncOptions);
    console.log('✓ Database sync completed successfully');
    
    // Check for existing users (this runs at startup, not after registration)
    const userCount = await User.count();
    console.log(`✓ Database connected. Current user count: ${userCount}`);
    
    if (userCount > 0) {
      const users = await User.findAll({
        attributes: ['id', 'fullName', 'email', 'authProvider', 'isActive'],
        limit: 5
      });
      console.log('✓ Sample users:', JSON.stringify(users, null, 2));
    } else {
      console.log('ℹ No users in database yet. Users will be created during registration.');
    }

    // Start Lead Reminder Job (check for uncontacted leads every 5 minutes)
    if (process.env.ENABLE_LEAD_REMINDERS !== 'false') {
      const leadReminderJob = require('./jobs/leadReminderJob');
      leadReminderJob.start();
      console.log('✓ Lead Reminder Job started');
    } else {
      console.log('ℹ Lead Reminder Job disabled (ENABLE_LEAD_REMINDERS=false)');
    }

      // Start Portal Lock Job (locks expired customer portals)
      if (process.env.ENABLE_PORTAL_LOCK_JOB !== 'false') {
        const portalLockJob = require('./jobs/portalLockJob');
        portalLockJob.start();
        console.log('✓ Portal Lock Job started');
      } else {
        console.log('ℹ Portal Lock Job disabled (ENABLE_PORTAL_LOCK_JOB=false)');
      }
      
    // Setup graceful shutdown for optimization system
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);
      
      try {
        if (optimizationSystem.initialized) {
          await optimizationSystem.shutdown();
        }
        
        await sequelize.close();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('✗ Database sync failed:', error.message);
   
  }
})();

module.exports = app;
