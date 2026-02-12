// controllers/dashboardController.js
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Quote = require('../models/Quote');
const Lead = require('../models/Lead');
const ContractorSettings = require('../models/ContractorSettings');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



/**
 * GET /api/v1/dashboard/stats
 * Get comprehensive dashboard statistics with caching and parallel execution
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;


        // Get current month date range
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        console.time('DB Query: getDashboardStats (Parallel)');
        // Execute queries in parallel but sharing ONE connection via a transaction
        const [currentMonthStats, lastMonthStats, totalRevenueResult, finalPaymentsRevenue] = await sequelize.transaction(async (t) => {
            return await Promise.all([
                // Current month aggregated stats
                Quote.findAll({
                    where: {
                        tenantId,
                        isActive: true,
                        createdAt: { [Op.gte]: firstDayOfMonth }
                    },
                    attributes: [
                        'status',
                        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('total'), 'DECIMAL(10,2)')), 'totalValue'],
                        [sequelize.fn('SUM',
                            sequelize.literal(`CASE 
                  WHEN deposit_verified = true 
                  AND deposit_transaction_id IS NOT NULL 
                  AND deposit_payment_method = 'stripe' 
                  THEN CAST(deposit_amount AS DECIMAL(10,2)) 
                  ELSE 0 
                END`)
                        ), 'revenue']
                    ],
                    group: ['status'],
                    raw: true,
                    transaction: t
                }),

                // Last month aggregated stats  
                Quote.findAll({
                    where: {
                        tenantId,
                        isActive: true,
                        createdAt: {
                            [Op.gte]: firstDayOfLastMonth,
                            [Op.lte]: lastDayOfLastMonth
                        }
                    },
                    attributes: [
                        'status',
                        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                        [sequelize.fn('SUM',
                            sequelize.literal(`CASE 
                  WHEN deposit_verified = true 
                  AND deposit_transaction_id IS NOT NULL 
                  AND deposit_payment_method = 'stripe' 
                  THEN CAST(deposit_amount AS DECIMAL(10,2)) 
                  ELSE 0 
                END`)
                        ), 'revenue']
                    ],
                    group: ['status'],
                    raw: true,
                    transaction: t
                }),

                // All-time total revenue from Stripe (deposits only)
                Quote.findOne({
                    where: {
                        tenantId,
                        isActive: true,
                        depositVerified: true,
                        depositTransactionId: { [Op.ne]: null },
                        depositPaymentMethod: 'stripe'
                    },
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('deposit_amount'), 'DECIMAL(10,2)')), 'totalRevenue']
                    ],
                    raw: true,
                    transaction: t
                }),

                // All-time final payments revenue from Jobs
                sequelize.query(`
            SELECT COALESCE(SUM(CAST(final_payment_amount AS DECIMAL(10,2))), 0) as totalFinalPayments
            FROM jobs
            WHERE tenant_id = :tenantId
            AND final_payment_status = 'paid'
            AND final_payment_transaction_id IS NOT NULL
          `, {
                    replacements: { tenantId },
                    type: sequelize.QueryTypes.SELECT,
                    raw: true,
                    transaction: t
                })
            ]);
        });
        console.timeEnd('DB Query: getDashboardStats (Parallel)');

        // Process aggregated results
        const processStats = (stats) => {
            const result = {
                activeQuotes: 0,
                completedJobs: 0,
                totalValue: 0,
                revenue: 0,
                byStatus: {
                    draft: 0, sent: 0, accepted: 0, deposit_paid: 0,
                    scheduled: 0, completed: 0, rejected: 0, declined: 0
                }
            };

            stats.forEach(row => {
                const count = parseInt(row.count) || 0;
                const revenue = parseFloat(row.revenue) || 0;
                const totalValue = parseFloat(row.totalValue) || 0;

                result.byStatus[row.status] = count;
                result.revenue += revenue;
                result.totalValue += totalValue;

                if (['sent', 'accepted', 'deposit_paid', 'scheduled'].includes(row.status)) {
                    result.activeQuotes += count;
                }
                if (['completed', 'scheduled'].includes(row.status)) {
                    result.completedJobs += count;
                }
            });

            result.avgJobValue = result.completedJobs > 0
                ? result.totalValue / result.completedJobs
                : 0;

            return result;
        };

        const currentStats = processStats(currentMonthStats);
        const lastStats = processStats(lastMonthStats);
        const depositRevenue = parseFloat(totalRevenueResult?.totalRevenue) || 0;
        const finalPaymentRevenue = parseFloat(finalPaymentsRevenue[0]?.totalFinalPayments) || 0;
        const totalRevenue = depositRevenue + finalPaymentRevenue;

        // Calculate changes (percentage or absolute)
        const revenueChange = calculatePercentageChange(currentStats.revenue, lastStats.revenue);
        const quotesChange = currentStats.activeQuotes - lastStats.activeQuotes;
        const jobsChange = currentStats.completedJobs - lastStats.completedJobs;
        const avgChange = calculatePercentageChange(currentStats.avgJobValue, lastStats.avgJobValue);

        const dashboardData = {
            stats: {
                totalRevenue: totalRevenue, // All-time revenue from verified Stripe payments
                currentMonthRevenue: currentStats.revenue, // Current month revenue
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


        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        console.time('DB Query: getMonthlyPerformance (Parallel)');
        // Use a transaction to share the same connection for parallel queries
        const [statsResult, responseTimeData] = await sequelize.transaction(async (t) => {
            return await Promise.all([
                // Aggregated stats query
                Quote.findOne({
                    where: {
                        tenantId,
                        isActive: true,
                        createdAt: { [Op.gte]: firstDayOfMonth }
                    },
                    attributes: [
                        [sequelize.fn('COUNT', sequelize.literal(`CASE WHEN status != 'draft' THEN 1 END`)), 'sentCount'],
                        [sequelize.fn('COUNT', sequelize.literal(`CASE WHEN status IN ('accepted', 'scheduled') THEN 1 END`)), 'acceptedCount'],
                        [sequelize.fn('SUM',
                            sequelize.literal(`CASE 
                  WHEN deposit_verified = true 
                  AND deposit_transaction_id IS NOT NULL 
                  AND deposit_payment_method = 'stripe' 
                  THEN CAST(deposit_amount AS DECIMAL(10,2)) 
                  ELSE 0 
                END`)
                        ), 'totalRevenue']
                    ],
                    raw: true,
                    transaction: t
                }),

                // Response time calculation (only for accepted quotes with timestamps)
                Quote.findAll({
                    where: {
                        tenantId,
                        isActive: true,
                        createdAt: { [Op.gte]: firstDayOfMonth },
                        status: { [Op.in]: ['accepted', 'scheduled'] },
                        approvedAt: { [Op.ne]: null }
                    },
                    attributes: ['createdAt', 'approvedAt'],
                    raw: true,
                    transaction: t
                })
            ]);
        });
        console.timeEnd('DB Query: getMonthlyPerformance (Parallel)');

        const sentCount = parseInt(statsResult?.sentCount) || 0;
        const acceptedCount = parseInt(statsResult?.acceptedCount) || 0;
        const totalRevenue = parseFloat(statsResult?.totalRevenue) || 0;

        const conversionRate = sentCount > 0
            ? ((acceptedCount / sentCount) * 100).toFixed(1)
            : '0.0';

        // Calculate average response time from loaded data
        let totalResponseTime = 0;
        let quotesWithResponse = responseTimeData.length;

        for (const quote of responseTimeData) {
            const responseTime = (new Date(quote.approvedAt) - new Date(quote.createdAt)) / (1000 * 60 * 60); // hours
            totalResponseTime += responseTime;
        }

        const avgResponseTime = quotesWithResponse > 0
            ? (totalResponseTime / quotesWithResponse).toFixed(1)
            : '0.0';

        const performanceData = {
            quotesSent: sentCount,
            conversionRate: conversionRate,
            avgResponseTime: avgResponseTime,
            revenue: (totalRevenue / 1000).toFixed(1) // in thousands, from real Stripe payments
        };



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
 * Get recent quote activity with caching
 */
exports.getRecentActivity = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const limit = parseInt(req.query.limit) || 10;


        console.time('DB Query: getRecentActivity');
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
            limit,
            raw: true // Use raw for better performance
        });
        console.timeEnd('DB Query: getRecentActivity');

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
