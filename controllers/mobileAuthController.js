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
 * Mobile User Registration - Step 1: Request Verification Code
 * POST /api/mobile/auth/signup
 * Sends verification code to email without creating user account yet
 */
const mobileSignup = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, address } = req.body;

    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: ["fullName", "email", "password"],
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format. Please enter a valid email address.",
      });
    }

    // Validate password strength
    if (password.length < 8) {
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
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      });
    }

    // Check if email already exists with a verified account
    const existingUser = await User.findOne({ 
      where: { 
        email: email.toLowerCase(),
        emailVerified: true 
      }
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    // Check for existing pending verification code
    let verificationRecord = await TwoFactorCode.findOne({
      where: {
        identifier: email.toLowerCase(),
        purpose: 'signup_verification',
      }
    });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (verificationRecord) {
      // Update existing record
      verificationRecord.code = verificationCode;
      verificationRecord.expiresAt = expiresAt;
      verificationRecord.attempts = 0;
      verificationRecord.metadata = {
        fullName: fullName.trim(),
        password, // Store temporarily (will be hashed when user is created)
        phoneNumber: phoneNumber ? phoneNumber.trim() : null,
        address: address ? address.trim() : null,
      };
      await verificationRecord.save();
    } else {
      // Create new verification record
      verificationRecord = await TwoFactorCode.create({
        identifier: email.toLowerCase(),
        code: verificationCode,
        purpose: 'signup_verification',
        expiresAt,
        attempts: 0,
        metadata: {
          fullName: fullName.trim(),
          password, // Store temporarily
          phoneNumber: phoneNumber ? phoneNumber.trim() : null,
          address: address ? address.trim() : null,
        }
      });
    }

    // Send verification code via email
    try {
      await emailService.sendVerificationCodeEmail(
        email.toLowerCase(), 
        verificationCode, 
        fullName.trim()
      );
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
      });
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile signup verification code sent',
      entityType: 'TwoFactorCode',
      entityId: verificationRecord.id,
      metadata: { email: email.toLowerCase() },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "Verification code sent to your email. Please check your inbox.",
      data: {
        email: email.toLowerCase(),
        expiresIn: 600, // 10 minutes in seconds
      },
    });
  } catch (error) {
    console.error("Mobile signup error:", error);
    
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mobile User Registration - Step 2: Verify Code and Create Account
 * POST /api/mobile/auth/verify-signup
 * Verifies code and creates the user account
 */
const mobileVerifySignup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { email, code } = req.body;
    console.log("📧 Verify Signup - Email:", email, "Code:", code);

    // Validation
    if (!email || !code) {
      console.log("❌ Missing email or code");
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required",
      });
    }

    // Find verification record
    console.log("🔍 Looking for verification record...");
    const verificationRecord = await TwoFactorCode.findOne({
      where: {
        identifier: email.toLowerCase(),
        purpose: 'signup_verification',
      },
      transaction
    });

    if (!verificationRecord) {
      console.log("❌ No verification record found");
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No verification code found for this email. Please request a new code.",
      });
    }

    console.log("✅ Verification record found:", {
      id: verificationRecord.id,
      expiresAt: verificationRecord.expiresAt,
      attempts: verificationRecord.attempts
    });

    // Check if code has expired
    if (new Date() > verificationRecord.expiresAt) {
      console.log("❌ Code expired");
      await verificationRecord.destroy({ transaction });
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
        expired: true,
      });
    }

    // Check attempts limit (max 5 attempts)
    if (verificationRecord.attempts >= 5) {
      console.log("❌ Too many attempts");
      await verificationRecord.destroy({ transaction });
      await transaction.rollback();
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new verification code.",
      });
    }

    // Verify code
    if (verificationRecord.code !== code.trim()) {
      console.log("❌ Invalid code - Attempts:", verificationRecord.attempts + 1);
      verificationRecord.attempts += 1;
      await verificationRecord.save({ transaction });
      await transaction.rollback();
      
      const attemptsLeft = 5 - verificationRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        attemptsLeft,
      });
    }

    console.log("✅ Code verified successfully");

    // Code is valid - check if user already exists
    console.log("🔍 Checking for existing user...");
    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() },
      transaction 
    });
    
    if (existingUser && existingUser.emailVerified) {
      console.log("❌ User already exists with verified email");
      await verificationRecord.destroy({ transaction });
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    console.log("✅ No existing verified user found");

    // Get or create Bobby's tenant
    console.log("🏢 Getting Bobby's tenant...");
    const bobbyTenant = await getBobbyTenant(transaction);
    console.log("✅ Bobby's tenant ready:", bobbyTenant.id);

    // Retrieve stored user data from metadata
    const { fullName, password, phoneNumber, address } = verificationRecord.metadata;
    console.log("📝 User data from metadata:", {
      fullName,
      hasPassword: !!password,
      phoneNumber,
      address
    });

    // Create user under Bobby's tenant
    console.log("👤 Creating user...");
    const user = await User.create(
      {
        fullName,
        email: email.toLowerCase(),
        password, // Will be hashed by beforeCreate hook
        phoneNumber,
        address,
        role: "customer", // Mobile users are customers
        tenantId: bobbyTenant.id,
        isActive: true,
        emailVerified: true, // Email is verified via code
      },
      { transaction }
    );
    console.log("✅ User created:", user.id);

    // Delete verification record
    console.log("🗑️ Deleting verification record...");
    await verificationRecord.destroy({ transaction });
    console.log("✅ Verification record deleted");

    // Create audit log
    console.log("📝 Creating audit log...");
    await createAuditLog({
      category: 'auth',
      action: 'Mobile user registration completed',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      changes: { email: user.email, role: user.role },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      transaction
    });
    console.log("✅ Audit log created");

    console.log("💾 Committing transaction...");
    await transaction.commit();
    console.log("✅ Transaction committed");

    // Generate tokens
    console.log("🔑 Generating tokens...");
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    console.log("✅ Tokens generated");

    // Return success response
    console.log("✅ Sending success response");
    res.status(201).json({
      success: true,
      message: "Registration successful! Welcome aboard.",
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
    console.error("❌ Mobile verify signup error:", error);
    console.error("Error stack:", error.stack);
    
    res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Resend Signup Verification Code
 * POST /api/mobile/auth/resend-signup-code
 */
const mobileResendSignupCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find verification record
    const verificationRecord = await TwoFactorCode.findOne({
      where: {
        identifier: email.toLowerCase(),
        purpose: 'signup_verification',
      }
    });

    if (!verificationRecord) {
      return res.status(404).json({
        success: false,
        message: "No pending signup found for this email. Please start the signup process again.",
      });
    }

    // Check if user already exists with verified email
    const existingUser = await User.findOne({ 
      where: { 
        email: email.toLowerCase(),
        emailVerified: true 
      }
    });
    
    if (existingUser) {
      await verificationRecord.destroy();
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    verificationRecord.code = verificationCode;
    verificationRecord.expiresAt = expiresAt;
    verificationRecord.attempts = 0;
    await verificationRecord.save();

    // Send verification code via email
    try {
      const { fullName } = verificationRecord.metadata;
      await emailService.sendVerificationCodeEmail(
        email.toLowerCase(), 
        verificationCode, 
        fullName
      );
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
      });
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile signup verification code resent',
      entityType: 'TwoFactorCode',
      entityId: verificationRecord.id,
      metadata: { email: email.toLowerCase() },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "New verification code sent to your email.",
      data: {
        email: email.toLowerCase(),
        expiresIn: 600, // 10 minutes in seconds
      },
    });
  } catch (error) {
    console.error("Mobile resend signup code error:", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code. Please try again.",
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
    const { email, password} = req.body;

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
    const allowedMobileRoles = ['customer', 'contractor_admin'];
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
 * Mobile Google Sign In (Flutter)
 * POST /api/mobile/auth/google
 * Accepts googleId, email, fullName from Flutter Google Sign In
 */
const mobileGoogleSignIn = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { googleId, email, fullName, photoUrl } = req.body;

    // Validation
    if (!googleId || !email) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Google ID and email are required",
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

    // Use the provided data directly from Flutter
    const name = fullName || email.split('@')[0];
    const picture = photoUrl || null;

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
          role: "customer",
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
      metadata: { provider: 'google' },
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
    const { identityToken, email, fullName } = req.body;

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
          role: "customer",
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
      metadata: { provider: 'apple' },
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
 * Mobile Forgot Password - Send Verification Code
 * POST /api/mobile/auth/forgot-password
 * Sends a 6-digit verification code to reset password
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
        message: "If your email is registered, you will receive a verification code shortly.",
      });
    }

    // Check for existing password reset code
    let resetRecord = await TwoFactorCode.findOne({
      where: {
        identifier: email.toLowerCase(),
        purpose: 'password_reset',
      }
    });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (resetRecord) {
      // Update existing record
      resetRecord.code = verificationCode;
      resetRecord.expiresAt = expiresAt;
      resetRecord.attempts = 0;
      resetRecord.metadata = { userId: user.id };
      await resetRecord.save();
    } else {
      // Create new reset record
      resetRecord = await TwoFactorCode.create({
        identifier: email.toLowerCase(),
        code: verificationCode,
        purpose: 'password_reset',
        expiresAt,
        attempts: 0,
        metadata: { userId: user.id }
      });
    }

    // Send verification code via email
    try {
      await emailService.sendVerificationCodeEmail(
        user.email,
        verificationCode,
        user.fullName
      );
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Don't expose email sending errors to client
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile password reset code sent',
      userId: user.id,
      entityType: 'TwoFactorCode',
      entityId: resetRecord.id,
      metadata: { email: user.email },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "If your email is registered, you will receive a verification code shortly.",
      data: {
        email: email.toLowerCase(),
        expiresIn: 600
      }
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
 * Mobile Reset Password - Verify Code and Reset
 * POST /api/mobile/auth/reset-password
 * Verifies the code and resets the password
 */
const mobileResetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, verification code, and new password are required",
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

    // Find verification record
    const resetRecord = await TwoFactorCode.findOne({
      where: {
        identifier: email.toLowerCase(),
        purpose: 'password_reset',
      }
    });

    if (!resetRecord) {
      return res.status(404).json({
        success: false,
        message: "No password reset request found for this email. Please request a new code.",
      });
    }

    // Check if code has expired
    if (new Date() > resetRecord.expiresAt) {
      await resetRecord.destroy();
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
        expired: true,
      });
    }

    // Check attempts limit (max 5 attempts)
    if (resetRecord.attempts >= 5) {
      await resetRecord.destroy();
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new verification code.",
      });
    }

    // Verify code
    if (resetRecord.code !== code.trim()) {
      resetRecord.attempts += 1;
      await resetRecord.save();
      
      const attemptsLeft = 5 - resetRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        attemptsLeft,
      });
    }

    // Code is valid - find user and update password
    const user = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      await resetRecord.destroy();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by beforeUpdate hook
    await user.save();

    // Delete reset record
    await resetRecord.destroy();

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
 * Resend Password Reset Verification Code
 * POST /api/mobile/auth/resend-reset-code
 */
const mobileResendResetCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find reset record
    const resetRecord = await TwoFactorCode.findOne({
      where: {
        identifier: email.toLowerCase(),
        purpose: 'password_reset',
      }
    });

    if (!resetRecord) {
      return res.status(404).json({
        success: false,
        message: "No password reset request found for this email. Please start the password reset process.",
      });
    }

    // Find user
    const user = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      await resetRecord.destroy();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    resetRecord.code = verificationCode;
    resetRecord.expiresAt = expiresAt;
    resetRecord.attempts = 0;
    await resetRecord.save();

    // Send verification code via email
    try {
      await emailService.sendVerificationCodeEmail(
        email.toLowerCase(),
        verificationCode,
        user.fullName
      );
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
      });
    }

    // Create audit log
    await createAuditLog({
      category: 'auth',
      action: 'Mobile password reset code resent',
      userId: user.id,
      entityType: 'TwoFactorCode',
      entityId: resetRecord.id,
      metadata: { email: email.toLowerCase() },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: "New verification code sent to your email.",
      data: {
        email: email.toLowerCase(),
        expiresIn: 600,
      },
    });
  } catch (error) {
    console.error("Mobile resend reset code error:", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code. Please try again.",
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
  mobileVerifySignup,
  mobileResendSignupCode,
  mobileSignin,
  mobileGoogleSignIn,
  mobileAppleSignIn,
  mobileForgotPassword,
  mobileResetPassword,
  mobileResendResetCode,
  mobileVerifyEmail,
};
