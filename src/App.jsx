

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { UserProvider } from "./context/UserContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import LoginPage from "./pages/LoginPage"
import RegistrationPage from "./pages/RegistrationPage"
import DashboardPage from "./pages/DashboardPage"
import PaymentSuccessPage from "./pages/PaymentSuccessPage"
import PaymentCancelPage from "./pages/PaymentCancelPage"
import CompleteGoogleSignupPage from "./pages/CompleteGoogleSignupPage"
import GoogleAuthSuccessPage from "./pages/GoogleAuthSuccessPage"

function App() {
  return (
    <Router>
      <UserProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/register/complete-google" element={<CompleteGoogleSignupPage />} />
            <Route path="/auth/google/success" element={<GoogleAuthSuccessPage />} />
            <Route path="/registration-success" element={<PaymentSuccessPage />} />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/payment-cancel" element={<PaymentCancelPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </UserProvider>
    </Router>
  )
}

export default App
