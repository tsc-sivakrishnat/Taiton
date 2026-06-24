import { useCallback, useEffect, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';

/** Platform: assign user to a priority-1 org role within an organization. */
export function PriorityOneMemberForm({ token }) {
  const [organizations, setOrganizations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    try {
      const orgRes = await enterpriseApi.platformOrganizations(token);
      setOrganizations(orgRes.organizations ?? []);
    } catch {
      setOrganizations([]);
    }
  }, [token]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (!token || !selectedOrgId) {
      setRoles([]);
      setRoleCode('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const roleRes = await enterpriseApi.platformPriorityOneRoles(token, Number(selectedOrgId));
        if (cancelled) return;
        const r = roleRes.roles ?? [];
        setRoles(r);
        setRoleCode((prev) => (prev && r.some((x) => x.code === prev) ? prev : r[0]?.code ?? ''));
      } catch {
        if (!cancelled) {
          setRoles([]);
          setRoleCode('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedOrgId]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!token || !selectedOrgId || !roleCode) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await enterpriseApi.platformCreateMember(token, Number(selectedOrgId), {
        email,
        fullName,
        mobile,
        roleCode,
      });
      setSuccess(
        `Created ${res.user?.role ?? roleCode} user ${res.user?.email ?? email}. Login: email + mobile.`,
      );
      setEmail('');
      setFullName('');
      setMobile('');
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cp-card cp-card-pad">
      <h2 className="cp-section-title">Priority 1 members</h2>
      <p className="cp-muted">
        Assign users to organization roles with <strong>rank = 1</strong> for the selected
        organization.
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
            <option value="">Select…</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field">
          <span>Role (rank 1)</span>
          <select
            className="cp-input"
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
            required
            disabled={!roles.length}
          >
            <option value="">Select…</option>
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
        <label className="cp-field">
          <span>Mobile (login password)</span>
          <input className="cp-input" value={mobile} onChange={(e) => setMobile(e.target.value)} required placeholder="10 digit mobile" />
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="cp-btn cp-btn-primary" disabled={busy || !selectedOrgId || !roleCode}>
            Create member
          </button>
        </div>
      </form>
    </section>
  );
}
