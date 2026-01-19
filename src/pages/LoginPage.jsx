import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'
import { useLogin } from '../hooks/useLogin'
import { message, Alert } from 'antd'
import GoogleAuthButton from '../components/GoogleAuthButton'
import AppleAuthButton from '../components/AppleAuthButton'
import Logo from '../components/Logo'

function LoginPage () {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [urlError, setUrlError] = useState(null)
  const { login, loading, error } = useLogin()
  const navigate = useNavigate()

  // Handle error from URL params (OAuth redirects)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) {
      setUrlError(decodeURIComponent(errorParam))
      
      // Show message
      if (errorParam.includes('incomplete')) {
        message.warning({
          content: decodeURIComponent(errorParam),
          duration: 8,
          style: { marginTop: '20vh' }
        })
      } else {
        message.error({
          content: decodeURIComponent(errorParam),
          duration: 6,
          style: { marginTop: '20vh' }
        })
      }

      // Clear URL params after displaying
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()

    if (!email || !password) {
      message.error('Please fill in all fields')
      return
    }

    const result = await login(email, password)
   
    if (result.success) {
      if (result.requiresTwoFactor) {
        navigate('/verify-2fa', {
          state: { userId: result.data.userId, email: result.data.email }
        })
      } else {
        contextLogin(
          result.data.user,
          result.data.token,
          result.data.refreshToken
        )
        navigate('/dashboard')
      }
    } else {
      if (result.requiresGoogleAuth || result.requiresOAuth) {
        message.warning({
          content: result.error,
          duration: 5,
          style: { marginTop: '20vh' }
        })
      } else {
        message.error(result.error || 'Login failed')
      }
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center px-4 '>
      <div className='w-full max-w-md'>
        {/* Header */}
        <div className='text-center flex items-center justify-center flex-wrap w-full  gap-2 '>
          <div className='flex justify-center'>
            <Logo width={100} />
          </div>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Contractor Hub</h1>
            <p className='text-gray-600'>Sign in to your account</p>
          </div>
        </div>

        {/* Login Form */}
        <div className='bg-white rounded-xl shadow-lg p-8'>

          {urlError && urlError.includes('incomplete') && (
            <Alert
              message="Incomplete Registration"
              description={urlError}
              type="warning"
              showIcon
              closable
              onClose={() => setUrlError(null)}
              className='mb-4'
              action={
                <Link
                  to='/register'
                  className='text-sm font-medium text-blue-600 hover:text-blue-700'
                >
                  Try Again
                </Link>
              }
            />
          )}
          
          {error && (
            <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
              <p className='text-red-700 text-sm'>{error}</p>
            </div>
          )}

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
                  onChange={e => setEmail(e.target.value)}
                  placeholder='you@example.com'
                  autoComplete='email'
                  className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>
                Password
              </label>
              <div className='relative'>
                <FiLock
                  className='absolute left-3 top-3 text-gray-400'
                  size={20}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder='••••••••'
                  className='w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                  disabled={loading}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-0 sm:right-3 sm:top-3 text-gray-400 hover:text-gray-600'
                  disabled={loading}
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className='flex items-center justify-between'>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  className='w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500'
                  disabled={loading}
                />
                <span className='ml-2 text-sm text-gray-600'>Remember me</span>
              </label>
              <Link
                to='/forgot-password'
                className='text-sm text-blue-600 hover:text-blue-700 font-medium'
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type='submit'
              disabled={loading}
              className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2'
            >
              {loading ? (
                <>
                  <span className='inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* OAuth Sign In Options */}
          <>
            {/* Divider */}
            <div className='my-6 flex items-center'>
              <div className='flex-1 border-t border-gray-300'></div>
              <span className='px-3 text-sm text-gray-500'>or</span>
              <div className='flex-1 border-t border-gray-300'></div>
            </div>

            {/* OAuth Sign In Options */}
            <div className='space-y-3'>
              <GoogleAuthButton mode='login' />
              <AppleAuthButton mode='login' />
            </div>

            {/* Sign Up Link */}
            <p className='mt-6 text-center text-gray-600'>
              Don&apos;t have an account?{' '}
              <Link
                to='/register'
                className='text-blue-600 hover:text-blue-700 font-semibold'
              >
                Sign up here
              </Link>
            </p>
          </>
        </div>

        {/* Footer */}
        <p className='text-center text-gray-500 text-xs mt-6'>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
        
        
      </div>
    </div>
  )
}

export default LoginPage
