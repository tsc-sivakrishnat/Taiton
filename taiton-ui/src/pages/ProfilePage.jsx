import { useState } from 'react';
import { useAuth } from '../context/authContext.js';
import { ProfileBrandingEditor } from './ProfileBrandingEditor.jsx';
import { roleMatchesCsv } from '../utils/roleAccess.js';
import { formatRoleName } from '../utils/displayLabels.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { notify } from '../utils/notify.js';

const BRANDING_EDITORS = 'super_admin,sys_admin';

export function ProfilePage() {
  const { user, activeOrganization, branding, token, refreshSession } = useAuth();
  const canEditBranding = roleMatchesCsv(activeOrganization?.roleCode, BRANDING_EDITORS);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const brandingKey = `${activeOrganization?.id ?? ''}-${branding?.appName ?? ''}-${branding?.logoUrl ?? ''}-${branding?.logoProfile ?? ''}`;

  async function onChangePassword(e) {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirmPassword) {
      notify.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      notify.error('New password must be at least 6 characters long');
      return;
    }
    setSavingPassword(true);
    try {
      await enterpriseApi.changePassword(token, { oldPassword, newPassword });
      notify.success('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      notify.apiError(err, 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="cp-stack">
      <h1 className="cp-page-title">Profile</h1>
      <p className="cp-page-lead">Your account and company appearance (where permitted).</p>

      <section className="cp-card cp-card-pad">
        <div className="cp-profile-row">
          <div className="cp-profile-row__name">
            <div className="cp-card-kicker">Full name</div>
            <div className="cp-profile-value">{user?.displayName ?? '—'}</div>
          </div>
          <div className="cp-profile-row__email">
            <div className="cp-card-kicker">Email</div>
            <div className="cp-profile-value">{user?.email ?? '—'}</div>
          </div>
          <div className="cp-profile-row__role">
            <div className="cp-card-kicker">Your role</div>
            <div className="cp-profile-value">
              {formatRoleName(activeOrganization?.roleCode, activeOrganization?.roleName)}
            </div>
          </div>
        </div>
      </section>

      <section className="cp-card cp-card-pad" style={{ marginTop: '24px' }}>
        <h2 className="cp-section-title">Change Password</h2>
        <p className="cp-page-lead" style={{ marginBottom: '20px' }}>Update your account password.</p>

        <form onSubmit={onChangePassword} className="cp-branding-form" style={{ width: '100%', maxWidth: 'none' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="cp-field" style={{ flex: '1 1 200px' }}>
              <span>Old Password</span>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                placeholder="Enter current password"
              />
            </label>
            <label className="cp-field" style={{ flex: '1 1 200px' }}>
              <span>New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password"
              />
            </label>
            <label className="cp-field" style={{ flex: '1 1 200px' }}>
              <span>Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
              />
            </label>
            <div style={{ flex: '0 0 auto' }}>
              <button
                type="submit"
                className="cp-btn cp-btn-primary"
                style={{ margin: 0, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={savingPassword}
              >
                {savingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {canEditBranding ? (
        <ProfileBrandingEditor
          key={brandingKey}
          branding={branding}
          activeOrganization={activeOrganization}
          token={token}
          refreshSession={refreshSession}
        />
      ) : null}
    </div>
  );
}

