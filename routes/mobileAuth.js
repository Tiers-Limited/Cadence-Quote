// routes/mobileAuth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
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
} = require('../controllers/mobileAuthController');

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour from same IP
  message: {
    success: false,
    message: 'Too many signup attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   POST /api/mobile/auth/signup
 * @desc    Request verification code for new mobile user registration
 * @access  Public
 */
router.post('/signup', signupLimiter, mobileSignup);

/**
 * @route   POST /api/mobile/auth/verify-signup
 * @desc    Verify code and complete registration
 * @access  Public
 */
router.post('/verify-signup', authLimiter, mobileVerifySignup);

/**
 * @route   POST /api/mobile/auth/resend-signup-code
 * @desc    Resend verification code for signup
 * @access  Public
 */
router.post('/resend-signup-code', signupLimiter, mobileResendSignupCode);

/**
 * @route   POST /api/mobile/auth/signin
 * @desc    Login mobile user
 * @access  Public
 */
router.post('/signin', authLimiter, mobileSignin);

/**
 * @route   POST /api/mobile/auth/google
 * @desc    Google Sign In for mobile
 * @access  Public
 */
router.post('/google', authLimiter, mobileGoogleSignIn);

/**
 * @route   POST /api/mobile/auth/apple
 * @desc    Apple Sign In for mobile
 * @access  Public
 */
router.post('/apple', authLimiter, mobileAppleSignIn);

/**
 * @route   POST /api/mobile/auth/forgot-password
 * @desc    Request verification code for password reset
 * @access  Public
 */
router.post('/forgot-password', passwordResetLimiter, mobileForgotPassword);

/**
 * @route   POST /api/mobile/auth/reset-password
 * @desc    Verify code and reset password
 * @access  Public
 */
router.post('/reset-password', authLimiter, mobileResetPassword);

/**
 * @route   POST /api/mobile/auth/resend-reset-code
 * @desc    Resend password reset verification code
 * @access  Public
 */
router.post('/resend-reset-code', passwordResetLimiter, mobileResendResetCode);

/**
 * @route   GET /api/mobile/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email/:token', mobileVerifyEmail);

module.exports = router;
