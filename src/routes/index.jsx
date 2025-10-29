import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import MainLayout from '../components/MainLayout';
import SettingsPage from '../pages/SettingsPage';
import RegistrationPage from '../pages/RegistrationPage';
import PaymentSuccessPage from '../pages/PaymentSuccessPage';
import PaymentCancelPage from '../pages/PaymentCancelPage';
import GoogleAuthSuccessPage from '../pages/GoogleAuthSuccessPage';
import AppleAuthSuccessPage from '../pages/AppleAuthSuccessPage';
import ProductCatalog from '../features/products/ProductCatalog';
import ColorLibrary from '../features/products/ColorLibrary';
import PricingSchemes from '../features/pricing/PricingSchemes';
import LeadFormBuilder from '../features/leads/LeadFormBuilder';

import EmailVerificationPage from '../pages/EmailVerificationPage';
import TwoFactorVerificationPage from '../pages/TwoFactorVerificationPage';
import ComingSoonPage from '../pages/ComingSoonPage';
import RoleBasedRoute from '../pages/RoleBasedRoute';
import PublicLeadFormPage from '../pages/PublicLeadFormPage';
import { Spin } from 'antd';

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();


  if (loading) {
    return <div className='min-h-screen min-w-screen w-full h-full flex items-center justify-center'><Spin spinning/></div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path='/login' element={
        isAuthenticated ? <Navigate to='/dashboard' replace /> : <LoginPage />
      } />
      <Route path='/register' element={<RegistrationPage />} />
      <Route path='/auth/google/success' element={<GoogleAuthSuccessPage />} />
      <Route path='/auth/apple/success' element={<AppleAuthSuccessPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path='/verify-2fa' element={<TwoFactorVerificationPage />} />
      <Route path='/registration-success' element={<PaymentSuccessPage />} />
      <Route path='/payment-success' element={<PaymentSuccessPage />} />
      <Route path='/payment-cancel' element={<PaymentCancelPage />} />
      <Route path='/coming-soon' element={<ComingSoonPage />} />
      
      {/* Public Lead Form Route - No authentication required */}
      <Route path='/public-form/:publicUrl' element={<PublicLeadFormPage />} />

      {/* Protected Routes for contractor_admin with MainLayout */}
      <Route
        element={
          <RoleBasedRoute allowedRoles={['contractor_admin']}>
            <MainLayout>
              <Outlet />
            </MainLayout>
          </RoleBasedRoute>
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
      </Route>

      {/* Settings Route - Accessible to both contractor_admin and business_admin */}
      <Route
        element={
          <RoleBasedRoute allowedRoles={['contractor_admin', 'business_admin']}>
            <MainLayout>
              <Outlet />
            </MainLayout>
          </RoleBasedRoute>
        }
      >
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
  );
};

export default AppRoutes;