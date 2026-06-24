import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PermissionRoute } from '../../routes/PermissionRoute.jsx';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { FieldLabel } from '../../components/FieldLabel.jsx';
import { FieldError } from '../../components/FieldError.jsx';
import { AddIconButton } from '../../components/AddIconButton.jsx';
import { OnboardingEmptyState } from '../../components/OnboardingEmptyState.jsx';
import { OrgTileActionBtn } from '../../components/OrgTileActionBtn.jsx';
import { notify } from '../../utils/notify.js';
import { formatOrganizationName } from '../../utils/displayLabels.js';
import { validateAll, v } from '../../utils/validation.js';
import { PageSpinner } from '../../components/PageSpinner.jsx';

const CODE_MAX = 40;
const NAME_MAX = 120;

function formatOrgCodeInput(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, CODE_MAX);
}

export function OrganizationsOnboardingPage() {
  return (
    <PermissionRoute platformOnly>
      <OrganizationsOnboardingPageInner />
    </PermissionRoute>
  );
}

function OrganizationsOnboardingPageInner() {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgCode, setOrgCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await enterpriseApi.platformOrganizations(token);
      setOrganizations(res.organizations ?? []);
    } catch (e) {
      notify.apiError(e, 'Could not load organizations');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e) {
    e.preventDefault();
    if (!token) return;
    const next = {
      code: v.orgCode(orgCode),
      name: v.name(orgName, 'Organization name', NAME_MAX),
    };
    setErrors(next);
    const err = validateAll([() => next.code, () => next.name]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    setBusy(true);
    try {
      const name = orgName.trim();
      await enterpriseApi.platformCreateOrganization(token, { code: orgCode, name });
      setOrgCode('');
      setOrgName('');
      setErrors({});
      notify.success('Organization Created', name);
      await load();
    } catch (err) {
      notify.apiError(err, 'Could not create organization');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Onboarding Organization" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Onboarding Organization</h1>
          <p className="cp-page-lead">Create tenants and open roles, members, or nav for each.</p>
        </div>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      <section className="cp-card cp-card-pad cp-onboard-panel">
        <form className="cp-form-inline-org cp-onboard-panel__create" onSubmit={onCreate} noValidate>
          <div className="cp-form-inline-org__field">
            <label className="cp-field cp-field--stacked">
              <FieldLabel required>Organization Code</FieldLabel>
              <input
                className="cp-input cp-input--uppercase"
                value={orgCode}
                onChange={(e) => {
                  setOrgCode(formatOrgCodeInput(e.target.value));
                  if (errors.code) setErrors((x) => ({ ...x, code: null }));
                }}
                placeholder="Enter Org Code"
                maxLength={CODE_MAX}
                aria-invalid={errors.code ? true : undefined}
              />
              <FieldError message={errors.code} />
            </label>
          </div>
          <div className="cp-form-inline-org__field">
            <label className="cp-field cp-field--stacked">
              <FieldLabel required>Organization Name</FieldLabel>
              <input
                className="cp-input"
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value.slice(0, NAME_MAX));
                  if (errors.name) setErrors((x) => ({ ...x, name: null }));
                }}
                maxLength={NAME_MAX}
                aria-invalid={errors.name ? true : undefined}
                placeholder="Enter Org Name"
              />
              <FieldError message={errors.name} />
            </label>
          </div>
          <div className="cp-form-inline-org__submit">
            <AddIconButton label="Add Organization" busyLabel="Creating…" busy={busy} />
          </div>
        </form>

        <div className="cp-onboard-panel__body">
          {loading ? (
            <PageSpinner />
          ) : organizations.filter((o) => o.code?.toLowerCase() !== 'sys_admin').length === 0 ? (
            <OnboardingEmptyState
              title="No Organizations Yet"
              description="Create an organization above to set up roles, administrators, and navigation."
            />
          ) : (
            <div className="cp-org-tile-grid">
              {organizations
                .filter((o) => o.code?.toLowerCase() !== 'sys_admin')
                .map((o) => (
                <article key={o.id} className="cp-org-tile">
                  <span className="cp-org-tile__icon" aria-hidden>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div className="cp-org-tile__code">{o.code}</div>
                  <div className="cp-org-tile__name">{formatOrganizationName(o)}</div>
                  <div className="cp-org-tile__actions">
                    <OrgTileActionBtn
                      to={`/app/onboarding/roles?orgId=${o.id}`}
                      icon="roles"
                      label="Roles"
                    />
                    <OrgTileActionBtn
                      to={`/app/onboarding/members?orgId=${o.id}`}
                      icon="members"
                      label="Members"
                    />
                    <OrgTileActionBtn
                      to={`/app/onboarding/nav?orgId=${o.id}`}
                      icon="nav"
                      label="Nav"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
