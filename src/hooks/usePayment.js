"use client"

import { useState } from "react"
import { apiService } from "../services/apiService"

export const usePayment = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getSubscriptionPlans = async () => {
    try {
      const response = await apiService.get("/payments/plans")
      return response.data?.plans || {}
    } catch (err) {
      console.error("Failed to fetch plans:", err)
      return {}
    }
  }

  const createCheckoutSession = async (subscriptionPlan) => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiService.post("/payments/create-checkout-session", {
        subscriptionPlan,
      })

      if (response.success) {
        return response.data
      } else {
        setError(response.message || "Failed to create checkout session")
        return null
      }
    } catch (err) {
      setError(err.message || "An error occurred")
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createCheckoutSession, getSubscriptionPlans, loading, error }
}
