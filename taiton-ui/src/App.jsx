import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.jsx';
import { AppShell } from './layouts/AppShell.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.jsx').then((m) => ({ default: m.DashboardPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage.jsx').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage.jsx').then((m) => ({ default: m.ProfilePage })),
);
const AccountsPage = lazy(() =>
  import('./pages/AccountsPage.jsx').then((m) => ({ default: m.AccountsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage.jsx').then((m) => ({ default: m.SettingsPage })),
);
const CustomerRequestsPage = lazy(() =>
  import('./pages/CustomerRequestsPage.jsx').then((m) => ({ default: m.CustomerRequestsPage })),
);
const ProductsPage = lazy(() =>
  import('./pages/ProductsPage.jsx').then((m) => ({ default: m.ProductsPage })),
);
const SeoPage = lazy(() =>
  import('./pages/SeoPage.jsx').then((m) => ({ default: m.SeoPage })),
);
const UiElementsPage = lazy(() =>
  import('./pages/UiElementsPage.jsx').then((m) => ({ default: m.UiElementsPage })),
);
const OrganizationsOnboardingPage = lazy(() =>
  import('./pages/onboarding/OrganizationsOnboardingPage.jsx').then((m) => ({
    default: m.OrganizationsOnboardingPage,
  })),
);
const RolesOnboardingPage = lazy(() =>
  import('./pages/onboarding/RolesOnboardingPage.jsx').then((m) => ({ default: m.RolesOnboardingPage })),
);
const MembersOnboardingPage = lazy(() =>
  import('./pages/onboarding/MembersOnboardingPage.jsx').then((m) => ({ default: m.MembersOnboardingPage })),
);
const NavOnboardingPage = lazy(() =>
  import('./pages/onboarding/NavOnboardingPage.jsx').then((m) => ({ default: m.NavOnboardingPage })),
);
const UsersOnboardingPage = lazy(() =>
  import('./pages/org/UsersOnboardingPage.jsx').then((m) => ({ default: m.UsersOnboardingPage })),
);
const ApprovalRulesPage = lazy(() =>
  import('./pages/org/ApprovalRulesPage.jsx').then((m) => ({ default: m.ApprovalRulesPage })),
);
const AuditPage = lazy(() =>
  import('./pages/org/AuditPage.jsx').then((m) => ({ default: m.AuditPage })),
);
const ApprovalsPage = lazy(() =>
  import('./pages/org/ApprovalsPage.jsx').then((m) => ({ default: m.ApprovalsPage })),
);
const WebResponsesPage = lazy(() =>
  import('./pages/WebResponsesPage.jsx').then((m) => ({ default: m.WebResponsesPage })),
);
const CareersPage = lazy(() =>
  import('./pages/CareersPage.jsx').then((m) => ({ default: m.CareersPage })),
);
const CatalogsPage = lazy(() =>
  import('./pages/CatalogsPage.jsx').then((m) => ({ default: m.CatalogsPage })),
);
const EventsPage = lazy(() =>
  import('./pages/EventsPage.jsx').then((m) => ({ default: m.EventsPage })),
);
const CustomNavPage = lazy(() =>
  import('./pages/CustomNavPage.jsx').then((m) => ({ default: m.CustomNavPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage.jsx').then((m) => ({ default: m.ResetPasswordPage })),
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="platform" element={<Navigate to="/app/onboarding/organizations" replace />} />
            <Route path="onboarding/organizations" element={<OrganizationsOnboardingPage />} />
            <Route path="onboarding/roles" element={<RolesOnboardingPage />} />
            <Route path="onboarding/members" element={<MembersOnboardingPage />} />
            <Route path="onboarding/nav" element={<NavOnboardingPage />} />
            <Route path="org/users" element={<UsersOnboardingPage />} />
            <Route path="org/approval-rules" element={<ApprovalRulesPage />} />
            <Route path="org/audit" element={<AuditPage />} />
            <Route path="org/approvals" element={<ApprovalsPage />} />
            <Route path="web-responses" element={<WebResponsesPage />} />
            <Route path="careers" element={<CareersPage />} />
            <Route path="catalogs" element={<CatalogsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="accounts" element={<Navigate to="/app/org/users" replace />} />
            <Route path="customer-requests" element={<Navigate to="/app/web-responses" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="seo" element={<SeoPage />} />
            <Route path="ui-elements" element={<UiElementsPage />} />
            <Route path="admin/actor-registration" element={<Navigate to="/app/accounts" replace />} />
            <Route path="*" element={<CustomNavPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
