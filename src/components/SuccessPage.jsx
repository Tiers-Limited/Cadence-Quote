"use client"

import { useEffect } from "react"
import { FiArrowLeft } from "react-icons/fi"
import { useRegistrationSubmit } from "../hooks/useRegistrationSubmit"
import { Spin, message } from "antd"

function SuccessPage({ formData, selectedPlan, onComplete, onBack }) {
  const { submitRegistration, loading, error } = useRegistrationSubmit()

  useEffect(() => {
    const handleSubmit = async () => {
      if (selectedPlan) {
        const result = await submitRegistration(formData, selectedPlan)
        if (result.success) {
          // Redirect to Stripe checkout
          globalThis.location.href = result.stripeUrl
        } else {
          message.error(result.error || "Registration failed")
        }
      }
    }

    handleSubmit()
  }, [formData, selectedPlan])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Spin size="large" />
          <p className="text-gray-600 mt-4">Preparing payment...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Failed</h1>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={onBack}
              className="inline-flex items-center px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition"
            >
              <FiArrowLeft size={20} className="mr-2" />
              Go Back
            </button>
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Return to Login
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spin size="large" />
        <p className="text-gray-600 mt-4">Redirecting to payment...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        {renderContent()}
      </div>
    </div>
  )
}

export default SuccessPage
