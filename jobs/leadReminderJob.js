// jobs/leadReminderJob.js
/**
 * Lead Reminder Job
 * Checks for leads that haven't been contacted within 30 minutes
 * and sends reminder notifications to the team
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const Lead = require('../models/Lead');
const LeadForm = require('../models/LeadForm');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

class LeadReminderJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '*/5 * * * *'; // Run every 5 minutes
  }

  /**
   * Start the cron job
   */
  start() {
    console.log('Starting Lead Reminder Job...');
    
    cron.schedule(this.cronExpression, async () => {
      if (this.isRunning) {
        console.log('Previous reminder job still running, skipping...');
        return;
      }

      try {
        this.isRunning = true;
        await this.checkUncontactedLeads();
      } catch (error) {
        console.error('Lead Reminder Job error:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log(`Lead Reminder Job scheduled: ${this.cronExpression}`);
  }

  /**
   * Check for uncontacted leads and send reminders
   */
  async checkUncontactedLeads() {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      // Find leads that:
      // 1. Were created more than 30 minutes ago
      // 2. Have status 'new' (not contacted)
      // 3. Don't have a contactedAt timestamp
      // 4. Haven't been reminded yet (or last reminder was >30 mins ago)
      const uncontactedLeads = await Lead.findAll({
        where: {
          status: 'new',
          createdAt: {
            [Op.lt]: thirtyMinutesAgo
          },
          contactedAt: null,
          [Op.or]: [
            { lastReminderAt: null },
            {
              lastReminderAt: {
                [Op.lt]: thirtyMinutesAgo
              }
            }
          ]
        },
        include: [
          {
            model: LeadForm,
            attributes: ['id', 'form_name', 'notificationEmails', 'autoResponseTimeMinutes']
          }
        ],
        limit: 50 // Process max 50 leads per run
      });

      if (uncontactedLeads.length === 0) {
        console.log('No uncontacted leads requiring reminders');
        return;
      }

      console.log(`Found ${uncontactedLeads.length} leads requiring follow-up reminders`);

      // Process each lead
      for (const lead of uncontactedLeads) {
        await this.sendReminders(lead);
        
        // Update lastReminderAt timestamp
        await lead.update({ lastReminderAt: new Date() });
      }

      console.log(`Sent reminders for ${uncontactedLeads.length} leads`);
    } catch (error) {
      console.error('Error checking uncontacted leads:', error);
      throw error;
    }
  }

  /**
   * Send reminder notifications for a specific lead
   * @param {Object} lead - Lead instance with LeadForm included
   */
  async sendReminders(lead) {
    try {
      const form = lead.LeadForm;
      
      if (!form || !form.notificationEmails) {
        console.log(`No notification emails configured for lead ${lead.id}`);
        return;
      }

      const recipients = Array.isArray(form.notificationEmails)
        ? form.notificationEmails
        : form.notificationEmails.split(',').map(e => e.trim());

      const leadData = {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        projectType: lead.projectType,
        zipCode: lead.zipCode,
        createdAt: lead.createdAt
      };

      // Calculate how long lead has been waiting
      const waitingMinutes = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 60000);

      console.log(`Sending reminder for lead ${lead.id} (waiting ${waitingMinutes} minutes)`);

      // Send email reminder
      const emailResult = await emailService.sendFollowUpReminder({
        to: recipients,
        lead: leadData
      });

      if (emailResult.success) {
        console.log(`Email reminder sent for lead ${lead.id}`);
      }

      // Send SMS reminder if team phone numbers configured
      if (process.env.TEAM_PHONE_NUMBERS) {
        const teamPhones = process.env.TEAM_PHONE_NUMBERS.split(',').map(p => p.trim());
        
        const smsResult = await smsService.sendFollowUpReminder({
          to: teamPhones,
          lead: leadData
        });

        if (smsResult.success) {
          console.log(`SMS reminder sent for lead ${lead.id}`);
        }
      }

    } catch (error) {
      console.error(`Error sending reminders for lead ${lead.id}:`, error);
    }
  }

  /**
   * Run the job once immediately (for testing)
   */
  async runOnce() {
    console.log('Running Lead Reminder Job once...');
    await this.checkUncontactedLeads();
  }
}

// Create singleton instance
const leadReminderJob = new LeadReminderJob();

// Export both the class and instance
module.exports = leadReminderJob;
