"use client"

import { FaApple } from "react-icons/fa"
import { message } from "antd"
import PropTypes from 'prop-types'

function AppleAuthButton({ mode = 'login', onSuccess, onError }) {
  const handleAppleAuth = async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1'
      
      // Get Apple auth URL from backend
      const response = await fetch(`${apiBaseUrl}/auth/apple/url?mode=${mode}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      console.log('Apple auth URL response:', data)
      
      if (data.url) {
        // Redirect to Apple OAuth (full page redirect)
        window.location.href = data.url
      } else {
        console.error('Response data:', data)
        throw new Error('Failed to get Apple auth URL from response')
      }
    } catch (error) {
      console.error('Apple auth error:', error)
      message.error(`Failed to initialize Apple authentication: ${error.message}`)
      if (onError) onError(error)
    }
  }

  return (
    <button
      type="button"
      onClick={handleAppleAuth}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-900 bg-black rounded-lg font-semibold text-white hover:bg-gray-900 transition duration-200 shadow-sm"
    >
      <FaApple size={24} />
      <span>
        {mode === 'signup' ? 'Sign up with Apple' : 'Continue with Apple'}
      </span>
    </button>
  )
}

AppleAuthButton.propTypes = {
  mode: PropTypes.oneOf(['login', 'signup']),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
}

export default AppleAuthButton
