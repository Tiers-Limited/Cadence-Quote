// routes/jobs.js
// Routes for job management (created from accepted quotes after deposit payment)

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// All routes require authentication and contractor role
router.use(auth);
router.use(requireRole('contractor_admin'));

/**
 * GET /api/jobs
 * Get all jobs for contractor with filtering and pagination
 * Query params: status, page, limit, sortBy, sortOrder, search
 */
router.get('/', jobController.getAllJobs);

/**
 * GET /api/jobs/stats
 * Get job statistics for dashboard
 */
router.get('/stats', jobController.getJobStats);

/**
 * GET /api/jobs/calendar
 * Get job calendar events
 * Query params: startDate, endDate
 */
router.get('/calendar', jobController.getJobCalendar);

/**
 * GET /api/jobs/:jobId
 * Get single job by ID with full details
 */
router.get('/:jobId', jobController.getJobById);

/**
 * PATCH /api/jobs/:jobId/schedule
 * Update job scheduling (start date, end date, crew assignment)
 * Body: { scheduledStartDate, scheduledEndDate, estimatedDuration, assignedCrewMembers, crewNotes }
 */
router.patch('/:jobId/schedule', jobController.updateJobSchedule);

/**
 * Approve customer selections (contractor action)
 */
router.patch('/:jobId/approve-selections', jobController.approveSelections);

/**
 * Toggle job visibility in customer portal
 */
router.patch('/:jobId/visibility', jobController.setJobVisibility);

/**
 * PATCH /api/jobs/:jobId/status
 * Update job status (in_progress, completed, etc.)
 * Body: { status, notes }
 */
router.patch('/:jobId/status', jobController.updateJobStatus);

/**
 * POST /api/jobs/:jobId/area-progress
 * Update progress for specific area
 * Body: { areaId, status } where status is: not_started, prepped, in_progress, touch_ups, completed
 */
router.post('/:jobId/area-progress', jobController.updateAreaProgress);

/**
 * POST /api/jobs/:jobId/lost-reason
 * Record lost job intelligence (for declined/expired quotes only)
 * Body: { lostReason, lostReasonDetails }
 */
router.post('/:jobId/lost-reason', jobController.recordLostJobReason);

/**
 * GET /api/jobs/:jobId/documents
 * Get job documents (material list, paint order, work order)
 * Only available after quote acceptance and deposit payment
 */
router.get('/:jobId/documents', jobController.getJobDocuments);

/**
 * POST /api/jobs/:jobId/documents/generate
 * Trigger job document generation
 * Called after quote acceptance and deposit payment
 */
router.post('/:jobId/documents/generate', jobController.generateJobDocuments);

/**
 * GET /api/jobs/:jobId/documents/:documentType
 * Download a specific job document
 * documentType: material-list, paint-order, work-order
 */
router.get('/:jobId/documents/:documentType', jobController.downloadJobDocument);

module.exports = router;
