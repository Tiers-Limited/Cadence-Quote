"use client"

import { createContext, useState, useCallback, useEffect, useMemo, useContext } from "react"
import PropTypes from 'prop-types'

export const UserContext = createContext()

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [googleProfile, setGoogleProfile] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)

  // Initialize user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    const storedToken = localStorage.getItem("authToken")

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser))
        setIsAuthenticated(true)
      } catch (error) {
        console.error("Failed to parse stored user:", error)
        localStorage.removeItem("user")
        localStorage.removeItem("authToken")
        localStorage.removeItem("refreshToken")
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback((userData, token, refreshToken) => {
    setUser(userData)
    setIsAuthenticated(true)
    localStorage.setItem("user", JSON.stringify(userData))
    localStorage.setItem("authToken", token)
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setIsAuthenticated(false)
    setGoogleProfile(null)
    localStorage.removeItem("user")
    localStorage.removeItem("authToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("tenant")
    localStorage.removeItem("pendingRegistration")
    localStorage.removeItem("googleProfile")
  }, [])

  const updateUser = useCallback(
    (updatedData) => {
      const newUser = { ...user, ...updatedData }
      setUser(newUser)
      localStorage.setItem("user", JSON.stringify(newUser))
    },
    [user],
  )

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    googleProfile,
    accessToken,
    refreshToken,
    setUser,
    setAccessToken,
    setRefreshToken,
    login,
    logout,
    updateUser,
  }), [user, loading, isAuthenticated, googleProfile, accessToken, refreshToken, login, logout, updateUser])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// Custom hook to use the UserContext
export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
