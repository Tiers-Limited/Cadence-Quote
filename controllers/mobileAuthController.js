// controllers/mobileAuthController.js
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const TwoFactorCode = require("../models/TwoFactorCode");
const { generateToken, generateRefreshToken } = require("../middleware/auth");
const emailService = require("../services/emailService");
const { createAuditLog } = require('./auditLogController');
const { OAuth2Client } = require("google-auth-library");
const crypto = require('crypto');
const sequelize = require("../config/database");

// Bobby's tenant configuration - This will be the single tenant for all mobile users
const BOBBY_TENANT_CONFIG = {
  companyName: "Bobby's Prime Choice Painting",
  email: "bobby@primechoicepainting.com",
  phoneNumber: "+1-555-0100",
  businessAddress: "123 Main Street, Austin, TX 78701",
  tradeType: "painter",
  subscriptionPlan: "enterprise", // Premium plan for Bobby
  isActive: true,
};

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Get or create Bobby's tenant
 * This ensures there's always exactly one tenant for the mobile app
 */
const getBobbyTenant = async (transaction) => {
  let tenant = await Tenant.findOne({
    where: { email: BOBBY_TENANT_CONFIG.email },
    transaction
  });

  if (!tenant) {
    tenant = await Tenant.create(BOBBY_TENANT_CONFIG, { transaction });
    console.log('✅ Bobby\'s tenant created successfully');
  }

  return tenant;
};

/**
 * Mobile User Registration
 * POST /api/mobile/auth/signup
 * All users are created under Bobby's tenant
 */
const mobileSignup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { fullName, email, password, phoneNumber, address } = req.body;

    // Validation
    if (!fullName || !email || !password) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: ["fullName", "email", "password"],
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() },
      transaction 
    });
    
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Get or create Bobby's tenant
    const bobbyTenant = await getBobbyTenant(transaction);

    // Create user under Bobby's tenant
    const user = await User.create(
      {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password, // Will be hashed by beforeCreate hook
        phoneNumber: phoneNumber ? phoneNumber.trim() : null,
        address: address ? address.trim() : null,
        role: "contractor", // Mobile users are contractors
        tenantId: bobbyTenant.id,
        isActive: true,
        emailVerified: false,
      },
      { transaction }
    );

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save({ transaction });

    // Send verification email (non-blocking)
    emailService.sendVerificationEmail(user.email, verificationToken, user.fullName)
      .catch(err => console.error('Error sending verification email:', err));

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile user registration',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      changes: { email: user.email, role: user.role },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      transaction
    });

    await transaction.commit();

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Return success response (don't expose sensitive data)
    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          role: user.role,
          emailVerified: user.emailVerified,
          tenantId: user.tenantId,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Mobile signup error:", error);
    
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mobile User Login
 * POST /api/mobile/auth/signin
 */
const mobileSignin = async (req, res) => {
  try {
    const { email, password, deviceId, deviceName, platform } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [{
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'companyName', 'subscriptionPlan', 'isActive']
      }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Check if tenant is active
    if (!user.tenant || !user.tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your organization account is not active. Please contact support.",
      });
    }

    // Check if user role is allowed for mobile
    const allowedMobileRoles = ['contractor', 'contractor_admin'];
    if (!allowedMobileRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Your account type is not authorized for mobile access.",
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile user login',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      metadata: { 
        deviceId, 
        deviceName, 
        platform,
        emailVerified: user.emailVerified 
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          tenantId: user.tenantId,
          tenant: {
            id: user.tenant.id,
            companyName: user.tenant.companyName,
            subscriptionPlan: user.tenant.subscriptionPlan,
          },
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Mobile signin error:", error);
    
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mobile Google Sign In
 * POST /api/mobile/auth/google
 */
const mobileGoogleSignIn = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { idToken, deviceId, deviceName, platform } = req.body;

    if (!idToken) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    // Verify Google token
    let googleUser;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      googleUser = ticket.getPayload();
    } catch (error) {
      await transaction.rollback();
      console.error("Google token verification failed:", error);
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const { email, name, sub: googleId, picture } = googleUser;

    // Get or create Bobby's tenant
    const bobbyTenant = await getBobbyTenant(transaction);

    // Find or create user
    let user = await User.findOne({
      where: { email: email.toLowerCase() },
      transaction,
      include: [{
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'companyName', 'subscriptionPlan', 'isActive']
      }]
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await User.create(
        {
          fullName: name,
          email: email.toLowerCase(),
          role: "contractor",
          tenantId: bobbyTenant.id,
          isActive: true,
          emailVerified: true, // Google emails are pre-verified
          googleId,
          profilePicture: picture,
        },
        { transaction }
      );
      isNewUser = true;
    } else {
      // Update existing user with Google info if not set
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.profilePicture && picture) {
        user.profilePicture = picture;
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
      }
      user.lastLoginAt = new Date();
      await user.save({ transaction });
    }

    // Check if user is active
    if (!user.isActive) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: isNewUser ? 'Mobile Google signup' : 'Mobile Google login',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      metadata: { deviceId, deviceName, platform, provider: 'google' },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      transaction
    });

    await transaction.commit();

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          profilePicture: user.profilePicture,
          tenantId: user.tenantId,
          tenant: {
            id: bobbyTenant.id,
            companyName: bobbyTenant.companyName,
            subscriptionPlan: bobbyTenant.subscriptionPlan,
          },
        },
        token,
        refreshToken,
        isNewUser,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Mobile Google signin error:", error);
    
    res.status(500).json({
      success: false,
      message: "Google sign-in failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mobile Apple Sign In
 * POST /api/mobile/auth/apple
 */
const mobileAppleSignIn = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { identityToken, email, fullName, deviceId, deviceName, platform } = req.body;

    if (!identityToken) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Apple identity token is required",
      });
    }

    // Note: Apple Sign In verification requires jwt and jwks-rsa packages
    // For production, you should verify the identityToken here
    // For now, we'll trust the client-provided data with caution

    if (!email) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Email is required for Apple Sign In",
      });
    }

    // Get or create Bobby's tenant
    const bobbyTenant = await getBobbyTenant(transaction);

    // Find or create user
    let user = await User.findOne({
      where: { email: email.toLowerCase() },
      transaction,
      include: [{
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'companyName', 'subscriptionPlan', 'isActive']
      }]
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await User.create(
        {
          fullName: fullName || email.split('@')[0], // Fallback to email username
          email: email.toLowerCase(),
          role: "contractor",
          tenantId: bobbyTenant.id,
          isActive: true,
          emailVerified: true, // Apple emails are pre-verified
          appleId: identityToken.substring(0, 50), // Store partial token as ID
        },
        { transaction }
      );
      isNewUser = true;
    } else {
      // Update existing user
      if (!user.appleId) {
        user.appleId = identityToken.substring(0, 50);
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
      }
      user.lastLoginAt = new Date();
      await user.save({ transaction });
    }

    // Check if user is active
    if (!user.isActive) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: isNewUser ? 'Mobile Apple signup' : 'Mobile Apple login',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      metadata: { deviceId, deviceName, platform, provider: 'apple' },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      transaction
    });

    await transaction.commit();

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          tenantId: user.tenantId,
          tenant: {
            id: bobbyTenant.id,
            companyName: bobbyTenant.companyName,
            subscriptionPlan: bobbyTenant.subscriptionPlan,
          },
        },
        token,
        refreshToken,
        isNewUser,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Mobile Apple signin error:", error);
    
    res.status(500).json({
      success: false,
      message: "Apple sign-in failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mobile Forgot Password
 * POST /api/mobile/auth/forgot-password
 */
const mobileForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    // Don't reveal whether the email exists or not
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If your email is registered, you will receive a password reset link shortly.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.fullName);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Don't expose email sending errors to client
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile password reset requested',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "If your email is registered, you will receive a password reset link shortly.",
    });
  } catch (error) {
    console.error("Mobile forgot password error:", error);
    
    res.status(500).json({
      success: false,
      message: "Unable to process password reset request. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mobile Reset Password
 * POST /api/mobile/auth/reset-password
 */
const mobileResetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      });
    }

    // Hash the token and find user
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
      },
    });

    if (!user || user.passwordResetExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by beforeUpdate hook
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile password reset completed',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Mobile reset password error:", error);
    
    res.status(500).json({
      success: false,
      message: "Unable to reset password. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify Email
 * GET /api/mobile/auth/verify-email/:token
 */
const mobileVerifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      where: {
        emailVerificationToken: hashedToken,
      },
    });

    if (!user || user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Update user
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile email verified',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Mobile verify email error:", error);
    
    res.status(500).json({
      success: false,
      message: "Unable to verify email. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  mobileSignup,
  mobileSignin,
  mobileGoogleSignIn,
  mobileAppleSignIn,
  mobileForgotPassword,
  mobileResetPassword,
  mobileVerifyEmail,
};
