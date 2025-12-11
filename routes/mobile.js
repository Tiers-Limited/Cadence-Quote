// routes/mobile.js
/**
 * Parent Mobile Router
 * Base path: /api/v1/mbl
 * 
 * Sub-routes:
 * - /auth - Mobile authentication (signup, signin, OAuth, password reset)
 * - /quote - Mobile quote builder (products, pricing, booking)
 */

const express = require('express');
const router = express.Router();

// Import sub-routers
const mobileAuthRouter = require('./mobileAuth');
const mobileQuoteRouter = require('./mobileQuote');

// Mount sub-routes
router.use('/auth', mobileAuthRouter);
router.use('/quote', mobileQuoteRouter);

// Health check for mobile API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Mobile API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/mbl/auth',
      quote: '/api/v1/mbl/quote'
    }
  });
});

module.exports = router;
