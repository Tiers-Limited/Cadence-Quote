import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import MainLayout from '../components/MainLayout'
import SettingsPage from '../pages/SettingsPage'
import RegistrationPage from '../pages/RegistrationPage'
import PaymentSuccessPage from '../pages/PaymentSuccessPage'
import PaymentCancelPage from '../pages/PaymentCancelPage'
import GoogleAuthSuccessPage from '../pages/GoogleAuthSuccessPage'
import ProductCatalog from '../features/products/ProductCatalog'
import ColorLibrary from '../features/products/ColorLibrary'
import PricingSchemes from '../features/pricing/PricingSchemes'
import LeadFormBuilder from '../features/leads/LeadFormBuilder'
import { ProtectedRoute } from '../components/ProtectedRoute'
import EmailVerificationPage from '../pages/EmailVerificationPage'

const AppRoutes = () => {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Public Routes */}
      <Route path='/login' element={<LoginPage />} />
      <Route path='/register' element={<RegistrationPage />} />
      <Route path='/auth/google/success' element={<GoogleAuthSuccessPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path='/registration-success' element={<PaymentSuccessPage />} />
      <Route path='/payment-success' element={<PaymentSuccessPage />} />
      <Route path='/payment-cancel' element={<PaymentCancelPage />} />

      {/* Protected Routes with MainLayout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout>
              <Outlet />
            </MainLayout>
          </ProtectedRoute>
        }
      >
        <Route path='/dashboard' element={<DashboardPage />} />
        <Route path='/products/catalog' element={<ProductCatalog />} />
        <Route path='/products/colors' element={<ColorLibrary />} />
        <Route path='/pricing/schemes' element={<PricingSchemes />} />
        <Route path='/leads/forms' element={<LeadFormBuilder />} />
        <Route
          path='/leads/management'
          element={<LeadFormBuilder initialTab='leads' />}
        />
        <Route path='/settings' element={<SettingsPage />} />
      </Route>

      {/* Default Route */}
      <Route
        path='/'
        element={
          isAuthenticated ? (
            <Navigate to='/dashboard' replace />
          ) : (
            <Navigate to='/login' replace />
          )
        }
      />

      {/* Catch-all Route */}
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}

export default AppRoutes
