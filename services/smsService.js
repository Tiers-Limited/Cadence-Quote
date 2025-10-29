// services/smsService.js
/**
 * SMS Notification Service
 * Handles sending SMS confirmations and notifications via Twilio
 */

class SmsService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client
   */
  initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken && this.fromNumber) {
      try {
        const twilio = require('twilio');
        this.client = twilio(accountSid, authToken);
        console.log('SMS service initialized with Twilio');
      } catch (error) {
        console.warn('Twilio not installed. Run: npm install twilio');
      }
    } else {
      console.warn('SMS service not initialized: Missing Twilio credentials');
    }
  }

  /**
   * Check if SMS service is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.client !== null && this.fromNumber !== null;
  }

  /**
   * Format phone number for Twilio (E.164 format)
   * @param {string} phone - Phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it doesn't start with country code, add US country code
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // Already has + or is international
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  }

  /**
   * Send confirmation SMS to lead
   * @param {Object} params
   * @param {string} params.to - Lead's phone number
   * @param {string} params.leadName - Lead's name
   * @param {number} params.ballparkQuote - Quote amount (optional)
   * @param {Object} params.quoteRange - Quote range (optional)
   * @returns {Promise<Object>}
   */
  async sendLeadConfirmation({ to, leadName, ballparkQuote, quoteRange }) {
    if (!this.isConfigured()) {
      console.warn('SMS service not configured, skipping confirmation SMS');
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      let messageBody = `Hi ${leadName}! Thank you for your painting project request. `;
      
      if (ballparkQuote && quoteRange) {
        messageBody += `Your estimated cost is $${quoteRange.low.toLocaleString()}-$${quoteRange.high.toLocaleString()}. `;
      }
      
      messageBody += `We'll contact you within 15 minutes. Reply STOP to opt out.`;

      const message = await this.client.messages.create({
        body: messageBody,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log('SMS confirmation sent:', message.sid);
      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      console.error('Error sending SMS confirmation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send internal notification SMS to team
   * @param {Object} params
   * @param {string|string[]} params.to - Team phone number(s)
   * @param {Object} params.lead - Lead data
   * @returns {Promise<Object>}
   */
  async sendInternalNotification({ to, lead }) {
    if (!this.isConfigured()) {
      console.warn('SMS service not configured, skipping internal SMS');
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const recipients = Array.isArray(to) ? to : [to];
      const results = [];

      const messageBody = `🚨 NEW LEAD: ${lead.firstName} ${lead.lastName}\n` +
        `Phone: ${lead.phone}\n` +
        `Email: ${lead.email}\n` +
        `Project: ${lead.projectType || 'General'}\n` +
        `Zip: ${lead.zipCode || 'N/A'}\n` +
        (lead.ballparkQuote ? `Quote: $${Number.parseFloat(lead.ballparkQuote).toLocaleString()}\n` : '') +
        `⏰ Contact within 15 mins!\n` +
        `View details in dashboard.`;

      for (const phone of recipients) {
        try {
          const formattedPhone = this.formatPhoneNumber(phone);
          
          const message = await this.client.messages.create({
            body: messageBody,
            from: this.fromNumber,
            to: formattedPhone
          });

          results.push({
            phone,
            success: true,
            messageSid: message.sid
          });
        } catch (error) {
          console.error(`Failed to send SMS to ${phone}:`, error);
          results.push({
            phone,
            success: false,
            error: error.message
          });
        }
      }

      console.log('Internal SMS notifications sent:', results.length);
      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('Error sending internal SMS notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send follow-up reminder SMS
   * @param {Object} params
   * @param {string|string[]} params.to - Team phone number(s)
   * @param {Object} params.lead - Lead data
   * @returns {Promise<Object>}
   */
  async sendFollowUpReminder({ to, lead }) {
    if (!this.isConfigured()) {
      console.warn('SMS service not configured, skipping reminder SMS');
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const recipients = Array.isArray(to) ? to : [to];
      const results = [];

      const messageBody = `⚠️ REMINDER: Lead ${lead.firstName} ${lead.lastName} has been waiting 30+ minutes.\n` +
        `Phone: ${lead.phone}\n` +
        `Project: ${lead.projectType || 'General'}\n` +
        `Please follow up immediately!`;

      for (const phone of recipients) {
        try {
          const formattedPhone = this.formatPhoneNumber(phone);
          
          const message = await this.client.messages.create({
            body: messageBody,
            from: this.fromNumber,
            to: formattedPhone
          });

          results.push({
            phone,
            success: true,
            messageSid: message.sid
          });
        } catch (error) {
          console.error(`Failed to send reminder SMS to ${phone}:`, error);
          results.push({
            phone,
            success: false,
            error: error.message
          });
        }
      }

      console.log('Follow-up reminder SMS sent:', results.length);
      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('Error sending reminder SMS:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send custom SMS
   * @param {Object} params
   * @param {string} params.to - Recipient phone number
   * @param {string} params.message - SMS message body
   * @returns {Promise<Object>}
   */
  async sendCustomSms({ to, message: messageBody }) {
    if (!this.isConfigured()) {
      console.warn('SMS service not configured');
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const message = await this.client.messages.create({
        body: messageBody,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log('Custom SMS sent:', message.sid);
      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      console.error('Error sending custom SMS:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SmsService();
