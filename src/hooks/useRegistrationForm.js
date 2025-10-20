"use client"

import { useState } from "react"

const initialFormData = {
  firstName: "",
  lastName: "",
  email: "",
  companyName: "",
  phone: "",
  password: "",
  confirmPassword: "",
  tradeType: "Select Trade Type",
  businessAddress: "",
  agreeToTerms: false,
}

const TRADE_TYPES = [
  { value: "painter", label: "Painter" },
  { value: "drywall", label: "Drywall" },
  { value: "pressure_washing", label: "Pressure Washing" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "roofing", label: "Roofing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
]

export const useRegistrationForm = () => {
  const [formData, setFormData] = useState(initialFormData)
  const [errors, setErrors] = useState({})

  const validateForm = (isGoogleAuth = false) => {
    const newErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required"
    }

    // Subdomain removed from registration

    // Only validate password if not using Google auth
    if (!isGoogleAuth) {
      if (!formData.password) {
        newErrors.password = "Password is required"
      } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters"
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password"
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match"
      }
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the terms and conditions"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  return {
    formData,
    setFormData,
    errors,
    validateForm,
    TRADE_TYPES,
  }
}
