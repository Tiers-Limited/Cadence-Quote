"use client"

import { useState } from "react"
import { apiService } from "../services/apiService"

export const useRegistrationSubmit = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submitRegistration = async (formData, selectedPlan) => {
    setLoading(true)
    setError(null)

    try {
      // Step 1: Register tenant and user with payment
      const registrationPayload = {
        companyName: formData.companyName,
        email: formData.email,
        phoneNumber: formData.phone,
        businessAddress: formData.businessAddress,
        tradeType: formData.tradeType,
        subscriptionPlan: selectedPlan.id,
        fullName: `${formData.firstName} ${formData.lastName}`,
      }

      // Add password only for non-Google users
      if (formData.authProvider === 'google' && formData.googleId) {
        // Google OAuth registration
        registrationPayload.googleId = formData.googleId
        registrationPayload.authProvider = 'google'
      } else {
        // Regular email/password registration
        registrationPayload.password = formData.password
      }

      const registrationResponse = await apiService.post("/auth/register", registrationPayload)

      if (registrationResponse.success) {
        // Store registration data for payment completion
        localStorage.setItem("pendingRegistration", JSON.stringify({
          sessionId: registrationResponse.data.sessionId,
          tenant: registrationResponse.data.tenant,
          user: registrationResponse.data.user,
          plan: selectedPlan
        }))

        // Return the Stripe checkout URL for redirection
        return {
          success: true,
          stripeUrl: registrationResponse.data.stripeUrl,
          sessionId: registrationResponse.data.sessionId
        }
      } else {
        setError(registrationResponse.message || "Registration failed")
        return { success: false, error: registrationResponse.message }
      }
    } catch (err) {
      setError(err.message || "An error occurred during registration")
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return { submitRegistration, loading, error }
}
