"use client"

import { FcGoogle } from "react-icons/fc"
import { message } from "antd"
import PropTypes from 'prop-types'

function GoogleAuthButton({ mode = 'login', onSuccess, onError }) {
  const handleGoogleAuth = async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api'
      
      // Get Google auth URL from backend
      const response = await fetch(`${apiBaseUrl}/auth/google/url?mode=${mode}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      console.log('Google auth URL response:', data)
      
      if (data.url) {
        // Redirect to Google OAuth (full page redirect)
        window.location.href = data.url
      } else {
        console.error('Response data:', data)
        throw new Error('Failed to get Google auth URL from response')
      }
    } catch (error) {
      console.error('Google auth error:', error)
      message.error(`Failed to initialize Google authentication: ${error.message}`)
      if (onError) onError(error)
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleAuth}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 shadow-sm"
    >
      <FcGoogle size={24} />
      <span>
        {mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
      </span>
    </button>
  )
}

GoogleAuthButton.propTypes = {
  mode: PropTypes.oneOf(['login', 'signup']),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
}

export default GoogleAuthButton
