// controllers/dashboardController.js
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Quote = require('../models/Quote');
const Lead = require('../models/Lead');
const ContractorSettings = require('../models/ContractorSettings');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Import optimization utilities
const { optimizationSystem } = require('../optimization');

// Cache keys for dashboard data
const CACHE_KEYS = {
  DASHBOARD_STATS: (tenantId) => `dashboard:stats:${tenantId}`,
  JOB_ANALYTICS: (tenantId) => `dashboard:analytics:${tenantId}`,
  MONTHLY_PERFORMANCE: (tenantId) => `dashboard:monthly:${tenantId}`,
  RECENT_ACTIVITY: (tenantId) => `dashboard:activity:${tenantId}`
};

// Cache TTL (5 minutes for dashboard data)
const CACHE_TTL = 300;

/**
 * GET /api/v1/dashboard/stats
 * Get comprehensive dashboard statistics with caching and parallel execution
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const cacheKey = CACHE_KEYS.DASHBOARD_STATS(tenantId);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedStats = await utils.cache?.get(cacheKey);
      
      if (cachedStats) {
        return res.json({
          success: true,
          data: cachedStats,
          cached: true
        });
      }
    }

    // Get current month date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Execute queries in parallel for better performance
    const [currentMonthQuotes, paidQuotes, lastMonthQuotes] = await Promise.all([
      // Current month quotes
      Quote.findAll({
        where: {
          tenantId,
          isActive: true,
          createdAt: {
            [Op.gte]: firstDayOfMonth
          }
        },
        attributes: [
          'id',
          'status',
          'total',
          'laborTotal',
          'materialTotal',
          'markup',
          'createdAt',
          'depositAmount',
          'depositTransactionId',
          'depositPaymentMethod',
          'depositVerified',
          'depositVerifiedAt'
        ],
        raw: true // Use raw queries for better performance
      }),
      
      // Paid quotes for revenue calculation
      Quote.findAll({
        where: {
          tenantId,
          isActive: true,
          depositVerified: true,
          depositTransactionId: { [Op.ne]: null },
          depositPaymentMethod: 'stripe',
          depositVerifiedAt: {
            [Op.gte]: firstDayOfMonth
          }
        },
        attributes: ['id', 'total', 'depositAmount', 'depositTransactionId'],
        raw: true
      }),
      
      // Last month quotes for comparison
      Quote.findAll({
        where: {
          tenantId,
          isActive: true,
          depositVerified: true,
          depositTransactionId: { [Op.ne]: null },
          depositPaymentMethod: 'stripe',
          depositVerifiedAt: {
            [Op.gte]: firstDayOfLastMonth,
            [Op.lte]: lastDayOfLastMonth
          }
        },
        attributes: ['depositAmount'],
        raw: true
      })
    ]);

    // Calculate revenue from paid quotes
    const totalRevenue = paidQuotes.reduce((sum, quote) => 
      sum + Number.parseFloat(quote.depositAmount || 0), 0
    );

    const lastMonthRevenue = lastMonthQuotes.reduce((sum, q) => 
      sum + Number.parseFloat(q.depositAmount || 0), 0
    );

    // Calculate current month stats
    const currentStats = calculateMonthStats(currentMonthQuotes);
    const lastMonthStats = calculateMonthStats(lastMonthQuotes);

    // Calculate changes (percentage or absolute)
    const revenueChange = calculatePercentageChange(totalRevenue, lastMonthRevenue);
    const quotesChange = currentStats.activeQuotes - lastMonthStats.activeQuotes;
    const jobsChange = currentStats.completedJobs - lastMonthStats.completedJobs;
    const avgChange = calculatePercentageChange(currentStats.avgJobValue, lastMonthStats.avgJobValue);

    const dashboardData = {
      stats: {
        totalRevenue: totalRevenue, // Real revenue from Stripe
        activeQuotes: currentStats.activeQuotes,
        completedJobs: currentStats.completedJobs,
        avgJobValue: currentStats.avgJobValue,
        revenueChange: formatChange(revenueChange, true),
        quotesChange: formatChange(quotesChange, false),
        jobsChange: formatChange(jobsChange, false),
        avgChange: formatChange(avgChange, true)
      },
      byStatus: currentStats.byStatus
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, dashboardData, CACHE_TTL, {
        tags: [`tenant:${tenantId}`, 'dashboard', 'stats']
      });
    }

    return res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/dashboard/job-analytics
 * Get job cost breakdown analytics from Pricing Engine settings with caching
 */
exports.getJobAnalytics = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const cacheKey = CACHE_KEYS.JOB_ANALYTICS(tenantId);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedAnalytics = await utils.cache?.get(cacheKey);
      
      if (cachedAnalytics) {
        return res.json({
          success: true,
          data: cachedAnalytics.data,
          avgMargin: cachedAnalytics.avgMargin,
          cached: true
        });
      }
    }

    // Fetch contractor settings to get pricing engine margins
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
      attributes: [
        'materialMarkupPercent',
        'laborMarkupPercent',
        'overheadPercent',
        'netProfitPercent'
      ],
      raw: true // Use raw query for better performance
    });

    let analyticsData;
    let avgMargin;

    if (!settings) {
      // Return default percentages if no settings found
      analyticsData = [
        { name: 'Material %', value: 35, color: '#3b82f6' },
        { name: 'Labor %', value: 40, color: '#10b981' },
        { name: 'Overhead %', value: 15, color: '#f59e0b' },
        { name: 'Net Profit %', value: 10, color: '#8b5cf6' }
      ];
      avgMargin = 10;
    } else {
      // Get percentages from pricing engine settings
      const materialPercent = Number.parseFloat(settings.materialMarkupPercent || 35);
      const laborPercent = Number.parseFloat(settings.laborMarkupPercent || 40);
      const overheadPercent = Number.parseFloat(settings.overheadPercent || 15);
      const netProfitPercent = Number.parseFloat(settings.netProfitPercent || 10);

      analyticsData = [
        { name: 'Material %', value: materialPercent, color: '#3b82f6' },
        { name: 'Labor %', value: laborPercent, color: '#10b981' },
        { name: 'Overhead %', value: overheadPercent, color: '#f59e0b' },
        { name: 'Net Profit %', value: netProfitPercent, color: '#8b5cf6' }
      ];
      avgMargin = netProfitPercent;
    }

    const result = { data: analyticsData, avgMargin };

    // Cache the results (longer TTL since settings don't change often)
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, result, CACHE_TTL * 4, { // 20 minutes
        tags: [`tenant:${tenantId}`, 'dashboard', 'analytics']
      });
    }

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching job analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch job analytics',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/dashboard/monthly-performance
 * Get monthly performance metrics with real Stripe revenue and caching
 */
exports.getMonthlyPerformance = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const cacheKey = CACHE_KEYS.MONTHLY_PERFORMANCE(tenantId);
    
    // Try to get from cache first
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      const cachedPerformance = await utils.cache?.get(cacheKey);
      
      if (cachedPerformance) {
        return res.json({
          success: true,
          data: cachedPerformance,
          cached: true
        });
      }
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyQuotes = await Quote.findAll({
      where: {
        tenantId,
        isActive: true,
        createdAt: {
          [Op.gte]: firstDayOfMonth
        }
      },
      attributes: [
        'id',
        'status',
        'total',
        'createdAt',
        'sentAt',
        'approvedAt',
        'depositAmount',
        'depositVerified',
        'depositVerifiedAt',
        'depositTransactionId',
        'depositPaymentMethod'
      ],
      raw: true // Use raw queries for better performance
    });

    // Use array methods for better performance than filter
    const sentQuotes = monthlyQuotes.filter(q => q.status !== 'draft');
    const acceptedQuotes = monthlyQuotes.filter(q => 
      q.status === 'accepted' || q.status === 'scheduled'
    );

    const conversionRate = sentQuotes.length > 0
      ? ((acceptedQuotes.length / sentQuotes.length) * 100).toFixed(1)
      : '0.0';

    // Calculate real revenue from Stripe payments
    const paidQuotes = monthlyQuotes.filter(q => 
      q.depositVerified && 
      q.depositTransactionId && 
      q.depositPaymentMethod === 'stripe'
    );
    
    const totalRevenue = paidQuotes.reduce((sum, q) => 
      sum + Number.parseFloat(q.depositAmount || 0), 0
    );

    // Calculate average response time (time from creation to approval)
    let totalResponseTime = 0;
    let quotesWithResponse = 0;

    for (const quote of acceptedQuotes) {
      if (quote.approvedAt && quote.createdAt) {
        const responseTime = (new Date(quote.approvedAt) - new Date(quote.createdAt)) / (1000 * 60 * 60); // hours
        totalResponseTime += responseTime;
        quotesWithResponse++;
      }
    }

    const avgResponseTime = quotesWithResponse > 0
      ? (totalResponseTime / quotesWithResponse).toFixed(1)
      : '0.0';

    const performanceData = {
      quotesSent: sentQuotes.length,
      conversionRate: conversionRate,
      avgResponseTime: avgResponseTime,
      revenue: (totalRevenue / 1000).toFixed(1) // in thousands, from real Stripe payments
    };

    // Cache the results
    if (optimizationSystem.initialized) {
      const utils = optimizationSystem.getUtils();
      await utils.cache?.set(cacheKey, performanceData, CACHE_TTL, {
        tags: [`tenant:${tenantId}`, 'dashboard', 'performance']
      });
    }

    return res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('Error fetching monthly performance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly performance',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/dashboard/recent-activity
 * Get recent quote activity
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = parseInt(req.query.limit) || 10;

    const recentQuotes = await Quote.findAll({
      where: {
        tenantId,
        isActive: true
      },
      attributes: [
        'id',
        'quoteNumber',
        'customerName',
        'jobType',
        'jobCategory',
        'status',
        'total',
        'createdAt'
      ],
      order: [['createdAt', 'DESC']],
      limit
    });

    const getStatusDisplay = (status) => {
      const statusMap = {
        'draft': 'Draft',
        'sent': 'Sent',
        'accepted': 'Accepted',
        'deposit_paid': 'Deposit Paid',
        'scheduled': 'Scheduled',
        'completed': 'Completed',
        'rejected': 'Rejected',
        'declined': 'Declined'
      };
      return statusMap[status] || status;
    };

    const activity = recentQuotes.map(q => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customerName,
      jobType: q.jobType,
      jobCategory: q.jobCategory,
      status: q.status,
      statusDisplay: getStatusDisplay(q.status),
      total: q.total,
      createdAt: q.createdAt,
      description: `${q.jobType ? q.jobType.charAt(0).toUpperCase() + q.jobType.slice(1) : 'Job'} - ${q.jobCategory ? q.jobCategory.charAt(0).toUpperCase() + q.jobCategory.slice(1) : 'General'}`
    }));

    return res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message
    });
  }
};

// Helper functions

function calculateMonthStats(quotes) {
  const stats = {
    totalRevenue: 0,
    activeQuotes: 0,
    completedJobs: 0,
    avgJobValue: 0,
    byStatus: {
      draft: 0,
      sent: 0,
      accepted: 0,
      scheduled: 0,
      rejected: 0
    }
  };

  const acceptedQuotes = [];

  for (const quote of quotes) {
    const total = Number.parseFloat(quote.total || 0);

    // Count by status
    if (quote.status === 'draft') stats.byStatus.draft++;
    else if (quote.status === 'sent') stats.byStatus.sent++;
    else if (quote.status === 'accepted') stats.byStatus.accepted++;
    else if (quote.status === 'scheduled') stats.byStatus.scheduled++;
    else if (quote.status === 'rejected') stats.byStatus.rejected++;

    // Active quotes (draft + sent)
    if (quote.status === 'draft' || quote.status === 'sent') {
      stats.activeQuotes++;
    }

    // Completed jobs and revenue (accepted + scheduled)
    if (quote.status === 'accepted' || quote.status === 'scheduled') {
      stats.completedJobs++;
      stats.totalRevenue += total;
      acceptedQuotes.push(quote);
    }
  }

  // Calculate average job value
  if (acceptedQuotes.length > 0) {
    stats.avgJobValue = stats.totalRevenue / acceptedQuotes.length;
  }

  return stats;
}

function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

function formatChange(value, isPercentage) {
  if (value === 0) {
    return isPercentage ? '0%' : '0';
  }
  
  const sign = value > 0 ? '+' : '';
  
  if (isPercentage) {
    return `${sign}${value.toFixed(1)}%`;
  } else {
    return `${sign}${Math.round(value)}`;
  }
}
