import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Spin, message, Button } from 'antd'
import { CheckCircle, XCircle, Mail } from 'lucide-react'
import { apiService } from '../services/apiService'

function EmailVerificationPage () {
  const [status, setStatus] = useState('loading') // 'loading', 'success', 'error', 'expired'
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setStatus('error')
        setError('Verification token is missing')
        return
      }

      try {
        const data = await apiService.get(`/auth/verify-email?token=${token}`)

        if (data.success) {
         
          setStatus('success')
        } else if (data.expired) {
          setStatus('expired')
        } else {
          setStatus('error')
          setError(data.message || 'Verification failed')
        }
      } catch (err) {
        setStatus('error')
        setError('An error occurred during verification')
      }
    }

    verifyEmail()
  }, [searchParams])

  const handleResendVerification = async () => {
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        message.success('Verification email sent! Please check your email.')
        navigate('/dashboard')
      } else {
        message.error(data.message || 'Failed to send verification email')
      }
    } catch (error) {
      message.error('Failed to send verification email')
    }
  }

  const handleGoToLogin = () => {
    navigate('/login')
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50'>
        <div className='max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center'>
          <Spin size='large' />
          <h1 className='text-xl font-semibold text-gray-900 mt-4'>
            Verifying Your Email...
          </h1>
          <p className='text-gray-600 mt-2'>
            Please wait while we verify your email address.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50'>
        <div className='max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center'>
          <CheckCircle className='text-green-600 mx-auto mb-4' size={64} />
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>
            Email Verified!
          </h1>
          <p className='text-gray-600 mb-6'>
            Your email address has been successfully verified. You can now
            access all features of the platform.
          </p>
          <Button type='primary' size='large' onClick={handleGoToDashboard}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50'>
        <div className='max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center'>
          <XCircle className='text-orange-600 mx-auto mb-4' size={64} />
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>
            Verification Link Expired
          </h1>
          <p className='text-gray-600 mb-6'>
            Your verification link has expired. Please request a new
            verification email from your dashboard.
          </p>
          <div className=' flex items-center gap-3 '>
            <Button
              type='primary'
              size='large'
              onClick={handleResendVerification}
            >
              <Mail className='w-4 h-4 mr-2' />
              Resend Verification Email
            </Button>
            <Button size='large' onClick={handleGoToDashboard}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50'>
      <div className='max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center'>
        <XCircle className='text-red-600 mx-auto mb-4' size={64} />
        <h1 className='text-2xl font-bold text-gray-900 mb-2'>
          Verification Failed
        </h1>
        <p className='text-red-600 mb-6'>{error}</p>
        <div className='space-y-3'>
          <Button
            type='primary'
            size='large'
            onClick={handleResendVerification}
          >
            <Mail className='w-4 h-4 mr-2' />
            Resend Verification Email
          </Button>
          <Button size='large' onClick={handleGoToLogin}>
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationPage
