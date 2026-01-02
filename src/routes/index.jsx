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

// Customer Portal Components
import CustomerDashboard from '../pages/customer/CustomerDashboard';
import ViewProposal from '../pages/customer/ViewProposal';
import DepositPayment from '../pages/customer/DepositPayment';
import FinishStandardsAcknowledgement from '../pages/customer/FinishStandardsAcknowledgement';
import ProductSelections from '../pages/customer/ProductSelections';
import CustomerDocuments from '../pages/customer/CustomerDocuments';

// Client Authentication Components
import ClientSetPassword from '../pages/ClientSetPassword';
import ClientForgotPassword from '../pages/ClientForgotPassword';
import ClientResetPassword from '../pages/ClientResetPassword';

import EmailVerificationPage from '../pages/EmailVerificationPage';
import TwoFactorVerificationPage from '../pages/TwoFactorVerificationPage';
import ComingSoonPage from '../pages/ComingSoonPage';
import RoleBasedRoute from '../pages/RoleBasedRoute';
import PublicLeadFormPage from '../pages/PublicLeadFormPage';
import { Spin } from 'antd';
import BrandProductManager from '../features/admin/BrandProductManager';
import QuoteBuilderPage from '../pages/QuoteBuilderPage';
import QuotesListPage from '../pages/QuotesListPage';
import ProposalDefaultsPage from '../pages/ProposalDefaultsPage';
import ServiceTypesPage from '../pages/ServiceTypesPage';
import LaborRatesPage from '../pages/LaborRatesPage';

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
      
      {/* Client Authentication Routes */}
      <Route path='/client/set-password' element={<ClientSetPassword />} />
      <Route path='/client/forgot-password' element={<ClientForgotPassword />} />
      <Route path='/client/reset-password' element={<ClientResetPassword />} />
      
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
        <Route path='/quotes' element={<QuotesListPage />} />
        <Route path='/quotes/new' element={<QuoteBuilderPage />} />
        <Route path='/quote-builder' element={<QuoteBuilderPage />} />
        <Route path='/pricing-engine' element={<ContractorProductConfigManager />} />
        <Route path='/products/catalog' element={<ContractorProductConfigManager />} />
        <Route path='/products/colors' element={<ColorLibrary />} />
        <Route path='/pricing/schemes' element={<PricingSchemes />} />
        <Route path='/leads/forms' element={<LeadFormBuilder />} />
        <Route
          path='/leads/management'
          element={<LeadFormBuilder initialTab='leads' />}
        />
        <Route path='/proposal-defaults' element={<ProposalDefaultsPage />} />
        <Route path='/service-types' element={<ServiceTypesPage />} />
        {/* Labor rates consolidated under Pricing Engine, route preserved if needed */}
        <Route path='/labor-rates' element={<LaborRatesPage />} />
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

      {/* Customer Portal Routes - Only accessible to customer role */}
      <Route
        path='/portal/*'
        element={
          <RoleBasedRoute allowedRoles={['customer']}>
            <MainLayout>
              <Outlet />
            </MainLayout>
          </RoleBasedRoute>
        }
      >
        <Route path='dashboard' element={<CustomerDashboard />} />
        <Route path='proposal/:proposalId' element={<ViewProposal />} />
        <Route path='payment/:proposalId' element={<DepositPayment />} />
        <Route path='finish-standards/:proposalId' element={<FinishStandardsAcknowledgement />} />
        <Route path='selections/:proposalId' element={<ProductSelections />} />
        <Route path='documents/:proposalId' element={<CustomerDocuments />} />
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