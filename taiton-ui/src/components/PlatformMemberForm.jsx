import { useCallback, useEffect, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { MobileField } from './MobileField.jsx';

/**
 * sys_admin: add user to an organization with selected role (including org_admin).
 */
export function PlatformMemberForm({ token }) {
  const [organizations, setOrganizations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [roleCode, setRoleCode] = useState('org_admin');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    const res = await enterpriseApi.platformOrganizations(token);
    setOrganizations(res.organizations ?? []);
  }, [token]);

  const loadRoles = useCallback(async () => {
    if (!token || !selectedOrgId) {
      setRoles([]);
      return;
    }
    try {
      const res = await enterpriseApi.platformAssignableRoles(token, Number(selectedOrgId));
      const list = res.roles ?? [];
      setRoles(list);
      if (list.length && !list.some((r) => r.code === roleCode)) {
        setRoleCode(list[0].code);
      }
    } catch {
      setRoles([{ code: 'org_admin', name: 'Organization Admin' }]);
      setRoleCode('org_admin');
    }
  }, [token, selectedOrgId, roleCode]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!token || !selectedOrgId || !roleCode || mobile.length !== 10) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const body = { email, fullName, mobile };
    try {
      let res;
      if (roleCode === 'org_admin') {
        res = await enterpriseApi.platformCreateOrgAdmin(token, Number(selectedOrgId), body);
      } else {
        res = await enterpriseApi.platformCreateMember(token, Number(selectedOrgId), {
          ...body,
          roleCode,
        });
      }
      setSuccess(
        `Created ${res.user?.role ?? roleCode} — ${res.user?.email ?? email}. Login: email + mobile.`,
      );
      setEmail('');
      setFullName('');
      setMobile('');
    } catch (err) {
      setError(err.message || 'Could not create user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cp-card cp-card-pad">
      <h2 className="cp-section-title">Onboarding members to roles</h2>
      <p className="cp-muted">
        Choose organization and role. Email must be unique within that organization. Mobile: 10 digits.
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
          <span>Role</span>
          <select
            className="cp-input"
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
            required
            disabled={!selectedOrgId || !roles.length}
          >
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field">
          <span>Full name</span>
          <input className="cp-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Enter full name" />
        </label>
        <label className="cp-field">
          <span>Email</span>
          <input type="email" className="cp-input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter email address" />
        </label>
        <MobileField value={mobile} onChange={setMobile} />
        <div style={{ gridColumn: '1 / -1' }}>
          <button
            type="submit"
            className="cp-btn cp-btn-primary"
            disabled={busy || !selectedOrgId || mobile.length !== 10}
          >
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </section>
  );
}
