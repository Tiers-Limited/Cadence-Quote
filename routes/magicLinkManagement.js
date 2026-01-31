// routes/magicLinkManagement.js
// Contractor-side magic link management routes

const express = require('express');
const router = express.Router();
const magicLinkManagementController = require('../controllers/magicLinkManagementController');
const { auth, authorize } = require('../middleware/auth');

// All routes require contractor authentication
router.use(auth);
router.use(authorize(['contractor_admin', 'contractor_user']));

/**
 * GET /api/v1/cadence-pulse
 * Get all magic links with filtering and pagination
 * Query params: status, search, page, limit
 */
router.get('/', magicLinkManagementController.getMagicLinks);

/**
 * GET /api/v1/cadence-pulse/stats
 * Get magic link statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await magicLinkManagementController.getMagicLinkStats(req.user.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/cadence-pulse/:id
 * Get single magic link details with session history
 */
router.get('/:id', magicLinkManagementController.getMagicLinkDetail);

/**
 * PUT /api/v1/cadence-pulse/:id/extend
 * Extend magic link expiry
 * Body: { days: 7 }
 */
router.put('/:id/extend', magicLinkManagementController.extendMagicLink);

/**
 * POST /api/v1/cadence-pulse/:id/regenerate
 * Regenerate magic link (invalidate old, create new)
 */
router.post('/:id/regenerate', magicLinkManagementController.regenerateMagicLink);

/**
 * DELETE /api/v1/cadence-pulse/:id
 * Deactivate magic link manually
 */
router.delete('/:id', magicLinkManagementController.deactivateMagicLink);

/**
 * POST /api/v1/cadence-pulse/bulk-extend
 * Bulk extend all expiring links
 * Body: { days: 7 }
 */
router.post('/bulk-extend', magicLinkManagementController.bulkExtendLinks);

module.exports = router;
