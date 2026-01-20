// services/pdfService.js
// OPTIMIZED: Generates PDF buffers from HTML using Puppeteer with browser pooling and caching

const puppeteer = require('puppeteer');

/**
 * PDF Service with browser pooling for better performance
 * OPTIMIZATION: Reuses browser instances to avoid expensive launch/close cycles
 */
class PDFService {
  constructor() {
    this.browserPool = [];
    this.maxPoolSize = 3;
    this.browserTimeout = 30000; // 30 seconds
    this.isShuttingDown = false;
    
    // Cleanup on process exit
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  /**
   * Get or create a browser instance
   */
  async getBrowser() {
    // Try to get an existing browser from pool
    if (this.browserPool.length > 0) {
      const browser = this.browserPool.pop();
      
      // Check if browser is still connected
      try {
        if (browser.isConnected()) {
          return browser;
        }
      } catch (error) {
        console.warn('PDF Service: Browser in pool was disconnected, creating new one');
      }
    }
    
    // Create new browser if pool is empty or browser was disconnected
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-gpu',
          '--no-first-run',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-domain-reliability',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--disable-sync'
        ],
        timeout: 90000, // Increase timeout for Windows
        protocolTimeout: 90000,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        ignoreDefaultArgs: ['--disable-extensions'],
        dumpio: false, // Disable dumping browser process stdout/stderr
      });
      
      // Set timeout for browser cleanup
      setTimeout(() => {
        this.returnBrowser(browser);
      }, this.browserTimeout);
      
      return browser;
    } catch (launchErr) {
      console.error('PDF Service: puppeteer.launch failed:', launchErr.message);
      throw launchErr;
    }
  }
  
  /**
   * Return browser to pool or close if pool is full
   */
  async returnBrowser(browser) {
    if (this.isShuttingDown) {
      try {
        await browser.close();
      } catch (error) {
        console.warn('PDF Service: Error closing browser during shutdown:', error.message);
      }
      return;
    }
    
    try {
      if (browser.isConnected() && this.browserPool.length < this.maxPoolSize) {
        this.browserPool.push(browser);
      } else {
        await browser.close();
      }
    } catch (error) {
      console.warn('PDF Service: Error returning browser to pool:', error.message);
    }
  }
  
  /**
   * Generate PDF from HTML with optimizations and retry logic
   */
  async htmlToPdfBuffer(html, options = {}) {
    const maxRetries = 3; // Increase retries
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this._generatePdfAttempt(html, options);
      } catch (error) {
        lastError = error;
        console.warn(`PDF Service: Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        // Clear browser pool on error to force fresh browser creation
        if (error.message.includes('Target closed') || error.message.includes('Protocol error')) {
          console.log('PDF Service: Clearing browser pool due to protocol error');
          await this._clearBrowserPool();
        }
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Clear all browsers from pool
   */
  async _clearBrowserPool() {
    const browsers = [...this.browserPool];
    this.browserPool = [];
    
    await Promise.all(browsers.map(async (browser) => {
      try {
        if (browser.isConnected()) {
          await browser.close();
        }
      } catch (error) {
        console.warn('PDF Service: Error closing browser during pool clear:', error.message);
      }
    }));
  }
  
  /**
   * Single PDF generation attempt
   */
  async _generatePdfAttempt(html, options = {}) {
    let browser;
    let page;
    let shouldReturnBrowser = true;
    
    try {
      browser = await this.getBrowser();
      page = await browser.newPage();
      
      try {
        // Set longer timeout for page operations
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
        
        // OPTIMIZATION: Set viewport for consistent rendering
        await page.setViewport({ width: 1200, height: 800 });
        
        // OPTIMIZATION: Disable images and CSS if not needed for faster rendering
        if (options.disableImages) {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            if (req.resourceType() === 'image') {
              req.abort();
            } else {
              req.continue();
            }
          });
        } else {
          // Enable request interception to handle image loading issues
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            // Allow all requests but add headers for better compatibility
            req.continue({
              headers: {
                ...req.headers(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
              }
            });
          });
        }
        
        const waitUntil = options.waitUntil || 'networkidle0'; // Wait for network to be idle to ensure images load
        await page.setContent(html, { waitUntil, timeout: 30000 }); // Increase timeout for image loading
        
        // Wait for images to load
        try {
          await page.waitForFunction(() => {
            const images = Array.from(document.images);
            return images.every(img => img.complete);
          }, { timeout: 10000 });
        } catch (imageWaitErr) {
          console.warn('PDF Service: Image loading timeout, continuing:', imageWaitErr.message);
        }
        
        // OPTIMIZATION: Wait for fonts to load if specified
        if (options.waitForFonts) {
          try {
            await page.evaluateHandle('document.fonts.ready');
          } catch (fontErr) {
            console.warn('PDF Service: Font loading failed, continuing:', fontErr.message);
          }
        }
        
      } catch (setContentErr) {
        console.error('PDF Service: page.setContent failed:', setContentErr.message);
        // Capture small snippet for debugging
        console.error('PDF Service: HTML snippet:', typeof html === 'string' ? html.substring(0, 500) : String(html));
        throw setContentErr;
      }

      try {
        let pdf = await page.pdf({
          format: 'A4',
          margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
          printBackground: true,
          timeout: 45000, // Increase timeout to 45 seconds
          preferCSSPageSize: false,
          ...options,
        });

        // Coerce ArrayBuffer / TypedArray -> Buffer
        const ctorName = pdf && pdf.constructor ? pdf.constructor.name : typeof pdf;
        const length = pdf && pdf.length ? pdf.length : null;
        if (!pdf || !Buffer.isBuffer(pdf)) {
          try {
            if (pdf && (pdf instanceof Uint8Array || pdf.buffer instanceof ArrayBuffer)) {
              pdf = Buffer.from(pdf);
              console.warn('PDF Service: coerced PDF from', ctorName, 'length', length);
            } else if (pdf && typeof pdf === 'object' && pdf.constructor && pdf.constructor.name === 'Uint8Array') {
              // Handle Puppeteer's Uint8Array response
              pdf = Buffer.from(pdf);
              console.warn('PDF Service: converted Uint8Array to Buffer, length', length);
            } else {
              console.error('PDF Service: Unknown PDF type:', ctorName, 'length:', length);
              pdf = Buffer.from(pdf || []);
            }
          } catch (coerceErr) {
            console.error('PDF Service: failed to coerce PDF to Buffer:', coerceErr && coerceErr.message);
            throw new Error('Failed to convert PDF to Buffer');
          }
        }

        if (!pdf || !Buffer.isBuffer(pdf)) {
          console.error('PDF Service: page.pdf returned invalid result', { ctorName, length });
          throw new Error('page.pdf returned invalid result');
        }

        // Close the page to free memory
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (closeErr) {
          console.debug('PDF Service: Page close warning (can be ignored):', closeErr.message);
        }
        
        return pdf;
      } catch (pdfErr) {
        console.error('PDF Service: page.pdf failed:', pdfErr.message);
        shouldReturnBrowser = false; // Don't return potentially corrupted browser
        throw pdfErr;
      }
    } catch (error) {
      shouldReturnBrowser = false; // Don't return browser on error
      throw error;
    } finally {
      // Always try to close the page if it exists
      if (page) {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (closeErr) {
          // Ignore errors when closing page - it might already be closed
          console.debug('PDF Service: Page close warning (can be ignored):', closeErr.message);
        }
      }
      
      if (browser && shouldReturnBrowser) {
        await this.returnBrowser(browser);
      } else if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn('PDF Service: Error closing browser after error:', closeError.message);
        }
      }
    }
  }
  
  /**
   * Shutdown PDF service and close all browsers
   */
  async shutdown() {
    this.isShuttingDown = true;
    console.log('PDF Service: Shutting down...');
    
    const closePromises = this.browserPool.map(async (browser) => {
      try {
        await browser.close();
      } catch (error) {
        console.warn('PDF Service: Error closing browser during shutdown:', error.message);
      }
    });
    
    await Promise.all(closePromises);
    this.browserPool = [];
    console.log('PDF Service: Shutdown complete');
  }
  
  /**
   * Get service health information
   */
  getHealth() {
    return {
      poolSize: this.browserPool.length,
      maxPoolSize: this.maxPoolSize,
      isShuttingDown: this.isShuttingDown,
      connectedBrowsers: this.browserPool.filter(browser => {
        try {
          return browser.isConnected();
        } catch {
          return false;
        }
      }).length
    };
  }
}

// Create singleton instance
const pdfService = new PDFService();

// Export both the service instance and the legacy function for backward compatibility
module.exports = { 
  htmlToPdfBuffer: (html, options) => pdfService.htmlToPdfBuffer(html, options),
  PDFService: pdfService
};
