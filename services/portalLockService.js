const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Quote = require('../models/Quote');
const Job = require('../models/Job');
const User = require('../models/User');
const { createAuditLog } = require('../controllers/auditLogController');
const emailService = require('../services/emailService');

async function lockExpiredPortals({ dryRun = false } = {}) {
  const now = new Date();
  const results = { checked: 0, locked: 0, jobsFlagged: 0, errors: [] };

  const quotes = await Quote.findAll({
    where: {
      portalOpen: true,
      portalClosedAt: { [Op.lte]: now }
    }
  });

  results.checked = quotes.length;

  for (const quote of quotes) {
    const t = await sequelize.transaction();
    try {
      // mark portal closed on quote
      if (!dryRun) {
        await quote.update({ portalOpen: false, portalClosedAt: quote.portalClosedAt || now }, { transaction: t });
      }

      // find related job (if any)
      const job = await Job.findOne({ where: { quoteId: quote.id }, transaction: t });

      if (job) {
        // Only flag if customer selections are not complete
        if (!job.customerSelectionsComplete) {
          // Only transition statuses that are awaiting customer action
          const actionableStatuses = ['deposit_paid', 'selections_pending'];
          if (actionableStatuses.includes(job.status)) {
            if (!dryRun) {
              await job.update({ status: 'on_hold', contractorNotes: (job.contractorNotes || '') + '\n[Auto] Portal expired - awaiting customer selections' }, { transaction: t });
            }
            results.jobsFlagged += 1;
          }
        }
      }

      if (!dryRun) await createAuditLog({
        category: 'system',
        action: 'portal_locked',
        userId: null,
        tenantId: quote.tenantId,
        entityType: 'Quote',
        entityId: quote.id,
        metadata: { quoteNumber: quote.quoteNumber, portalClosedAt: quote.portalClosedAt },
      });

      // notify contractor
      try {
        const contractor = await User.findOne({ where: { tenantId: quote.tenantId, isActive: true } });
        if (contractor && contractor.email && !dryRun) {
          // Use generic internal notification for now
          await emailService.sendInternalNotification({
            to: contractor.email,
            lead: { firstName: contractor.firstName || contractor.name || 'Contractor', lastName: '' },
            form: { message: `Portal expired for proposal ${quote.quoteNumber} (customer: ${quote.customerName}). Selections incomplete.` }
          });
        }
      } catch (notifyErr) {
        console.error('Portal lock notify error', notifyErr);
      }

      if (!dryRun) await t.commit();
      results.locked += 1;
    } catch (err) {
      await t.rollback();
      results.errors.push({ quoteId: quote.id, error: err.message });
      console.error('Failed to lock portal for quote', quote.id, err);
    }
  }

  return results;
}

module.exports = { lockExpiredPortals };
