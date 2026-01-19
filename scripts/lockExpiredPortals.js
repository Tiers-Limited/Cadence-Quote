#!/usr/bin/env node
const { lockExpiredPortals } = require('../services/portalLockService');

(async () => {
  try {
    console.log('Starting portal lock job...');
    const res = await lockExpiredPortals({ dryRun: false });
    console.log('Portal lock job completed:', res);
    process.exit(0);
  } catch (err) {
    console.error('Portal lock job failed:', err);
    process.exit(2);
  }
})();
