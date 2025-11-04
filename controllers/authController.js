// controllers/authController.js
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Payment = require("../models/Payment");
const TwoFactorCode = require("../models/TwoFactorCode");
const {
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
} = require("../middleware/auth");
const {
  createCheckoutSession,
  SUBSCRIPTION_PLANS,
} = require("../services/stripeService");
const emailService = require("../services/emailService");
const {
  generateVerificationToken,
  verifyVerificationToken,
} = require("../utils/verificationToken");
const sequelize = require("../config/database");
const { OAuth2Client } = require("google-auth-library");
const speakeasy = require("speakeasy");

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
      subscriptionPlan,
    } = req.body;

    // Validation
    if (
      !fullName ||
      !email ||
      !password ||
      !companyName ||
      !phoneNumber ||
      !tradeType
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: [
          "fullName",
          "email",
          "password",
          "companyName",
          "phoneNumber",
          "tradeType",
        ],
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Validate subscription plan
    const validPlans = ["starter", "pro"];
    if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan. Must be "starter" or "pro"',
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create tenant
    const tenant = await Tenant.create(
      {
        companyName,
        email,
        phoneNumber,
        businessAddress: businessAddress || null,
        tradeType,
        subscriptionPlan: subscriptionPlan || "starter",
        isActive: true,
      },
      { transaction }
    );

    // Create admin user for the tenant
    const user = await User.create(
      {
        fullName,
        email,
        password, // Will be hashed by beforeCreate hook
        role: "contractor_admin",
        tenantId: tenant.id,
        isActive: true,
        emailVerified: false, // Will send verification email
      },
      { transaction }
    );

    // Commit transaction
    await transaction.commit();

    // Generate JWT token
    const token = generateToken(user.id, tenant.id);

    // Send email verification for non-Google users
    try {
      const verificationToken = generateVerificationToken(user.id, user.email);
      await emailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.fullName
      );
      console.log("✓ Verification email sent to:", user.email);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails, just log it
    }

    // Return success response
    res.status(201).json({
      success: true,
      message:
        "Registration successful! Please check your email to verify your account.",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
          tradeType: tenant.tradeType,
          subscriptionPlan: tenant.subscriptionPlan,
        },
        token,
        accessUrl: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/tenant/${tenant.id}`,
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.error("Registration error:", error);

    // Handle Sequelize validation errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Validation
//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email and password are required'
//       });
//     }

//     // Find user with tenant information (optimized query)
//     const user = await User.findOne({
//       where: {
//         email,
//         isActive: true
//       },
//       attributes: ['id', 'fullName', 'email', 'role', 'tenantId', 'authProvider', 'password', 'emailVerified'],
//       include: [{
//         model: Tenant,
//         where: { isActive: true },
//         attributes: ['id', 'companyName', 'tradeType', 'subscriptionPlan'],
//         required: true // INNER JOIN for better performance
//       }]
//     });

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }

//     // Check if user registered with Google OAuth
//     if (user.authProvider === 'google' && !user.password) {
//       return res.status(400).json({
//         success: false,
//         message: 'This account was created using Google Sign-In. Please use "Continue with Google" to login.',
//         authProvider: 'google',
//         requiresGoogleAuth: true
//       });
//     }

//     // Verify password
//     const isPasswordValid = await user.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }

//     // Generate JWT token
//     const token = generateToken(user.id, user.tenantId);
//     const refreshToken = generateRefreshToken(user.id, user.tenantId);

//     // Return success response
//     res.json({
//       success: true,
//       message: 'Login successful',
//       data: {
//         user: {
//           id: user.id,
//           fullName: user.fullName,
//           email: user.email,
//           role: user.role,
//           emailVerified: user.emailVerified
//         },
//         tenant: {
//           id: user.Tenant.id,
//           companyName: user.Tenant.companyName,
//           tradeType: user.Tenant.tradeType,
//           subscriptionPlan: user.Tenant.subscriptionPlan
//         },
//         token,
//         refreshToken,
//         accessUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tenant/${user.Tenant.id}`,

//       }
//     });

//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Login failed. Please try again.'
//     });
//   }
// };

const login = async (req, res) => {
  try {
    const { email, password, authProvider } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user with tenant information
    const user = await User.findOne({
      where: {
        email,
        isActive: true,
      },
      attributes: [
        "id",
        "fullName",
        "email",
        "role",
        "tenantId",
        "authProvider",
        "password",
        "emailVerified",
        "twoFactorEnabled",
        "twoFactorSecret",
      ],
      include: [
        {
          model: Tenant,
          where: { isActive: true },
          attributes: ["id", "companyName", "tradeType", "subscriptionPlan"],
          required: true,
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No account found with this email",
      });
    }

    // ✅ If OAuth user (Google/Apple) without password, auto-login
    if (
      (user.authProvider === "google" ||
        user.authProvider === "apple" ||
        user.authProvider === "local") &&
      !user.password
    ) {
      // Optional: Verify the provider matches if passed from frontend
      if (authProvider && authProvider !== user.authProvider) {
        return res.status(400).json({
          success: false,
          message: `This account was created using ${user.authProvider.toUpperCase()} Sign-In. Please continue with ${user.authProvider.toUpperCase()}.`,
        });
      }

      // Generate JWTs
      const token = generateToken(user.id, user.tenantId);
      const refreshToken = generateRefreshToken(user.id, user.tenantId);

      return res.json({
        success: true,
        message: `${
          user.authProvider.charAt(0).toUpperCase() + user.authProvider.slice(1)
        } Sign-In successful`,
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
          },
          tenant: {
            id: user.Tenant.id,
            companyName: user.Tenant.companyName,
            tradeType: user.Tenant.tradeType,
            subscriptionPlan: user.Tenant.subscriptionPlan,
          },
          token,
          refreshToken,
          accessUrl: `${
            process.env.FRONTEND_URL || "http://localhost:5173"
          }/tenant/${user.Tenant.id}`,
        },
      });
    }

    // For normal email/password users
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required for email/password login",
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if 2FA is enabled (and not OAuth)
    if (user.twoFactorEnabled && user.authProvider === "local") {
      const code = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: "base32",
      });

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await TwoFactorCode.create({
        userId: user.id,
        code,
        expiresAt,
      });

      await emailService.sendTwoFactorCodeEmail(
        user.email,
        code,
        user.fullName
      );

      return res.json({
        success: true,
        requiresTwoFactor: true,
        message: "Two-factor authentication code sent to your email",
        data: {
          userId: user.id,
          email: user.email,
        },
      });
    }

    // Generate JWT token for local login
    const token = generateToken(user.id, user.tenantId);
    const refreshToken = generateRefreshToken(user.id, user.tenantId);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        tenant: {
          id: user.Tenant.id,
          companyName: user.Tenant.companyName,
          tradeType: user.Tenant.tradeType,
          subscriptionPlan: user.Tenant.subscriptionPlan,
        },
        token,
        refreshToken,
        accessUrl: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/tenant/${user.Tenant.id}`,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

/**
 * Verify 2FA code
 * POST /api/auth/verify-2fa
 */
const verifyTwoFactorCode = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: "User ID and 2FA code are required",
      });
    }

    // Find user
    const user = await User.findOne({
      where: { id: userId, isActive: true },
      attributes: [
        "id",
        "fullName",
        "email",
        "role",
        "tenantId",
        "twoFactorSecret",
      ],
      include: [
        {
          model: Tenant,
          where: { isActive: true },
          attributes: ["id", "companyName", "tradeType", "subscriptionPlan"],
          required: true,
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify TOTP code
    const isValidCode = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1, // Allow 30-second window
    });

    if (!isValidCode) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired 2FA code",
      });
    }

    // Clean up used code
    await TwoFactorCode.destroy({
      where: { userId, code },
    });

    // Generate JWT token
    const token = generateToken(user.id, user.tenantId);
    const refreshToken = generateRefreshToken(user.id, user.tenantId);

    res.json({
      success: true,
      message: "Two-factor authentication successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        tenant: {
          id: user.Tenant.id,
          companyName: user.Tenant.companyName,
          tradeType: user.Tenant.tradeType,
          subscriptionPlan: user.Tenant.subscriptionPlan,
        },
        token,
        refreshToken,
        accessUrl: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/tenant/${user.Tenant.id}`,
      },
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify 2FA code",
    });
  }
};

/**
 * Enable 2FA for user
 * POST /api/auth/enable-2fa
 * @access Private
 */
const enableTwoFactor = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is already enabled",
      });
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Contractor Hub (${user.email})`,
    });

    await user.update({
      twoFactorSecret: secret.base32,
      twoFactorEnabled: true,
    });

    // Generate QR code for authenticator app
    const qrcode = require("qrcode");
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      message: "Two-factor authentication enabled",
      data: {
        qrCodeUrl,
        secret: secret.base32,
      },
    });
  } catch (error) {
    console.error("Enable 2FA error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enable 2FA",
    });
  }
};

/**
 * Disable 2FA for user
 * POST /api/auth/disable-2fa
 * @access Private
 */
const disableTwoFactor = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not enabled",
      });
    }

    await user.update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    // Clean up any existing 2FA codes
    await TwoFactorCode.destroy({
      where: { userId },
    });

    res.json({
      success: true,
      message: "Two-factor authentication disabled",
    });
  } catch (error) {
    console.error("Disable 2FA error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disable 2FA",
    });
  }
};
/**
 * Get current user profile
 * GET /api/auth/me
 */
const getProfile = async (req, res) => {
  try {
    // User is already attached by authenticateToken middleware (optimized query)
    const user = await User.findOne({
      where: { id: req.user.id },
      attributes: [
        "id",
        "fullName",
        "email",
        "role",
        "isActive",
        "emailVerified",
        "createdAt",
      ],
      include: [
        {
          model: Tenant,
          attributes: [
            "id",
            "companyName",
            "tradeType",
            "subscriptionPlan",
            "phoneNumber",
            "businessAddress",
          ],
          required: true, // INNER JOIN for better performance
        },
      ],
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
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        tenant: user.Tenant,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    });
  }
};

/**
 * Register new tenant and create payment session in one transaction
 * POST /api/auth/register-with-payment
 */
const registerWithPayment = async (req, res) => {
  console.log(req.body);
  const transaction = await sequelize.transaction();

  try {
    const {
      fullName,
      email,
      password,
      companyName,
      phoneNumber,
      businessAddress,
      tradeType,
      subscriptionPlan,
      googleId,
      appleId,
      authProvider,
    } = req.body;

    // Validation
    if (
      !fullName ||
      !email ||
      !companyName ||
      !phoneNumber ||
      !tradeType ||
      !subscriptionPlan
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: [
          "fullName",
          "email",
          "companyName",
          "phoneNumber",
          "tradeType",
          "subscriptionPlan",
        ],
      });
    }

    console.log(authProvider);

    const isGoogleAuth = authProvider === "google" && googleId;
    const isAppleAuth = authProvider === "apple" && appleId;
    const isOAuth = isGoogleAuth || isAppleAuth;

    if (!isOAuth && (!password || password.length < 8)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: !password
          ? "Password is required for email registration"
          : "Password must be at least 8 characters long",
      });
    }

    const validPlans = ["starter", "pro"];
    if (!validPlans.includes(subscriptionPlan)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan. Must be "starter" or "pro"',
      });
    }

    // Check for existing user
    console.log("Checking for existing user:", email);
    try {
      const existingUser = await User.findOne({
        where: { email },
        transaction,
      });
      if (existingUser) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }
    } catch (error) {
      console.error("Error checking existing user:", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to check existing user",
      });
    }

    // Create tenant
    console.log("Creating tenant with data:", {
      companyName,
      email,
      phoneNumber,
      tradeType,
      subscriptionPlan,
    });
    let tenant;
    try {
      tenant = await Tenant.create(
        {
          companyName,
          email,
          phoneNumber,
          businessAddress: businessAddress || null,
          tradeType,
          subscriptionPlan,
          isActive: false,
          paymentStatus: "pending",
        },
        { transaction }
      );
      console.log("Tenant created:", tenant.id);
    } catch (error) {
      console.error("Tenant creation failed:", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to create tenant",
      });
    }

    // Create user
    const userCreateData = {
      fullName,
      email,
      role: "contractor_admin",
      tenantId: tenant.id,
      isActive: false,
    };
    if (isGoogleAuth) {
      userCreateData.googleId = googleId;
      userCreateData.authProvider = "google";
      userCreateData.emailVerified = true;
    } else if (isAppleAuth) {
      userCreateData.appleId = appleId;
      userCreateData.authProvider = "apple";
      userCreateData.emailVerified = true;
    } else {
      userCreateData.password = password;
      userCreateData.emailVerified = false;
    }

    console.log("Creating user with data:", {
      fullName,
      email,
      role: "contractor_admin",
    });
    let user;
    try {
      user = await User.create(userCreateData, { transaction });
      console.log("User created:", user.id);
    } catch (error) {
      console.error("User creation failed:", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to create user",
      });
    }

    // Create payment
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];
    console.log("Creating payment for tenant:", tenant.id);
    let payment;
    try {
      payment = await Payment.create(
        {
          tenantId: tenant.id,
          userId: user.id,
          subscriptionPlan,
          amount: planDetails.price,
          currency: "usd",
          status: "pending",
          description: `${planDetails.name} - ${tenant.companyName}`,
          metadata: {
            planFeatures: planDetails.features,
            registrationFlow: true,
          },
        },
        { transaction }
      );
      console.log("Payment created:", payment.id);
    } catch (error) {
      console.error("Payment creation failed:", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to create payment",
      });
    }

    // Create Stripe checkout session
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4001";
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
    console.log("Creating Stripe checkout session");
    let session;
    try {
      session = await createCheckoutSession({
        userId: user.id,
        tenantId: tenant.id,
        subscriptionPlan,
        email: user.email,
        successUrl: `${BACKEND_URL}/api/v1/payments/confirm?sessionId={CHECKOUT_SESSION_ID}&registration=true`,
        cancelUrl: `${FRONTEND_URL}/register?step=2&plan=${subscriptionPlan}&error=payment_cancelled`,
      });
      console.log("Stripe session created:", session.sessionId);
    } catch (error) {
      console.error("Stripe session creation failed:", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to create Stripe checkout session",
      });
    }

    // Update payment with session ID
    try {
      await payment.update(
        {
          stripeSessionId: session.sessionId,
        },
        { transaction }
      );
      console.log("Payment updated with session ID:", session.sessionId);
    } catch (error) {
      console.error("Payment update failed:", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to update payment",
      });
    }

    // Commit transaction
    await transaction.commit();
    console.log("Transaction committed successfully");

    // Send email verification for non-OAuth users
    if (!isOAuth) {
      try {
        const verificationToken = generateVerificationToken(
          user.id,
          user.email
        );
        await emailService.sendVerificationEmail(
          user.email,
          verificationToken,
          user.fullName
        );
        console.log("Verification email sent to:", user.email);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: isOAuth
        ? "Registration initiated. Please complete payment."
        : "Registration initiated. Please complete payment and check your email to verify your account.",
      data: {
        stripeUrl: session.sessionUrl,
        sessionId: session.sessionId,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
          tradeType: tenant.tradeType,
          subscriptionPlan: tenant.subscriptionPlan,
        },
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (error) {
    console.error("Registration with payment error:", error);
    try {
      await transaction.rollback();
      console.log("Transaction rolled back");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};
// generateSubdomain helper removed - tenant subdomain option discontinued

/**
 * Get Google OAuth URL
 * GET /api/auth/google/url
 */
const getGoogleAuthUrl = async (req, res) => {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4001";
    const { mode } = req.query; // 'login' or 'signup'

    const authUrl = `${BACKEND_URL}/api/auth/google?mode=${mode || "login"}`;

    res.json({
      success: true,
      data: { url: authUrl },
    });
  } catch (error) {
    console.error("Get Google auth URL error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate Google auth URL",
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
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

    console.log("Backend User Response:", response);

    // New user - redirect to registration page with Google data
    if (response.isNewUser) {
      const profile = response.googleProfile;

      // Encode profile data to pass in URL
      const googleData = {
        googleId: profile.id,
        email:
          profile.emails && profile.emails[0] ? profile.emails[0].value : "",
        firstName: profile.name?.givenName || "",
        lastName: profile.name?.familyName || "",
        fullName: profile.displayName || "",
        photo:
          profile.photos && profile.photos[0] ? profile.photos[0].value : "",
        provider: "google",
        timestamp: Date.now(),
      };

      // Base64 encode the data
      const encodedData = Buffer.from(JSON.stringify(googleData)).toString(
        "base64"
      );

      // Redirect to registration page with encoded data
      return res.redirect(`${FRONTEND_URL}/register?googleData=${encodedData}`);
    }
    // Existing user - generate tokens and redirect to dashboard
    else {
      const token = generateToken(response.user.id, response.user.tenantId);
      const refreshToken = generateRefreshToken(
        response.user.id,
        response.user.tenantId
      );

      // Redirect to login success page with tokens
      return res.redirect(
        `${FRONTEND_URL}/auth/google/success?token=${token}&refreshToken=${refreshToken}`
      );
    }
  } catch (error) {
    console.error("Google callback error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

    // Redirect to login with error
    return res.redirect(
      `${FRONTEND_URL}/login?error=${encodeURIComponent(
        error.message || "Authentication failed"
      )}`
    );
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
      subscriptionPlan,
    } = req.body;

    // Decode and validate Google data
    let googleInfo;
    try {
      const decoded = Buffer.from(googleData, "base64").toString("utf-8");
      googleInfo = JSON.parse(decoded);

      // Check timestamp (data should be used within 30 minutes)
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - googleInfo.timestamp > thirtyMinutes) {
        return res.status(400).json({
          success: false,
          message: "Google authentication data expired. Please try again.",
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google authentication data",
      });
    }

    // Validation
    if (!companyName || !phoneNumber || !tradeType || !subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: [
          "companyName",
          "phoneNumber",
          "tradeType",
          "subscriptionPlan",
        ],
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email: googleInfo.email },
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create tenant (no subdomain)
    const tenant = await Tenant.create(
      {
        companyName,
        email: googleInfo.email,
        phoneNumber,
        businessAddress: businessAddress || null,
        tradeType,
        subscriptionPlan,
        isActive: false, // Will be activated after payment
        paymentStatus: "pending",
      },
      { transaction }
    );

    // Create user with Google OAuth
    const user = await User.create(
      {
        fullName: googleInfo.fullName,
        email: googleInfo.email,
        password: null, // No password for OAuth users
        googleId: googleInfo.googleId,
        authProvider: "google",
        role: "contractor_admin",
        tenantId: tenant.id,
        isActive: false, // Will be activated after payment
        emailVerified: true, // Google emails are pre-verified
      },
      { transaction }
    );

    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];

    // Create payment record
    const payment = await Payment.create(
      {
        tenantId: tenant.id,
        userId: user.id,
        subscriptionPlan,
        amount: planDetails.price,
        currency: "usd",
        status: "pending",
        description: `${planDetails.name} - ${tenant.companyName}`,
        metadata: {
          planFeatures: planDetails.features,
          registrationFlow: true,
          authProvider: "google",
        },
      },
      { transaction }
    );

    // Create Stripe Checkout Session
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";

    const session = await createCheckoutSession({
      userId: user.id,
      tenantId: tenant.id,
      subscriptionPlan,
      email: user.email,
      successUrl: `${BACKEND_URL}/api/payments/confirm?sessionId={CHECKOUT_SESSION_ID}&registration=true`,
      cancelUrl: `${FRONTEND_URL}/register?step=2&plan=${subscriptionPlan}&error=payment_cancelled`,
    });

    // Update payment with session ID
    await payment.update(
      {
        stripeSessionId: session.sessionId,
      },
      { transaction }
    );

    await transaction.commit();

    console.log("Google signup initiated:", {
      tenantId: tenant.id,
      userId: user.id,
      email: googleInfo.email,
      authProvider: "google",
    });

    // Return Stripe checkout URL
    res.status(200).json({
      success: true,
      message: "Google signup completed. Please complete payment.",
      data: {
        stripeUrl: session.sessionUrl,
        sessionId: session.sessionId,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
        },
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Complete Google signup error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to complete Google signup. Please try again.",
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
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;

    // Check if Google account is already linked to another user
    const existingUser = await User.findOne({
      where: { googleId },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        success: false,
        message: "This Google account is already linked to another user",
      });
    }

    // Update user with Google ID
    const user = await User.findByPk(userId);
    await user.update({
      googleId,
      authProvider: user.authProvider === "local" ? "local,google" : "google",
    });

    res.json({
      success: true,
      message: "Google account linked successfully",
      data: {
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Link Google account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to link Google account",
    });
  }
};

/**
 * Handle Apple OAuth callback
 * GET /api/auth/apple/callback
 */
const handleAppleCallback = async (req, res) => {
  try {
    const response = req.user;
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

    console.log("Backend Apple User Response:", response);

    // New user - redirect to registration page with Apple data
    if (response.isNewUser) {
      const profile = response.appleProfile;

      // Encode profile data to pass in URL
      const appleData = {
        appleId: response.appleId,
        email: response.email,
        fullName: response.fullName,
        provider: "apple",
        timestamp: Date.now(),
      };

      // Base64 encode the data
      const encodedData = Buffer.from(JSON.stringify(appleData)).toString(
        "base64"
      );

      // Redirect to registration page with encoded data
      return res.redirect(`${FRONTEND_URL}/register?appleData=${encodedData}`);
    }
    // Existing user - generate tokens and redirect to dashboard
    else {
      const token = generateToken(response.user.id, response.user.tenantId);
      const refreshToken = generateRefreshToken(
        response.user.id,
        response.user.tenantId
      );

      // Redirect to login success page with tokens
      return res.redirect(
        `${FRONTEND_URL}/auth/apple/success?token=${token}&refreshToken=${refreshToken}`
      );
    }
  } catch (error) {
    console.error("Apple callback error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

    // Redirect to login with error
    return res.redirect(
      `${FRONTEND_URL}/login?error=${encodeURIComponent(
        error.message || "Authentication failed"
      )}`
    );
  }
};

/**
 * Complete Apple signup with company details
 * POST /api/auth/apple/complete-signup
 */
const completeAppleSignup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      appleData, // Base64 encoded data from Apple
      companyName,
      phoneNumber,
      businessAddress,
      tradeType,
      subscriptionPlan,
    } = req.body;

    // Decode and validate Apple data
    let appleInfo;
    try {
      const decoded = Buffer.from(appleData, "base64").toString("utf-8");
      appleInfo = JSON.parse(decoded);

      // Check timestamp (data should be used within 30 minutes)
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - appleInfo.timestamp > thirtyMinutes) {
        return res.status(400).json({
          success: false,
          message: "Apple authentication data expired. Please try again.",
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid Apple authentication data",
      });
    }

    // Validation
    if (!companyName || !phoneNumber || !tradeType || !subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: [
          "companyName",
          "phoneNumber",
          "tradeType",
          "subscriptionPlan",
        ],
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email: appleInfo.email },
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create tenant
    const tenant = await Tenant.create(
      {
        companyName,
        email: appleInfo.email,
        phoneNumber,
        businessAddress: businessAddress || null,
        tradeType,
        subscriptionPlan,
        isActive: false, // Will be activated after payment
        paymentStatus: "pending",
      },
      { transaction }
    );

    // Create user with Apple OAuth
    const user = await User.create(
      {
        fullName: appleInfo.fullName,
        email: appleInfo.email,
        password: null, // No password for OAuth users
        appleId: appleInfo.appleId,
        authProvider: "apple",
        role: "contractor_admin",
        tenantId: tenant.id,
        isActive: false, // Will be activated after payment
        emailVerified: true, // Apple emails are pre-verified
      },
      { transaction }
    );

    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[subscriptionPlan];

    // Create payment record
    const payment = await Payment.create(
      {
        tenantId: tenant.id,
        userId: user.id,
        subscriptionPlan,
        amount: planDetails.price,
        currency: "usd",
        status: "pending",
        description: `${planDetails.name} - ${tenant.companyName}`,
        metadata: {
          planFeatures: planDetails.features,
          registrationFlow: true,
          authProvider: "apple",
        },
      },
      { transaction }
    );

    // Create Stripe Checkout Session
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4001";
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await createCheckoutSession({
      userId: user.id,
      tenantId: tenant.id,
      subscriptionPlan,
      email: user.email,
      successUrl: `${BACKEND_URL}/api/v1/payments/confirm?sessionId={CHECKOUT_SESSION_ID}&registration=true`,
      cancelUrl: `${FRONTEND_URL}/register?step=2&plan=${subscriptionPlan}&error=payment_cancelled`,
    });

    // Update payment with session ID
    await payment.update(
      {
        stripeSessionId: session.sessionId,
      },
      { transaction }
    );

    await transaction.commit();

    console.log("Apple signup initiated:", {
      tenantId: tenant.id,
      userId: user.id,
      email: appleInfo.email,
      authProvider: "apple",
    });

    // Return Stripe checkout URL
    res.status(200).json({
      success: true,
      message: "Apple signup completed. Please complete payment.",
      data: {
        stripeUrl: session.sessionUrl,
        sessionId: session.sessionId,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
        },
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Complete Apple signup error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to complete Apple signup. Please try again.",
    });
  }
};

/**
 * Link Apple account to existing user
 * POST /api/auth/apple/link
 */
const linkAppleAccount = async (req, res) => {
  try {
    const { appleToken } = req.body;
    const userId = req.user.id;

    // For Apple, you'd need to verify the identity token
    // This is a simplified version - in production you should verify the token
    const appleId = req.body.appleId; // You'd extract this from the verified token

    if (!appleId) {
      return res.status(400).json({
        success: false,
        message: "Apple ID is required",
      });
    }

    // Check if Apple account is already linked to another user
    const existingUser = await User.findOne({
      where: { appleId },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        success: false,
        message: "This Apple account is already linked to another user",
      });
    }

    // Update user with Apple ID
    const user = await User.findByPk(userId);
    await user.update({
      appleId,
      authProvider: user.authProvider === "local" ? "local,apple" : "apple",
    });

    res.json({
      success: true,
      message: "Apple account linked successfully",
      data: {
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Link Apple account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to link Apple account",
    });
  }
};

/**
 * Set password for OAuth-only account
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
        message: "Password and confirmation are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user with password and auth provider
    await user.update({
      password, // Will be hashed by beforeUpdate hook
      authProvider:
        user.authProvider === "google" ? "local,google" : user.authProvider,
    });

    res.json({
      success: true,
      message:
        "Password set successfully. You can now login with email and password.",
      data: {
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set password",
    });
  }
};

/**
 * Send email verification link
 * POST /api/auth/send-verification
 * @access Private (requires authentication)
 */
const sendVerificationEmail = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate verification token
    const verificationToken = generateVerificationToken(user.id, user.email);

    // Send verification email
    await emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.fullName
    );

    res.json({
      success: true,
      message: "Verification email sent successfully. Please check your email.",
    });
  } catch (error) {
    console.error("Send verification email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send verification email",
    });
  }
};

/**
 * Verify email with token
 * GET /api/auth/verify-email
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Verify token
    const tokenResult = verifyVerificationToken(token);

    if (!tokenResult.valid) {
      const errorMessage = tokenResult.expired
        ? "Verification link has expired. Please request a new one."
        : "Invalid verification link.";

      return res.status(400).json({
        success: false,
        message: errorMessage,
        expired: tokenResult.expired || false,
      });
    }

    // Find and update user
    const user = await User.findOne({
      where: {
        id: tokenResult.userId,
        email: tokenResult.email,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified",
        alreadyVerified: true,
      });
    }

    // Mark email as verified
    await user.update({ emailVerified: true });

    res.json({
      success: true,
      message: "Email verified successfully! You can now access all features.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 * @access Private (requires authentication)
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate verification token
    const verificationToken = generateVerificationToken(user.id, user.email);

    // Send verification email
    await emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.fullName
    );

    res.json({
      success: true,
      message: "Verification email sent successfully. Please check your email.",
    });
  } catch (error) {
    console.error("Resend verification email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
    });
  }
};

const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ["id", "twoFactorEnabled", "twoFactorSecret"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        hasTwoFactorSecret: !!user.twoFactorSecret,
      },
    });
  } catch (error) {
    console.error("Get 2FA status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve 2FA status",
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
  handleAppleCallback,
  completeAppleSignup,
  linkAppleAccount,
  setPassword,
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
  verifyTwoFactorCode,
  enableTwoFactor,
  disableTwoFactor,
  get2FAStatus,
};
