/**
 * Portal Automation Initialization
 * Add this to your server startup (app.js or server.js)
 * 
 * Example:
 * const PortalAutomationService = require('./services/portalAutomationService');
 * 
 * // Initialize portal automation jobs
 * PortalAutomationService.initializeScheduledJobs();
 */

// This file shows how to integrate the automation service

// In your main server file (app.js or server.js), add:

/*

// At the top with other imports
const PortalAutomationService = require('./services/portalAutomationService');

// After your database is connected and migrations are run:
// (Typically inside an async startup function or after app.listen())

(async () => {
  try {
    // ... your existing startup code ...
    
    // Initialize portal automation jobs
    PortalAutomationService.initializeScheduledJobs();
    
    console.log('Server startup complete');
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
})();

*/

module.exports = {
  initializePortalAutomation: (app) => {
    const PortalAutomationService = require('./portalAutomationService');
    PortalAutomationService.initializeScheduledJobs();
  }
};
