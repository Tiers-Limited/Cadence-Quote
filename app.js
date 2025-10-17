// Load environment variables FIRST
require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const sequelize = require('./config/database');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const dotenv = require('dotenv');
dotenv.config();

// Import routes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var paymentsRouter = require('./routes/payments');

// Import middleware
const { resolveTenant } = require('./middleware/tenantResolver');
const User = require('./models/User');

var app = express();

// Initialize Passport
require('./config/passport')(passport);
app.use(passport.initialize());

// Middleware
app.use(helmet());  // Security headers
app.use(cors());  // Enable CORS for frontend
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100  // Limit each IP to 100 requests per windowMs
});
app.use(limiter);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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
app.use('/users', usersRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/payments', paymentsRouter);

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
    await sequelize.sync({ force: process.env.NODE_ENV === 'development' });
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
  } catch (error) {
    console.error('✗ Database sync failed:', error.message);
    console.error('Server is running, but database operations will fail until connection is established.');
  }
})();

module.exports = app;
