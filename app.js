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

// Import routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const paymentsRouter = require('./routes/payments');
const brandsRouter = require('./routes/brands');
const productsRouter = require('./routes/products');
const adminRouter = require('./routes/admin');
const subscriptionsRouter = require('./routes/subscriptions');
const webhooksRouter = require('./routes/webhooks');
// Import middleware
const { resolveTenant } = require('./middleware/tenantResolver');
// Load all models and associations
const { User, Tenant, Subscription, Payment } = require('./models');

const app = express();

// Initialize Passport
require('./config/passport')(passport);
app.use(passport.initialize());

// Middleware
app.use(helmet());  // Security headers
app.use(cors());  // Enable CORS for frontend

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


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
// Note: express.json/urlencoded already configured above with increased limits.
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (before tenant resolution)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply tenant resolution middleware (skips public routes)
// app.use(resolveTenant);

// Mount routes
app.use('/', indexRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/brands', brandsRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/subscriptions', subscriptionsRouter);
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
    // In development, alter existing tables instead of dropping them
    
    const syncOptions = process.env.NODE_ENV === 'development' 
      ? { alter: true } // Don't alter - schema is now stable
      : { force: false }; // In production, don't sync at all
    
    await sequelize.sync(syncOptions);
    console.log('✓ Database models synchronized');
    
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
  } catch (error) {
    console.error('✗ Database sync failed:', error.message);
    console.error('💡 Try running the migration manually:');
    console.error('   psql -U postgres -d postgres -f migrations/003-create-milestone2-tables.sql');
    console.error('Server is running, but database operations will fail until connection is established.');
  }
})();

module.exports = app;
