import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { message, Button, Alert, Card, Row, Col, Statistic, Progress } from 'antd'
import { Mail, CheckCircle, TrendingUp, TrendingDown, DollarSign, Users, FileText, Clock } from 'lucide-react'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

function DashboardPage () {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Job Analytics Data
  const jobAnalyticsData = [
    { name: 'Material %', value: 35, color: '#3b82f6' }, // Blue
    { name: 'Labor %', value: 40, color: '#10b981' },    // Green
    { name: 'Overhead %', value: 15, color: '#f59e0b' }, // Orange
    { name: 'Net Profit %', value: 10, color: '#8b5cf6' } // Purple
  ]

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

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

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
      <div className='content-wrapper'>
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
            value='$87,100' 
            change='+12.5%' 
            isPositive={true}
            icon={<DollarSign className="w-6 h-6" />}
            color="blue"
          />
          <StatCard 
            title='Active Quotes' 
            value='25' 
            change='+3' 
            isPositive={true}
            icon={<FileText className="w-6 h-6" />}
            color="green"
          />
          <StatCard 
            title='Completed Jobs' 
            value='142' 
            change='+18' 
            isPositive={true}
            icon={<CheckCircle className="w-6 h-6" />}
            color="purple"
          />
          <StatCard 
            title='Avg. Job Value' 
            value='$3,484' 
            change='+8.2%' 
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
              <Button size="small" type="link">View Details</Button>
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
                    outerRadius={80}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {jobAnalyticsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `${value}%`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Breakdown Details */}
            <div className="mt-6 space-y-3">
              {jobAnalyticsData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{item.value}%</span>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Jobs</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">142</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Avg. Margin</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600">10%</p>
                </div>
              </div>
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
                <Button size="small" type="link">View All</Button>
              </div>
              <div className='space-y-4'>
                <ActivityItem 
                  title='Quote #1247 - Johnson Residence' 
                  description='Interior painting - 3 rooms'
                  time='2 hours ago' 
                  status='pending'
                  amount='$2,450'
                />
                <ActivityItem 
                  title='Quote #1246 - Smith Property' 
                  description='Exterior painting - Full house'
                  time='5 hours ago' 
                  status='accepted'
                  amount='$8,750'
                />
                <ActivityItem 
                  title='Quote #1245 - Davis Commercial' 
                  description='Office repaint - 12 rooms'
                  time='1 day ago' 
                  status='completed'
                  amount='$15,200'
                />
                <ActivityItem 
                  title='Quote #1244 - Brown Condo' 
                  description='Kitchen cabinets refinishing'
                  time='2 days ago' 
                  status='declined'
                  amount='$3,100'
                />
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
                    value={48}
                    valueStyle={{ color: '#3b82f6', fontSize: '24px' }}
                    prefix={<FileText className="w-4 h-4" />}
                  />
                </Card>
                <Card className="text-center">
                  <Statistic
                    title="Conversion"
                    value={68}
                    valueStyle={{ color: '#10b981', fontSize: '24px' }}
                    suffix="%"
                    prefix={<TrendingUp className="w-4 h-4" />}
                  />
                </Card>
                <Card className="text-center">
                  <Statistic
                    title="Avg. Response"
                    value={2.4}
                    valueStyle={{ color: '#f59e0b', fontSize: '24px' }}
                    suffix="hrs"
                    prefix={<Clock className="w-4 h-4" />}
                  />
                </Card>
                <Card className="text-center">
                  <Statistic
                    title="Revenue"
                    value={87.1}
                    valueStyle={{ color: '#8b5cf6', fontSize: '24px' }}
                    prefix="$"
                    suffix="K"
                  />
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}

function StatCard ({ title, value, change, isPositive, icon, color }) {
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

function ActionButton ({ label, onClick, icon }) {
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

function ActivityItem ({ title, description, time, status, amount }) {
  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    accepted: { color: 'bg-green-100 text-green-800', label: 'Accepted' },
    completed: { color: 'bg-blue-100 text-blue-800', label: 'Completed' },
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
