"use client"

import { useEffect, useState } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { Spin, message } from "antd"
import SubscriptionPage from "../components/SubscriptionPage"

function CompleteGoogleSignupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [googleData, setGoogleData] = useState(null)
  const [currentStep, setCurrentStep] = useState('form') // 'form' or 'subscription'
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to get data from location state first (from postMessage)
    const stateProfile = location.state?.profile
    
    if (stateProfile) {
      // Data from postMessage
      setGoogleData({
        email: stateProfile.email,
        fullName: stateProfile.displayName || `${stateProfile.firstName} ${stateProfile.lastName}`,
        googleId: stateProfile.id,
        firstName: stateProfile.firstName,
        lastName: stateProfile.lastName,
        photo: stateProfile.photo,
        timestamp: Date.now()
      })
      setLoading(false)
      return
    }

    // Fallback: try to get from localStorage (if browser refreshed)
    const storedProfile = localStorage.getItem('googleProfile')
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile)
        setGoogleData({
          email: parsed.email,
          fullName: parsed.displayName || `${parsed.firstName} ${parsed.lastName}`,
          googleId: parsed.id,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          photo: parsed.photo,
          timestamp: Date.now()
        })
        setLoading(false)
        return
      } catch (error) {
        console.error('Failed to parse stored profile:', error)
      }
    }

    // Old method: URL params (keeping for backwards compatibility)
    const data = searchParams.get('data')
    if (!data) {
      message.error('Invalid Google authentication data')
      navigate('/register')
      return
    }

    try {
      const decoded = atob(data)
      const parsed = JSON.parse(decoded)
      
      // Check if data is too old (30 minutes)
      const thirtyMinutes = 30 * 60 * 1000
      if (Date.now() - parsed.timestamp > thirtyMinutes) {
        message.error('Google authentication expired. Please try again.')
        navigate('/register')
        return
      }

      setGoogleData(parsed)
      setLoading(false)
    } catch (error) {
      console.error('Failed to parse Google data:', error)
      message.error('Invalid authentication data')
      navigate('/register')
    }
  }, [searchParams, navigate, location])

  const handleFormSubmit = (data) => {
    setFormData(data)
    setCurrentStep('subscription')
  }

  const handlePlanSelect = async (plan) => {
    setLoading(true)

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api'
      
      // Prepare Google data (either from URL param or create new base64)
      let googleDataParam = searchParams.get('data')
      
      if (!googleDataParam && googleData) {
        // Create base64 encoded data from our googleData state
        const dataToEncode = {
          email: googleData.email,
          fullName: googleData.fullName,
          googleId: googleData.googleId,
          timestamp: googleData.timestamp || Date.now()
        }
        googleDataParam = btoa(JSON.stringify(dataToEncode))
      }
      
      const payload = {
        googleData: googleDataParam,
        companyName: formData.companyName,
        phoneNumber: formData.phone,
        businessAddress: formData.businessAddress,
        tradeType: formData.tradeType,
        subscriptionPlan: plan.id
      }

      const response = await fetch(`${apiBaseUrl}/auth/google/complete-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success && data.data.stripeUrl) {
        // Store pending registration
        localStorage.setItem('pendingRegistration', JSON.stringify({
          sessionId: data.data.sessionId,
          tenant: data.data.tenant,
          user: data.data.user,
          plan
        }))

        // Redirect to Stripe
        window.location.href = data.data.stripeUrl
      } else {
        message.error(data.message || 'Failed to complete signup')
        setLoading(false)
      }
    } catch (error) {
      console.error('Complete Google signup error:', error)
      message.error('Failed to complete signup')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <Spin size="large" />
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Loading...</h1>
        </div>
      </div>
    )
  }

  if (currentStep === 'form') {
    return (
      <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Registration</h1>
          <p className="text-gray-600 mb-6">
            Welcome, {googleData?.fullName}! Please provide your company details.
          </p>

          <form onSubmit={(e) => {
            e.preventDefault()
            const formDataObj = {
              companyName: e.target.companyName.value,
              phone: e.target.phone.value,
              businessAddress: e.target.businessAddress.value,
              tradeType: e.target.tradeType.value
            }
            handleFormSubmit(formDataObj)
          }} className="space-y-6">
            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="businessAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                Business Address
              </label>
              <input
                id="businessAddress"
                name="businessAddress"
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="tradeType" className="block text-sm font-semibold text-gray-700 mb-2">
                Trade Type *
              </label>
              <select
                id="tradeType"
                name="tradeType"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Trade Type</option>
                <option value="Painting">Painting</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Electrical">Electrical</option>
                <option value="HVAC">HVAC</option>
                <option value="Carpentry">Carpentry</option>
                <option value="Roofing">Roofing</option>
                <option value="Landscaping">Landscaping</option>
                <option value="General Contracting">General Contracting</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              Continue to Plan Selection
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <SubscriptionPage
      formData={formData}
      onSelectPlan={handlePlanSelect}
      onBack={() => setCurrentStep('form')}
    />
  )
}

export default CompleteGoogleSignupPage
