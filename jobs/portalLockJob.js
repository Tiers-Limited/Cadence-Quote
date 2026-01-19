const cron = require('node-cron');
const { lockExpiredPortals } = require('../services/portalLockService');

class PortalLockJob {
  constructor() {
    this.isRunning = false;
    // Default: run once per day at 02:00 AM server time
    this.cronExpression = process.env.PORTAL_LOCK_CRON || '0 2 * * *';
  }

  start() {
    console.log('Starting Portal Lock Job...');
    cron.schedule(this.cronExpression, async () => {
      if (this.isRunning) {
        console.log('Previous portal lock run still executing, skipping this tick');
        return;
      }

      try {
        this.isRunning = true;
        const results = await lockExpiredPortals();
        console.log('Portal Lock Job results:', results);
      } catch (err) {
        console.error('Portal Lock Job error:', err);
      } finally {
        this.isRunning = false;
      }
    });

    console.log(`Portal Lock Job scheduled: ${this.cronExpression}`);
  }

  async runOnce() {
    return lockExpiredPortals();
  }
}

module.exports = new PortalLockJob();
