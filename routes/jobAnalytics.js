/**
 * Job Analytics Routes
 * 
 * Provides secure API endpoints for job analytics functionality.
 * All routes require authentication and tenant-based data isolation.
 */

const express = require('express');
const router = express.Router();
const JobAnalyticsController = require('../controllers/JobAnalyticsController');
const { auth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');

// Apply authentication and tenant resolution to all routes
router.use(auth);
router.use(resolveTenant);

/**
 * GET /api/job-analytics/tenant/summary
 * Get analytics summary for all completed jobs in tenant
 * 
 * Security: Requires authentication, tenant-scoped data
 * Returns: Aggregated analytics data and averages
 */
router.get('/tenant/summary', JobAnalyticsController.getTenantAnalyticsSummary);

/**
 * GET /api/job-analytics/completed-jobs
 * Get all completed jobs with their analytics status
 * 
 * Security: Requires authentication, tenant-scoped data
 * Returns: List of completed jobs with analytics data
 */
router.get('/completed-jobs', JobAnalyticsController.getCompletedJobs);

/**
 * GET /api/job-analytics/:quoteId
 * Retrieve job analytics for a specific quote
 * 
 * Security: Requires authentication, validates quote belongs to user's tenant
 * Returns: Analytics breakdown with cost allocation and industry comparison
 */
router.get('/:quoteId', JobAnalyticsController.getJobAnalytics);

/**
 * POST /api/job-analytics/:quoteId/calculate
 * Calculate and store job analytics with actual cost data
 * 
 * Security: Requires authentication, validates quote belongs to user's tenant
 * Body: { jobPrice, actualMaterialCost?, actualLaborCost? }
 * Returns: Calculated analytics breakdown
 */
router.post('/:quoteId/calculate', JobAnalyticsController.calculateAnalytics);

module.exports = router;