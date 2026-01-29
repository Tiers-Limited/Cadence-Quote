// services/jobAnalyticsService.js
// Job Analytics Service for tracking pricing calculations and quote metrics
// **Feature: cadence-quote-builder-update, Task 6.4**
// **Validates: Requirements 5.2**

/**
 * Job Analytics Service
 * Handles recording and tracking of pricing calculations for analytics purposes
 */
class JobAnalyticsService {
  constructor() {
    this.isEnabled = process.env.JOB_ANALYTICS_ENABLED === 'true';
    this.apiEndpoint = process.env.JOB_ANALYTICS_API_ENDPOINT || 'https://analytics.cadence.com/api';
    this.apiKey = process.env.JOB_ANALYTICS_API_KEY;
    this.retryAttempts = 3;
    this.timeout = 5000; // 5 seconds
  }

  /**
   * Record a pricing calculation for analytics
   * @param {object} calculationData - Pricing calculation data
   * @returns {Promise<boolean>} - Success status
   */
  async recordPricingCalculation(calculationData) {
    if (!this.isEnabled) {
      console.log('Job Analytics is disabled, skipping calculation recording');
      return true;
    }

    try {
      const analyticsPayload = this.formatCalculationData(calculationData);
      const success = await this.sendToAnalytics('pricing-calculation', analyticsPayload);
      
      if (success) {
        console.log('Pricing calculation recorded to Job Analytics');
      } else {
        console.warn('Failed to record pricing calculation to Job Analytics');
      }
      
      return success;
    } catch (error) {
      console.error('Error recording pricing calculation:', error.message);
      // Don't throw error - analytics failures shouldn't break the main flow
      return false;
    }
  }

  /**
   * Record final quote prices for analytics
   * @param {object} quoteData - Final quote data
   * @returns {Promise<boolean>} - Success status
   */
  async recordQuotePrices(quoteData) {
    if (!this.isEnabled) {
      console.log('Job Analytics is disabled, skipping quote recording');
      return true;
    }

    try {
      const analyticsPayload = this.formatQuoteData(quoteData);
      const success = await this.sendToAnalytics('quote-finalized', analyticsPayload);
      
      if (success) {
        console.log('Quote prices recorded to Job Analytics');
      } else {
        console.warn('Failed to record quote prices to Job Analytics');
      }
      
      return success;
    } catch (error) {
      console.error('Error recording quote prices:', error.message);
      // Don't throw error - analytics failures shouldn't break the main flow
      return false;
    }
  }

  /**
   * Format calculation data for analytics
   * @param {object} calculationData - Raw calculation data
   * @returns {object} - Formatted analytics payload
   */
  formatCalculationData(calculationData) {
    const {
      model,
      total,
      laborCost,
      materialCost,
      totalSqft,
      totalHours,
      gallons,
      tenantId,
      userId,
      quoteId,
      timestamp = new Date().toISOString()
    } = calculationData;

    return {
      eventType: 'pricing-calculation',
      timestamp,
      tenantId,
      userId,
      quoteId,
      pricingModel: model,
      metrics: {
        totalCost: this.safeNumber(total),
        laborCost: this.safeNumber(laborCost),
        materialCost: this.safeNumber(materialCost),
        totalSqft: this.safeNumber(totalSqft),
        totalHours: this.safeNumber(totalHours),
        gallonsRequired: this.safeNumber(gallons),
        costPerSqft: totalSqft > 0 ? this.safeNumber(total / totalSqft) : 0,
        laborPercentage: total > 0 ? this.safeNumber((laborCost / total) * 100) : 0,
        materialPercentage: total > 0 ? this.safeNumber((materialCost / total) * 100) : 0
      }
    };
  }

  /**
   * Format quote data for analytics
   * @param {object} quoteData - Raw quote data
   * @returns {object} - Formatted analytics payload
   */
  formatQuoteData(quoteData) {
    const {
      quoteId,
      tenantId,
      userId,
      customerId,
      total,
      subtotal,
      tax,
      deposit,
      balance,
      pricingModel,
      status,
      createdAt,
      timestamp = new Date().toISOString()
    } = quoteData;

    return {
      eventType: 'quote-finalized',
      timestamp,
      tenantId,
      userId,
      customerId,
      quoteId,
      pricingModel,
      status,
      createdAt,
      pricing: {
        total: this.safeNumber(total),
        subtotal: this.safeNumber(subtotal),
        tax: this.safeNumber(tax),
        deposit: this.safeNumber(deposit),
        balance: this.safeNumber(balance),
        taxPercentage: subtotal > 0 ? this.safeNumber((tax / subtotal) * 100) : 0,
        depositPercentage: total > 0 ? this.safeNumber((deposit / total) * 100) : 0
      }
    };
  }

  /**
   * Send data to analytics API with retry logic
   * @param {string} eventType - Type of analytics event
   * @param {object} payload - Data payload
   * @returns {Promise<boolean>} - Success status
   */
  async sendToAnalytics(eventType, payload) {
    if (!this.apiKey) {
      console.warn('Job Analytics API key not configured');
      return false;
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.makeApiRequest(eventType, payload);
        
        if (response.ok) {
          return true;
        } else {
          console.warn(`Job Analytics API returned ${response.status}: ${response.statusText}`);
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            return false;
          }
        }
      } catch (error) {
        console.warn(`Job Analytics API attempt ${attempt} failed:`, error.message);
        
        // If this is the last attempt, return false
        if (attempt === this.retryAttempts) {
          return false;
        }
        
        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    return false;
  }

  /**
   * Make HTTP request to analytics API
   * @param {string} eventType - Type of analytics event
   * @param {object} payload - Data payload
   * @returns {Promise<Response>} - Fetch response
   */
  async makeApiRequest(eventType, payload) {
    const url = `${this.apiEndpoint}/events/${eventType}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'Cadence-Backend/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Safely convert value to number
   * @param {any} value - Value to convert
   * @returns {number} - Safe numeric value
   */
  safeNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test analytics connection
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const testPayload = {
        eventType: 'connection-test',
        timestamp: new Date().toISOString(),
        source: 'cadence-backend'
      };

      const success = await this.sendToAnalytics('connection-test', testPayload);
      return success;
    } catch (error) {
      console.error('Analytics connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get analytics configuration status
   * @returns {object} - Configuration status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      hasApiKey: !!this.apiKey,
      apiEndpoint: this.apiEndpoint,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts
    };
  }
}

// Create singleton instance
const jobAnalyticsService = new JobAnalyticsService();

module.exports = jobAnalyticsService;