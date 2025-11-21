import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginPage from '../pages/LoginPage';
import AuthSuccess from '../components/AppleSuccess';
import DashboardPage from '../pages/DashboardPage';
import MainLayout from '../components/MainLayout';
import SettingsPage from '../pages/SettingsPage';
import RegistrationPage from '../pages/RegistrationPage';
import PaymentSuccessPage from '../pages/PaymentSuccessPage';
import PaymentCancelPage from '../pages/PaymentCancelPage';
import GoogleAuthSuccessPage from '../pages/GoogleAuthSuccessPage';
import AppleAuthSuccessPage from '../pages/AppleAuthSuccessPage';
import ResumePaymentPage from '../pages/ResumePaymentPage';
import ProductCatalog from '../features/products/ProductCatalog';
import ColorLibrary from '../features/products/ColorLibrary';
import PricingSchemes from '../features/pricing/PricingSchemes';
import LeadFormBuilder from '../features/leads/LeadFormBuilder';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

import EmailVerificationPage from '../pages/EmailVerificationPage';
import TwoFactorVerificationPage from '../pages/TwoFactorVerificationPage';
import ComingSoonPage from '../pages/ComingSoonPage';
import RoleBasedRoute from '../pages/RoleBasedRoute';
import PublicLeadFormPage from '../pages/PublicLeadFormPage';
import { Spin } from 'antd';
import BrandProductManager from '../features/admin/BrandProductManager';
import QuoteBuilderPage from '../pages/QuoteBuilderPage';

// Admin Components
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import GlobalProductsPage from '../pages/admin/GlobalProductsPage';
import GlobalColorsPage from '../pages/admin/GlobalColorsPage';
import PricingSchemeManagementPage from '../pages/admin/PricingSchemeManagementPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';
import TenantManagementPage from '../pages/admin/TenantManagementPage';
import FeatureFlagsPage from '../pages/admin/FeatureFlagsPage';
import StripeBillingPage from '../pages/admin/StripeBillingPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';
import ContractorProductConfigManager from '../pages/ContractorProductConfigManager';

const AppRoutes = () => {
  const { isAuthenticated, loading, user } = useAuth();


  if (loading) {
    return <div className='min-h-screen min-w-screen w-full h-full flex items-center justify-center'><Spin spinning/></div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path='/login' element={
        isAuthenticated ? (
          user?.role === 'admin' ? (
            <Navigate to='/admin/dashboard' replace />
          ) : (
            <Navigate to='/dashboard' replace />
          )
        ) : (
          <LoginPage />
        )
      } />
      <Route path='/register' element={<RegistrationPage />} />
      <Route path='/forgot-password' element={<ForgotPasswordPage />} />
      <Route path='/reset-password' element={<ResetPasswordPage />} />
      <Route path='/auth/apple/success' element={<AuthSuccess />} />
      <Route path='/auth/google/success' element={<GoogleAuthSuccessPage />} />
      <Route path='/auth/resume-payment' element={<ResumePaymentPage />} />
      {/* <Route path='/auth/apple/success' element={<AppleAuthSuccessPage />} /> */}
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
        <Route path='/quotes/new' element={<QuoteBuilderPage />} />
        <Route path='/products/catalog' element={<ContractorProductConfigManager />} />
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

      {/* Admin Routes - Only accessible to admin role */}
      <Route
        path='/admin/*'
        element={
          <RoleProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <Outlet />
            </MainLayout>
          </RoleProtectedRoute>
        }
      >
        <Route path='dashboard' element={<AdminDashboardPage />} />
        <Route path='products' element={<GlobalProductsPage />} />
        <Route path='colors' element={<GlobalColorsPage />} />
        <Route path='pricing-schemes' element={<PricingSchemeManagementPage />} />
        <Route path='audit-logs' element={<AuditLogsPage />} />
        <Route path='tenants' element={<TenantManagementPage />} />
        <Route path='features' element={<FeatureFlagsPage />} />
        <Route path='billing' element={<StripeBillingPage />} />
        <Route path='settings' element={<AdminSettingsPage />} />
      </Route>

      {/* Default Route */}
      <Route
        path='/'
        element={
          isAuthenticated ? (
            user?.role === 'admin' ? (
              <Navigate to='/admin/dashboard' replace />
            ) : (
              <Navigate to='/dashboard' replace />
            )
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