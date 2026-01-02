// routes/clientAuth.js
const express = require('express');
const router = express.Router();
const clientAuthController = require('../controllers/clientAuthController');
const { auth, authorize } = require('../middleware/auth');

// Public routes - No authentication required
router.post('/login', clientAuthController.clientLogin);
router.post('/set-password', clientAuthController.setPassword);
router.post('/forgot-password', clientAuthController.forgotPassword);
router.post('/reset-password', clientAuthController.resetPassword);
router.get('/validate-reset-token', clientAuthController.validateResetToken);

// Protected routes - Contractor only
router.post('/invite', auth, authorize(['contractor_admin', 'business_admin']), clientAuthController.inviteClient);
router.post('/resend-invitation', auth, authorize(['contractor_admin', 'business_admin']), clientAuthController.resendInvitation);

module.exports = router;
