import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { ORG_NAV_TEMPLATES } from '../../constants/navTemplates.js';
import { NAV_ICON_OPTIONS } from '../../constants/navIcons.js';
import { PermissionRoute } from '../../routes/PermissionRoute.jsx';
import { RoleMultiSelectDropdown } from '../../components/RoleMultiSelectDropdown.jsx';
import { SearchableOrgSelect } from '../../components/SearchableOrgSelect.jsx';
import { AddIconButton } from '../../components/AddIconButton.jsx';
import { OnboardingEmptyState } from '../../components/OnboardingEmptyState.jsx';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { IconSelect } from '../../components/IconSelect.jsx';
import { notify } from '../../utils/notify.js';
import { FieldLabel } from '../../components/FieldLabel.jsx';
import { FieldError } from '../../components/FieldError.jsx';
import { formatRolesList, formatRoleName } from '../../utils/displayLabels.js';
import { ConfirmDeleteCard } from '../../components/ConfirmDeleteCard.jsx';
import { validateAll, v } from '../../utils/validation.js';
import { PageSpinner } from '../../components/PageSpinner.jsx';

function parseRolesCsv(csv) {
  if (!csv || !String(csv).trim()) return [];
  return String(csv)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function nextSortOrder(items) {
  if (!items?.length) return 1;
  return Math.max(...items.map((i) => Number(i.sortOrder) || 0), 0) + 1;
}

export function NavOnboardingPage() {
  return (
    <PermissionRoute platformOnly>
      <NavOnboardingPageInner />
    </PermissionRoute>
  );
}

function NavOnboardingPageInner() {
  const { token, refreshNavigation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [organizations, setOrganizations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [orgId, setOrgId] = useState(searchParams.get('orgId') ?? '');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [icons, setIcons] = useState(NAV_ICON_OPTIONS);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    id: null,
    label: '',
    icon: 'Circle',
    route: '',
    sortOrder: 1,
    roleCodes: [],
    position: 'top',
    isActive: true,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');

  const autoSort = useMemo(() => nextSortOrder(items), [items]);

  const filteredItems = useMemo(() => {
    const visibleToOthers = items.filter((item) => {
      if (!item.rolesCsv || !item.rolesCsv.trim()) return true;
      const parts = item.rolesCsv.split(',').map((p) => p.trim()).filter(Boolean);
      const hasOtherRoles = parts.some((role) => role !== 'sys_admin' && role !== 'super_admin');
      return hasOtherRoles;
    });

    if (!roleFilter) return visibleToOthers;
    return visibleToOthers.filter((item) => {
      if (!item.rolesCsv || !item.rolesCsv.trim()) return true;
      const parts = item.rolesCsv.split(',').map((p) => p.trim()).filter(Boolean);
      return parts.includes(roleFilter);
    });
  }, [items, roleFilter]);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    const res = await enterpriseApi.platformOrganizations(token);
    setOrganizations(res.organizations ?? []);
  }, [token]);

  const loadRoles = useCallback(async () => {
    if (!token || !orgId) {
      setRoles([]);
      return;
    }
    setRoles([]);
    let orgRolesList = [];
    try {
      const res = await enterpriseApi.platformOrgRoles(token, Number(orgId));
      if (res.roles?.length) {
        orgRolesList = res.roles;
      }
    } catch {
      /* fall through */
    }
    if (!orgRolesList.length) {
      try {
        const res = await enterpriseApi.platformAssignableRoles(token, Number(orgId));
        orgRolesList = res.roles ?? [];
      } catch {
        orgRolesList = [];
      }
    }
    const combined = [];
    for (const r of orgRolesList) {
      if (r.code !== 'sys_admin' && r.code !== 'super_admin') {
        if (!combined.some((c) => c.code === r.code)) {
          combined.push(r);
        }
      }
    }
    setRoles(combined);
  }, [token, orgId]);

  const loadNav = useCallback(async () => {
    if (!token || !orgId) {
      setItems([]);
      return;
    }
    setItems([]);
    setLoading(true);
    try {
      const res = await enterpriseApi.platformNav(token, Number(orgId));
      setItems(res.items ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load nav');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    loadOrgs();
    if (token) {
      enterpriseApi
        .platformNavIcons(token)
        .then((res) => {
          if (res.icons?.length) setIcons(res.icons);
        })
        .catch(() => {});
    }
  }, [loadOrgs, token]);

  useEffect(() => {
    resetForm();
    setRoleFilter('');
    if (orgId) {
      setSearchParams({ orgId }, { replace: true });
      loadRoles();
      loadNav();
    } else {
      setRoles([]);
      setItems([]);
    }
  }, [orgId, loadRoles, loadNav, setSearchParams]);

  useEffect(() => {
    if (!editingId) {
      setForm((f) => ({ ...f, sortOrder: autoSort }));
    }
  }, [autoSort, editingId]);

  function resetForm() {
    setEditingId(null);
    setForm({
      id: null,
      label: '',
      icon: 'Circle',
      route: '',
      sortOrder: nextSortOrder(items),
      roleCodes: [],
      position: 'top',
      isActive: true,
    });
    setFieldErrors({});
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      id: item.id,
      label: item.label,
      icon: item.icon || 'Circle',
      route: item.route,
      sortOrder: item.sortOrder ?? 1,
      roleCodes: parseRolesCsv(item.rolesCsv),
      position: item.position === 'bottom' ? 'bottom' : 'top',
      isActive: item.isActive !== false && item.isActive !== 0,
    });
  }

  async function onSaveItem(e) {
    e.preventDefault();
    if (!token || !orgId) return;
    const next = {
      label: v.name(form.label, 'Label', 80),
      route: v.route(form.route),
    };
    setFieldErrors(next);
    const err = validateAll([() => next.label, () => next.route]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    const isDuplicate = items.some(
      (item) =>
        item.id !== form.id &&
        String(item.label).trim().toLowerCase() === String(form.label).trim().toLowerCase()
    );
    if (isDuplicate) {
      notify.warning('Duplicate Label', 'A nav item with this menu label already exists.');
      return;
    }
    const sortOrder = editingId ? form.sortOrder : nextSortOrder(items);
    setBusy(true);
    try {
      const rolesCsv = form.roleCodes.length ? form.roleCodes.join(',') : null;
      await enterpriseApi.platformUpsertNav(token, Number(orgId), {
        id: form.id ?? undefined,
        label: form.label,
        icon: form.icon,
        route: form.route,
        sortOrder,
        rolesCsv,
        position: form.position,
        isActive: form.isActive,
      });
      notify.success(editingId ? 'Nav Updated' : 'Nav Added', form.label);
      resetForm();
      await loadNav();
      if (refreshNavigation) await refreshNavigation();
    } catch (err) {
      notify.apiError(err, 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const item = pendingDelete;
    if (!token || !orgId || !item) return;
    setBusy(true);
    try {
      await enterpriseApi.platformDeleteNav(token, Number(orgId), item.id);
      notify.success('Nav Deleted', item.label);
      if (editingId === item.id) resetForm();
      setPendingDelete(null);
      await loadNav();
    } catch (err) {
      notify.apiError(err, 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate(tpl) {
    if (!token || !orgId) return;
    if (items.some((i) => String(i.label).trim().toLowerCase() === String(tpl.label).trim().toLowerCase())) {
      notify.warning('Already Added', `${tpl.label} exists.`);
      return;
    }
    setBusy(true);
    try {
      await enterpriseApi.platformUpsertNav(token, Number(orgId), {
        label: tpl.label,
        icon: tpl.icon,
        route: tpl.route,
        sortOrder: nextSortOrder(items),
        rolesCsv: tpl.rolesCsv,
        position: 'top',
      });
      notify.success('Template Added', tpl.label);
      await loadNav();
    } catch (err) {
      notify.apiError(err, 'Template failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cp-stack cp-stack--fill">
      <PageBreadcrumb current="Onboarding Nav Items" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Onboarding Nav Items</h1>
          <p className="cp-page-lead">Pick an organization and assign menu links to roles.</p>
        </div>
        <button
          type="button"
          className="cp-btn cp-btn-secondary"
          onClick={() => {
            loadOrgs();
            if (orgId) {
              loadRoles();
              loadNav();
            }
            notify.info('Refreshed', 'List updated.');
          }}
        >
          Refresh
        </button>
      </div>

      <section className="cp-card cp-card-pad cp-card--overflow-visible cp-onboard-panel cp-onboard-panel--stretch">
        <SearchableOrgSelect organizations={organizations} value={orgId} onChange={setOrgId} label="Organization" />

        {!orgId ? (
          <OnboardingEmptyState
            fill
            title="Select An Organization"
            description="Choose an organization from the dropdown above to manage navigation."
          />
        ) : loading ? (
          <PageSpinner />
        ) : (
          <>
            <div className="cp-nav-templates cp-onboard-panel__divider">
              <h2 className="cp-section-title cp-section-title--in-card">Quick Add Templates</h2>
              <div className="cp-nav-templates__list">
                {ORG_NAV_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.route}
                    type="button"
                    className="cp-btn cp-btn-secondary cp-nav-templates__btn"
                    disabled={busy}
                    onClick={() => addTemplate(tpl)}
                  >
                    + {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <form className="cp-grid cp-grid-2 cp-onboard-panel__divider" onSubmit={onSaveItem} noValidate>
              <h2 className="cp-section-title cp-section-title--in-card cp-field--full">
                {editingId ? 'Edit Nav Item' : 'Add Nav Item'}
              </h2>
              <label className="cp-field">
                <FieldLabel required>Menu Label</FieldLabel>
                <input
                  className="cp-input"
                  value={form.label}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, label: e.target.value }));
                    if (fieldErrors.label) setFieldErrors((x) => ({ ...x, label: null }));
                  }}
                  maxLength={80}
                  aria-invalid={fieldErrors.label ? true : undefined}
                  placeholder="Enter menu label"
                />
                <FieldError message={fieldErrors.label} />
              </label>
              <label className="cp-field">
                <FieldLabel required>Page Link</FieldLabel>
                <input
                  className="cp-input"
                  value={form.route}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, route: e.target.value }));
                    if (fieldErrors.route) setFieldErrors((x) => ({ ...x, route: null }));
                  }}
                  placeholder="/app/example"
                  aria-invalid={fieldErrors.route ? true : undefined}
                />
                <FieldError message={fieldErrors.route} />
              </label>
              <IconSelect icons={icons} value={form.icon} onChange={(icon) => setForm((f) => ({ ...f, icon }))} />
              <label className="cp-field">
                <FieldLabel required>Position</FieldLabel>
                <select
                  className="cp-input"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
              {editingId ? (
                <label className="cp-field cp-field--checkbox">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <span>Active</span>
                </label>
              ) : null}
              <div className="cp-field--full">
                <RoleMultiSelectDropdown
                  roles={roles}
                  selectedCodes={form.roleCodes}
                  onChange={(roleCodes) => setForm((f) => ({ ...f, roleCodes }))}
                  action={
                    <AddIconButton
                      label={editingId ? 'Save Nav Item' : 'Add Nav Item'}
                      busyLabel="Saving…"
                      busy={busy}
                    />
                  }
                />
              </div>
              {editingId ? (
                <div style={{ gridColumn: '1 / -1' }} className="cp-row">
                  <button type="button" className="cp-btn cp-btn-secondary" onClick={resetForm}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </form>

            <div className="cp-onboard-panel__body cp-onboard-panel__divider" style={{ marginTop: '48px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 className="cp-section-title cp-section-title--in-card" style={{ margin: 0 }}>Current Nav Items</h2>
                {items.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="cp-field-label" style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--cp-text-muted)' }}>Filter by Role:</span>
                    <select
                      className="cp-input"
                      style={{ width: '180px', height: '36px', fontSize: '13px' }}
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value="">All Roles</option>
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {formatRoleName(r.code, r.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {items.length === 0 ? (
                <p className="cp-muted">No nav items yet.</p>
              ) : (
                <div className="cp-accounts-table-wrap">
                  <table className="cp-accounts-table">
                    <thead>
                      <tr>
                        <th>Menu Label</th>
                        <th>Position</th>
                        <th>Page Link</th>
                        <th>Roles Visibility</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right', width: '115px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--cp-text-muted)' }}>
                            No nav items visible to the selected role.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600 }}>{item.label}</td>
                            <td>{item.position === 'bottom' ? 'Bottom' : 'Top'}</td>
                            <td><code>{item.route}</code></td>
                            <td>
                              {(() => {
                                if (!item.rolesCsv || !item.rolesCsv.trim()) return 'All roles';
                                const cleanCsv = item.rolesCsv
                                  .split(',')
                                  .map((r) => r.trim())
                                  .filter((r) => r !== 'sys_admin' && r !== 'super_admin')
                                  .join(',');
                                return formatRolesList(cleanCsv, roles);
                              })()}
                            </td>
                            <td>
                              <span className={`cp-tag cp-tag-${item.isActive ? 'success' : 'info'}`}>
                                {item.isActive ? 'Active' : 'Off'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'nowrap' }}>
                                <button
                                  type="button"
                                  className="cp-btn-icon"
                                  onClick={() => startEdit(item)}
                                aria-label={`Edit ${item.label}`}
                                title="Edit nav item"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path
                                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--danger"
                                onClick={() => setPendingDelete(item)}
                                aria-label={`Delete ${item.label}`}
                                title="Delete nav item"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {pendingDelete ? (
        <ConfirmDeleteCard
          title="Delete this nav item?"
          message={`"${pendingDelete.label}" will be removed.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
