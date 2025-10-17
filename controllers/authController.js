// controllers/authController.js
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const { createCheckoutSession, SUBSCRIPTION_PLANS } = require('../services/stripeService');
const sequelize = require('../config/database');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Register new tenant (contractor company) and admin user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      // User fields
      fullName,
      email,
      password,
      // Tenant fields
      companyName,
      phoneNumber,
      businessAddress,
      tradeType,
      subscriptionPlan
    } = req.body;

    // Validation
    if (!fullName || !email || !password || !companyName || !phoneNumber || !tradeType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['fullName', 'email', 'password', 'companyName', 'phoneNumber', 'tradeType']
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate subscription plan
    const validPlans = ['starter', 'pro'];
    if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan. Must be "starter" or "pro"'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate subdomain from company name
    const subdomain = generateSubdomain(companyName);

    // Check if subdomain already exists
    const existingTenant = await Tenant.findOne({ where: { subdomain } });
    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Company name already registered. Please use a different company name.',
        suggestedSubdomain: subdomain
      });
    }

    // Create tenant
    const tenant = await Tenant.create({
      companyName,
      subdomain,
      email,
      phoneNumber,
      businessAddress: businessAddress || null,
      tradeType,
      subscriptionPlan: subscriptionPlan || 'starter',
      isActive: true
    }, { transaction });

    // Create admin user for the tenant
    const user = await User.create({
      fullName,
      email,
      password, // Will be hashed by beforeCreate hook
      role: 'contractor_admin',
      tenantId: tenant.id,
      isActive: true
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Generate JWT token
    const token = generateToken(user.id, tenant.id);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
          subdomain: tenant.subdomain,
          tradeType: tenant.tradeType,
          subscriptionPlan: tenant.subscriptionPlan
        },
        token,
        accessUrl: `https://${subdomain}.cadence.com` // For production
      }
    });

  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    
    console.error('Registration error:', error);
    
    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user with tenant information
    const user = await User.findOne({
      where: { 
        email,
        isActive: true
      },
      include: [{
        model: Tenant,
        where: { isActive: true },
        attributes: ['id', 'companyName', 'subdomain', 'tradeType', 'subscriptionPlan']
      }]
    });
   

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user registered with Google OAuth
    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account was created using Google Sign-In. Please use "Continue with Google" to login.',
        authProvider: 'google',
        requiresGoogleAuth: true
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.tenantId);
    const refreshToken = generateRefreshToken(user.id, user.tenantId);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        tenant: {
          id: user.Tenant.id,
          companyName: user.Tenant.companyName,
          subdomain: user.Tenant.subdomain,
          tradeType: user.Tenant.tradeType,
          subscriptionPlan: user.Tenant.subscriptionPlan
        },
        token,
        refreshToken,
        accessUrl: `https://${user.Tenant.subdomain}.cadence.com`
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getProfile = async (req, res) => {
  try {
    // User is already attached by authenticateToken middleware
    const user = await User.findOne({
      where: { id: req.user.id },
      attributes: { exclude: ['password'] },
      include: [{
        model: Tenant,
        attributes: ['id', 'companyName', 'subdomain', 'tradeType', 'subscriptionPlan', 'phoneNumber', 'businessAddress']
      }]
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt
        },
        tenant: user.Tenant
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

/**
 * Register new tenant and create payment session in one transaction
 * POST /api/auth/register-with-payment
 */
const registerWithPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      // User fields
      fullName,
      email,
      password,
      // Tenant fields
      companyName,
      phoneNumber,
      businessAddress,
      tradeType,
      subscriptionPlan,
      // Google OAuth fields
      googleId,
      authProvider
    } = req.body;

    // Check if this is a Google OAuth registration
    const isGoogleAuth = authProvider === 'google' && googleId;

    // Validation - password is only required for non-Google registrations
    if (!fullName || !email || !companyName || !phoneNumber || !tradeType || !subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['fullName', 'email', 'companyName', 'phoneNumber', 'tradeType', 'subscriptionPlan']
      });
    }

    // Password validation only for non-Google auth
    if (!isGoogleAuth) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required for email registration'
        });
      }
      
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }
    }

    // Validate subscription plan
    const validPlans = ['starter', 'pro'];
    if (!validPlans.includes(subscriptionPlan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan. Must be "starter" or "pro"'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate subdomain from company name
    const subdomain = generateSubdomain(companyName);

    // Check if subdomain already exists
    const existingTenant = await Tenant.findOne({ where: { subdomain } });
    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Company name already registered. Please use a different company name.',
        suggestedSubdomain: subdomain
      });
    }

    // Create tenant (initially inactive until payment is confirmed)
    const tenant = await Tenant.create({
      companyName,
      subdomain,
      email,
      phoneNumber,
      businessAddress: businessAddress || null,
      tradeType,
      subscriptionPlan,
      isActive: false, // Will be activated after payment
      paymentStatus: 'pending'
    }, { transaction });

    // Create admin user for the tenant (initially inactive)
    const userCreateData = {
      fullName,
      email,
      role: 'contractor_admin',
      tenantId: tenant.id,
      isActive: false // Will be activated after payment
    };

    // Add password or Google OAuth fields
    if (isGoogleAuth) {
      userCreateData.googleId = googleId;
      userCreateData.authProvider = 'google';
      // No password needed for Google OAuth users
    } else {
      userCreateData.password = password; // Will be hashed by beforeCreate hook
    }

    const user = await User.create(userCreateData, { transaction });

    console.log('✓ User created successfully:', {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      authProvider: user.authProvider,
      googleId: user.googleId ? '***' : null,
      hasPassword: !!user.password
    });

    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];

    // Create payment record
    const payment = await Payment.create({
      tenantId: tenant.id,
      userId: user.id,
      subscriptionPlan,
      amount: planDetails.price,
      currency: 'usd',
      status: 'pending',
      description: `${planDetails.name} - ${tenant.companyName}`,
      metadata: {
        planFeatures: planDetails.features,
        registrationFlow: true // Mark this as part of registration flow
      }
    }, { transaction });

    // Create Stripe Checkout Session
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await createCheckoutSession({
      userId: user.id,
      tenantId: tenant.id,
      subscriptionPlan,
      email: user.email,
      successUrl: `${BACKEND_URL}/api/v1/payments/confirm?sessionId={CHECKOUT_SESSION_ID}&registration=true`,
      cancelUrl: `${FRONTEND_URL}/register?step=2&plan=${subscriptionPlan}&error=payment_cancelled`
    });

    // Update payment with session ID
    await payment.update({
      stripeSessionId: session.sessionId
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    console.log('Registration with payment initiated:', {
      tenantId: tenant.id,
      userId: user.id,
      paymentId: payment.id,
      stripeSessionId: session.sessionId,
      stripeUrl: session.sessionUrl
    });

    // Return Stripe checkout URL
    res.status(200).json({
      success: true,
      message: 'Registration initiated. Please complete payment.',
      data: {
        stripeUrl: session.sessionUrl,
        sessionId: session.sessionId,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
          subdomain: tenant.subdomain,
          tradeType: tenant.tradeType,
          subscriptionPlan: tenant.subscriptionPlan
        },
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email
        }
      }
    });

  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.error('Registration with payment error:', error);

    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Generate subdomain from company name
 * Example: "ABC Painting LLC" -> "abc-painting"
 */
function generateSubdomain(companyName) {
  return companyName
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .trim()
    .replaceAll(/\s+/g, '-') // Replace spaces with hyphens
    .replaceAll(/-+/g, '-') // Replace multiple hyphens with single
    .replaceAll(/(?:^-|-$)/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Get Google OAuth URL
 * GET /api/auth/google/url
 */
const getGoogleAuthUrl = async (req, res) => {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001';
    const { mode } = req.query; // 'login' or 'signup'
    
    const authUrl = `${BACKEND_URL}/api/auth/google?mode=${mode || 'login'}`;
    
    res.json({
      success: true,
      data: { url: authUrl }
    });
  } catch (error) {
    console.error('Get Google auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Google auth URL'
    });
  }
};

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/callback
 */
const handleGoogleCallback = async (req, res) => {
  try {
    const response = req.user;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    console.log("Backend User Response:", response);

    // New user - redirect to registration page with Google data
    if (response.isNewUser) {
      const profile = response.googleProfile;
      
      // Encode profile data to pass in URL
      const googleData = {
        googleId: profile.id,
        email: profile.emails && profile.emails[0] ? profile.emails[0].value : '',
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        fullName: profile.displayName || '',
        photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
        provider: 'google',
        timestamp: Date.now()
      };

      // Base64 encode the data
      const encodedData = Buffer.from(JSON.stringify(googleData)).toString('base64');

      // Redirect to registration page with encoded data
      return res.redirect(`${FRONTEND_URL}/register?googleData=${encodedData}`);
    } 
    // Existing user - generate tokens and redirect to dashboard
    else {
      const token = generateToken(response.user.id, response.user.tenantId);
      const refreshToken = generateRefreshToken(response.user.id, response.user.tenantId);

      // Redirect to login success page with tokens
      return res.redirect(
        `${FRONTEND_URL}/auth/google/success?token=${token}&refreshToken=${refreshToken}`
      );
    }

  } catch (error) {
    console.error('Google callback error:', error);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Redirect to login with error
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
};

/**
 * Complete Google signup with company details
 * POST /api/auth/google/complete-signup
 */
const completeGoogleSignup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      googleData, // Base64 encoded data from Google
      companyName,
      phoneNumber,
      businessAddress,
      tradeType,
      subscriptionPlan
    } = req.body;

    // Decode and validate Google data
    let googleInfo;
    try {
      const decoded = Buffer.from(googleData, 'base64').toString('utf-8');
      googleInfo = JSON.parse(decoded);
      
      // Check timestamp (data should be used within 30 minutes)
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - googleInfo.timestamp > thirtyMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Google authentication data expired. Please try again.'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google authentication data'
      });
    }

    // Validation
    if (!companyName || !phoneNumber || !tradeType || !subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['companyName', 'phoneNumber', 'tradeType', 'subscriptionPlan']
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email: googleInfo.email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate subdomain
    const subdomain = generateSubdomain(companyName);

    // Check if subdomain already exists
    const existingTenant = await Tenant.findOne({ where: { subdomain } });
    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Company name already registered. Please use a different company name.'
      });
    }

    // Create tenant
    const tenant = await Tenant.create({
      companyName,
      subdomain,
      email: googleInfo.email,
      phoneNumber,
      businessAddress: businessAddress || null,
      tradeType,
      subscriptionPlan,
      isActive: false, // Will be activated after payment
      paymentStatus: 'pending'
    }, { transaction });

    // Create user with Google OAuth
    const user = await User.create({
      fullName: googleInfo.fullName,
      email: googleInfo.email,
      password: null, // No password for OAuth users
      googleId: googleInfo.googleId,
      authProvider: 'google',
      role: 'contractor_admin',
      tenantId: tenant.id,
      isActive: false // Will be activated after payment
    }, { transaction });

    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];

    // Create payment record
    const payment = await Payment.create({
      tenantId: tenant.id,
      userId: user.id,
      subscriptionPlan,
      amount: planDetails.price,
      currency: 'usd',
      status: 'pending',
      description: `${planDetails.name} - ${tenant.companyName}`,
      metadata: {
        planFeatures: planDetails.features,
        registrationFlow: true,
        authProvider: 'google'
      }
    }, { transaction });

    // Create Stripe Checkout Session
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

    const session = await createCheckoutSession({
      userId: user.id,
      tenantId: tenant.id,
      subscriptionPlan,
      email: user.email,
      successUrl: `${BACKEND_URL}/api/payments/confirm?sessionId={CHECKOUT_SESSION_ID}&registration=true`,
      cancelUrl: `${FRONTEND_URL}/register?step=2&plan=${subscriptionPlan}&error=payment_cancelled`
    });

    // Update payment with session ID
    await payment.update({
      stripeSessionId: session.sessionId
    }, { transaction });

    await transaction.commit();

    console.log('Google signup initiated:', {
      tenantId: tenant.id,
      userId: user.id,
      email: googleInfo.email,
      authProvider: 'google'
    });

    // Return Stripe checkout URL
    res.status(200).json({
      success: true,
      message: 'Google signup completed. Please complete payment.',
      data: {
        stripeUrl: session.sessionUrl,
        sessionId: session.sessionId,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
          subdomain: tenant.subdomain
        },
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Complete Google signup error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to complete Google signup. Please try again.'
    });
  }
};

/**
 * Link Google account to existing user
 * POST /api/auth/google/link
 */
const linkGoogleAccount = async (req, res) => {
  try {
    const { googleToken } = req.body;
    const userId = req.user.id;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;

    // Check if Google account is already linked to another user
    const existingUser = await User.findOne({
      where: { googleId }
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        success: false,
        message: 'This Google account is already linked to another user'
      });
    }

    // Update user with Google ID
    const user = await User.findByPk(userId);
    await user.update({
      googleId,
      authProvider: user.authProvider === 'local' ? 'local,google' : 'google'
    });

    res.json({
      success: true,
      message: 'Google account linked successfully',
      data: {
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    console.error('Link Google account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link Google account'
    });
  }
};

/**
 * Set password for Google-only account
 * POST /api/auth/set-password
 * @access Private (requires authentication)
 */
const setPassword = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    const { password, confirmPassword } = req.body;

    // Validation
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user with password and auth provider
    await user.update({
      password, // Will be hashed by beforeUpdate hook
      authProvider: user.authProvider === 'google' ? 'local,google' : user.authProvider
    });

    res.json({
      success: true,
      message: 'Password set successfully. You can now login with email and password.',
      data: {
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set password'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  registerWithPayment,
  getGoogleAuthUrl,
  handleGoogleCallback,
  completeGoogleSignup,
  linkGoogleAccount,
  setPassword
};
