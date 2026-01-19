// routes/jobScheduling.js
// Routes for job scheduling and management

const express = require('express');
const router = express.Router();
const jobSchedulingController = require('../controllers/jobSchedulingController');
const { auth, authorize } = require('../middleware/auth');
const { customerSessionAuth } = require('../middleware/customerSessionAuth');

// ============================================================================
// CONTRACTOR ROUTES (Require contractor authentication)
// ============================================================================

// Schedule a job
router.post(
  '/:id/schedule',
  auth,
  authorize(['contractor_admin', 'contractor_user']),
  jobSchedulingController.scheduleJob
);

// Reschedule a job
router.put(
  '/:id/reschedule',
  auth,
  authorize(['contractor_admin', 'contractor_user']),
  jobSchedulingController.rescheduleJob
);

// Update job status
router.put(
  '/:id/status',
  auth,
  authorize(['contractor_admin', 'contractor_user']),
  jobSchedulingController.updateJobStatus
);

// Mark job as completed
router.post(
  '/:id/complete',
  auth,
  authorize(['contractor_admin', 'contractor_user']),
  jobSchedulingController.completeJob
);

// ============================================================================
// CUSTOMER ROUTES (Require customer authentication)
// ============================================================================

// Get job details (customer view)
router.get(
  '/:id',
  customerSessionAuth,
  jobSchedulingController.getJobDetails
);

// Create final payment intent
router.post(
  '/:id/create-final-payment',
  customerSessionAuth,
  jobSchedulingController.createFinalPayment
);

// Confirm final payment
router.post(
  '/:id/confirm-final-payment',
  customerSessionAuth,
  jobSchedulingController.confirmFinalPayment
);

module.exports = router;
