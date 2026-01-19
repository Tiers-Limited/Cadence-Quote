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

import DepositPayment from '../pages/customer/DepositPayment';
import FinishStandardsAcknowledgement from '../pages/customer/FinishStandardsAcknowledgement';
import ProductSelections from '../pages/customer/ProductSelections';
import ColorSelections from '../pages/customer/ColorSelections';
import CustomerDocuments from '../pages/customer/CustomerDocuments';
import MagicLinkDashboard from '../pages/contractor/MagicLinkDashboard';
import JobProgressView from '../pages/customer/JobProgressView';
import CustomerJobDetail from '../pages/customer/CustomerJobDetail';
import ProposalAcceptance from '../pages/customer/ProposalAcceptance';
import ProductSelectionWizard from '../pages/customer/ProductSelectionWizard';
import JobTracking from '../pages/customer/JobTracking';
import CustomerCalendar from '../pages/customer/CustomerCalendar';

// Magic Link Portal Components
import MagicLinkAccess from '../components/CustomerPortal/MagicLinkAccess';
import MagicLinkCustomerDashboard from '../components/CustomerPortal/MagicLinkCustomerDashboard';


import { withMagicLinkAuth } from '../components/CustomerPortal/withMagicLinkAuth';

// Wrap customer portal components with magic link authentication

const MagicLinkDepositPayment = withMagicLinkAuth(DepositPayment);
const MagicLinkFinishStandards = withMagicLinkAuth(FinishStandardsAcknowledgement);
const MagicLinkProductSelections = withMagicLinkAuth(ProductSelections);
const MagicLinkColorSelections = withMagicLinkAuth(ColorSelections);
const MagicLinkCustomerDocuments = withMagicLinkAuth(CustomerDocuments);
const MagicLinkJobProgress = withMagicLinkAuth(JobProgressView);
const MagicLinkCustomerJobDetail = withMagicLinkAuth(CustomerJobDetail);

// Wrap new customer portal components
const MagicLinkProposalAcceptance = withMagicLinkAuth(ProposalAcceptance);
const MagicLinkProductSelectionWizard = withMagicLinkAuth(ProductSelectionWizard);
const MagicLinkJobTracking = withMagicLinkAuth(JobTracking);
const MagicLinkCustomerCalendar = withMagicLinkAuth(CustomerCalendar);

// Portal Admin Components
import PortalAdminSettings from '../components/Admin/PortalAdminSettings';

// Jobs Components
import JobsListPage from '../pages/JobsListPage';
import JobDetailPage from '../pages/JobDetailPage';
import JobCalendarPage from '../pages/JobCalendarPage';

import EmailVerificationPage from '../pages/EmailVerificationPage';
import TwoFactorVerificationPage from '../pages/TwoFactorVerificationPage';
import ComingSoonPage from '../pages/ComingSoonPage';
import RoleBasedRoute from '../pages/RoleBasedRoute';
import PublicLeadFormPage from '../pages/PublicLeadFormPage';
import { Spin } from 'antd';
import BrandProductManager from '../features/admin/BrandProductManager';
import ProductTierManager from '../features/admin/ProductTierManager';
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
import { CustomerPortalLayout } from '..';

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
        <Route path='/quotes/edit/:quoteId' element={<QuoteBuilderPage />} />
        <Route path='/quote-builder' element={<QuoteBuilderPage />} />
        <Route path='/jobs' element={<JobsListPage />} />
        <Route path='/jobs/:jobId' element={<JobDetailPage />} />
        <Route path='/jobs/calendar' element={<JobCalendarPage />} />
        <Route path='/pricing-engine' element={<ContractorProductConfigManager />} />
        <Route path='/products/catalog' element={<ContractorProductConfigManager />} />
        <Route path='/products/colors' element={<ColorLibrary />} />
        <Route path='/products/tiers' element={<ProductTierManager />} />
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
        <Route path='/magic-links' element={<MagicLinkDashboard />} />
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
        <Route path='/portal-admin' element={<PortalAdminSettings />} />
      </Route>

      {/* Magic Link Portal Access - Public route (no authentication required) */}
      <Route path='/portal/access/:token' element={<MagicLinkAccess />} />
      <Route path='/portal' element={<CustomerPortalLayout/>}>
        <Route index element={<Navigate to='/portal/dashboard' replace />} />
        <Route path='dashboard' element={<MagicLinkCustomerDashboard />} />
        <Route path='proposals/:proposalId/accept' element={<MagicLinkProposalAcceptance />} />
        <Route path='finish-standards/:proposalId' element={<MagicLinkFinishStandards />} />
        <Route path='proposals/:proposalId/selections' element={<MagicLinkProductSelectionWizard />} />
        <Route path='documents/:proposalId' element={<MagicLinkCustomerDocuments />} />
        {/* <Route path='jobs/:proposalId' element={<MagicLinkJobProgress />} /> */}
        <Route path='jobs/:jobId' element={<MagicLinkJobTracking />} />
        <Route path='job/:jobId' element={<MagicLinkCustomerJobDetail />} />
        <Route path='calendar' element={<MagicLinkCustomerCalendar />} />
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