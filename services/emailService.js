// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendVerificationEmail(email, verificationToken, userName) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

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
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendVerificationReminder(email, userName) {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

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
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification reminder email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending verification reminder email:', error);
      throw new Error('Failed to send verification reminder email');
    }
  }
}

module.exports = new EmailService();