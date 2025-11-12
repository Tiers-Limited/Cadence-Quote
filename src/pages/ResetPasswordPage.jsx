import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi'
import { message, Spin } from 'antd'

import Logo from '../components/Logo'
import { apiService } from '../services/apiService'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifyingToken, setVerifyingToken] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [passwordReset, setPasswordReset] = useState(false)

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, text: '', color: '' }
    
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++

    if (strength <= 2) return { strength, text: 'Weak', color: 'text-red-600' }
    if (strength <= 3) return { strength, text: 'Fair', color: 'text-yellow-600' }
    if (strength <= 4) return { strength, text: 'Good', color: 'text-blue-600' }
    return { strength, text: 'Strong', color: 'text-green-600' }
  }

  const passwordStrength = getPasswordStrength(newPassword)

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        message.error('Invalid password reset link')
        setVerifyingToken(false)
        setTokenValid(false)
        return
      }

      try {
        const response = await apiService.get(`/auth/verify-reset-token?token=${token}`)
        
        if (response.success) {
          setTokenValid(true)
          setUserEmail(response.data.email)
        } else {
          message.error(response.message || 'Invalid or expired reset link')
          setTokenValid(false)
        }
      } catch (error) {
        console.error('Token verification error:', error)
        message.error(error.response?.data?.message || 'Invalid or expired reset link')
        setTokenValid(false)
      } finally {
        setVerifyingToken(false)
      }
    }

    verifyToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!newPassword || !confirmPassword) {
      message.error('Please fill in all fields')
      return
    }

    if (newPassword.length < 8) {
      message.error('Password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      message.error('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await apiService.post('/auth/reset-password', {
        token,
        newPassword,
      })

      if (response.success) {
        setPasswordReset(true)
        message.success('Password reset successful! Redirecting to login...')
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      } else {
        message.error(response.message || 'Failed to reset password')
      }
    } catch (error) {
      console.error('Reset password error:', error)
      message.error(error.response?.data?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while verifying token
  if (verifyingToken) {
    return (
      <div className='min-h-screen flex items-center justify-center px-4'>
        <div className='text-center'>
          <Spin size='large' />
          <p className='mt-4 text-gray-600'>Verifying reset link...</p>
        </div>
      </div>
    )
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className='min-h-screen flex items-center justify-center px-4'>
        <div className='w-full max-w-md'>
          <div className='text-center flex items-center justify-center flex-wrap w-full gap-2 mb-8'>
            <div className='flex justify-center'>
              <Logo width={100} />
            </div>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Contractor Hub</h1>
            </div>
          </div>

          <div className='bg-white rounded-xl shadow-lg p-8 text-center'>
            <div className='mb-4 flex justify-center'>
              <div className='w-16 h-16 bg-red-100 rounded-full flex items-center justify-center'>
                <svg
                  className='w-8 h-8 text-red-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </div>
            </div>

            <h2 className='text-2xl font-bold text-gray-900 mb-2'>
              Invalid Reset Link
            </h2>
            <p className='text-gray-600 mb-6'>
              This password reset link is invalid or has expired. Reset links are valid for 1 hour.
            </p>

            <div className='space-y-3'>
              <Link
                to='/forgot-password'
                className='block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200'
              >
                Request New Reset Link
              </Link>
              <Link
                to='/login'
                className='block text-blue-600 hover:text-blue-700 font-medium'
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Password reset success state
  if (passwordReset) {
    return (
      <div className='min-h-screen flex items-center justify-center px-4'>
        <div className='w-full max-w-md'>
          <div className='text-center flex items-center justify-center flex-wrap w-full gap-2 mb-8'>
            <div className='flex justify-center'>
              <Logo width={100} />
            </div>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Contractor Hub</h1>
            </div>
          </div>

          <div className='bg-white rounded-xl shadow-lg p-8 text-center'>
            <div className='mb-4 flex justify-center'>
              <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center'>
                <FiCheck className='w-8 h-8 text-green-500' />
              </div>
            </div>

            <h2 className='text-2xl font-bold text-gray-900 mb-2'>
              Password Reset Successful!
            </h2>
            <p className='text-gray-600 mb-6'>
              Your password has been reset successfully. You can now login with your new password.
            </p>

            <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6'>
              <p className='text-sm text-blue-800'>
                Redirecting to login page in 3 seconds...
              </p>
            </div>

            <Link
              to='/login'
              className='block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200'
            >
              Go to Login Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Reset password form
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
            <p className='text-gray-600'>Create your new password</p>
          </div>
        </div>

        {/* Reset Form */}
        <div className='bg-white rounded-xl shadow-lg p-8'>
          <div className='mb-6'>
            <h2 className='text-2xl font-bold text-gray-900 mb-2'>
              Reset Password
            </h2>
            <p className='text-gray-600 text-sm'>
              Resetting password for: <strong>{userEmail}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* New Password Field */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>
                New Password
              </label>
              <div className='relative'>
                <FiLock
                  className='absolute left-3 top-3 text-gray-400'
                  size={20}
                />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder='Enter new password'
                  className='w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                  disabled={loading}
                  autoFocus
                />
                <button
                  type='button'
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className='absolute right-3 top-3 text-gray-400 hover:text-gray-600'
                  disabled={loading}
                >
                  {showNewPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className='mt-2'>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-gray-600'>Password strength:</span>
                    <span className={`text-xs font-semibold ${passwordStrength.color}`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-1.5'>
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        passwordStrength.strength <= 2
                          ? 'bg-red-500'
                          : passwordStrength.strength <= 3
                          ? 'bg-yellow-500'
                          : passwordStrength.strength <= 4
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <p className='text-xs text-gray-500 mt-2'>
                Must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>
                Confirm New Password
              </label>
              <div className='relative'>
                <FiLock
                  className='absolute left-3 top-3 text-gray-400'
                  size={20}
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder='Confirm new password'
                  className='w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                  disabled={loading}
                />
                <button
                  type='button'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className='absolute right-3 top-3 text-gray-400 hover:text-gray-600'
                  disabled={loading}
                >
                  {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {confirmPassword && (
                <p className={`text-xs mt-2 ${
                  newPassword === confirmPassword ? 'text-green-600' : 'text-red-600'
                }`}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type='submit'
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2'
            >
              {loading ? (
                <>
                  <Spin size='small' />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className='mt-6 text-center'>
            <Link
              to='/login'
              className='text-blue-600 hover:text-blue-700 font-medium text-sm'
            >
              Back to Login
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className='text-center text-gray-500 text-xs mt-6'>
          Need help? Contact our support team
        </p>
      </div>
    </div>
  )
}

export default ResetPasswordPage
