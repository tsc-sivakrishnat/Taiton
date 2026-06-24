import { useAuth } from '../context/authContext.js';
import { ProfileBrandingEditor } from './ProfileBrandingEditor.jsx';
import { OrgThemeEditor } from '../components/OrgThemeEditor.jsx';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';
import { AccessDenied } from '../components/AccessDenied.jsx';

/** org_admin: organization profile, branding, and theme. */
export function SettingsPage() {
  const { token, branding, activeOrganization, refreshSession } = useAuth();
  const canEdit = activeOrganization?.roleCode === 'org_admin';
  const brandingKey = `${activeOrganization?.id ?? ''}-${branding?.logoUrl ?? ''}-${branding?.logoUrlCollapsed ?? ''}`;

  if (!canEdit) {
    return (
      <AccessDenied
        title="Settings"
        message="Organization profile settings are available to organization administrators."
      />
    );
  }

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Settings" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Settings</h1>
          <p className="cp-muted">Edit organization profile — name, wide logo, and collapsed navbar mark.</p>
        </div>
      </div>
      <ProfileBrandingEditor
        key={brandingKey}
        branding={branding}
        activeOrganization={activeOrganization}
        token={token}
        refreshSession={refreshSession}
      />
      <OrgThemeEditor
        branding={branding}
        token={token}
        refreshSession={refreshSession}
        activeOrganization={activeOrganization}
      />
    </div>
  );
}
