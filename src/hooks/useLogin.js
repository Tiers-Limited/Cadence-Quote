"use client";

import { useState } from "react";
import { apiService } from "../services/apiService";

export const useLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.post("/auth/login", {
        email,
        password,
      });

      if (response.success) {
        if (response.requiresTwoFactor) {
          // Return 2FA required response with userId and email for verification
          return {
            success: true,
            requiresTwoFactor: true,
            data: response.data
          };
        }

        // Store token and refresh token in localStorage for successful login
        localStorage.setItem("authToken", response.data.token);
        localStorage.setItem("tenant", JSON.stringify(response.data.tenant));
        
        if (response.data.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }

        return {
          success: true,
          data: response.data
        };
      } else {
        const errorMsg = response.message || "Login failed";
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          requiresGoogleAuth: response.requiresGoogleAuth || false,
          authProvider: response.authProvider
        };
      }
    } catch (err) {
      const errorMsg = err.message || "An error occurred during login";
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
};