// Mock API Service for development/testing
// Replace with real API calls when backend is ready

export const mockApiService = {
  // Mock login
  login: async (email, password) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (email && password.length >= 8) {
          resolve({
            success: true,
            data: {
              token: "mock-token-" + Date.now(),
              user: {
                id: "1",
                email,
                name: "John Doe",
              },
            },
          })
        } else {
          resolve({
            success: false,
            message: "Invalid credentials",
          })
        }
      }, 1000)
    })
  },

  // Mock registration
  register: async (formData, selectedPlan) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            id: "contractor-" + Date.now(),
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            companyName: formData.companyName,
            phone: formData.phone,
            plan: selectedPlan,
            registeredAt: new Date().toISOString(),
          },
        })
      }, 2000)
    })
  },
}
