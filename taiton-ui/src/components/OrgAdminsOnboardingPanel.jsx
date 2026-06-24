import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { SearchableOrgSelect } from './SearchableOrgSelect.jsx';
import { OnboardingEmptyState } from './OnboardingEmptyState.jsx';
import { AddIconButton } from './AddIconButton.jsx';
import { FieldLabel } from './FieldLabel.jsx';
import { FieldError } from './FieldError.jsx';
import { ConfirmDeleteCard } from './ConfirmDeleteCard.jsx';
import { MobileField } from './MobileField.jsx';
import { notify } from '../utils/notify.js';
import { validateAll, v } from '../utils/validation.js';

const EMPTY = { email: '', fullName: '', mobile: '' };

export function OrgAdminsOnboardingPanel({ token, embedded = false, refreshSignal = 0 }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState(searchParams.get('orgId') ?? '');
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    const res = await enterpriseApi.platformOrganizations(token);
    setOrganizations(res.organizations ?? []);
  }, [token]);

  const loadAdmins = useCallback(async () => {
    if (!token || !orgId) {
      setAdmins([]);
      return;
    }
    try {
      const res = await enterpriseApi.platformOrgAdmins(token, Number(orgId));
      setAdmins(res.admins ?? []);
    } catch (e) {
      notify.apiError(e, 'Could not load administrators');
      setAdmins([]);
    }
  }, [token, orgId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs, refreshSignal]);

  useEffect(() => {
    if (refreshSignal > 0) loadAdmins();
  }, [refreshSignal, loadAdmins]);

  useEffect(() => {
    if (orgId) {
      setSearchParams({ orgId }, { replace: true });
    }
    setEditingId(null);
    setForm({ ...EMPTY });
    setErrors({});
    loadAdmins();
  }, [orgId, loadAdmins, setSearchParams]);

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setErrors({});
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      email: row.email ?? '',
      fullName: row.fullName ?? '',
      mobile: String(row.mobile ?? '').replace(/\D/g, '').slice(0, 10),
    });
    setErrors({});
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!token) return;
    const next = {
      org: orgId ? null : 'Please select an organization.',
      fullName: v.name(form.fullName, 'Full name', 120),
      email: v.email(form.email),
      mobile: v.mobile10(form.mobile),
    };
    setErrors(next);
    const err = validateAll([() => next.org, () => next.fullName, () => next.email, () => next.mobile]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    setBusy(true);
    const body = {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      mobile: form.mobile,
    };
    try {
      if (editingId) {
        await enterpriseApi.platformUpdateOrgAdmin(token, Number(orgId), editingId, body);
        notify.success('Administrator updated');
        cancelEdit();
      } else {
        await enterpriseApi.platformCreateOrgAdmin(token, Number(orgId), body);
        notify.success('Administrator added');
        setForm({ ...EMPTY });
        setErrors({});
      }
      await loadAdmins();
    } catch (err) {
      notify.apiError(err, 'Could not save administrator');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const row = pendingDelete;
    if (!token || !orgId || !row) return;
    setBusy(true);
    try {
      await enterpriseApi.platformDeleteOrgAdmin(token, Number(orgId), row.id);
      if (editingId === row.id) cancelEdit();
      setPendingDelete(null);
      notify.success('Administrator removed');
      await loadAdmins();
    } catch (err) {
      notify.apiError(err, 'Could not remove administrator');
    } finally {
      setBusy(false);
    }
  }

  const inner = (
    <>
      <SearchableOrgSelect
        organizations={organizations}
        value={orgId}
        onChange={setOrgId}
        label="Organization"
        required
        error={errors.org}
      />

      {!orgId ? (
        <OnboardingEmptyState
          fill
          title="Select An Organization"
          description="Choose an organization from the dropdown above to add administrators."
        />
      ) : (
        <>
          <form className="cp-form-inline-members cp-onboard-panel__divider" onSubmit={onSubmit} noValidate>
            <label className="cp-field">
              <FieldLabel required>Full Name</FieldLabel>
              <input
                id="oa-full"
                className="cp-input"
                value={form.fullName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, fullName: e.target.value }));
                  if (errors.fullName) setErrors((x) => ({ ...x, fullName: null }));
                }}
                aria-invalid={errors.fullName ? true : undefined}
                placeholder="Enter full name"
              />
              <FieldError message={errors.fullName} />
            </label>
            <label className="cp-field">
              <FieldLabel required>Email</FieldLabel>
              <input
                id="oa-email"
                type="email"
                className="cp-input"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }));
                  if (errors.email) setErrors((x) => ({ ...x, email: null }));
                }}
                aria-invalid={errors.email ? true : undefined}
                placeholder="Enter email address"
              />
              <FieldError message={errors.email} />
            </label>
            <div className="cp-field">
              <MobileField
                id="oa-mobile"
                value={form.mobile}
                onChange={(mobile) => {
                  setForm((f) => ({ ...f, mobile }));
                  if (errors.mobile) setErrors((x) => ({ ...x, mobile: null }));
                }}
                error={errors.mobile}
              />
            </div>
            <div className="cp-field cp-field--action">
              <span className="cp-field-label-gutter" aria-hidden="true" />
              <div className="cp-row">
                <AddIconButton
                  label={editingId ? 'Save User' : 'Add User'}
                  busyLabel="Saving…"
                  busy={busy}
                />
                {editingId ? (
                  <button type="button" className="cp-btn cp-btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <div className="cp-accounts-table-wrap">
            <table className="cp-accounts-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="cp-accounts-empty">
                      No administrators yet.
                    </td>
                  </tr>
                ) : (
                  admins.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{idx + 1}</td>
                      <td className="cp-accounts-name">{row.fullName || '—'}</td>
                      <td>{row.email}</td>
                      <td>{row.mobile || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="cp-btn cp-btn-secondary"
                            disabled={busy}
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="cp-btn cp-btn-danger"
                            disabled={busy}
                            onClick={() => setPendingDelete(row)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  const deleteCard = pendingDelete ? (
    <ConfirmDeleteCard
      title="Remove this administrator?"
      message={`${pendingDelete.fullName || pendingDelete.email} will be removed.`}
      confirmLabel="Remove"
      busy={busy}
      onConfirm={confirmDelete}
      onCancel={() => setPendingDelete(null)}
    />
  ) : null;

  if (embedded) {
    return (
      <>
        {inner}
        {deleteCard}
      </>
    );
  }

  return (
    <>
      <section className="cp-card cp-card-pad cp-card--overflow-visible cp-onboard-panel">{inner}</section>
      {deleteCard}
    </>
  );
}
