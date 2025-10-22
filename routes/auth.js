// routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const { 
  register, 
  login, 
  getProfile, 
  registerWithPayment,
  handleGoogleCallback,
  completeGoogleSignup,
  linkGoogleAccount,
  setPassword,
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
  verifyTwoFactorCode,
  enableTwoFactor,
  disableTwoFactor,
  get2FAStatus
} = require('../controllers/authController');
const { auth, refreshAccessToken } = require('../middleware/auth');

// Initialize passport
require('../config/passport')(passport);

/**
 * @route   POST /api/auth/register-with-payment
 * @desc    Register new tenant and initiate payment in one flow
 * @access  Public
 */
router.post('/register', registerWithPayment);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token or 2FA prompt
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/verify-2fa
 * @desc    Verify 2FA code
 * @access  Public
 */
router.post('/verify-2fa', verifyTwoFactorCode);

/**
 * @route   POST /api/auth/enable-2fa
 * @desc    Enable 2FA for user
 * @access  Private
 */
router.post('/enable-2fa', auth, enableTwoFactor);

/**
 * @route   POST /api/auth/disable-2fa
 * @desc    Disable 2FA for user
 * @access  Private
 */
router.post('/disable-2fa', auth, disableTwoFactor);


/**
 * @route   GET /api/auth/2fa-status
 * @desc    Get 2FA status for the authenticated user
 * @access  Private
 */
router.get('/2fa-status', auth, get2FAStatus);


/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', refreshAccessToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', auth, getProfile);

/**
 * @route   GET /api/auth/google/url
 * @desc    Get Google OAuth URL with query parameters
 * @access  Public
 */
router.get('/google/url', (req, res) => {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001';
  const authUrl = `${BACKEND_URL}/api/v1/auth/google?${new URLSearchParams(req.query).toString()}`;
  res.json({ url: authUrl });
});

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth
 * @access  Public
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`
  }),
  handleGoogleCallback
);

/**
 * @route   POST /api/auth/google/complete-signup
 * @desc    Complete Google OAuth signup with company details
 * @access  Public
 */
router.post('/google/complete-signup', completeGoogleSignup);

/**
 * @route   POST /api/auth/google/link
 * @desc    Link Google account to existing user
 * @access  Private
 */
router.post('/google/link', auth, linkGoogleAccount);

/**
 * @route   POST /api/auth/set-password
 * @desc    Set password for Google-only accounts
 * @access  Private
 */
router.post('/set-password', auth, setPassword);

/**
 * @route   POST /api/auth/send-verification
 * @desc    Send email verification link
 * @access  Private
 */
router.post('/send-verification', auth, sendVerificationEmail);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.get('/verify-email', verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post('/resend-verification', auth, resendVerificationEmail);

module.exports = router;