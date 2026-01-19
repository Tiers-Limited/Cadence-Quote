const cron = require('node-cron');
const MagicLinkService = require('./magicLinkService');
const emailService = require('./emailService');
const MagicLink = require('../models/MagicLink');
const CustomerSession = require('../models/CustomerSession');
const { Op } = require('sequelize');

/**
 * Portal Automation Service
 * Handles scheduled tasks for portal management:
 * - Cleanup of expired data
 * - Expiry notifications
 * - Session maintenance
 */
class PortalAutomationService {
  static initialized = false;

  /**
   * Initialize scheduled jobs
   * Called once on server startup
   */
  static initializeScheduledJobs() {
    if (this.initialized) {
      console.log('Portal automation jobs already initialized');
      return;
    }

    console.log('Initializing portal automation jobs...');

    // Run cleanup every day at 2 AM
    cron.schedule('0 2 * * *', () => {
      console.log('[Portal Automation] Running daily cleanup job');
      this.runDailyCleanup();
    });

    // Send expiry notifications every day at 9 AM
    cron.schedule('0 9 * * *', () => {
      console.log('[Portal Automation] Running expiry notification job');
      this.sendExpiryNotifications();
    });

    // Check for expired sessions and revoke them every 6 hours
    cron.schedule('0 */6 * * *', () => {
      console.log('[Portal Automation] Running expired session check');
      this.revokeExpiredSessions();
    });

    // Cleanup old OTP verifications every 24 hours
    cron.schedule('0 3 * * *', () => {
      console.log('[Portal Automation] Running OTP cleanup');
      this.cleanupOldOtpVerifications();
    });

    this.initialized = true;
    console.log('Portal automation jobs initialized successfully');
  }

  /**
   * Daily cleanup of expired magic links and sessions
   * Runs at 2 AM daily
   */
  static async runDailyCleanup() {
    try {
      const result = await MagicLinkService.cleanupExpiredPortalData();
      
      console.log(`[Portal Cleanup] Deleted ${result.linksDeleted} expired links and ${result.sessionsDeleted} expired sessions`);
      
      // Log cleanup event
      await this.logAutomationEvent('cleanup', {
        linksDeleted: result.linksDeleted,
        sessionsDeleted: result.sessionsDeleted,
        status: 'success',
      });
    } catch (error) {
      console.error('[Portal Cleanup] Error during cleanup:', error);
      
      await this.logAutomationEvent('cleanup', {
        error: error.message,
        status: 'error',
      });
    }
  }

  /**
   * Send expiry notifications to customers
   * Emails sent to customers with links expiring in 3 days
   * Runs at 9 AM daily
   */
  static async sendExpiryNotifications() {
    try {
      // Find magic links expiring in 3 days
      const in3Days = new Date();
      in3Days.setDate(in3Days.getDate() + 3);
      const in4Days = new Date();
      in4Days.setDate(in4Days.getDate() + 4);

      const expiringLinks = await MagicLink.findAll({
        where: {
          expiresAt: { [Op.between]: [in3Days, in4Days] },
          revokedAt: null,
          portalExpiryNotificationSentAt: null,
        },
        include: [
          { model: require('../models/Client'), attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: require('../models/Tenant'), attributes: ['id', 'companyName', 'portalBrandingConfig'] }
        ],
      });

      let notificationsSent = 0;

      for (const link of expiringLinks) {
        try {
          // Send expiry notification email
          await emailService.sendPortalExpiryNotification({
            to: link.email,
            customerName: link.Client?.firstName || 'Valued Customer',
            daysRemaining: 3,
            expiryDate: link.expiresAt,
            tenantBranding: link.Tenant?.portalBrandingConfig,
            portalUrl: process.env.CUSTOMER_PORTAL_URL,
          });

          // Mark notification as sent
          link.portalExpiryNotificationSentAt = new Date();
          await link.save();

          notificationsSent++;
        } catch (emailError) {
          console.error(`[Expiry Notification] Failed to send to ${link.email}:`, emailError);
        }
      }

      console.log(`[Portal Automation] Sent ${notificationsSent} expiry notifications`);

      await this.logAutomationEvent('expiry_notifications', {
        sent: notificationsSent,
        total: expiringLinks.length,
        status: 'success',
      });
    } catch (error) {
      console.error('[Expiry Notification] Error:', error);

      await this.logAutomationEvent('expiry_notifications', {
        error: error.message,
        status: 'error',
      });
    }
  }

  /**
   * Revoke expired sessions automatically
   * Runs every 6 hours
   */
  static async revokeExpiredSessions() {
    try {
      const now = new Date();

      const expiredSessions = await CustomerSession.findAll({
        where: {
          expiresAt: { [Op.lt]: now },
          revokedAt: null,
        },
      });

      for (const session of expiredSessions) {
        await session.revoke();
      }

      console.log(`[Portal Automation] Revoked ${expiredSessions.length} expired sessions`);

      await this.logAutomationEvent('revoke_expired_sessions', {
        revoked: expiredSessions.length,
        status: 'success',
      });
    } catch (error) {
      console.error('[Revoke Sessions] Error:', error);

      await this.logAutomationEvent('revoke_expired_sessions', {
        error: error.message,
        status: 'error',
      });
    }
  }

  /**
   * Cleanup old OTP verifications
   * Deletes OTP records older than 7 days
   * Runs at 3 AM daily
   */
  static async cleanupOldOtpVerifications() {
    try {
      const OTPVerification = require('../models/OTPVerification');
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deleted = await OTPVerification.destroy({
        where: {
          createdAt: { [Op.lt]: sevenDaysAgo },
        }
      });

      console.log(`[Portal Automation] Deleted ${deleted} old OTP records`);

      await this.logAutomationEvent('otp_cleanup', {
        deleted,
        status: 'success',
      });
    } catch (error) {
      console.error('[OTP Cleanup] Error:', error);

      await this.logAutomationEvent('otp_cleanup', {
        error: error.message,
        status: 'error',
      });
    }
  }

  /**
   * Check for suspicious activity and alert admins
   * Look for multiple failed attempts, unusual IP addresses, etc.
   */
  static async checkSuspiciousActivity() {
    try {
      // Count failed magic link validations in last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const failedAttempts = await MagicLink.count({
        where: {
          accessCount: { [Op.gt]: 3 }, // Attempted more than 3 times
          lastAccessedAt: { [Op.gt]: oneHourAgo },
        }
      });

      if (failedAttempts > 10) {
        console.warn('[Portal Security] Suspicious activity detected: ' + failedAttempts + ' failed attempts');

        // Could send admin alert here
        await this.logAutomationEvent('suspicious_activity', {
          failedAttempts,
          status: 'warning',
        });
      }
    } catch (error) {
      console.error('[Security Check] Error:', error);
    }
  }

  /**
   * Log automation events for audit trail
   */
  static async logAutomationEvent(eventType, data) {
    try {
      // This would typically be stored in a database table
      // For now, we'll just log to console
      console.log(`[Automation Event] ${eventType}:`, JSON.stringify(data));

      // Optional: Send to monitoring service like Sentry
      // Sentry.captureMessage(`Portal automation: ${eventType}`, 'info', { extra: data });
    } catch (error) {
      console.error('[Log Event] Error logging automation event:', error);
    }
  }

  /**
   * Manually trigger cleanup (admin action)
   */
  static async triggerCleanupManual(tenantId = null) {
    try {
      return await MagicLinkService.cleanupExpiredPortalData(tenantId);
    } catch (error) {
      console.error('[Manual Cleanup] Error:', error);
      throw error;
    }
  }

  /**
   * Get automation job status
   */
  static getAutomationStatus() {
    return {
      initialized: this.initialized,
      jobs: [
        {
          name: 'Daily Cleanup',
          schedule: '0 2 * * *',
          description: 'Delete expired magic links and sessions',
          lastRun: 'Not available in this version',
        },
        {
          name: 'Expiry Notifications',
          schedule: '0 9 * * *',
          description: 'Send expiry warning emails',
          lastRun: 'Not available in this version',
        },
        {
          name: 'Revoke Expired Sessions',
          schedule: '0 */6 * * *',
          description: 'Automatically revoke expired sessions',
          lastRun: 'Not available in this version',
        },
        {
          name: 'OTP Cleanup',
          schedule: '0 3 * * *',
          description: 'Delete old OTP verification records',
          lastRun: 'Not available in this version',
        },
      ]
    };
  }
}

module.exports = PortalAutomationService;
