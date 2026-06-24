import { useCallback, useEffect, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { MobileField } from './MobileField.jsx';

/**
 * Platform-only: create org_admin for a selected organization (email + mobile login).
 */
export function ProvisionOrgAdminForm({ token, title = 'Create organization admin (org_admin)' }) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminMobile, setAdminMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await enterpriseApi.platformOrganizations(token);
      setOrganizations(res.organizations ?? []);
    } catch {
      setOrganizations([]);
    }
  }, [token]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!token || !selectedOrgId || adminMobile.length !== 10) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await enterpriseApi.platformCreateOrgAdmin(token, Number(selectedOrgId), {
        email: adminEmail,
        fullName: adminName,
        mobile: adminMobile,
      });
      setSuccess(
        `Created org_admin ${res.user?.email ?? adminEmail} for organization ${res.user?.orgCode ?? ''}. Login: email + mobile digits.`,
      );
      setAdminEmail('');
      setAdminName('');
      setAdminMobile('');
    } catch (err) {
      setError(err.message || 'Could not create org_admin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cp-card cp-card-pad cp-platform-admin-panel">
      <h2 className="cp-section-title">{title}</h2>
      <p className="cp-muted">
        Only platform administrators can create <strong>org_admin</strong> users. Pick the target
        organization, then enter name, email, and mobile (used as the login password).
      </p>
      {error ? <div className="cp-alert">{error}</div> : null}
      {success ? <div className="cp-success-banner">{success}</div> : null}
      <form className="cp-grid cp-grid-2" onSubmit={onSubmit}>
        <label className="cp-field">
          <span>Organization</span>
          <select
            className="cp-input"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            required
          >
            <option value="">Select organization…</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field">
          <span>Full name</span>
          <input
            className="cp-input"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            required
            placeholder="Enter full name"
          />
        </label>
        <label className="cp-field">
          <span>Email</span>
          <input
            type="email"
            className="cp-input"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            placeholder="Enter email address"
          />
        </label>
        <MobileField value={adminMobile} onChange={setAdminMobile} label="Mobile (login password)" />
        <div style={{ gridColumn: '1 / -1' }}>
          <button
            type="submit"
            className="cp-btn cp-btn-primary"
            disabled={busy || !selectedOrgId || adminMobile.length !== 10}
          >
            {busy ? 'Creating…' : 'Create org_admin'}
          </button>
        </div>
      </form>
    </section>
  );
}
