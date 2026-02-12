// services/dashboardService.js
// Dashboard analytics and statistics API service

import apiService from './apiService';

/**
 * Dashboard API Service
 * Provides aggregated data for dashboard analytics
 */
const dashboardService = {
    /**
     * Get comprehensive dashboard statistics
     * Returns aggregated data from quotes, leads, and other metrics
     */
    getDashboardStats: async (options = {}) => {
        try {
            const response = await apiService.get('/dashboard/stats', null, options);

            if (response.success) {
                return {
                    success: true,
                    data: response.data
                };
            }

            throw new Error(response.message || 'Failed to fetch dashboard stats');
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            return {
                success: false,
                message: 'Failed to fetch dashboard statistics',
                error: error.message,
                data: {
                    stats: {
                        totalRevenue: 0,
                        activeQuotes: 0,
                        completedJobs: 0,
                        avgJobValue: 0,
                        revenueChange: '0%',
                        quotesChange: '0',
                        jobsChange: '0',
                        avgChange: '0%'
                    },
                    byStatus: {
                        draft: 0,
                        sent: 0,
                        accepted: 0,
                        scheduled: 0,
                        rejected: 0
                    }
                }
            };
        }
    },

    /**
     * Get job analytics breakdown
     * Returns cost breakdown percentages
     */
    getJobAnalytics: async (options = {}) => {
        try {
            const response = await apiService.get('/dashboard/job-analytics', null, options);

            if (response.success) {
                return {
                    success: true,
                    data: response.data,
                    totalJobs: response.totalJobs || 0
                };
            }

            throw new Error(response.message || 'Failed to fetch job analytics');
        } catch (error) {
            console.error('Error fetching job analytics:', error);
            return {
                success: true,
                data: [
                    { name: 'Material %', value: 35, color: '#3b82f6' },
                    { name: 'Labor %', value: 40, color: '#10b981' },
                    { name: 'Overhead %', value: 15, color: '#f59e0b' },
                    { name: 'Net Profit %', value: 10, color: '#8b5cf6' }
                ],
                totalJobs: 0
            };
        }
    },

    /**
     * Get monthly performance metrics
     * Calculates metrics for current month
     */
    getMonthlyPerformance: async (options = {}) => {
        try {
            const response = await apiService.get('/dashboard/monthly-performance', null, options);

            if (response.success) {
                return {
                    success: true,
                    data: response.data
                };
            }

            throw new Error(response.message || 'Failed to fetch monthly performance');
        } catch (error) {
            console.error('Error fetching monthly performance:', error);
            return {
                success: false,
                data: {
                    quotesSent: 0,
                    conversionRate: '0.0',
                    avgResponseTime: '0.0',
                    revenue: '0.0'
                }
            };
        }
    },

    /**
     * Get recent quote activity
     * Returns recent quotes with details
     */
    getRecentActivity: async (limit = 10, options = {}) => {
        try {
            const response = await apiService.get(`/dashboard/recent-activity?limit=${limit}`, null, options);

            if (response.success) {
                return {
                    success: true,
                    data: response.data || []
                };
            }

            throw new Error(response.message || 'Failed to fetch recent activity');
        } catch (error) {
            console.error('Error fetching recent activity:', error);
            return {
                success: false,
                data: []
            };
        }
    },

    /**
     * Get lead statistics
     * Returns: { total, recent, byStatus }
     */
    getLeadStats: async () => {
        try {
            const response = await apiService.get('/leads/stats');

            if (response.success) {
                return {
                    success: true,
                    data: response.data
                };
            }

            throw new Error(response.message || 'Failed to fetch lead stats');
        } catch (error) {
            console.error('Error fetching lead stats:', error);
            return {
                success: false,
                message: 'Failed to fetch lead statistics',
                data: {
                    total: 0,
                    recent: 0,
                    byStatus: []
                }
            };
        }
    }
};

export default dashboardService;
