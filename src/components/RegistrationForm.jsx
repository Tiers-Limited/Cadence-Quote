"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiPhone, FiMapPin } from "react-icons/fi"
import { useRegistrationForm } from "../hooks/useRegistrationForm"
import { message, Input, Select, Button, Checkbox } from "antd"
import { BuildingIcon } from "lucide-react"
import GoogleAuthButton from "./GoogleAuthButton"
import PropTypes from 'prop-types'

function RegistrationForm({ onSubmit, onNavigateToLogin, googleData }) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { formData, setFormData, errors, validateForm, TRADE_TYPES } = useRegistrationForm()
  const [isGoogleAuth, setIsGoogleAuth] = useState(false)
  const navigate = useNavigate()

  // Auto-fill form with Google data when available
  useEffect(() => {
    if (googleData) {
      setIsGoogleAuth(true)
      setFormData((prev) => ({
        ...prev,
        firstName: googleData.firstName || '',
        lastName: googleData.lastName || '',
        email: googleData.email || '',
        googleId: googleData.googleId || '',
        authProvider: 'google',
      }))
      // Don't require password for Google OAuth users
      message.success('Google authentication successful! Please complete your registration.')
    }
  }, [googleData, setFormData])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm(isGoogleAuth)) {
      onSubmit({
        ...formData,
        ...(isGoogleAuth && { 
          googleId: googleData?.googleId,
          authProvider: 'google' 
        })
      })
    } else {
      message.error("Please fix the errors in the form")
    }
  }

    const handleNavigateToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin()
    } else {
      navigate('/login')
    }
  }

  const inputFields = [
    {
      name: "firstName",
      label: "First Name",
      type: "text",
      icon: FiUser,
      placeholder: "John",
    },
    {
      name: "lastName",
      label: "Last Name",
      type: "text",
      icon: FiUser,
      placeholder: "Doe",
    },
    {
      name: "email",
      label: "Email Address",
      type: "email",
      icon: FiMail,
      placeholder: "john@example.com",
    },
    {
      name: "companyName",
      label: "Company Name",
      type: "text",
      icon: BuildingIcon,
      placeholder: "Your Company Inc.",
    },
    {
      name: "phone",
      label: "Phone Number",
      type: "tel",
      icon: FiPhone,
      placeholder: "+1 (555) 000-0000",
    },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg mb-4">
          <span className="text-white font-bold text-xl">C</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h1>
        <p className="text-gray-600">Join our contractor network today</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Google Sign Up Option */}
        <div className="mb-6">
          <GoogleAuthButton mode="signup" />
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-semibold">
                1
              </div>
              <span className="ml-2 text-sm font-semibold text-gray-700">Account Details</span>
            </div>
            <div className="flex-1 h-1 bg-gray-300 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-600 rounded-full font-semibold">
                2
              </div>
              <span className="ml-2 text-sm font-semibold text-gray-500">Select Plan</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inputFields.map((field) => {
              const Icon = field.icon
              return (
                <div key={field.name}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{field.label}</label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                      type={field.type}
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                        errors[field.name] ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                  </div>
                  {errors[field.name] && <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>}
                </div>
              )
            })}
            <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Trade Type</label>
            <Select
              name="tradeType"
              value={formData.tradeType || "Select Trade Type"}
              onChange={(value) => setFormData((prev) => ({ ...prev, tradeType: value }))}
              className="w-full"
              placeholder="Select Trade Type"
            >
              <Select.Option value="Select Trade Type">Select Trade Type</Select.Option>
              {TRADE_TYPES.map((type) => (
                <Select.Option key={type.value} value={type.value}>
                  {type.label}
                </Select.Option>
              ))}
            </Select>
          </div>
          </div>

      

          {/* Business Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Business Address (Optional)</label>
            <textarea
              name="businessAddress"
              value={formData.businessAddress}
              onChange={handleChange}
              placeholder="123 Main St, City, State 12345"
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Password Fields */}
          {/* Password fields - only required for non-Google auth */}
          {!isGoogleAuth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                      errors.password ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                      errors.confirmPassword ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>
          )}

          {/* Google Auth Info Message */}
          {isGoogleAuth && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ✓ Authenticated with Google. No password needed. Please complete the remaining fields.
              </p>
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="flex items-start">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-1"
            />
            <label className="ml-3 text-sm text-gray-600">
              I agree to the{" "}
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.agreeToTerms && <p className="text-red-500 text-xs">{errors.agreeToTerms}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            Continue to Plans
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Already have an account?{" "}
          <button onClick={handleNavigateToLogin} className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign in here
          </button>
        </p>
      </div>
    </div>
  )
}

export default RegistrationForm
