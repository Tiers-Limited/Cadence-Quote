// controllers/dashboardController.js
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Quote = require('../models/Quote');
const Lead = require('../models/Lead');
const ContractorSettings = require('../models/ContractorSettings');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * GET /api/v1/dashboard/stats
 * Get comprehensive dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get current month date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch all quotes with deposit payments for current month
    const currentMonthQuotes = await Quote.findAll({
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
      ]
    });

    // Fetch quotes with verified deposits for revenue calculation (from Stripe)
    const paidQuotes = await Quote.findAll({
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
      attributes: ['id', 'total', 'depositAmount', 'depositTransactionId']
    });

    // Calculate actual revenue from Stripe payments
    let totalRevenue = 0;
    for (const quote of paidQuotes) {
      // Use deposit amount as revenue (deposit paid via Stripe)
      totalRevenue += Number.parseFloat(quote.depositAmount || 0);
    }

    // Fetch all quotes for last month (for comparison)
    const lastMonthQuotes = await Quote.findAll({
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
      attributes: ['depositAmount']
    });

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

    return res.json({
      success: true,
      data: {
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
      }
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
 * Get job cost breakdown analytics from Pricing Engine settings
 */
exports.getJobAnalytics = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Fetch contractor settings to get pricing engine margins
    const settings = await ContractorSettings.findOne({
      where: { tenantId },
      attributes: [
        'materialMarkupPercent',
        'laborMarkupPercent',
        'overheadPercent',
        'netProfitPercent'
      ]
    });

    if (!settings) {
      // Return default percentages if no settings found
      return res.json({
        success: true,
        data: [
          { name: 'Material %', value: 35, color: '#3b82f6' },
          { name: 'Labor %', value: 40, color: '#10b981' },
          { name: 'Overhead %', value: 15, color: '#f59e0b' },
          { name: 'Net Profit %', value: 10, color: '#8b5cf6' }
        ],
        avgMargin: 10
      });
    }

    // Get percentages from pricing engine settings
    const materialPercent = Number.parseFloat(settings.materialMarkupPercent || 35);
    const laborPercent = Number.parseFloat(settings.laborMarkupPercent || 40);
    const overheadPercent = Number.parseFloat(settings.overheadPercent || 15);
    const netProfitPercent = Number.parseFloat(settings.netProfitPercent || 10);

    return res.json({
      success: true,
      data: [
        { name: 'Material %', value: materialPercent, color: '#3b82f6' },
        { name: 'Labor %', value: laborPercent, color: '#10b981' },
        { name: 'Overhead %', value: overheadPercent, color: '#f59e0b' },
        { name: 'Net Profit %', value: netProfitPercent, color: '#8b5cf6' }
      ],
      avgMargin: netProfitPercent
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
 * Get monthly performance metrics with real Stripe revenue
 */
exports.getMonthlyPerformance = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

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
      ]
    });

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

    return res.json({
      success: true,
      data: {
        quotesSent: sentQuotes.length,
        conversionRate: conversionRate,
        avgResponseTime: avgResponseTime,
        revenue: (totalRevenue / 1000).toFixed(1) // in thousands, from real Stripe payments
      }
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
