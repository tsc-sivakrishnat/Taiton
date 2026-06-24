import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PermissionRoute } from '../../routes/PermissionRoute.jsx';
import { PERMISSIONS } from '../../constants/permissions.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { AddIconButton } from '../../components/AddIconButton.jsx';
import { OnboardingEmptyState } from '../../components/OnboardingEmptyState.jsx';
import { notify } from '../../utils/notify.js';
import { FieldLabel } from '../../components/FieldLabel.jsx';
import { formatRoleName } from '../../utils/displayLabels.js';
import { ConfirmDeleteCard } from '../../components/ConfirmDeleteCard.jsx';
import { validateAll, v } from '../../utils/validation.js';

const EMPTY_FORM = {
  id: null,
  resource: '',
  makerRole: '',
  checkerRole: '',
  isActive: true,
};

export function ApprovalRulesPage() {
  return (
    <PermissionRoute permission={PERMISSIONS.ORG_APPROVAL_RULES}>
      <ApprovalRulesPageInner />
    </PermissionRoute>
  );
}

function ApprovalRulesPageInner() {
  const { token } = useAuth();
  const [rules, setRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [navItems, setNavItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [pendingDelete, setPendingDelete] = useState(null);

  const getResourceLabel = useCallback((value) => {
    const found = navItems.find((item) => item.route === value);
    return found ? found.label : value;
  }, [navItems]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [rulesRes, rolesRes, navRes] = await Promise.all([
        enterpriseApi.orgApprovalRules(token),
        enterpriseApi.orgRoles(token),
        enterpriseApi.orgNavigation(token).catch(() => ({ items: [] })),
      ]);
      const filteredNav = (navRes.items ?? []).filter((item) => {
        const r = String(item.route ?? '').trim().toLowerCase();
        if (r.includes('dashboard') || r.includes('profile')) return false;
        if (r.startsWith('/app/onboarding') || r.startsWith('/app/platform')) return false;
        if (r.includes('/org/')) {
          const isStatic = String(item.id).startsWith('static-');
          return !isStatic;
        }
        return true;
      });
      setNavItems(filteredNav);

      const filteredRules = (rulesRes.rules ?? []).filter((r) => {
        return filteredNav.some((nav) => nav.route === r.resource);
      });
      setRules(filteredRules);
      setRoles(rolesRes.roles ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (navItems.length && !form.resource) {
      setForm((f) => ({ ...f, resource: navItems[0].route }));
    }
  }, [navItems, form.resource]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function startEdit(rule) {
    setEditingId(rule.id);
    setForm({
      id: rule.id,
      resource: rule.resource,
      makerRole: rule.makerRole,
      checkerRole: rule.checkerRole,
      isActive: rule.isActive !== false && rule.isActive !== 0,
    });
  }

  function cancelEdit() {
    resetForm();
  }

  async function onSave(e) {
    e.preventDefault();
    if (!token || !form.makerRole || !form.checkerRole) return;
    if (form.makerRole === form.checkerRole) {
      notify.warning('Invalid rule', 'Submitter and approver must be different people.');
      return;
    }
    const err = validateAll([
      () => (form.makerRole ? null : 'Select who submits content.'),
      () => (form.checkerRole ? null : 'Select who approves content.'),
    ]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    setBusy(true);
    try {
      await enterpriseApi.orgUpsertApprovalRule(token, {
        id: form.id ?? undefined,
        resource: form.resource,
        makerRole: form.makerRole,
        checkerRole: form.checkerRole,
        isActive: form.isActive,
      });
      notify.success(editingId ? 'Rule updated' : 'Rule added', getResourceLabel(form.resource));
      resetForm();
      await load();
    } catch (err) {
      notify.apiError(err, 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const rule = pendingDelete;
    if (!token || !rule) return;
    setBusy(true);
    try {
      await enterpriseApi.orgDeleteApprovalRule(token, rule.id);
      notify.success('Rule deleted', getResourceLabel(rule.resource));
      if (editingId === rule.id) cancelEdit();
      setPendingDelete(null);
      await load();
    } catch (err) {
      notify.apiError(err, 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Onboarding Rules to Roles" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Onboarding Rules to Roles</h1>
          <p className="cp-page-lead">Maker and checker role pairs for this organization.</p>
        </div>
        <button
          type="button"
          className="cp-btn cp-btn-secondary"
          onClick={() => {
            load();
            notify.info('Refreshed', 'List updated.');
          }}
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      <section className="cp-card cp-card-pad">
        <h2 className="cp-section-title">{editingId ? 'Edit Rule' : 'Add Rule'}</h2>
        <form onSubmit={onSave}>
          <div className={editingId ? 'cp-grid cp-grid-2' : 'cp-grid-rules-inline'}>
            <label className="cp-field">
              <FieldLabel required>Content type</FieldLabel>
              <select
                className="cp-input"
                value={form.resource}
                onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value }))}
                disabled={!navItems.length}
              >
                {navItems.map((item) => (
                  <option key={item.id} value={item.route}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="cp-field">
              <FieldLabel required>Submitted by</FieldLabel>
              <select
                className="cp-input"
                value={form.makerRole}
                onChange={(e) => setForm((f) => ({ ...f, makerRole: e.target.value }))}
                disabled={!roles.length}
              >
                <option value="">Select…</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {formatRoleName(r.code, r.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="cp-field">
              <FieldLabel required>Approved by</FieldLabel>
              <select
                className="cp-input"
                value={form.checkerRole}
                onChange={(e) => setForm((f) => ({ ...f, checkerRole: e.target.value }))}
                disabled={!roles.length}
              >
                <option value="">Select…</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {formatRoleName(r.code, r.name)}
                  </option>
                ))}
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
            ) : (
              <div className="cp-field cp-field--action">
                <span className="cp-field-label-gutter" aria-hidden="true">
                  &nbsp;
                </span>
                <AddIconButton
                  label="Add Rule"
                  busyLabel="Adding…"
                  busy={busy}
                  disabled={!roles.length}
                />
              </div>
            )}
          </div>
          {editingId ? (
            <div className="cp-row" style={{ marginTop: 12 }}>
              <button type="submit" className="cp-btn cp-btn-primary" disabled={busy || !roles.length}>
                Save changes
              </button>
              <button type="button" className="cp-btn cp-btn-secondary" onClick={cancelEdit} disabled={busy}>
                Cancel
              </button>
            </div>
          ) : null}
        </form>

        <h2 className="cp-section-title cp-section-title--divider">Current Rules</h2>
        {rules.length === 0 ? (
          <OnboardingEmptyState
            title="No Rules Yet"
            description="Add a rule above to link content types with submitter and approver roles."
          />
        ) : (
          <ul className="cp-notify-list">
            {rules.map((r) => (
              <li key={r.id} className="cp-notify-item">
                <div>
                  <div className="cp-notify-title">{getResourceLabel(r.resource)}</div>
                  <div className="cp-muted">
                    {formatRoleName(r.makerRole)} → {formatRoleName(r.checkerRole)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>
                  <span className={`cp-tag cp-tag-${r.isActive ? 'success' : 'info'}`}>
                    {r.isActive ? 'active' : 'off'}
                  </span>
                  <button
                    type="button"
                    className="cp-btn cp-btn-secondary"
                    disabled={busy}
                    onClick={() => startEdit(r)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn-danger"
                    disabled={busy}
                    onClick={() => setPendingDelete(r)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingDelete ? (
        <ConfirmDeleteCard
          title="Delete this rule?"
          message={`Approval rule for "${getResourceLabel(pendingDelete.resource)}" will be removed.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
