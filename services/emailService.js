// services/emailService.js
const nodemailer = require('nodemailer')

class EmailService {
  constructor () {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }

  async sendVerificationEmail (email, verificationToken, userName) {
    const verificationUrl = `${
      process.env.FRONTEND_URL || 'http://localhost:5173'
    }/verify-email?token=${verificationToken}`

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email Address - Cadence',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to Cadence!</h1>
            <p>Please verify your email address to get started</p>
          </div>

          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for signing up for Cadence. To complete your registration and start using our platform, please verify your email address.</p>

            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>

            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${verificationUrl}</p>

            <div class="warning">
              <strong>Important:</strong> This verification link will expire in 24 hours for security reasons.
            </div>

            <p>If you didn't create an account with Cadence, please ignore this email.</p>

            <p>Best regards,<br>The Cadence Team</p>
          </div>

          <div class="footer">
            <p>This email was sent to ${email}. If you have any questions, please contact our support team.</p>
            <p>&copy; 2025 Cadence. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${userName}!

        Thank you for signing up for Cadence. To complete your registration and start using our platform, please verify your email address by clicking the link below:

        ${verificationUrl}

        This verification link will expire in 24 hours for security reasons.

        If you didn't create an account with Cadence, please ignore this email.

        Best regards,
        The Cadence Team
      `
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('Verification email sent:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('Error sending verification email:', error)
      throw new Error('Failed to send verification email')
    }
  }

  async sendVerificationReminder (email, userName) {
    const loginUrl = `${
      process.env.FRONTEND_URL || 'http://localhost:5173'
    }/login`

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reminder: Verify Your Email Address - Cadence',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification Reminder</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Email Verification Required</h1>
          </div>

          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>We noticed you haven't verified your email address yet. To access all features of Cadence, please verify your email.</p>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Go to Login & Verify</a>
            </div>

            <p>Once logged in, you'll find the verification option in your dashboard.</p>

            <p>Best regards,<br>The Cadence Team</p>
          </div>

          <div class="footer">
            <p>This email was sent to ${email}.</p>
            <p>&copy; 2025 Cadence. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${userName}!

        We noticed you haven't verified your email address yet. To access all features of Cadence, please verify your email by logging into your account.

        ${loginUrl}

        Once logged in, you'll find the verification option in your dashboard.

        Best regards,
        The Cadence Team
      `
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('Verification reminder email sent:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('Error sending verification reminder email:', error)
      throw new Error('Failed to send verification reminder email')
    }
  }

  async sendTwoFactorCodeEmail (to, code, fullName) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject: 'Your Two-Factor Authentication Code - Contractor Hub',
      html: `
      <h2>Hello ${fullName},</h2>
      <p>Your two-factor authentication code is:</p>
      <h3 style="font-size: 24px; font-weight: bold;">${code}</h3>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't attempt to log in, please secure your account immediately.</p>
    `
    }
    await this.transporter.sendMail(mailOptions)
  }

  /**
   * Send confirmation email to lead
   * @param {Object} params
   * @param {string} params.to - Lead's email
   * @param {string} params.leadName - Lead's name
   * @param {string} params.template - Custom HTML template (optional)
   * @param {Object} params.data - Additional data for template
   * @returns {Promise<Object>}
   */
  async sendLeadConfirmation({ to, leadName, template, data = {} }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping confirmation email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const subject = data.subject || 'Thank You for Your Request!';
      const companyName = data.companyName || 'Our Team';
      const ballparkQuote = data.ballparkQuote;
      const quoteRange = data.quoteRange;
      
      // Use custom template or default
      const htmlContent = template || this.getLeadConfirmationTemplate({
        leadName,
        companyName,
        ballparkQuote,
        quoteRange,
        ...data
      });

      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Confirmation email sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send internal notification to team
   * @param {Object} params
   * @param {string|string[]} params.to - Team email(s)
   * @param {Object} params.lead - Lead data
   * @param {Object} params.form - Lead form data
   * @returns {Promise<Object>}
   */
  async sendInternalNotification({ to, lead, form }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping internal notification');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const recipients = Array.isArray(to) ? to.join(', ') : to;
      const subject = `New Lead: ${lead.firstName} ${lead.lastName} - ${lead.projectType || 'General Inquiry'}`;
      
      const htmlContent = this.getInternalNotificationTemplate({ lead, form });

      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
        to: recipients,
        subject,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Internal notification sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending internal notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Lead confirmation email template
   */
  getLeadConfirmationTemplate({ leadName, companyName, ballparkQuote, quoteRange }) {
    const quoteSection = ballparkQuote && quoteRange ? `
      <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h2 style="color: #166534; margin-top: 0;">Your Ballpark Estimate</h2>
        <p style="font-size: 32px; font-weight: bold; color: #16a34a; margin: 16px 0;">
          $${quoteRange.low.toLocaleString()} - $${quoteRange.high.toLocaleString()}
        </p>
        <p style="color: #4b5563; font-size: 14px;">
          Based on your zip code and project size. Final quote provided after free on-site assessment.
        </p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You for Your Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #3b82f6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Thank You, ${leadName}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">We've received your painting project request</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          ${quoteSection}
          
          <div style="background-color: white; border-radius: 8px; padding: 24px; margin-top: 24px;">
            <h2 style="color: #1f2937; margin-top: 0;">What Happens Next:</h2>
            <ol style="color: #4b5563; padding-left: 20px;">
              <li style="margin-bottom: 12px;">
                <strong>Quick Response:</strong> Our team will review your details and contact you within 15 minutes during business hours.
              </li>
              <li style="margin-bottom: 12px;">
                <strong>Free Consultation:</strong> We'll schedule a convenient time for a free on-site estimate.
              </li>
              <li style="margin-bottom: 12px;">
                <strong>Detailed Quote:</strong> Receive your comprehensive quote within 24 hours of the site visit.
              </li>
            </ol>
          </div>

          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-top: 24px; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af;">
              <strong>💡 Pro Tip:</strong> Have photos of your project ready when we call - it helps us provide a more accurate estimate!
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0;">Questions? Reply to this email or call us directly.</p>
            <p style="color: #3b82f6; font-weight: bold; margin: 10px 0 0 0;">
              We're excited to work with you!
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          <p>Powered by Cadence Quote</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Internal notification template
   */
  getInternalNotificationTemplate({ lead, form }) {
    const ballparkSection = lead.ballparkQuote ? `
      <tr>
        <td style="padding: 8px; background-color: #f0fdf4; font-weight: bold;">Ballpark Quote:</td>
        <td style="padding: 8px; background-color: #f0fdf4; color: #16a34a; font-weight: bold;">
          $${parseFloat(lead.ballparkQuote).toLocaleString()}
        </td>
      </tr>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🚨 New Lead Submitted!</h1>
          <p style="margin: 5px 0 0 0;">Action Required: Contact within 15 minutes</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">Contact Information:</h2>
          <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 4px; overflow: hidden;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 180px;">Name:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.firstName} ${lead.lastName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <a href="mailto:${lead.email}" style="color: #3b82f6;">${lead.email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Phone:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <a href="tel:${lead.phone}" style="color: #3b82f6;">${lead.phone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Preferred Contact:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.preferredContactMethod || 'Any'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Best Time:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.bestTimeToContact || 'Not specified'}</td>
            </tr>
          </table>

          <h2 style="color: #1f2937; margin-top: 24px;">Project Details:</h2>
          <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 4px; overflow: hidden;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 180px;">Project Type:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.projectType || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Zip Code:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.zipCode || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Home Size:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.homeSize ? lead.homeSize.toLocaleString() + ' sq ft' : 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Room Count:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.roomCount || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Timeline:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.timeline || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Paint Preference:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${lead.paintPreference || 'Not specified'}</td>
            </tr>
            ${ballparkSection}
          </table>

          ${lead.projectDetails ? `
          <h3 style="color: #1f2937; margin-top: 20px;">Project Description:</h3>
          <div style="background-color: white; padding: 16px; border-radius: 4px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; white-space: pre-wrap;">${lead.projectDetails}</p>
          </div>
          ` : ''}

          ${lead.referralSource ? `
          <p style="margin-top: 16px;"><strong>Referral Source:</strong> ${lead.referralSource}</p>
          ` : ''}

          ${lead.utmSource || lead.utmMedium || lead.utmCampaign ? `
          <div style="margin-top: 20px; padding: 16px; background-color: #fef3c7; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: #92400e;">Marketing Attribution:</h4>
            <p style="margin: 4px 0; font-size: 14px;">
              ${lead.utmSource ? `Source: ${lead.utmSource}<br>` : ''}
              ${lead.utmMedium ? `Medium: ${lead.utmMedium}<br>` : ''}
              ${lead.utmCampaign ? `Campaign: ${lead.utmCampaign}` : ''}
            </p>
          </div>
          ` : ''}

          <div style="background-color: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-top: 24px; text-align: center;">
            <h3 style="color: #991b1b; margin: 0 0 8px 0;">⏰ ACTION REQUIRED</h3>
            <p style="color: #7f1d1d; margin: 0; font-size: 16px;">
              Contact this lead within <strong>15 minutes</strong> for highest conversion rate!
            </p>
          </div>

          <div style="text-align: center; margin-top: 20px;">
            <a href="mailto:${lead.email}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">
              Send Email
            </a>
            <a href="tel:${lead.phone}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Call Now
            </a>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>Lead submitted via: ${form.name}</p>
          <p>Powered by Cadence Quote</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send follow-up reminder to team
   * @param {Object} params
   * @param {string|string[]} params.to - Team email(s)
   * @param {Object} params.lead - Lead data
   * @returns {Promise<Object>}
   */
  async sendFollowUpReminder({ to, lead }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping reminder');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const recipients = Array.isArray(to) ? to.join(', ') : to;
      const subject = `⚠️ REMINDER: Follow up with ${lead.firstName} ${lead.lastName}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <h1 style="margin: 0;">⚠️ Follow-Up Reminder</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">30+ minutes have passed without contact</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 8px;">
            <h2 style="color: #1f2937;">Lead Details:</h2>
            <p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p>
            <p><strong>Phone:</strong> <a href="tel:${lead.phone}">${lead.phone}</a></p>
            <p><strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a></p>
            <p><strong>Project:</strong> ${lead.projectType || 'General Inquiry'}</p>
            <p><strong>Zip Code:</strong> ${lead.zipCode || 'Not provided'}</p>
            
            <div style="background-color: #fef3c7; padding: 16px; border-radius: 4px; margin-top: 16px;">
              <p style="margin: 0; color: #78350f;"><strong>This lead has been waiting for 30+ minutes.</strong></p>
              <p style="margin: 8px 0 0 0; color: #78350f;">Please follow up immediately to maintain high conversion rates!</p>
            </div>

            <div style="text-align: center; margin-top: 20px;">
              <a href="tel:${lead.phone}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">
                Call Now
              </a>
              <a href="mailto:${lead.email}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Send Email
              </a>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p>Automated reminder from Cadence Quote</p>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
        to: recipients,
        subject,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Follow-up reminder sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending follow-up reminder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService()
