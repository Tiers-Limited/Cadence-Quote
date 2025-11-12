import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMail, FiArrowLeft } from 'react-icons/fi'
import { message, Spin } from 'antd'

import Logo from '../components/Logo'
import { apiService } from '../services/apiService'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email) {
      message.error('Please enter your email address')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      message.error('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const response = await apiService.post('/auth/forgot-password', { email })

      if (response.success) {
        setEmailSent(true)
        message.success('Password reset instructions have been sent to your email')
      } else {
        message.error(response.message || 'Failed to send reset email')
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      message.error(error.response?.data?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center px-4'>
      <div className='w-full max-w-md'>
        {/* Header */}
        <div className='text-center flex items-center justify-center flex-wrap w-full gap-2 mb-8'>
          <div className='flex justify-center'>
            <Logo width={100} />
          </div>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Contractor Hub</h1>
            <p className='text-gray-600'>
              {emailSent ? 'Check your email' : 'Reset your password'}
            </p>
          </div>
        </div>

        {/* Reset Form */}
        <div className='bg-white rounded-xl shadow-lg p-8'>
          {!emailSent ? (
            <>
              <div className='mb-6'>
                <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                  Forgot Password?
                </h2>
                <p className='text-gray-600 text-sm'>
                  No worries! Enter your email address and we'll send you instructions to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className='space-y-6'>
                {/* Email Field */}
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>
                    Email Address
                  </label>
                  <div className='relative'>
                    <FiMail
                      className='absolute left-3 top-3 text-gray-400'
                      size={20}
                    />
                    <input
                      type='email'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder='you@example.com'
                      autoComplete='email'
                      className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type='submit'
                  disabled={loading}
                  className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2'
                >
                  {loading ? (
                    <>
                      <Spin size='small' />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Instructions'
                  )}
                </button>
              </form>

              {/* Back to Login */}
              <div className='mt-6'>
                <Link
                  to='/login'
                  className='flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium'
                >
                  <FiArrowLeft size={16} />
                  Back to Login
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Email Sent Confirmation */}
              <div className='text-center'>
                <div className='mb-4 flex justify-center'>
                  <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center'>
                    <svg
                      className='w-8 h-8 text-green-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                      />
                    </svg>
                  </div>
                </div>

                <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                  Check Your Email
                </h2>
                <p className='text-gray-600 mb-4'>
                  We've sent password reset instructions to{' '}
                  <strong>{email}</strong>
                </p>

                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left'>
                  <h3 className='font-semibold text-blue-900 mb-2'>
                    What's next?
                  </h3>
                  <ul className='text-sm text-blue-800 space-y-2'>
                    <li>• Check your inbox (and spam folder)</li>
                    <li>• Click the reset link in the email</li>
                    <li>• The link expires in 1 hour</li>
                    <li>• Create your new password</li>
                  </ul>
                </div>

                <div className='space-y-3'>
                  <button
                    onClick={() => {
                      setEmailSent(false)
                      setEmail('')
                    }}
                    className='text-blue-600 hover:text-blue-700 font-medium text-sm'
                  >
                    Didn't receive the email? Try again
                  </button>

                  <div>
                    <Link
                      to='/login'
                      className='flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium'
                    >
                      <FiArrowLeft size={16} />
                      Back to Login
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className='text-center text-gray-500 text-xs mt-6'>
          Need help? Contact our support team
        </p>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
