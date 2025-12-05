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
  async sendQuoteToCustomer({ to, customerName, quote, calculation, contractor, quoteViewUrl }) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping quote email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const subject = `Your Painting Quote #${quote.quoteNumber} from ${contractor.companyName}`;
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
        html: htmlContent
      };

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
            <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold;">Your Quote is Ready!</h1>
            <p style="margin: 0; font-size: 18px; opacity: 0.9;">Quote #${quote.quoteNumber}</p>
          </div>

          <!-- Greeting -->
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Hi ${customerName},</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Thank you for choosing ${contractor.companyName} for your painting project! We've prepared a detailed quote based on your requirements. Below you'll find a comprehensive breakdown of your project.
            </p>
          </div>

          <!-- Price Summary -->
          <div style="margin: 0 30px 30px 30px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 12px; padding: 24px;">
            <div style="text-align: center;">
              <p style="margin: 0 0 8px 0; color: #166534; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Total Investment</p>
              <p style="margin: 0; color: #16a34a; font-size: 48px; font-weight: bold; line-height: 1;">$${calculation.total.toLocaleString()}</p>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #86efac;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #166534; font-size: 14px;">Labor:</span>
                <span style="color: #166534; font-weight: 600; font-size: 14px;">$${calculation.laborTotal.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #166534; font-size: 14px;">Materials:</span>
                <span style="color: #166534; font-weight: 600; font-size: 14px;">$${calculation.materialTotal.toLocaleString()}</span>
              </div>
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

          <!-- CTA Button -->
          <div style="padding: 0 30px 30px 30px; text-align: center;">
            <a href="${quoteViewUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
              View Full Quote & Accept
            </a>
            <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px;">Click the button above to review your quote, choose colors, and accept</p>
          </div>

          <!-- Next Steps -->
          <div style="background: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">What Happens Next?</h3>
            <ol style="color: #4b5563; padding-left: 20px; margin: 0;">
              <li style="margin-bottom: 12px;"><strong>Review Your Quote:</strong> Click the button above to see all details and options</li>
              <li style="margin-bottom: 12px;"><strong>Choose Colors & Finishes:</strong> Select your preferred colors and sheens for each area</li>
              <li style="margin-bottom: 12px;"><strong>Accept & Schedule:</strong> Once you're happy, accept the quote and we'll schedule your project</li>
              <li><strong>Get It Done:</strong> Our professional team will transform your space!</li>
            </ol>
          </div>

          <!-- Contact Info -->
          <div style="background: #1f2937; color: white; padding: 30px; text-align: center;">
            <h4 style="margin: 0 0 16px 0; font-size: 18px;">Questions? We're Here to Help!</h4>
            <p style="margin: 0 0 8px 0; opacity: 0.9;">📧 Email: <a href="mailto:${contractor.email}" style="color: #60a5fa; text-decoration: none;">${contractor.email}</a></p>
            ${contractor.phone ? `<p style="margin: 0; opacity: 0.9;">📱 Phone: <a href="tel:${contractor.phone}" style="color: #60a5fa; text-decoration: none;">${contractor.phone}</a></p>` : ''}
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
}

module.exports = new EmailService()
