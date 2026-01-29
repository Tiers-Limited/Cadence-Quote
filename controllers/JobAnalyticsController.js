/**
 * Job Analytics Controller
 * 
 * Handles job analytics calculations and retrieval with strict security controls.
 * Provides read-only access to profit margin tracking and cost breakdown analysis.
 */

const { Quote, JobAnalytics, ContractorSettings, Tenant, Job, Client } = require('../models');
const { Op } = require('sequelize');
const CostAllocationService = require('../services/CostAllocationService');

class JobAnalyticsController {
  /**
   * GET /api/job-analytics/:quoteId
   * Retrieve job analytics for a specific quote
   */
  static async getJobAnalytics(req, res) {
    try {
      const { quoteId } = req.params;
      const tenantId = req.user.tenantId;

      // Validate quote exists and belongs to tenant
      const quote = await Quote.findOne({
        where: { 
          id: quoteId, 
          tenantId: tenantId 
        },
        include: [
          {
            model: JobAnalytics,
            as: 'jobAnalytics',
            required: false
          }
        ]
      });

      if (!quote) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'QUOTE_NOT_FOUND',
            message: 'Quote not found or access denied'
          }
        });
      }

      // Check if job is completed
      if (!quote.canCalculateAnalytics()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'JOB_NOT_COMPLETE',
            message: 'Job analytics are only available for completed jobs with final invoice amounts',
            details: {
              jobCompleted: quote.isJobComplete(),
              finalInvoiceAmount: quote.finalInvoiceAmount
            }
          }
        });
      }

      // Get contractor settings for overhead percentage
      const settings = await ContractorSettings.findOne({
        where: { tenantId: tenantId }
      });

      if (!settings || !settings.overheadPercent) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OVERHEAD_NOT_CONFIGURED',
            message: 'Overhead target must be configured in Settings before viewing job analytics',
            details: {
              requiredAction: 'Configure overhead percentage in contractor settings',
              settingsUrl: '/settings#overhead'
            }
          }
        });
      }

      // Check if analytics already exist
      let analytics = quote.jobAnalytics;
      
      if (!analytics) {
        // Calculate analytics on-demand
        const allocation = CostAllocationService.calculateAllocation(
          parseFloat(quote.finalInvoiceAmount),
          quote.actualMaterialCost ? parseFloat(quote.actualMaterialCost) : null,
          quote.actualLaborCost ? parseFloat(quote.actualLaborCost) : null,
          parseFloat(settings.overheadPercent),
          settings.netProfitPercent ? parseFloat(settings.netProfitPercent) : null
        );

        // Store analytics in database
        analytics = await JobAnalytics.create({
          quoteId: quote.id,
          tenantId: tenantId,
          jobPrice: allocation.jobPrice,
          actualMaterialCost: allocation.breakdown.materials.source === 'actual' ? allocation.breakdown.materials.amount : null,
          actualLaborCost: allocation.breakdown.labor.source === 'actual' ? allocation.breakdown.labor.amount : null,
          allocatedOverhead: allocation.breakdown.overhead.amount,
          netProfit: allocation.breakdown.profit.amount,
          materialPercentage: allocation.breakdown.materials.percentage,
          laborPercentage: allocation.breakdown.labor.percentage,
          overheadPercentage: allocation.breakdown.overhead.percentage,
          profitPercentage: allocation.breakdown.profit.percentage,
          materialSource: allocation.breakdown.materials.source,
          laborSource: allocation.breakdown.labor.source,
          calculatedAt: new Date()
        });

        // Mark quote as having analytics calculated
        await quote.markAnalyticsCalculated();
      }

      // Return analytics data
      const response = {
        success: true,
        data: {
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          customerName: quote.customerName,
          jobPrice: parseFloat(analytics.jobPrice),
          breakdown: analytics.getBreakdown(),
          healthStatus: analytics.getHealthStatus(),
          isHealthy: analytics.isHealthy(),
          calculatedAt: analytics.calculatedAt,
          industryStandards: CostAllocationService.getIndustryStandards(),
          analysis: CostAllocationService.analyzeAgainstStandards(analytics.getBreakdown())
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error retrieving job analytics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve job analytics',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * POST /api/job-analytics/:quoteId/calculate
   * Calculate and store job analytics with actual cost data
   */
  static async calculateAnalytics(req, res) {
    try {
      const { quoteId } = req.params;
      const { jobPrice, actualMaterialCost, actualLaborCost } = req.body;
      const tenantId = req.user.tenantId;

      // Validate input
      if (!jobPrice || jobPrice <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JOB_PRICE',
            message: 'Job price must be greater than zero'
          }
        });
      }

      // Validate quote exists and belongs to tenant
      const quote = await Quote.findOne({
        where: { 
          id: quoteId, 
          tenantId: tenantId 
        }
      });

      if (!quote) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'QUOTE_NOT_FOUND',
            message: 'Quote not found or access denied'
          }
        });
      }

      // Get contractor settings
      const settings = await ContractorSettings.findOne({
        where: { tenantId: tenantId }
      });

      if (!settings || settings.overheadPercent === null || settings.overheadPercent === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OVERHEAD_NOT_CONFIGURED',
            message: 'Overhead target must be configured in Settings'
          }
        });
      }

      // Update quote with job completion data
      await quote.markJobComplete(jobPrice, actualMaterialCost, actualLaborCost);

      // Calculate allocation
      const allocation = CostAllocationService.calculateAllocation(
        parseFloat(jobPrice),
        actualMaterialCost ? parseFloat(actualMaterialCost) : null,
        actualLaborCost ? parseFloat(actualLaborCost) : null,
        parseFloat(settings.overheadPercent),
        settings.netProfitPercent ? parseFloat(settings.netProfitPercent) : null
      );

      // Delete existing analytics if they exist
      await JobAnalytics.destroy({
        where: { quoteId: quote.id }
      });

      // Create new analytics record
      const analytics = await JobAnalytics.create({
        quoteId: quote.id,
        tenantId: tenantId,
        jobPrice: allocation.jobPrice,
        actualMaterialCost: allocation.breakdown.materials.source === 'actual' ? allocation.breakdown.materials.amount : null,
        actualLaborCost: allocation.breakdown.labor.source === 'actual' ? allocation.breakdown.labor.amount : null,
        allocatedOverhead: allocation.breakdown.overhead.amount,
        netProfit: allocation.breakdown.profit.amount,
        materialPercentage: allocation.breakdown.materials.percentage,
        laborPercentage: allocation.breakdown.labor.percentage,
        overheadPercentage: allocation.breakdown.overhead.percentage,
        profitPercentage: allocation.breakdown.profit.percentage,
        materialSource: allocation.breakdown.materials.source,
        laborSource: allocation.breakdown.labor.source,
        calculatedAt: new Date()
      });

      res.json({
        success: true,
        data: {
          quoteId: quote.id,
          jobPrice: parseFloat(analytics.jobPrice),
          breakdown: analytics.getBreakdown(),
          healthStatus: analytics.getHealthStatus(),
          calculatedAt: analytics.calculatedAt
        }
      });

    } catch (error) {
      console.error('Error calculating job analytics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: 'Failed to calculate job analytics',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * GET /api/job-analytics/tenant/:tenantId/summary
   * Get analytics summary for all completed jobs (admin/reporting)
   */
  static async getTenantAnalyticsSummary(req, res) {
    try {
      const tenantId = req.user.tenantId;

      // Get all analytics for tenant
      const analytics = await JobAnalytics.findAll({
        where: { tenantId: tenantId },
        include: [
          {
            model: Quote,
            as: 'quote',
            attributes: ['id', 'quoteNumber', 'customerName', 'jobCompletedAt']
          }
        ],
        order: [['calculatedAt', 'DESC']]
      });

      if (analytics.length === 0) {
        return res.json({
          success: true,
          data: {
            totalJobs: 0,
            averages: null,
            summary: 'No completed jobs with analytics available'
          }
        });
      }

      // Calculate averages
      const totals = analytics.reduce((acc, item) => {
        acc.materialPercentage += parseFloat(item.materialPercentage);
        acc.laborPercentage += parseFloat(item.laborPercentage);
        acc.overheadPercentage += parseFloat(item.overheadPercentage);
        acc.profitPercentage += parseFloat(item.profitPercentage);
        acc.jobPrice += parseFloat(item.jobPrice);
        return acc;
      }, {
        materialPercentage: 0,
        laborPercentage: 0,
        overheadPercentage: 0,
        profitPercentage: 0,
        jobPrice: 0
      });

      const count = analytics.length;
      const averages = {
        materialPercentage: parseFloat((totals.materialPercentage / count).toFixed(2)),
        laborPercentage: parseFloat((totals.laborPercentage / count).toFixed(2)),
        overheadPercentage: parseFloat((totals.overheadPercentage / count).toFixed(2)),
        profitPercentage: parseFloat((totals.profitPercentage / count).toFixed(2)),
        averageJobPrice: parseFloat((totals.jobPrice / count).toFixed(2))
      };

      // Health analysis
      const healthyJobs = analytics.filter(item => item.isHealthy()).length;
      const healthPercentage = parseFloat(((healthyJobs / count) * 100).toFixed(1));

      res.json({
        success: true,
        data: {
          totalJobs: count,
          healthyJobs: healthyJobs,
          healthPercentage: healthPercentage,
          averages: averages,
          industryStandards: CostAllocationService.getIndustryStandards(),
          recentJobs: analytics.slice(0, 10).map(item => ({
            quoteId: item.quoteId,
            quoteNumber: item.quote.quoteNumber,
            customerName: item.quote.customerName,
            jobPrice: parseFloat(item.jobPrice),
            profitPercentage: parseFloat(item.profitPercentage),
            healthStatus: item.getHealthStatus(),
            calculatedAt: item.calculatedAt
          }))
        }
      });

    } catch (error) {
      console.error('Error retrieving tenant analytics summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUMMARY_ERROR',
          message: 'Failed to retrieve analytics summary'
        }
      });
    }
  }

  /**
   * GET /api/job-analytics/completed-jobs
   * Get all completed jobs for the tenant with their analytics status
   */
  static async getCompletedJobs(req, res) {
    try {
      const tenantId = req.user.tenantId;

      // Get all completed or closed jobs from Jobs table
      const completedJobs = await Job.findAll({
        where: {
          tenantId: tenantId,
          status: { [Op.in]: ['completed', 'closed'] }
        },
        include: [
          {
            model: Quote,
            as: 'quote',
            required: true,
            include: [
              {
                model: JobAnalytics,
                as: 'jobAnalytics',
                required: false
              }
            ]
          },
          {
            model: Client,
            as: 'client',
            required: false
          }
        ],
        order: [['actualEndDate', 'DESC'], ['updatedAt', 'DESC']]
      });

      // Get contractor settings for overhead percentage
      const settings = await ContractorSettings.findOne({
        where: { tenantId: tenantId }
      });

      const overheadConfigured = settings && settings.overheadPercent !== null;

      // Process each job and calculate analytics
      const jobsData = await Promise.all(completedJobs.map(async (job) => {
        const jobData = job.toJSON();
        const quote = jobData.quote;
        
        if (!quote) {
          return null;
        }

        // Extract labor and material costs from quote
        const laborCost = quote.laborTotal ? parseFloat(quote.laborTotal) : 0;
        const materialCost = quote.materialTotal ? parseFloat(quote.materialTotal) : 0;
        const jobPrice = parseFloat(jobData.totalAmount);

        // Calculate or retrieve analytics
        let analytics = null;
        let hasAnalytics = false;

        if (quote.jobAnalytics) {
          // Analytics already exist
          hasAnalytics = true;
          analytics = {
            materialCost: parseFloat(quote.jobAnalytics.actualMaterialCost || materialCost),
            laborCost: parseFloat(quote.jobAnalytics.actualLaborCost || laborCost),
            overheadCost: parseFloat(quote.jobAnalytics.allocatedOverhead),
            netProfit: parseFloat(quote.jobAnalytics.netProfit),
            materialPercentage: parseFloat(quote.jobAnalytics.materialPercentage),
            laborPercentage: parseFloat(quote.jobAnalytics.laborPercentage),
            overheadPercentage: parseFloat(quote.jobAnalytics.overheadPercentage),
            profitPercentage: parseFloat(quote.jobAnalytics.profitPercentage),
            breakdown: quote.jobAnalytics.getBreakdown(),
            healthStatus: quote.jobAnalytics.getHealthStatus(),
            isHealthy: quote.jobAnalytics.isHealthy(),
            calculatedAt: quote.jobAnalytics.calculatedAt
          };
        } else if (overheadConfigured && jobPrice > 0) {
          // Calculate analytics on-the-fly
          try {
            const allocation = CostAllocationService.calculateAllocation(
              jobPrice,
              materialCost > 0 ? materialCost : null,
              laborCost > 0 ? laborCost : null,
              parseFloat(settings.overheadPercent),
              settings.netProfitPercent ? parseFloat(settings.netProfitPercent) : null
            );

            analytics = {
              materialCost: allocation.breakdown.materials.amount,
              laborCost: allocation.breakdown.labor.amount,
              overheadCost: allocation.breakdown.overhead.amount,
              netProfit: allocation.breakdown.profit.amount,
              materialPercentage: allocation.breakdown.materials.percentage,
              laborPercentage: allocation.breakdown.labor.percentage,
              overheadPercentage: allocation.breakdown.overhead.percentage,
              profitPercentage: allocation.breakdown.profit.percentage,
              breakdown: allocation.breakdown,
              healthStatus: allocation.breakdown.profit.percentage >= 8 ? 
                (allocation.breakdown.profit.percentage >= 12 ? 'good' : 'fair') : 'poor',
              isHealthy: allocation.breakdown.profit.percentage >= 8,
              calculatedAt: new Date()
            };
          } catch (error) {
            console.error(`Error calculating analytics for job ${jobData.id}:`, error);
          }
        }

        return {
          id: jobData.id,
          jobNumber: jobData.jobNumber,
          quoteNumber: quote.quoteNumber,
          customerName: jobData.customerName,
          status: jobData.status,
          completedAt: jobData.actualEndDate || jobData.updatedAt,
          jobPrice: jobPrice,
          laborCost: laborCost,
          materialCost: materialCost,
          hasAnalytics: hasAnalytics,
          canCalculateAnalytics: overheadConfigured && jobPrice > 0,
          analytics: analytics
        };
      }));

      // Filter out null entries
      const validJobsData = jobsData.filter(j => j !== null);

      // Calculate summary statistics
      const totalJobs = validJobsData.length;
      const withAnalytics = validJobsData.filter(j => j.hasAnalytics).length;
      const needingAnalytics = validJobsData.filter(j => !j.hasAnalytics && j.canCalculateAnalytics).length;

      res.json({
        success: true,
        data: {
          jobs: validJobsData,
          summary: {
            totalCompletedJobs: totalJobs,
            jobsWithAnalytics: withAnalytics,
            jobsNeedingAnalytics: needingAnalytics,
            overheadConfigured: overheadConfigured
          }
        }
      });

    } catch (error) {
      console.error('Error retrieving completed jobs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to retrieve completed jobs',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
}

module.exports = JobAnalyticsController;