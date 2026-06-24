import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';
import { ProvisionOrgAdminForm } from '../components/ProvisionOrgAdminForm.jsx';

export function PlatformPage() {
  return (
    <PermissionRoute platformOnly>
      <PlatformPageInner />
    </PermissionRoute>
  );
}

function PlatformPageInner() {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orgCode, setOrgCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const orgRes = await enterpriseApi.platformOrganizations(token);
      setOrganizations(orgRes.organizations ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreateOrg(e) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await enterpriseApi.platformCreateOrganization(token, {
        code: orgCode,
        name: orgName,
      });
      setOrgCode('');
      setOrgName('');
      await load();
    } catch (err) {
      setError(err.message || 'Create organization failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cp-stack">
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Platform</h1>
          <p className="cp-muted">
            System administration — organizations and org_admin provisioning. Roles are managed per
            organization under Onboarding Roles.
          </p>
        </div>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>
      {error ? <div className="cp-alert">{error}</div> : null}

      <section className="cp-card cp-card-pad">
        <h2 className="cp-section-title">Organizations</h2>
        {loading ? (
          <p className="cp-muted">Loading…</p>
        ) : (
          <ul className="cp-notify-list">
            {organizations.map((o) => (
              <li key={o.id} className="cp-notify-item">
                <div>
                  <div className="cp-notify-title">{o.name}</div>
                  <div className="cp-muted">{o.code} · id {o.id}</div>
                </div>
                <span className={`cp-tag cp-tag-${o.isActive ? 'success' : 'info'}`}>
                  {o.isActive ? 'active' : 'inactive'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cp-card cp-card-pad">
        <h2 className="cp-section-title">Create organization</h2>
        <form className="cp-grid cp-grid-2" onSubmit={onCreateOrg}>
          <label className="cp-field">
            <span>Code</span>
            <input className="cp-input" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} required placeholder="Enter organization code" />
          </label>
          <label className="cp-field">
            <span>Name</span>
            <input className="cp-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="Enter organization name" />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="cp-btn cp-btn-primary" disabled={busy}>
              Create organization
            </button>
          </div>
        </form>
      </section>

      <ProvisionOrgAdminForm token={token} />

    </div>
  );
}
