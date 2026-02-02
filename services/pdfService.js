// services/pdfService.js
// OPTIMIZED: Generates PDF buffers from HTML using html-pdf-node
// Switched from Puppeteer to avoid deployment issues with shared libraries

const htmlPdf = require('html-pdf-node');

/**
 * PDF Service using html-pdf-node
 * Compatible with shared hosting environments (no system dependencies required)
 */
class PDFService {
  constructor() {
    this.isShuttingDown = false;
    
    // Cleanup on process exit
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  /**
   * Generate PDF from HTML with retry logic
   */
  async htmlToPdfBuffer(html, options = {}) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this._generatePdfAttempt(html, options);
      } catch (error) {
        lastError = error;
        console.warn(`PDF Service: Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
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
   * Single PDF generation attempt using html-pdf-node
   */
  async _generatePdfAttempt(html, options = {}) {
    try {
      // Configure html-pdf-node options
      const file = { content: html };
      
      // Default PDF options with A4 format and margins
      const pdfOptions = {
        format: 'A4',
        margin: { 
          top: '16mm', 
          right: '12mm', 
          bottom: '16mm', 
          left: '12mm' 
        },
        printBackground: true,
        preferCSSPageSize: false,
        ...options
      };

      // Launch options for the browser (html-pdf-node uses Puppeteer internally but handles it better)
      const launchOptions = {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process'
        ]
      };

      // Generate PDF
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions, launchOptions);
      
      // Validate the result
      if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        console.error('PDF Service: generatePdf returned invalid result', {
          type: typeof pdfBuffer,
          isBuffer: Buffer.isBuffer(pdfBuffer)
        });
        throw new Error('Invalid PDF buffer returned from generatePdf');
      }

      return pdfBuffer;
      
    } catch (error) {
      console.error('PDF Service: PDF generation failed:', error.message);
      // Log snippet of HTML for debugging (first 500 chars)
      if (typeof html === 'string') {
        console.error('PDF Service: HTML snippet:', html.substring(0, 500));
      }
      throw error;
    }
  }
  
  /**
   * Shutdown PDF service
   */
  async shutdown() {
    this.isShuttingDown = true;
    console.log('PDF Service: Shutting down...');
    // html-pdf-node handles cleanup internally
    console.log('PDF Service: Shutdown complete');
  }
  
  /**
   * Get service health information
   */
  getHealth() {
    return {
      isShuttingDown: this.isShuttingDown,
      library: 'html-pdf-node'
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
