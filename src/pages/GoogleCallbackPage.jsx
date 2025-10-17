"use client"

import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Spin, message } from "antd"
import { useAuth } from "../hooks/useAuth"

function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token')
        const refreshToken = searchParams.get('refreshToken')
        const email = searchParams.get('email')
        const error = searchParams.get('error')

        if (error) {
          message.error('Google authentication failed. Please try again.')
          navigate('/login')
          return
        }

        if (token && email) {
          // Store tokens
          localStorage.setItem('authToken', token)
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken)
          }

          // Fetch user profile
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1'
          const response = await fetch(`${apiBaseUrl}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          const data = await response.json()

          if (data.success && data.data.user) {
            // Login via context
            login(data.data.user, token, refreshToken)
            
            message.success('Successfully logged in with Google!')
            setStatus('success')
            
            // Redirect to dashboard
            setTimeout(() => {
              navigate('/dashboard')
            }, 1000)
          } else {
            throw new Error('Failed to fetch user profile')
          }
        } else {
          throw new Error('Missing authentication tokens')
        }
      } catch (error) {
        console.error('Google callback error:', error)
        message.error('Authentication failed. Please try again.')
        setStatus('error')
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    }

    handleCallback()
  }, [searchParams, navigate, login])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        <Spin size="large" />
        <h1 className="text-xl font-semibold text-gray-900 mt-4">
          {status === 'processing' && 'Completing Google Sign In...'}
          {status === 'success' && 'Success! Redirecting...'}
          {status === 'error' && 'Authentication Failed'}
        </h1>
        <p className="text-gray-600 mt-2">
          {status === 'processing' && 'Please wait while we set up your account.'}
          {status === 'success' && 'You will be redirected to your dashboard.'}
          {status === 'error' && 'Redirecting to login page...'}
        </p>
      </div>
    </div>
  )
}

export default GoogleCallbackPage
