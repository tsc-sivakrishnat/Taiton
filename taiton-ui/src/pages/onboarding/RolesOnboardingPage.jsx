import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PermissionRoute } from '../../routes/PermissionRoute.jsx';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { SearchableOrgSelect } from '../../components/SearchableOrgSelect.jsx';
import { AddIconButton } from '../../components/AddIconButton.jsx';
import { OnboardingEmptyState } from '../../components/OnboardingEmptyState.jsx';
import { FieldLabel } from '../../components/FieldLabel.jsx';
import { FieldError } from '../../components/FieldError.jsx';
import { notify } from '../../utils/notify.js';
import { formatRoleName } from '../../utils/displayLabels.js';
import { ConfirmDeleteCard } from '../../components/ConfirmDeleteCard.jsx';
import { validateAll, v } from '../../utils/validation.js';
import { PageSpinner } from '../../components/PageSpinner.jsx';
import { OrgTileActionBtn } from '../../components/OrgTileActionBtn.jsx';

function nextAvailableRank(roles) {
  const used = new Set(
    (roles ?? []).map((r) => Number(r.priority)).filter((n) => Number.isFinite(n) && n >= 1),
  );
  let rank = 1;
  while (used.has(rank)) rank += 1;
  return rank;
}

function slugFromRoleName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

const PROTECTED_ROLE = 'org_admin';

export function RolesOnboardingPage() {
  return (
    <PermissionRoute platformOnly>
      <RolesOnboardingPageInner />
    </PermissionRoute>
  );
}

function RolesOnboardingPageInner() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState(searchParams.get('orgId') ?? '');
  const [roles, setRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: '',
  });
  const [errors, setErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await enterpriseApi.platformOrganizations(token);
      setOrganizations(res.organizations ?? []);
    } catch {
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadRoles = useCallback(async () => {
    if (!token || !orgId) {
      setRoles([]);
      return;
    }
    setLoading(true);
    try {
      const res = await enterpriseApi.platformOrgRoles(token, Number(orgId));
      setRoles(res.roles ?? []);
    } catch (e) {
      notify.apiError(e, 'Could not load roles');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (orgId) {
      setSearchParams({ orgId }, { replace: true });
      loadRoles();
    }
  }, [orgId, loadRoles, setSearchParams]);

  useEffect(() => {
    if (!orgId) return;
    setForm({ name: '', description: '', priority: '' });
    setErrors({});
    setPendingDelete(null);
  }, [orgId]);

  useEffect(() => {
    setForm((f) => {
      if (f.priority !== '') return f;
      return { ...f, priority: nextAvailableRank(roles) };
    });
  }, [roles]);

  async function onSave(e) {
    e.preventDefault();
    if (!token) return;
    const next = {
      org: orgId ? null : 'Please select an organization.',
      name: v.name(form.name, 'Role name', 120),
      priority: v.priority(form.priority),
    };
    setErrors(next);
    const err = validateAll([() => next.org, () => next.name, () => next.priority]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    const samePriority = roles.some((r) => Number(r.priority) === Number(form.priority));
    if (samePriority) {
      notify.warning('Duplicate Rank', 'A role with this rank already exists in this organization.');
      return;
    }
    const code = slugFromRoleName(form.name);
    if (!code) {
      notify.warning('Invalid role name', 'Use letters or numbers only.');
      return;
    }
    setBusy(true);
    try {
      await enterpriseApi.platformCreateOrgRole(token, Number(orgId), {
        code,
        name: form.name.trim(),
        description: form.description.trim(),
        priority: form.priority,
      });
      notify.success('Role Added', form.name.trim());
      setForm({ name: '', description: '', priority: '' });
      setErrors({});
      await loadRoles();
    } catch (err) {
      notify.apiError(err, 'Could not add role');
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(role) {
    if (role.code === PROTECTED_ROLE) {
      notify.warning('Cannot remove', 'Organization administrator role is protected.');
      return;
    }
    setPendingDelete(role);
  }

  async function confirmDelete() {
    const role = pendingDelete;
    if (!token || !orgId || !role) return;
    const label = formatRoleName(role.code, role.name);
    setBusy(true);
    try {
      await enterpriseApi.platformDeleteOrgRole(token, Number(orgId), role.code);
      notify.success('Role Removed', label);
      setPendingDelete(null);
      await loadRoles();
    } catch (err) {
      notify.apiError(err, 'Could not remove role');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cp-stack cp-stack--fill">
      <PageBreadcrumb current="Onboarding Roles" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Onboarding Roles</h1>
          <p className="cp-page-lead">Pick an organization, then add roles (rank 1, 2, 3…).</p>
        </div>
        <button
          type="button"
          className="cp-btn cp-btn-secondary"
          onClick={() => {
            loadOrgs();
            if (orgId) loadRoles();
            notify.info('Refreshed', 'List updated.');
          }}
        >
          Refresh
        </button>
      </div>

      <section className="cp-card cp-card-pad cp-card--overflow-visible cp-onboard-panel cp-onboard-panel--stretch">
        <SearchableOrgSelect
          organizations={organizations}
          value={orgId}
          onChange={setOrgId}
          label="Organization"
          required
        />

        {!orgId ? (
          <OnboardingEmptyState
            fill
            title="Select An Organization"
            description="Choose an organization from the dropdown above to manage its roles."
          />
        ) : loading ? (
          <PageSpinner />
        ) : (
          <>
            <form className="cp-form-inline cp-form-inline-roles cp-onboard-panel__divider" onSubmit={onSave} noValidate>
              <label className="cp-field">
                <FieldLabel required>Role Name</FieldLabel>
                <input
                  className="cp-input"
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value.slice(0, 120) }));
                    if (errors.name) setErrors((x) => ({ ...x, name: null }));
                  }}
                  placeholder="eg. Employee"
                  maxLength={120}
                  aria-invalid={errors.name ? true : undefined}
                />
                <FieldError message={errors.name} />
              </label>
              <label className="cp-field">
                <FieldLabel required>Rank</FieldLabel>
                <input
                  type="number"
                  className="cp-input"
                  value={form.priority === 0 ? '' : form.priority}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setForm((f) => ({
                      ...f,
                      priority: raw === '' ? '' : Number(raw),
                    }));
                    if (errors.priority) setErrors((x) => ({ ...x, priority: null }));
                  }}
                  min={1}
                  max={9999}
                  placeholder="Rank"
                  aria-invalid={errors.priority ? true : undefined}
                />
                <FieldError message={errors.priority} />
              </label>
              <label className="cp-field">
                <FieldLabel>Description</FieldLabel>
                <input
                  className="cp-input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, 255) }))}
                  maxLength={255}
                  placeholder="Enter description"
                />
              </label>
              <div className="cp-field cp-field--action">
                <span className="cp-field-label-gutter" aria-hidden="true" />
                <AddIconButton label="Add Role" busyLabel="Adding…" busy={busy} />
              </div>
            </form>

            <div className="cp-onboard-panel__body">
              {roles.length === 0 ? (
                <OnboardingEmptyState
                  title="No Roles Yet"
                  description="Add a role above, then assign users and navigation."
                />
              ) : (
                <div className="cp-org-tile-grid">
                  {roles.map((r) => (
                    <article key={r.id ?? r.code} className="cp-org-tile cp-org-tile--role">
                      <span className="cp-org-tile__icon" aria-hidden>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </span>
                      <div className="cp-org-tile__code">Line {r.priority}</div>
                      <div className="cp-org-tile__name">{formatRoleName(r.code, r.name)}</div>
                      {r.description ? (
                        <p className="cp-org-tile__meta">{r.description}</p>
                      ) : null}
                      {r.code !== PROTECTED_ROLE ? (
                        <button
                          type="button"
                          className="cp-btn cp-btn-danger cp-org-tile__action-btn"
                          disabled={busy}
                          onClick={() => requestDelete(r)}
                        >
                          Delete
                        </button>
                      ) : (
                        <div className="cp-org-tile__actions" style={{ width: '100%' }}>
                          <OrgTileActionBtn
                            to={`/app/onboarding/members?orgId=${orgId}`}
                            icon="members"
                            label="Members"
                          />
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {pendingDelete ? (
        <ConfirmDeleteCard
          title="Remove this role?"
          message={`"${formatRoleName(pendingDelete.code, pendingDelete.name)}" will be deleted.`}
          confirmLabel="Remove role"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
