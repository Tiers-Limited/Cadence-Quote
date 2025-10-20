

import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import RegistrationForm from "../components/RegistrationForm"
import SubscriptionPage from "../components/SubscriptionPage"
import { message } from "antd"

function RegistrationPage() {
  const [currentStep, setCurrentStep] = useState("form")
  const [formData, setFormData] = useState(null)
  const [googleData, setGoogleData] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Handle Google OAuth data
    const googleDataParam = searchParams.get('googleData')
    if (googleDataParam) {
      try {
        // Decode base64 encoded Google data
        const decoded = JSON.parse(atob(googleDataParam))
        console.log('Google OAuth data received:', decoded)
        setGoogleData(decoded)
        message.info('Please complete your registration details')
      } catch (error) {
        console.error('Error decoding Google data:', error)
        message.error('Failed to process Google authentication data')
      }
    }

    // Handle payment cancellation redirect
    const error = searchParams.get('error')
    const plan = searchParams.get('plan')
    const step = searchParams.get('step')

    if (error === 'payment_cancelled') {
      message.warning('Payment was cancelled. You can try again or complete payment later.')
      if (step === '2' && plan) {
        // Restore to subscription step with the selected plan
        setCurrentStep('subscription')
        // You might want to pre-select the plan here
      }
    }
  }, [searchParams])

  const handleFormSubmit = (data) => {
    setFormData(data)
    setCurrentStep("subscription")
  }

  const handleSubscriptionSelect = (plan) => {
    // Registration and payment redirect handled directly in SubscriptionPage
    // No need for additional steps
  }

  const handleBackToForm = () => {
    setCurrentStep("form")
  }

  const handleNavigateToLogin = () => {
    navigate('/login')
  }

  return (
    <div className="min-h-screen py-12 px-4">
      {currentStep === "form" && (
        <RegistrationForm 
          onSubmit={handleFormSubmit} 
          onNavigateToLogin={handleNavigateToLogin}
          googleData={googleData}
        />
      )}
      {currentStep === "subscription" && (
        <SubscriptionPage formData={formData} onSelectPlan={handleSubscriptionSelect} onBack={handleBackToForm} />
      )}
    </div>
  )
}

export default RegistrationPage
