import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { message, Button, Alert, Card, Row, Col, Statistic, Progress, Spin } from 'antd'
import { Mail, CheckCircle, TrendingUp, TrendingDown, DollarSign, Users, FileText, Clock } from 'lucide-react'
import { apiService } from '../services/apiService'
import dashboardService from '../services/dashboardService'
import MainLayout from '../components/MainLayout'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useState, useEffect } from 'react'
import { useAbortableEffect, isAbortError } from '../hooks/useAbortableEffect'

function DashboardPage() {
    const navigate = useNavigate()
    const { user } = useAuth()

    // State for dashboard data
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeQuotes: 0,
        completedJobs: 0,
        avgJobValue: 0,
        revenueChange: '+0%',
        quotesChange: '+0',
        jobsChange: '+0',
        avgChange: '+0%'
    })
    const [jobAnalyticsData, setJobAnalyticsData] = useState([
        { name: 'Materials', value: 0, color: '#3b82f6' },
        { name: 'Labor', value: 0, color: '#10b981' },
        { name: 'Overhead', value: 0, color: '#f59e0b' },
        { name: 'Net Profit', value: 0, color: '#8b5cf6' }
    ])
    const [recentActivity, setRecentActivity] = useState([])
    const [monthlyPerformance, setMonthlyPerformance] = useState({
        quotesSent: 0,
        conversionRate: '0.0',
        avgResponseTime: '0.0',
        revenue: '0.0'
    })
    const [totalJobs, setTotalJobs] = useState(0)
    const [avgMargin, setAvgMargin] = useState(10)

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

    // Fetch dashboard data on mount
    useAbortableEffect((signal) => {
        fetchDashboardData(signal);
    }, []);

    const fetchDashboardData = async (signal) => {
        setLoading(true)

        // Start all requests in parallel
        const statsPromise = dashboardService.getDashboardStats({ signal });
        const analyticsPromise = fetchJobAnalyticsSummary(signal);
        const performancePromise = dashboardService.getMonthlyPerformance({ signal });
        const activityPromise = dashboardService.getRecentActivity(10, { signal });

        // Handle Stats
        statsPromise.then(dashboardStats => {
            if (signal?.aborted) return;
            if (dashboardStats.success && dashboardStats.data.stats) {
                const statsData = dashboardStats.data.stats;
                setStats({
                    totalRevenue: statsData.totalRevenue || 0,
                    activeQuotes: statsData.activeQuotes || 0,
                    completedJobs: statsData.completedJobs || 0,
                    avgJobValue: statsData.avgJobValue || 0,
                    revenueChange: statsData.revenueChange || '0%',
                    quotesChange: statsData.quotesChange || '0',
                    jobsChange: statsData.jobsChange || '0',
                    avgChange: statsData.avgChange || '0%'
                });
            }
        }).catch(err => console.error('Stats fetch failed', err));

        // Handle Analytics
        analyticsPromise.then(analytics => {
            if (signal?.aborted) return;
            if (analytics.success && analytics.data) {
                const { averages, totalJobs } = analytics.data;
                if (averages) {
                    const total = averages.materialPercentage + averages.laborPercentage +
                        averages.overheadPercentage + averages.profitPercentage;

                    // Only adjust if total is > 0 to avoid 100% profit display when data is missing
                    const adjustedProfit = (total > 0 && total !== 100)
                        ? averages.profitPercentage + (100 - total)
                        : averages.profitPercentage;

                    setJobAnalyticsData([
                        { name: 'Materials', value: averages.materialPercentage, amount: averages.averageJobPrice * (averages.materialPercentage / 100), color: '#3b82f6' },
                        { name: 'Labor', value: averages.laborPercentage, amount: averages.averageJobPrice * (averages.laborPercentage / 100), color: '#10b981' },
                        { name: 'Overhead', value: averages.overheadPercentage, amount: averages.averageJobPrice * (averages.overheadPercentage / 100), color: '#f59e0b' },
                        { name: 'Net Profit', value: adjustedProfit, amount: averages.averageJobPrice * (adjustedProfit / 100), color: '#8b5cf6' }
                    ]);
                    setAvgMargin(adjustedProfit);
                }
                setTotalJobs(totalJobs || 0);
            }
        }).catch(err => console.error('Analytics fetch failed', err));

        // Handle Performance
        performancePromise.then(performance => {
            if (signal?.aborted) return;
            if (performance.success) setMonthlyPerformance(performance.data);
        }).catch(err => console.error('Performance fetch failed', err));

        // Handle Activity
        activityPromise.then(activity => {
            if (signal?.aborted) return;
            if (activity.success) setRecentActivity(activity.data || []);
        }).catch(err => console.error('Activity fetch failed', err))
            .finally(() => {
                if (!signal?.aborted) setLoading(false);
            });
    }

    // Fetch job analytics summary from our new API
    const fetchJobAnalyticsSummary = async (signal) => {
        try {
            // Use the completed jobs endpoint which calculates analytics on-the-fly
            const response = await apiService.get('/job-analytics/completed-jobs', null, { signal });

            if (signal && signal.aborted) return { success: false, data: null };

            if (response.success && response.data) {
                const { jobs, summary } = response.data;

                // If no completed jobs, return empty
                if (summary.totalCompletedJobs === 0) {
                    return {
                        success: true,
                        data: {
                            totalJobs: 0,
                            averages: null
                        }
                    };
                }

                // Get all jobs that have analytics (either stored or calculated on-the-fly)
                const jobsWithAnalytics = jobs.filter(j => j.analytics);

                if (jobsWithAnalytics.length === 0) {
                    return {
                        success: true,
                        data: {
                            totalJobs: summary.totalCompletedJobs,
                            averages: null
                        }
                    };
                }

                // Calculate averages from all jobs with analytics
                const totals = jobsWithAnalytics.reduce((acc, job) => {
                    const analytics = job.analytics;
                    acc.materialPercentage += analytics.materialPercentage || 0;
                    acc.laborPercentage += analytics.laborPercentage || 0;
                    acc.overheadPercentage += analytics.overheadPercentage || 0;
                    acc.profitPercentage += analytics.profitPercentage || 0;
                    acc.jobPrice += job.jobPrice || 0;
                    return acc;
                }, {
                    materialPercentage: 0,
                    laborPercentage: 0,
                    overheadPercentage: 0,
                    profitPercentage: 0,
                    jobPrice: 0
                });

                const count = jobsWithAnalytics.length;
                const averages = {
                    materialPercentage: parseFloat((totals.materialPercentage / count).toFixed(2)),
                    laborPercentage: parseFloat((totals.laborPercentage / count).toFixed(2)),
                    overheadPercentage: parseFloat((totals.overheadPercentage / count).toFixed(2)),
                    profitPercentage: parseFloat((totals.profitPercentage / count).toFixed(2)),
                    averageJobPrice: parseFloat((totals.jobPrice / count).toFixed(2))
                };

                return {
                    success: true,
                    data: {
                        totalJobs: summary.totalCompletedJobs,
                        averages: averages
                    }
                };
            }

            return { success: false, data: null };
        } catch (error) {
            if (isAbortError(error)) {
                console.log('Job analytics fetch aborted');
                return { success: false, data: null };
            }
            console.error('Error fetching job analytics summary:', error);
            return { success: false, data: null };
        }
    }

    const handleSendVerification = async () => {
        try {
            const data = await apiService.post('/auth/send-verification')

            if (data.success) {
                message.success('Verification email sent! Please check your email.')
            } else {
                message.error(data.message || 'Failed to send verification email')
            }
        } catch (error) {
            message.error('Failed to send verification email')
        }
    }

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
        const RADIAN = Math.PI / 180
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
        const x = cx + radius * Math.cos(-midAngle * RADIAN)
        const y = cy + radius * Math.sin(-midAngle * RADIAN)

        // Only show label if value is greater than 0
        if (value === 0) return null

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                className="font-semibold text-sm"
            >
                {`${value}%`}
            </text>
        )
    }

    const getTimeAgo = (dateString) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffInMs = now - date
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
            return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
        } else if (diffInHours < 24) {
            return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
        } else if (diffInDays < 7) {
            return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
    }

    return (
        <div className='content-wrapper'>
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <Spin size="large" tip="Loading dashboard..." />
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4 sm:gap-0'>
                        <div>
                            <h2 className='text-2xl sm:text-3xl font-bold text-gray-900'>Dashboard</h2>
                            <p className='text-sm sm:text-base text-gray-600 mt-1'>
                                Welcome back, {user?.fullName || user?.email || 'User'}
                            </p>
                        </div>
                        <div className='text-left sm:text-right'>
                            <p className='text-xs sm:text-sm text-gray-500'>Today</p>
                            <p className='text-base sm:text-lg font-semibold text-gray-900'>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {/* Email Verification Status Alert */}
                    {user && (
                        <Alert
                            message={user.emailVerified ? 'Email Verified' : 'Email Verification Required'}
                            description={
                                user.emailVerified
                                    ? 'Your email address has been successfully verified.'
                                    : 'Please verify your email address to access all features. Check your email for a verification link or click the button below to resend.'
                            }
                            type={user.emailVerified ? 'success' : 'warning'}
                            className='mb-6'
                            showIcon
                            icon={user.emailVerified ? <CheckCircle className='w-4 h-4' /> : null}
                            action={
                                !user.emailVerified && (
                                    <Button size='small' type='primary' onClick={handleSendVerification}>
                                        <Mail className='w-4 h-4 mr-1' />
                                        Resend Verification
                                    </Button>
                                )
                            }
                        />
                    )}

                    {/* Stats Grid */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8'>
                        <StatCard
                            title='Total Revenue'
                            value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                            change={stats.revenueChange}
                            isPositive={true}
                            icon={<DollarSign className="w-6 h-6" />}
                            color="blue"
                        />
                        <StatCard
                            title='Active Quotes'
                            value={stats.activeQuotes.toString()}
                            change={stats.quotesChange}
                            isPositive={true}
                            icon={<FileText className="w-6 h-6" />}
                            color="green"
                        />
                        <StatCard
                            title='Completed Jobs'
                            value={stats.completedJobs.toString()}
                            change={stats.jobsChange}
                            isPositive={true}
                            icon={<CheckCircle className="w-6 h-6" />}
                            color="purple"
                        />
                        <StatCard
                            title='Avg. Job Value'
                            value={`$${stats.avgJobValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                            change={stats.avgChange}
                            isPositive={true}
                            icon={<TrendingUp className="w-6 h-6" />}
                            color="orange"
                        />
                    </div>

                    {/* Main Content Area */}
                    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8'>
                        {/* Job Analytics - Donut Chart */}
                        <div className='lg:col-span-1 bg-white rounded-xl shadow-lg p-6 sm:p-8'>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className='text-lg sm:text-xl font-bold text-gray-900'>
                                    Job Analytics
                                </h3>
                                {/* <Button 
                type="link" 
                size="small"
                onClick={() => navigate('/job-analytics')}
                className="text-blue-600 hover:text-blue-700"
              >
                View Details
              </Button> */}
                            </div>

                            <div className="h-64 sm:h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={jobAnalyticsData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={renderCustomLabel}
                                            outerRadius={window.innerWidth < 640 ? 60 : 80}
                                            innerRadius={window.innerWidth < 640 ? 30 : 40}
                                            fill="#8884d8"
                                            dataKey="value"
                                            paddingAngle={2}
                                        >
                                            {jobAnalyticsData.map((entry, index) => (
                                                <Cell key={`cell-${entry.name}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value, name, props) => {
                                                const amount = props.payload.amount || 0;
                                                return [
                                                    `${value.toFixed(1)}% ($${amount.toLocaleString('en-US', {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0
                                                    })})`,
                                                    name
                                                ];
                                            }}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #e5e7eb',
                                                fontSize: '14px',
                                                padding: '8px 12px'
                                            }}
                                        />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: '12px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Breakdown Details - Read-only per spec */}
                            <div className="mt-6 space-y-3">
                                <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                                    <span>Cost Breakdown (Read-only)</span>
                                    {totalJobs > 0 && (
                                        <span className="font-medium">
                                            Total: {jobAnalyticsData.reduce((sum, item) => sum + item.value, 0).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                {jobAnalyticsData.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500">
                                                ${(item.amount || 0).toLocaleString('en-US', {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0
                                                })}
                                            </span>
                                            <span className="text-sm font-bold text-gray-900 w-12 text-right">
                                                {item.value.toFixed(1)}%
                                            </span>
                                            <Progress
                                                percent={item.value}
                                                strokeColor={item.color}
                                                showInfo={false}
                                                className="w-16 sm:w-20"
                                                size="small"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-200">
                                {totalJobs === 0 ? (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 mb-2">No completed jobs with analytics yet</p>
                                        <p className="text-xs text-gray-400">
                                            Complete jobs and configure overhead target in Settings to view analytics
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Total Jobs</p>
                                                <p className="text-lg sm:text-xl font-bold text-gray-900">{totalJobs}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Net Profit Margin</p>
                                                <p className={`text-lg sm:text-xl font-bold ${avgMargin >= 8 ? 'text-green-600' : avgMargin >= 0 ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {avgMargin.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                                            <p className="font-medium text-gray-700 mb-1">Analytics Formula:</p>
                                            <p>Materials (actual) + Labor (actual/estimated) + Overhead (allocated) + Net Profit (remainder) = 100%</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions & Recent Activity */}
                        <div className='lg:col-span-2 space-y-6 sm:space-y-8'>
                            {/* Quick Actions */}
                            <div className='bg-white rounded-xl shadow-lg p-6 sm:p-8'>
                                <h3 className='text-lg sm:text-xl font-bold text-gray-900 mb-6'>
                                    Quick Actions
                                </h3>
                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                                    <ActionButton
                                        label='Create New Quote'
                                        onClick={() => navigate('/quotes/new')}
                                        icon={<FileText className="w-5 h-5" />}
                                    />
                                    <ActionButton
                                        label='View All Quotes'
                                        onClick={() => navigate('/quotes')}
                                        icon={<CheckCircle className="w-5 h-5" />}
                                    />
                                    <ActionButton
                                        label='Settings'
                                        onClick={() => navigate('/settings')}
                                        icon={<Users className="w-5 h-5" />}
                                    />
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className='bg-white rounded-xl shadow-lg p-6 sm:p-8'>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className='text-lg sm:text-xl font-bold text-gray-900'>
                                        Recent Activity
                                    </h3>
                                    <Button size="small" type="link" onClick={() => navigate('/quotes')}>View All</Button>
                                </div>
                                <div className='space-y-4'>
                                    {recentActivity.length > 0 ? (
                                        recentActivity.slice(0, 4).map((activity) => (
                                            <ActivityItem
                                                key={activity.id}
                                                title={`Quote #${activity.quoteNumber} - ${activity.customerName}`}
                                                description={activity.description}
                                                time={getTimeAgo(activity.createdAt)}
                                                status={activity.status}
                                                amount={`$${Number.parseFloat(activity.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>No recent activity</p>
                                            <Button type="primary" className="mt-4" onClick={() => navigate('/quotes/new')}>
                                                Create Your First Quote
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Monthly Performance */}
                            <div className='bg-white rounded-xl shadow-lg p-6 sm:p-8'>
                                <h3 className='text-lg sm:text-xl font-bold text-gray-900 mb-6'>
                                    Monthly Performance
                                </h3>
                                <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6'>
                                    <Card className="text-center">
                                        <Statistic
                                            title="Quotes Sent"
                                            value={monthlyPerformance.quotesSent}
                                            valueStyle={{ color: '#3b82f6', fontSize: '24px' }}
                                            prefix={<FileText className="w-4 h-4" />}
                                        />
                                    </Card>
                                    <Card className="text-center">
                                        <Statistic
                                            title="Conversion"
                                            value={monthlyPerformance.conversionRate}
                                            valueStyle={{ color: '#10b981', fontSize: '24px' }}
                                            suffix="%"
                                            prefix={<TrendingUp className="w-4 h-4" />}
                                        />
                                    </Card>
                                    <Card className="text-center">
                                        <Statistic
                                            title="Avg. Response"
                                            value={monthlyPerformance.avgResponseTime}
                                            valueStyle={{ color: '#f59e0b', fontSize: '24px' }}
                                            suffix="hrs"
                                            prefix={<Clock className="w-4 h-4" />}
                                        />
                                    </Card>
                                    <Card className="text-center">
                                        <Statistic
                                            title="Revenue"
                                            value={monthlyPerformance.revenue}
                                            valueStyle={{ color: '#8b5cf6', fontSize: '24px' }}
                                            prefix="$"
                                            suffix="K"
                                        />
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({ title, value, change, isPositive, icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600'
    }

    const changeColor = isPositive ? 'text-green-600' : 'text-red-600'
    const ChangeIcon = isPositive ? TrendingUp : TrendingDown

    return (
        <div className='bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow duration-200'>
            <div className="flex items-center justify-between mb-3">
                <p className='text-gray-600 text-xs sm:text-sm font-medium'>{title}</p>
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    {icon}
                </div>
            </div>
            <p className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2'>{value}</p>
            <div className={`flex items-center gap-1 ${changeColor} text-xs sm:text-sm font-semibold`}>
                <ChangeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{change} from last month</span>
            </div>
        </div>
    )
}

function ActionButton({ label, onClick, icon }) {
    return (
        <button
            onClick={onClick}
            className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 w-full'
        >
            {icon}
            <span className="text-sm sm:text-base">{label}</span>
        </button>
    )
}

function ActivityItem({ title, description, time, status, amount }) {
    const statusConfig = {
        draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
        sent: { color: 'bg-yellow-100 text-yellow-800', label: 'Sent' },
        pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
        accepted: { color: 'bg-green-100 text-green-800', label: 'Accepted' },
        deposit_paid: { color: 'bg-blue-100 text-blue-800', label: 'Deposit Paid' },
        scheduled: { color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
        completed: { color: 'bg-blue-100 text-blue-800', label: 'Completed' },
        rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
        declined: { color: 'bg-red-100 text-red-800', label: 'Declined' }
    }

    const config = statusConfig[status] || statusConfig.pending

    return (
        <div className='pb-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 p-3 rounded-lg transition-colors duration-150'>
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <p className='text-gray-900 font-semibold text-sm sm:text-base'>{title}</p>
                    <p className='text-gray-600 text-xs sm:text-sm mt-1'>{description}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} whitespace-nowrap ml-2`}>
                    {config.label}
                </span>
            </div>
            <div className="flex items-center justify-between mt-2">
                <p className='text-gray-500 text-xs sm:text-sm'>{time}</p>
                <p className='text-gray-900 font-bold text-sm sm:text-base'>{amount}</p>
            </div>
        </div>
    )
}

export default DashboardPage
