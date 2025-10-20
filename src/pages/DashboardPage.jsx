import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { message, Button, Alert } from 'antd'
import { Mail, CheckCircle } from 'lucide-react'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'

function DashboardPage () {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

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

  return (
  
      <div className='content-wrapper'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4 sm:gap-0'>
          <div>
            <h2 className='text-2xl sm:text-3xl font-bold text-gray-900'>Welcome Back!</h2>
            <p className='text-sm sm:text-base text-gray-600 mt-1'>
              Logged in as: {user?.email || 'User'}
            </p>
          </div>
          <div className='text-left sm:text-right'>
            <p className='text-xs sm:text-sm text-gray-500'>Today</p>
            <p className='text-base sm:text-lg font-semibold text-gray-900'>
              {new Date().toLocaleDateString()}
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
        <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mb-8'>
          <StatCard title='Total Revenue' value='$87,100' change='+12.5%' />
          <StatCard title='Active Projects' value='25' change='+3' />
          <StatCard title='Team Members' value='12' change='+2' />
          <StatCard title='Conversion Rate' value='68%' change='+5.2%' />
        </div>

        {/* Main Content Area */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Quick Actions */}
          <div className='lg:col-span-2 bg-white rounded-xl shadow-lg p-8'>
            <h3 className='text-xl font-bold text-gray-900 mb-6'>
              Quick Actions
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <ActionButton label='Create New Quote' />
              <ActionButton label='View Reports' />
              <ActionButton label='Schedule Follow-up' />
            </div>
          </div>

          {/* Recent Activity */}
          <div className='bg-white rounded-xl shadow-lg p-8'>
            <h3 className='text-xl font-bold text-gray-900 mb-6'>
              Recent Activity
            </h3>
            <div className='space-y-4'>
              <ActivityItem title='New project created' time='2 hours ago' />
              <ActivityItem title='Quote accepted' time='5 hours ago' />
              <ActivityItem title='Team member added' time='1 day ago' />
            </div>
          </div>
        </div>
      </div>
  )
}

function StatCard ({ title, value, change }) {
  return (
    <div className='bg-white rounded-xl shadow-lg p-6'>
      <p className='text-gray-600 text-sm mb-2'>{title}</p>
      <p className='text-3xl font-bold text-gray-900 mb-2'>{value}</p>
      <p className='text-green-600 text-sm font-semibold'>
        {change} from last month
      </p>
    </div>
  )
}

function ActionButton ({ label }) {
  return (
    <button className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200'>
      {label}
    </button>
  )
}

function ActivityItem ({ title, time }) {
  return (
    <div className='pb-4 border-b border-gray-200 last:border-b-0'>
      <p className='text-gray-900 font-medium'>{title}</p>
      <p className='text-gray-500 text-sm'>{time}</p>
    </div>
  )
}

export default DashboardPage
