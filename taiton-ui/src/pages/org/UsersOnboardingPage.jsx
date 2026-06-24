import { AccountsPage } from '../AccountsPage.jsx';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';

/** org_admin: onboarding users to roles (wraps Accounts). */
export function UsersOnboardingPage() {
  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Onboarding User to Roles" />
      <AccountsPage embedded />
    </div>
  );
}
