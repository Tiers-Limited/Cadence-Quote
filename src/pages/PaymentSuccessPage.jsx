"use client"

import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { FiCheckCircle, FiXCircle } from "react-icons/fi"
import { Spin, message } from "antd"

function PaymentSuccessPage() {
  const [status, setStatus] = useState('loading') // 'loading', 'success', 'error'
  const [paymentData, setPaymentData] = useState(null)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      const sessionId = searchParams.get('sessionId')
      const plan = searchParams.get('plan')
      const alreadyProcessed = searchParams.get('already_processed')

      if (!sessionId) {
        setStatus('error')
        setError('Missing session information. Please contact support.')
        return
      }

      // Check if already processed
      if (alreadyProcessed === 'true') {
        // Try to get stored registration data
        const storedData = localStorage.getItem('pendingRegistration')
        if (storedData) {
          try {
            const data = JSON.parse(storedData)
            setPaymentData({ plan, ...data })
          } catch (parseError) {
            console.error('Failed to parse stored data:', parseError)
          }
        }
        setStatus('success')
        setPaymentData((prev) => prev || { plan })
        message.info('Payment was already confirmed.')
        return
      }

      try {
        // Get pending registration data
        const pendingRegistration = localStorage.getItem("pendingRegistration")
        
        if (pendingRegistration) {
          try {
            const registrationData = JSON.parse(pendingRegistration)
            
            // Payment already confirmed by backend redirect
            // User account should be activated now
            setPaymentData({
              plan: plan || registrationData.plan?.id,
              tenant: registrationData.tenant,
              user: registrationData.user
            })

            // Clear pending registration
            localStorage.removeItem("pendingRegistration")

            setStatus('success')
            message.success("Payment successful! Your account has been activated.")
          } catch (parseError) {
            console.error('Failed to parse pending registration:', parseError)
            setStatus('success')
            setPaymentData({ plan })
            message.success("Payment confirmed! Please login to continue.")
          }
        } else {
          // No pending registration found, but payment was successful
          setStatus('success')
          setPaymentData({ plan })
          message.success("Payment confirmed! Please login to continue.")
        }
      } catch (err) {
        console.error('Payment confirmation error:', err)
        setStatus('error')
        setError(err.message || 'An error occurred during payment confirmation')
      }
    }

    handlePaymentSuccess()
  }, [searchParams, navigate])

  const handleContinue = () => {
    // Navigate to login page for user to sign in
    navigate('/login')
  }

  const handleRetry = () => {
    navigate('/register')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <Spin size="large" />
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Confirming Payment...</h1>
          <p className="text-gray-600 mt-2">Please wait while we activate your account.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <FiXCircle className="text-red-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Issue</h1>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              type="button"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 px-4 rounded-lg transition"
              type="button"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <FiCheckCircle className="text-green-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your {paymentData?.plan || 'subscription'} plan has been activated successfully.
        </p>
        
        {paymentData?.tenant && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">Account Details</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Company:</span> {paymentData.tenant.companyName}
            </p>
            {paymentData.user && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {paymentData.user.email}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            type="button"
          >
            Continue to Login
          </button>
          <p className="text-sm text-gray-500">
            You can now login with your credentials
          </p>
        </div>
      </div>
    </div>
  )
}

export default PaymentSuccessPage
