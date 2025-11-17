

import { useState, useEffect } from "react"
import PropTypes from 'prop-types'
import { FiCheck, FiArrowLeft } from "react-icons/fi"
import { Spin, message } from "antd"
import { useRegistrationSubmit } from "../hooks/useRegistrationSubmit"

function SubscriptionPage({ formData, onSelectPlan, onBack }) {
  console.log(formData);
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState({})
  const { submitRegistration } = useRegistrationSubmit()

  useEffect(() => {
    // Define subscription plans matching the new tier structure
    const subscriptionPlans = {
      basic: {
        name: "Basic Plan",
        price: 29.99,
        currency: "USD",
        interval: "month",
        description: "Perfect for small contractors getting started",
        trialDays: 14,
        features: [
          "Up to 10 projects",
          "Basic proposal templates",
          "Customer management",
          "Email support",
          "5 team seats"
        ]
      },
      pro: {
        name: "Pro Plan",
        price: 79.99,
        currency: "USD",
        interval: "month",
        description: "Advanced features for growing businesses",
        trialDays: 14,
        popular: true,
        features: [
          "Unlimited projects",
          "Advanced proposal templates",
          "Team collaboration",
          "Priority support",
          "Custom branding",
          "Analytics dashboard",
          "20 team seats"
        ]
      },
      enterprise: {
        name: "Enterprise Plan",
        price: 199.99,
        currency: "USD",
        interval: "month",
        description: "Full-featured solution for large teams",
        trialDays: 30,
        features: [
          "Everything in Pro",
          "Dedicated account manager",
          "24/7 phone support",
          "Custom integrations",
          "Advanced analytics",
          "SLA guarantees",
          "Unlimited team seats"
        ]
      }
    }
    setPlans(subscriptionPlans)
  }, [])

  const handleSelectPlan = async (planId) => {
    setSelectedPlan(planId)
    setLoading(true)

    try {
      // Create the plan object to pass to submitRegistration
      const selectedPlanData = {
        id: planId,
        ...plans[planId]
      }

      // Call registration with payment - this will create user/tenant and redirect to Stripe
      console.log(formData, "/////")
      const result = await submitRegistration(formData, selectedPlanData)

      if (!result.success) {
        message.error(result.error || "Registration failed")
        setLoading(false)
        return
      }
      
      // If successful, redirect to Stripe
      if (result.stripeUrl) {
        globalThis.location.href = result.stripeUrl
      } else {
        message.error("Failed to get payment URL")
        setLoading(false)
      }
    } catch (err) {
      console.error("Registration error:", err)
      message.error("Error processing registration")
      setLoading(false)
    }
  }

  const planList = Object.entries(plans).map(([key, plan]) => ({
    id: key,
    ...plan,
  }))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold mb-4"
          type="button"
        >
          <FiArrowLeft size={20} className="mr-2" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Plan</h1>
        <p className="text-gray-600">Select the perfect plan for your business needs</p>
      </div>

      {planList.length === 0 ? (
        <div className="text-center py-12">
          <Spin size="large" />
          <p className="text-gray-600 mt-4">Loading subscription plans...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {planList.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl shadow-lg overflow-hidden transition transform hover:scale-105 ${
                plan.popular ? "ring-2 ring-blue-600 md:scale-105" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                  Most Popular
                </div>
              )}

              <div className={`p-8 ${plan.popular ? "bg-blue-50" : "bg-white"}`}>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-6">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features &&
                    plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <FiCheck className="text-green-500 mr-3 mt-1 flex-shrink-0" size={20} />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading && selectedPlan === plan.id}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition duration-200 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                  } ${loading && selectedPlan === plan.id ? "opacity-50 cursor-not-allowed" : ""}`}
                  type="button"
                >
                  {loading && selectedPlan === plan.id ? (
                    <>
                      <Spin size="small" />
                      Processing...
                    </>
                  ) : (
                    "Select Plan"
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

SubscriptionPage.propTypes = {
  formData: PropTypes.object.isRequired,
  onSelectPlan: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
}

export default SubscriptionPage
