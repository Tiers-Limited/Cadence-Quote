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

  async sendVerificationCodeEmail (email, code, userName) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Verification Code - Cadence',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Verification Code</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 30px 0; border-radius: 10px; }
            .code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Verify Your Email</h1>
            <p>Complete your registration with Cadence</p>
          </div>

          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for signing up for Cadence. Please use the verification code below to complete your registration:</p>

            <div class="code-box">
              <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code</p>
              <div class="code">${code}</div>
            </div>

            <div class="info">
              <strong>📱 For Mobile Users:</strong> Simply enter this 6-digit code in your app to verify your email and complete registration.
            </div>

            <div class="warning">
              <strong>⏱️ Time Sensitive:</strong> This code will expire in 10 minutes for security reasons.
            </div>

            <p><strong>Security Tips:</strong></p>
            <ul>
              <li>Never share this code with anyone</li>
              <li>Cadence staff will never ask for your verification code</li>
              <li>If you didn't request this code, please ignore this email</li>
            </ul>

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

        Thank you for signing up for Cadence. Please use the verification code below to complete your registration:

        VERIFICATION CODE: ${code}

        This code will expire in 10 minutes for security reasons.

        Security Tips:
        - Never share this code with anyone
        - Cadence staff will never ask for your verification code
        - If you didn't request this code, please ignore this email

        Best regards,
        The Cadence Team

        This email was sent to ${email}.
      `
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('Verification code email sent:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('Error sending verification code email:', error)
      throw new Error('Failed to send verification code email')
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

  /**
   * Send password reset email
   * @param {string} email - User's email
   * @param {string} resetToken - Password reset token
   * @param {string} userName - User's full name
   * @returns {Promise<Object>}
   */
  /**
   * Send quote to customer
   * @param {Object} params
   * @param {string} params.to - Customer email
   * @param {string} params.customerName - Customer name
   * @param {Object} params.quote - Quote data
   * @param {Object} params.calculation - Calculated totals
   * @param {Object} params.contractor - Contractor info
   * @param {string} params.quoteViewUrl - URL to view quote
   * @returns {Promise<Object>}
   */
  async sendQuoteToCustomer({ to, customerName, quote, calculation, contractor, quoteViewUrl, pdfBuffer }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping quote email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const subject = `Your Professional Painting Proposal #${quote.quoteNumber} from ${contractor.companyName}`;
      const htmlContent = this.getQuoteEmailTemplate({
        customerName,
        quote,
        calculation,
        contractor,
        quoteViewUrl
      });

      const mailOptions = {
        from: `"${contractor.companyName}" <${process.env.SMTP_USER}>`,
        to,
        replyTo: contractor.email,
        subject,
        html: htmlContent,
        attachments: []
      };

      // Attach PDF if provided
      if (pdfBuffer) {
        mailOptions.attachments.push({
          filename: `Proposal-${quote.quoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
      }

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Quote email sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending quote email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send contractor-authored message with standardized signature
   * Requirements:
   * - From appears as contractor; reply-to goes to contractor
   * - Body is authored by contractor and not modified
   * - Signature is appended by system with logo and contact info
   * - No pricing or CTAs should be present in body (validation handled upstream)
   * @param {Object} params
   * @param {string} params.to - Customer email
   * @param {string} params.subject - Email subject line
   * @param {string} params.body - Contractor-authored plain text body
   * @param {Object} params.contractor - { name, title?, companyName, email, phone?, website?, logoUrl? }
   * @param {Buffer} [params.pdfBuffer] - Optional proposal PDF attachment
   */
  async sendContractorMessageWithSignature({ to, subject, body, contractor, pdfBuffer }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping send');
      return { success: false, message: 'Email service not configured' };
    }

    const escapeHtml = (unsafe) =>
      String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const signatureHtml = `
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <table style="width:100%; max-width:600px; font-family: Arial, sans-serif; color:#374151;">
        <tr>
          <td style="width:64px; vertical-align: top; padding-right: 12px;">
            ${contractor.logoUrl ? `<img src="${contractor.logoUrl}" alt="Company Logo" style="max-height:48px; width:auto; display:block;" />` : ''}
          </td>
          <td style="vertical-align: top;">
            <div style="font-size:14px; line-height:1.6;">
              <div style="font-weight:600; color:#111827;">${escapeHtml(contractor.name || contractor.companyName || 'Contractor')}</div>
              ${contractor.title ? `<div style="color:#6b7280;">${escapeHtml(contractor.title)}</div>` : ''}
              <div style="color:#374151;">${escapeHtml(contractor.companyName || '')}</div>
              ${contractor.phone ? `<div style="color:#374151;">📱 ${escapeHtml(contractor.phone)}</div>` : ''}
              ${contractor.email ? `<div style="color:#374151;">📧 <a href="mailto:${escapeHtml(contractor.email)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(contractor.email)}</a></div>` : ''}
              ${contractor.website ? `<div style="color:#374151;">🌐 <a href="${escapeHtml(contractor.website)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(contractor.website)}</a></div>` : ''}
            </div>
          </td>
        </tr>
      </table>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(subject || 'Message')}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height:1.6; color:#111827; background:#ffffff;">
          <div style="max-width:700px; margin:0 auto; padding:24px;">
            <div style="font-size:16px; color:#374151;">
              ${body || ''}
            </div>
            ${signatureHtml}
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `${contractor.name ? '"' + contractor.name + '" ' : ''}<${process.env.SMTP_USER}>`,
      to,
      replyTo: contractor.email,
      subject,
      html: htmlContent,
      attachments: []
    };

    if (pdfBuffer) {
      mailOptions.attachments.push({
        filename: `Proposal.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Contractor message sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending contractor message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quote email template
   */
  getQuoteEmailTemplate({ customerName, quote, calculation, contractor, quoteViewUrl }) {
    const areasHtml = (quote.areas || []).map(area => {
      const items = area.laborItems || [];
      const selectedItems = items.filter(i => i.selected);
      
      if (selectedItems.length === 0) return '';
      
      const itemsHtml = selectedItems.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.categoryName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity} ${item.measurementUnit}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.numberOfCoats || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.gallons ? item.gallons + ' gal' : '-'}</td>
        </tr>
      `).join('');
      
      return `
        <div style="margin-bottom: 24px; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: #f3f4f6; padding: 12px 16px; border-bottom: 2px solid #3b82f6;">
            <h3 style="margin: 0; color: #1f2937; font-size: 18px;">${area.name}</h3>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 10px 8px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600;">Surface</th>
                <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #6b7280; font-weight: 600;">Quantity</th>
                <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #6b7280; font-weight: 600;">Coats</th>
                <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #6b7280; font-weight: 600;">Gallons</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Painting Quote</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 700px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold;color:#fff">Your Quote is Ready!</h1>
            <p style="margin: 0; font-size: 18px; opacity: 0.9; color:#fff">Quote #${quote.quoteNumber}</p>
          </div>

          <!-- Greeting -->
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Hi ${customerName},</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Thank you for choosing ${contractor.companyName} for your painting project! We've prepared a detailed professional proposal based on your requirements.
            </p>
            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
              <p style="margin: 0; color: #1e40af; font-size: 15px;">
                📎 <strong>Your complete proposal is attached as a PDF</strong> for your review. Please open the attached PDF to view all project details, pricing, and terms.
              </p>
            </div>
            <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; color: #166534; font-size: 15px;">
                📱 <strong>Use the Cadence Mobile App</strong>
              </p>
              <p style="margin: 0; color: #166534; font-size: 14px;">
                To review, accept, and manage your quote, please use the Cadence mobile app where you can:
              </p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #166534; font-size: 14px;">
                <li>View your complete proposal</li>
                <li>Choose colors and finishes</li>
                <li>Accept the quote digitally</li>
                <li>Schedule your project</li>
                <li>Track progress in real-time</li>
              </ul>
            </div>
          </div>

          <!-- Price Summary -->
          <div style="margin: 0 30px 30px 30px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 12px; padding: 24px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <p style="margin: 0 0 8px 0; color: #166534; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Total Investment</p>
              <p style="margin: 0; color: #16a34a; font-size: 48px; font-weight: bold; line-height: 1;">$${calculation.total.toLocaleString()}</p>
            </div>
            <div style="padding: 16px; background: rgba(255,255,255,0.7); border-radius: 8px; margin-bottom: 15px;">
              <p style="margin: 0 0 10px 0; color: #166534; font-size: 12px; font-style: italic;">
                Following US industry standard formula:<br>
                <strong>(Materials + Labor + Overhead) × (1 + Profit Margin) + Tax</strong>
              </p>
            </div>
            <div style="padding-top: 20px; border-top: 1px solid #86efac;">
              <table width="100%" style="font-size: 14px;">
                <tr style="border-bottom: 1px solid #d1fae5;">
                  <td style="padding: 6px 0; color: #166534;">Labor:</td>
                  <td align="right" style="padding: 6px 0; color: #166534; font-weight: 600;">$${calculation.laborTotal.toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #d1fae5;">
                  <td style="padding: 6px 0; color: #166534;">Materials (with ${calculation.materialMarkupPercent}% markup):</td>
                  <td align="right" style="padding: 6px 0; color: #166534; font-weight: 600;">$${calculation.materialTotal.toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #d1fae5;">
                  <td style="padding: 6px 0; color: #166534;">Overhead (${calculation.overheadPercent}%):</td>
                  <td align="right" style="padding: 6px 0; color: #166534; font-weight: 600;">$${calculation.overhead.toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #d1fae5;">
                  <td style="padding: 6px 0; color: #166534;">Profit Margin (${calculation.profitMarginPercent}%):</td>
                  <td align="right" style="padding: 6px 0; color: #166534; font-weight: 600;">$${calculation.profitAmount.toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #d1fae5;">
                  <td style="padding: 6px 0; color: #166534;">Subtotal:</td>
                  <td align="right" style="padding: 6px 0; color: #166534; font-weight: 600;">$${calculation.subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #166534;">Sales Tax (${calculation.taxPercent}%):</td>
                  <td align="right" style="padding: 6px 0; color: #166534; font-weight: 600;">$${calculation.tax.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #16a34a; text-align: center;">
              <p style="margin: 0; color: #166534; font-size: 12px;">
                <strong>Deposit (${calculation.depositPercent}%):</strong> $${calculation.deposit.toLocaleString()} due at signing<br>
                <strong>Balance:</strong> $${calculation.balance.toLocaleString()} due at completion
              </p>
            </div>
          </div>

          <!-- Project Details -->
          <div style="padding: 0 30px 30px 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Project Details</h2>
            
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <div style="margin-bottom: 12px;">
                <strong style="color: #374151;">Job Type:</strong>
                <span style="color: #6b7280; margin-left: 8px; text-transform: capitalize;">${quote.jobType || 'Not specified'}</span>
              </div>
              <div>
                <strong style="color: #374151;">Property Address:</strong>
                <span style="color: #6b7280; margin-left: 8px;">${quote.street || ''}, ${quote.city || ''}, ${quote.state || ''} ${quote.zipCode || ''}</span>
              </div>
            </div>

            ${areasHtml}

            ${quote.notes ? `
            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-top: 20px;">
              <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 16px;">📝 Additional Notes:</h4>
              <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${quote.notes}</p>
            </div>
            ` : ''}
          </div>

          <!-- CTA Section -->
          <div style="padding: 0 30px 30px 30px;">
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center;">
              <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 20px;">📱 Open the Cadence Mobile App</h3>
              <p style="color: #1e3a8a; margin: 0 0 16px 0; font-size: 15px;">
                All actions can be completed through the mobile app
              </p>
              <div style="background: white; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <p style="color: #64748b; margin: 0; font-size: 13px; line-height: 1.6;">
                  If you haven't installed the app yet, download it from the App Store or Google Play Store and log in with your email address.
                </p>
              </div>
            </div>
          </div>

          <!-- Next Steps -->
          <div style="background: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">What Happens Next?</h3>
            <ol style="color: #4b5563; padding-left: 20px; margin: 0;">
              <li style="margin-bottom: 12px;"><strong>Review the PDF:</strong> Open the attached proposal to see all details, pricing, and terms</li>
              <li style="margin-bottom: 12px;"><strong>Open the Mobile App:</strong> Log in to the Cadence app with your email address</li>
              <li style="margin-bottom: 12px;"><strong>Choose Colors & Finishes:</strong> Select your preferred colors and sheens for each area in the app</li>
              <li style="margin-bottom: 12px;"><strong>Accept & Schedule:</strong> Digitally accept the quote and schedule your project</li>
              <li><strong>Track Your Project:</strong> Monitor progress in real-time through the app as our team transforms your space!</li>
            </ol>
          </div>

          <!-- Contact Info -->
          <div style="background: #1f2937; color: white; padding: 30px; text-align: center;">
            <h4 style="margin: 0 0 16px 0; font-size: 18px; color:#fff">Questions? We're Here to Help!</h4>
            <p style="margin: 0 0 8px 0; opacity: 0.9; color:#fff">📧 Email: <a href="mailto:${contractor.email}" style="color: #60a5fa; text-decoration: none;">${contractor.email}</a></p>
            ${contractor.phone ? `<p style="margin: 0; opacity: 0.9; color:#fff">📱 Phone: <a href="tel:${contractor.phone}" style="color: #60a5fa; text-decoration: none;">${contractor.phone}</a></p>` : ''}
          </div>

          <!-- Footer -->
          <div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">This quote is valid for 30 days from the date of issue.</p>
            <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} ${contractor.companyName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${
      process.env.FRONTEND_URL || 'http://localhost:5173'
    }/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request - Cadence',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .alert { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>We received a request to reset your password</p>
          </div>

          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>You recently requested to reset your password for your Cadence account. Click the button below to reset it:</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Your Password</a>
            </div>

            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 14px;">${resetUrl}</p>

            <div class="warning">
              <strong>⏰ Important:</strong> This password reset link will expire in 1 hour for security reasons.
            </div>

            <div class="alert">
              <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure. Your password will remain unchanged.
            </div>

            <p><strong>Why did I receive this email?</strong><br>
            This email was sent because someone (hopefully you) requested a password reset for your account. If this wasn't you, please contact our support team immediately.</p>

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

        You recently requested to reset your password for your Cadence account. Click the link below to reset it:

        ${resetUrl}

        This password reset link will expire in 1 hour for security reasons.

        If you didn't request a password reset, please ignore this email and ensure your account is secure. Your password will remain unchanged.

        Best regards,
        The Cadence Team

        This email was sent to ${email}.
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send email notification when deposit is verified
   */
  async sendDepositVerifiedEmail(customerEmail, proposalDetails = {}, options = {}) {
    // options: { tenantId, contractorMessage }
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';
    const subject = (tenant?.defaultEmailMessage?.subject) || `Deposit Verified - ${proposalDetails.quoteNumber || ''}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Deposit verified email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending deposit verified email:', error);
      throw error;
    }
  }

  /**
   * Send email notification when customer completes selections
   */
  async sendSelectionsCompletedEmail(contractorEmail, proposalDetails) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: contractorEmail,
      subject: `Customer completed selections - ${proposalDetails.quoteNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .info-box { background-color: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🎉 Customer Selections Complete</h1></div>
            <div class="content">
              <h2>Selections Submitted</h2>
              <p>${proposalDetails.customerName} has completed all product selections for proposal <strong>${proposalDetails.quoteNumber}</strong>.</p>
              <div class="info-box">
                <p><strong>Customer:</strong> ${proposalDetails.customerName}</p>
                <p><strong>Quote Number:</strong> ${proposalDetails.quoteNumber}</p>
                <p><strong>Selected Tier:</strong> ${proposalDetails.selectedTier?.toUpperCase() || 'N/A'}</p>
                <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p style="text-align: center;">
                <a href="${frontendUrl}/quotes" class="button">View Selections</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Selections completed email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending selections completed email:', error);
      throw error;
    }
  }

  /**
   * Send email notification when proposal is accepted
   */
  async sendProposalAcceptedEmail(contractorEmail, proposalDetails) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: contractorEmail,
      subject: `Proposal accepted - ${proposalDetails.quoteNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .info-box { background-color: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🎉 Proposal Accepted!</h1></div>
            <div class="content">
              <p>${proposalDetails.customerName} has accepted proposal <strong>${proposalDetails.quoteNumber}</strong>.</p>
              <div class="info-box">
                <p><strong>Customer:</strong> ${proposalDetails.customerName}</p>
                <p><strong>Quote Number:</strong> ${proposalDetails.quoteNumber}</p>
                <p><strong>Selected Tier:</strong> ${proposalDetails.selectedTier?.toUpperCase() || 'N/A'}</p>
              </div>
              <p style="text-align: center;">
                <a href="${frontendUrl}/quotes" class="button">View Proposal</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Proposal accepted email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending proposal accepted email:', error);
      throw error;
    }
  }

  /**
   * Send email notification when portal is reopened
   */
  async sendPortalReopenedEmail(customerEmail, proposalDetails = {}, options = {}) {
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';
    const subject = tenant?.defaultEmailMessage?.subject || `Portal Reopened - ${proposalDetails.quoteNumber || ''}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Portal reopened email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending portal reopened email:', error);
      throw error;
    }
  }

  /**
   * Send client portal invitation email
   * @param {string} email - Client email address
   * @param {Object} details - Invitation details
   */
  async sendClientInvitationEmail(email, details) {
    const { clientName, contractorName, invitationLink, expiryHours } = details;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'You\'re Invited to Access Your Customer Portal',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to Your Customer Portal</h1>
            <p>Set up your account to get started</p>
          </div>

          <div class="content">
            <h2>Hello ${clientName}!</h2>
            <p>${contractorName} has invited you to access your dedicated customer portal where you can:</p>
            
            <ul style="margin: 20px 0; padding-left: 20px;">
              <li>View your project quotes and proposals</li>
              <li>Accept or decline quotes</li>
              <li>Make secure deposit payments</li>
              <li>Select products and finishes</li>
              <li>Track your project progress</li>
              <li>Access important documents</li>
            </ul>

            <div class="info-box">
              <strong>🔐 Set Up Your Password</strong><br>
              Click the button below to create your secure password and activate your account.
            </div>

            <div style="text-align: center;">
              <a href="${invitationLink}" class="button">Set Up My Account</a>
            </div>

            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px;">${invitationLink}</p>

            <p style="color: #666; font-size: 14px; margin-top: 25px;">
              <strong>Note:</strong> This invitation link will expire in ${expiryHours} hours. If you need a new link, please contact ${contractorName}.
            </p>

            <p style="margin-top: 25px;">Best regards,<br>The Cadence Team</p>
          </div>

          <div class="footer">
            <p>This email was sent to ${email} on behalf of ${contractorName}.</p>
            <p>&copy; 2025 Cadence. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${clientName}!

        ${contractorName} has invited you to access your dedicated customer portal.

        Click the link below to set up your password and activate your account:
        ${invitationLink}

        With your customer portal, you can:
        - View your project quotes and proposals
        - Accept or decline quotes
        - Make secure deposit payments
        - Select products and finishes
        - Track your project progress
        - Access important documents

        This invitation link will expire in ${expiryHours} hours.

        Best regards,
        The Cadence Team
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Client invitation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending client invitation email:', error);
      throw new Error('Failed to send invitation email');
    }
  }

  /**
   * Send client password reset email
   * @param {string} email - Client email address
   * @param {Object} details - Reset details
   */
  async sendClientPasswordResetEmail(email, details) {
    const { clientName, resetLink, expiryHours } = details;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Customer Portal Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Reset Your Password</h1>
            <p>Customer Portal Access</p>
          </div>

          <div class="content">
            <h2>Hello ${clientName}!</h2>
            <p>We received a request to reset your customer portal password. If you made this request, click the button below to create a new password:</p>

            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset My Password</a>
            </div>

            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px;">${resetLink}</p>

            <div class="warning">
              <strong>⏰ Time Sensitive:</strong> This password reset link will expire in ${expiryHours} hours for security reasons.
            </div>

            <p style="margin-top: 25px;">
              <strong>Didn't request this?</strong><br>
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>

            <p style="margin-top: 25px;">Best regards,<br>The Cadence Team</p>
          </div>

          <div class="footer">
            <p>This email was sent to ${email}. If you need help, please contact your contractor.</p>
            <p>&copy; 2025 Cadence. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${clientName}!

        We received a request to reset your customer portal password.

        Click the link below to create a new password:
        ${resetLink}

        This password reset link will expire in ${expiryHours} hours for security reasons.

        If you didn't request a password reset, you can safely ignore this email.

        Best regards,
        The Cadence Team
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Client password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending client password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send OTP verification code email
   * @param {Object} params
   * @param {string} params.to - Customer email
   * @param {string} params.code - 6-digit OTP code
   * @param {string} params.clientName - Customer name
   * @param {string} params.companyName - Contractor company name
   * @param {number} params.expiryMinutes - How long code is valid
   */
  async sendOTPEmail({ to, code, clientName, companyName, expiryMinutes = 10 }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping OTP email');
      return { success: false, message: 'Email service not configured' };
    }

    const firstName = clientName.split(' ')[0];

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to,
      subject: `Your Verification Code - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 2px solid #2563eb;
            }
            .content {
              padding: 30px 0;
            }
            .otp-code {
              background-color: #f3f4f6;
              border: 2px solid #2563eb;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #2563eb;
              font-family: 'Courier New', monospace;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; color: #2563eb;">${companyName}</h1>
          </div>
          
          <div class="content">
            <p>Hi ${firstName},</p>
            
            <p>You requested access to all your projects with ${companyName}. Here's your verification code:</p>
            
            <div class="otp-code">
              <div class="code">${code}</div>
              <p style="margin: 10px 0 0 0; color: #6b7280;">Enter this code in the customer portal</p>
            </div>
            
            <p><strong>This code will expire in ${expiryMinutes} minutes.</strong></p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. ${companyName} will never ask for this code via phone or text.
            </div>
            
            <p>If you didn't request this code, you can safely ignore this email or contact us directly.</p>
          </div>
          
          <div class="footer">
            <p>This email was sent by ${companyName}</p>
            <p style="font-size: 12px; color: #9ca3af;">Powered by Cadence Quote</p>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${firstName},

You requested access to all your projects with ${companyName}. Here's your verification code:

${code}

Enter this code in the customer portal within ${expiryMinutes} minutes.

SECURITY NOTICE: Never share this code with anyone. ${companyName} will never ask for this code via phone or text.

If you didn't request this code, you can safely ignore this email or contact us directly.

- ${companyName}
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('OTP email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending OTP email:', error);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Send magic link for customer portal access
   * @param {Object} params
   * @param {string} params.to - Customer email
   * @param {string} params.customerName - Customer name
   * @param {string} params.magicLink - Magic link URL
   * @param {string} params.companyName - Contractor company name
   * @param {string} params.companyLogo - Optional contractor logo URL
   * @param {string} params.purpose - Link purpose (quote_view, payment, etc.)
   * @param {Object} params.quoteInfo - Optional quote information
   * @param {number} params.expiryHours - Hours until link expires
   */
  async sendMagicLink({ 
    to, 
    customerName, 
    magicLink, 
    companyName, 
    companyLogo = null,
    purpose = 'portal_access',
    quoteInfo = null,
    expiryHours = 24 
  }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping magic link email');
      return { success: false, message: 'Email service not configured' };
    }

    const firstName = customerName.split(' ')[0];
    
    // Purpose-specific messaging
    const purposeMessages = {
      quote_view: {
        subject: 'Your Painting Proposal is Ready',
        heading: 'Your Proposal is Ready to View',
        intro: `Great news! Your painting proposal${quoteInfo ? ` #${quoteInfo.quoteNumber}` : ''} is ready for review.`,
        cta: 'View Your Proposal',
      },
      quote_approval: {
        subject: 'Action Required: Approve Your Proposal',
        heading: 'Your Approval is Needed',
        intro: 'Your proposal is ready for final approval. Please review and approve to get started.',
        cta: 'Review & Approve',
      },
      payment: {
        subject: 'Complete Your Payment',
        heading: 'Ready to Process Payment',
        intro: 'Your project is approved! Complete your payment to schedule the work.',
        cta: 'Make Payment',
      },
      portal_access: {
        subject: 'Access Your Project Portal',
        heading: 'Access Your Customer Portal',
        intro: 'Click below to securely access your project information.',
        cta: 'Access Portal',
      },
      job_status: {
        subject: 'Project Update Available',
        heading: 'New Project Update',
        intro: 'There\'s a new update on your project. View the latest status and photos.',
        cta: 'View Update',
      },
    };

    const msg = purposeMessages[purpose] || purposeMessages.portal_access;

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to,
      subject: `${msg.subject} - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .logo {
              max-width: 200px;
              height: auto;
              margin-bottom: 20px;
            }
            .content {
              padding: 40px 30px;
            }
            .cta-button {
              display: inline-block;
              background-color: #2563eb;
              color: white !important;
              text-decoration: none;
              padding: 16px 32px;
              border-radius: 8px;
              font-weight: 600;
              margin: 30px 0;
              text-align: center;
            }
            .cta-button:hover {
              background-color: #1d4ed8;
            }
            .info-box {
              background-color: #f3f4f6;
              border-left: 4px solid #2563eb;
              padding: 16px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              padding: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
              background-color: #f9fafb;
            }
            .link-text {
              word-break: break-all;
              color: #6b7280;
              font-size: 12px;
              background-color: #f3f4f6;
              padding: 12px;
              border-radius: 4px;
              margin-top: 20px;
            }
            .security-note {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" class="logo" />` : `<h1 style="margin: 0;">${companyName}</h1>`}
              <h2 style="margin: 10px 0 0 0; font-weight: 500;">${msg.heading}</h2>
            </div>
            
            <div class="content">
              <p>Hi ${firstName},</p>
              
              <p>${msg.intro}</p>
              
              ${quoteInfo ? `
                <div class="info-box">
                  <strong>Proposal #${quoteInfo.quoteNumber}</strong><br/>
                  ${quoteInfo.total ? `Total Investment: $${parseFloat(quoteInfo.total).toFixed(2)}<br/>` : ''}
                  ${quoteInfo.validUntil ? `Valid Until: ${new Date(quoteInfo.validUntil).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}` : ''}
                </div>
              ` : ''}
              
              <div style="text-align: center;">
                <a href="${magicLink}" class="cta-button">${msg.cta}</a>
              </div>
              
              <p style="margin-top: 30px;">This secure link gives you instant access - no password required! It will remain valid for ${expiryHours} hours.</p>
              
              <div class="security-note">
                <strong>🔒 Security:</strong> This link is unique to you. Don't share it with others. If you have questions, contact us directly.
              </div>
              
              <p>Having trouble with the button? Copy and paste this link into your browser:</p>
              <div class="link-text">${magicLink}</div>
              
              <p style="margin-top: 30px;">
                Questions? Reply to this email or give us a call. We're here to help!
              </p>
            </div>
            
            <div class="footer">
              <p><strong>${companyName}</strong></p>
              <p style="margin: 5px 0;">Professional Painting Services</p>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">Powered by Cadence Quote</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${firstName},

${msg.intro}

${quoteInfo ? `Proposal #${quoteInfo.quoteNumber}\n${quoteInfo.total ? `Total Investment: $${parseFloat(quoteInfo.total).toFixed(2)}\n` : ''}` : ''}

Click here to access: ${magicLink}

This secure link gives you instant access - no password required! It will remain valid for ${expiryHours} hours.

SECURITY: This link is unique to you. Don't share it with others. If you have questions, contact us directly.

Questions? Reply to this email or give us a call. We're here to help!

- ${companyName}
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Magic link email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending magic link email:', error);
      throw new Error('Failed to send access link');
    }
  }

  /**
   * Send portal expiry notification email
   * @param {Object} params
   * @param {string} params.to - Customer email
   * @param {string} params.customerName - Customer name
   * @param {number} params.daysRemaining - Days until expiry
   * @param {Date} params.expiryDate - Expiry date
   * @param {Object} params.tenantBranding - Contractor branding
   * @param {string} params.portalUrl - Portal base URL
   */
  async sendPortalExpiryNotification({
    to,
    customerName,
    daysRemaining,
    expiryDate,
    tenantBranding = {},
    portalUrl = process.env.CUSTOMER_PORTAL_URL || 'https://portal.cadence.local'
  }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping expiry notification');
      return { success: false, message: 'Email service not configured' };
    }

    const firstName = customerName.split(' ')[0];
    const companyName = tenantBranding?.companyName || 'Your Contractor';
    const expiryDateStr = expiryDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to,
      subject: `⏰ Your Portal Access Expires in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: bold;
            }
            .content {
              padding: 30px;
            }
            .expiry-box {
              background-color: #fef3c7;
              border: 2px solid #f59e0b;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .expiry-days {
              font-size: 36px;
              font-weight: bold;
              color: #d97706;
              margin: 10px 0;
            }
            .expiry-date {
              font-size: 16px;
              color: #92400e;
              margin-top: 10px;
            }
            .action-box {
              background-color: #dbeafe;
              border: 2px solid #3b82f6;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .action-box h3 {
              margin: 0 0 10px 0;
              color: #1e40af;
              font-size: 16px;
            }
            .action-box p {
              margin: 8px 0;
              color: #1e40af;
              font-size: 14px;
            }
            .footer {
              background-color: #f3f4f6;
              padding: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
            }
            ul {
              margin: 15px 0;
              padding-left: 20px;
              color: #374151;
            }
            li {
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Portal Access Expiring Soon</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.95;">Your access will expire soon</p>
            </div>

            <div class="content">
              <p>Hi ${firstName},</p>

              <p>This is a reminder that your access to the customer portal will expire soon.</p>

              <div class="expiry-box">
                <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;">Portal expires in:</p>
                <div class="expiry-days">${daysRemaining}</div>
                <p style="margin: 0; color: #92400e; font-size: 12px;">day${daysRemaining > 1 ? 's' : ''}</p>
                <div class="expiry-date">
                  <strong>${expiryDateStr}</strong>
                </div>
              </div>

              <p style="color: #4b5563; margin-top: 20px;">After this date, you will no longer be able to:</p>
              <ul>
                <li>View your project quotes</li>
                <li>Approve or decline proposals</li>
                <li>Make design selections</li>
                <li>Access project documents</li>
              </ul>

              <div class="action-box">
                <h3>📧 Need Access Again?</h3>
                <p>If you need continued access after the expiration date, please contact ${companyName} directly and request a new magic link.</p>
                <p style="margin: 15px 0 0 0;">Our team can extend your access or send you a new link for your next project phase.</p>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                <strong>Questions?</strong> Reply to this email or contact ${companyName} for assistance.
              </p>

              <p style="margin-top: 30px;">Best regards,<br>
              <strong>${companyName}</strong></p>
            </div>

            <div class="footer">
              <p style="margin: 0 0 8px 0;">This is an automated notification from Cadence Quote</p>
              <p style="margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${firstName},

This is a reminder that your access to the customer portal will expire soon.

PORTAL EXPIRES IN: ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} (${expiryDateStr})

After this date, you will no longer be able to:
- View your project quotes
- Approve or decline proposals
- Make design selections
- Access project documents

NEED ACCESS AGAIN?
If you need continued access after the expiration date, please contact ${companyName} directly and request a new magic link. Our team can extend your access or send you a new link for your next project phase.

Questions? Contact ${companyName} for assistance.

Best regards,
${companyName}

---
This is an automated notification from Cadence Quote
© ${new Date().getFullYear()} ${companyName}. All rights reserved.
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Portal expiry notification sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending expiry notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // NEW WORKFLOW EMAIL TEMPLATES
  // ============================================================================

  /**
   * Send proposal accepted notification to contractor
   */
  async sendProposalAcceptedEmail(to, { quoteNumber, customerName, customerEmail, selectedTier, total, depositAmount }) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      subject: `✅ Proposal Accepted - ${quoteNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #52c41a;">🎉 Proposal Accepted!</h2>
            <p>Great news! <strong>${customerName}</strong> has accepted your proposal.</p>
            <div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Quote:</strong> ${quoteNumber}</p>
              <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
              ${selectedTier ? `<p><strong>Selected Tier:</strong> ${selectedTier.toUpperCase()}</p>` : ''}
              <p><strong>Total:</strong> $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p><strong>Deposit:</strong> $${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Customer will complete deposit payment</li>
              <li>Selection portal will open for product/color choices</li>
              <li>You'll be notified when selections are complete</li>
              <li>Schedule the job and begin work</li>
            </ol>
            <p>Best regards,<br>Cadence System</p>
          </div>
        </body>
        </html>
      `,
      text: `Proposal Accepted - ${quoteNumber}\n\nCustomer: ${customerName} (${customerEmail})\nSelected Tier: ${selectedTier || 'N/A'}\nTotal: $${total}\nDeposit: $${depositAmount}\n\nNext steps: Customer will complete payment and make product selections.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Proposal accepted email sent');
    } catch (error) {
      console.error('Error sending proposal accepted email:', error);
    }
  }

  /**
   * Send proposal rejected notification to contractor
   */
  async sendProposalRejectedEmail(to, { quoteNumber, customerName, customerEmail, total, reason, comments }) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      subject: `❌ Proposal Rejected - ${quoteNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ff4d4f;">Proposal Rejected</h2>
            <p><strong>${customerName}</strong> has declined your proposal.</p>
            <div style="background: #fff2e8; border: 1px solid #ffbb96; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Quote:</strong> ${quoteNumber}</p>
              <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
              <p><strong>Total:</strong> $${total}</p>
              <p><strong>Reason:</strong> ${reason.replace('_', ' ')}</p>
              ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
            </div>
            <p>Consider reaching out to discuss their concerns or offer alternatives.</p>
            <p>Best regards,<br>Cadence System</p>
          </div>
        </body>
        </html>
      `,
      text: `Proposal Rejected - ${quoteNumber}\n\nCustomer: ${customerName}\nReason: ${reason}\nComments: ${comments || 'None'}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Proposal rejected email sent');
    } catch (error) {
      console.error('Error sending proposal rejected email:', error);
    }
  }

  /**
   * Send selection portal open notification to customer
   */
  async sendSelectionPortalOpenEmail(to, { customerName, quoteNumber, portalExpiryDate, portalDurationDays }, options = {}) {
    const expiryDateStr = new Date(portalExpiryDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options?.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || null;
    const subject = (tenant?.defaultEmailMessage?.subject) || `🎨 Make Your Product Selections - ${quoteNumber}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage || `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1890ff;">Your Selection Portal is Now Open!</h2>
            <p>Hi ${customerName},</p>
            <p>Thank you for your deposit payment! You can now make your product, color, and sheen selections for your project.</p>
            <div style="background: #e6f7ff; border: 1px solid #91d5ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>⏰ Portal Closes:</strong> ${expiryDateStr}</p>
              <p><strong>📅 Days Remaining:</strong> ${portalDurationDays} days</p>
            </div>
            <p><strong>What to do:</strong></p>
            <ol>
              <li>Log in to your customer portal</li>
              <li>Review the selected products for each area</li>
              <li>Choose your preferred colors and sheens</li>
              <li>Submit your selections when complete</li>
            </ol>
            <p><strong>Important:</strong> Please complete your selections before the portal closes. If you need more time, contact us to extend your access.</p>
            <p>Best regards,<br>Your Project Team</p>
          </div>
        </body>
        </html>
      `, tenant),
      text: contractorMessage ? this._stripHtml(contractorMessage) : `Selection Portal Open\n\nHi ${customerName},\n\nYour selection portal is now open! You have ${portalDurationDays} days to make your product, color, and sheen selections.\n\nPortal closes: ${expiryDateStr}\n\nLog in to your customer portal to get started.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Selection portal open email sent');
    } catch (error) {
      console.error('Error sending portal open email:', error);
    }
  }

  /**
   * Send selections complete notification to contractor
   */
  async sendSelectionsCompleteEmail(to, { jobNumber, quoteNumber, customerName, customerEmail }, options = {}) {
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options?.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || null;
    const subject = (tenant?.defaultEmailMessage?.subject) || `✅ Customer Selections Complete - ${jobNumber}`;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #52c41a;">Customer Selections Submitted!</h2>
            <p><strong>${customerName}</strong> has completed and submitted their product selections.</p>
            <div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Job Number:</strong> ${jobNumber}</p>
              <p><strong>Original Quote:</strong> ${quoteNumber}</p>
              <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the customer's selections in the dashboard</li>
              <li>Download work order and material lists (auto-generated)</li>
              <li>Schedule the job with your crew</li>
              <li>Customer will be notified of the schedule</li>
            </ol>
            <p>The job is ready to be scheduled!</p>
            <p>Best regards,<br>Cadence System</p>
          </div>
        </body>
        </html>
      `;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage || htmlContent, tenant),
      text: contractorMessage ? this._stripHtml(contractorMessage) : `Selections Complete - ${jobNumber}\n\nCustomer: ${customerName}\nJob is ready to schedule!`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Selections complete email sent');
    } catch (error) {
      console.error('Error sending selections complete email:', error);
    }
  }

  /**
   * Send selections confirmation to customer
   */
  async sendSelectionsConfirmationEmail(to, { customerName, jobNumber, quoteNumber }, options = {}) {
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options?.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || null;
    const subject = (tenant?.defaultEmailMessage?.subject) || `✅ Your Selections Have Been Submitted - ${jobNumber}`;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #52c41a;">Selections Submitted Successfully!</h2>
            <p>Hi ${customerName},</p>
            <p>Thank you for completing your product selections! Your choices have been locked and submitted to your contractor.</p>
            <div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Job Number:</strong> ${jobNumber}</p>
              <p><strong>Original Proposal:</strong> ${quoteNumber}</p>
            </div>
            <p><strong>What happens next:</strong></p>
            <ol>
              <li>Your contractor will review your selections</li>
              <li>The job will be scheduled and you'll receive notification</li>
              <li>You can track progress in your customer portal</li>
            </ol>
            <p>Your selections are now locked and cannot be changed. If you have concerns, please contact your contractor directly.</p>
            <p>Best regards,<br>Your Project Team</p>
          </div>
        </body>
        </html>
      `;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage || htmlContent, tenant),
      text: contractorMessage ? this._stripHtml(contractorMessage) : `Selections Submitted - ${jobNumber}\n\nHi ${customerName},\n\nYour product selections have been submitted and locked. Your contractor will schedule the job and notify you soon.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Selections confirmation email sent');
    } catch (error) {
      console.error('Error sending selections confirmation email:', error);
    }
  }

  /**
   * Send job scheduled notification to customer
   */
  async sendJobScheduledEmail(to, { customerName, jobNumber, scheduledStartDate, scheduledEndDate, estimatedDuration } = {}, options = {}) {
    // options: { tenantId, contractorMessage }
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options && options.tenantId) {
      tenant = await Tenant.findByPk(options.tenantId);
    }

    // Build body: prefer contractorMessage (exact contractor-written body), else fallback to tenant default email
    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';

    const startDateStr = scheduledStartDate ? new Date(scheduledStartDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }): null

    const endDateStr = scheduledEndDate ? new Date(scheduledEndDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : null;

    // Build the HTML: use contractorMessage (assumed to be full HTML) and append system-controlled signature
    const htmlBody = `${contractorMessage || `
      <div>
        <h2>Your Project is Scheduled!</h2>
        <p>Hi ${customerName || ''},</p>
        <p>Your job <strong>${jobNumber || ''}</strong> has been scheduled.</p>
      </div>
    `}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject: (tenant?.defaultEmailMessage?.subject) ? tenant.defaultEmailMessage.subject : `Your Project Has Been Scheduled - ${jobNumber}`,
      html: await this._appendSignatureHtml(htmlBody, tenant),
      text: contractorMessage ? this._stripHtml(contractorMessage) : `Job Scheduled - ${jobNumber}\nStart Date: ${startDateStr}`
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Job scheduled email sent');
    } catch (error) {
      console.error('Error sending job scheduled email:', error);
    }
  }

  /**
   * Notify customer that contractor approved their selections
   */
  async sendSelectionsApprovedEmail(to, { customerName, jobNumber, quoteNumber, jobId }) {
    // Legacy signature: allow caller to pass tenantId or contractorMessage via options
    // New usage: sendSelectionsApprovedEmail(to, payload, { tenantId, contractorMessage })
    // But maintain backwards compatibility
    const options = arguments[2] || {};
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || `<div><p>Hi ${customerName || ''},</p><p>Your selections for job ${jobNumber || ''} have been approved by your contractor.</p></div>`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject: (tenant?.defaultEmailMessage?.subject) ? tenant.defaultEmailMessage.subject : `Selections approved - ${jobNumber}`,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Selections approved email sent');
    } catch (error) {
      console.error('Error sending selections approved email:', error);
    }
  }

  // Helper: append standardized, system-controlled signature HTML to a contractor-provided body
  async _appendSignatureHtml(bodyHtml, tenant) {
    const companyLogo = tenant?.companyLogoUrl || '';
    const companyName = tenant?.companyName || '';
    const phone = tenant?.phoneNumber || '';
    const email = tenant?.email || '';
    const website = tenant?.website || '';

    const signatureHtml = `
      <div style="margin-top:20px;border-top:1px solid #e8e8e8;padding-top:12px;display:flex;gap:12px;align-items:center;font-family:Arial, sans-serif;color:#333;">
        ${companyLogo ? `<div style="width:80px;height:80px;flex:0 0 80px;"><img src="${companyLogo}" alt="${companyName}" style="max-width:80px;max-height:80px;object-fit:contain;"/></div>` : ''}
        <div style="font-size:14px;line-height:1.3;">
          ${companyName ? `<div style="font-weight:600;margin-bottom:4px;">${companyName}</div>` : ''}
          ${phone ? `<div style="color:#555;margin-bottom:2px;">${phone}</div>` : ''}
          ${email ? `<div style="color:#555;margin-bottom:2px;">${email}</div>` : ''}
          ${website ? `<div style="color:#555;">${website}</div>` : ''}
        </div>
      </div>
    `;

    return `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; color:#333;">${bodyHtml}${signatureHtml}</body></html>`;
  }

  // Helper: very simple HTML stripper for plain-text fallback
  _stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Send job rescheduled notification to customer
   */
  async sendJobRescheduledEmail(to, { customerName, jobNumber, oldStartDate, newStartDate, newEndDate, reason }) {
    const options = arguments[2] || {};
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';
    const subject = tenant?.defaultEmailMessage?.subject || `Schedule Change - ${jobNumber}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Job rescheduled email sent');
    } catch (error) {
      console.error('Error sending job rescheduled email:', error);
    }
  }

  /**
   * Send job status update notification to customer
   */
  async sendJobStatusUpdateEmail(to, { customerName, jobNumber, oldStatus, newStatus, notes }) {
    const options = arguments[2] || {};
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';
    const subject = tenant?.defaultEmailMessage?.subject || `Job Status Update - ${jobNumber}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Job status update email sent');
    } catch (error) {
      console.error('Error sending status update email:', error);
    }
  }

  /**
   * Send final payment request to customer
   */
  async sendFinalPaymentRequestEmail(to, { customerName, jobNumber, total, depositPaid, remainingBalance }) {
    const options = arguments[2] || {};
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';
    const subject = tenant?.defaultEmailMessage?.subject || `Final Payment Required - ${jobNumber}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Final payment request email sent');
    } catch (error) {
      console.error('Error sending final payment request email:', error);
    }
  }

  /**
   * Send payment receipt to customer
   */
  async sendPaymentReceiptEmail(to, { customerName, jobNumber, amount, paymentDate, transactionId }) {
    const options = arguments[2] || {};
    const Tenant = require('../models/Tenant');
    let tenant = null;
    if (options.tenantId) tenant = await Tenant.findByPk(options.tenantId);

    const contractorMessage = options?.contractorMessage || tenant?.defaultEmailMessage?.body || '';
    const subject = tenant?.defaultEmailMessage?.subject || `Payment Receipt - ${jobNumber}`;

    const mailOptions = {
      from: tenant && tenant.companyName ? `"${tenant.companyName}" <${tenant.email || process.env.SMTP_USER}>` : `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      replyTo: tenant?.email || process.env.SMTP_USER,
      subject,
      html: await this._appendSignatureHtml(contractorMessage, tenant),
      text: this._stripHtml(contractorMessage)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Payment receipt email sent');
    } catch (error) {
      console.error('Error sending payment receipt email:', error);
    }
  }

  /**
   * Send final payment received notification to contractor
   */
  async sendFinalPaymentReceivedEmail(to, { jobNumber, customerName, amount }) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Cadence'}" <${process.env.SMTP_USER}>`,
      to,
      subject: `✅ Final Payment Received - ${jobNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #52c41a;">Final Payment Received!</h2>
            <p><strong>${customerName}</strong> has completed their final payment.</p>
            <div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Job Number:</strong> ${jobNumber}</p>
              <p><strong>Final Payment:</strong> $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p><strong>Status:</strong> Project Complete & Paid in Full</p>
            </div>
            <p>This job is now fully complete. Great work!</p>
            <p>Best regards,<br>Cadence System</p>
          </div>
        </body>
        </html>
      `,
      text: `Final Payment Received - ${jobNumber}\n\nCustomer: ${customerName}\nAmount: $${amount}\n\nJob is now complete and paid in full.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Final payment received email sent');
    } catch (error) {
      console.error('Error sending final payment received email:', error);
    }
  }
}

// Export a singleton instance so callers can use methods directly
module.exports = new EmailService();