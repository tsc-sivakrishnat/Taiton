import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { roleMatchesCsv } from '../utils/roleAccess.js';
import { AddIconButton } from '../components/AddIconButton.jsx';
import { ConfirmDeleteCard } from '../components/ConfirmDeleteCard.jsx';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';
import { notify } from '../utils/notify.js';
import { formatRoleName } from '../utils/displayLabels.js';
import { validateAll, v } from '../utils/validation.js';

const VIEW_ROLES = 'org_admin,manager,super_admin,sys_admin';
const REGISTRAR_ROLES = 'org_admin,super_admin,sys_admin';
const PAGE_SIZE = 10;

function isMissingMobileColumnError(message) {
  const m = String(message || '');
  return m.includes('Unknown column') && m.toLowerCase().includes('mobile');
}

function formatActorsDbError(message) {
  if (isMissingMobileColumnError(message)) return null;
  const m = String(message || '');
  return m || 'Something went wrong';
}

function visiblePages(current, totalPages, span = 5) {
  if (totalPages <= span) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let hi = Math.min(totalPages, Math.max(current + Math.floor(span / 2), span));
  let lo = hi - span + 1;
  if (lo < 1) {
    lo = 1;
    hi = Math.min(totalPages, lo + span - 1);
  }
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function StatusDot({ active, label }) {
  const text = label ?? (active ? 'Active' : 'Inactive');
  return (
    <span
      className={`cp-accounts-status ${active ? 'cp-accounts-status--on' : 'cp-accounts-status--off'}`}
      title={text}
      aria-label={text}
    >
      {active ? (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            fill="currentColor"
            d="M10.28 2.28a1 1 0 0 1 0 1.44l-5.25 5.25a1 1 0 0 1-1.44 0L1.72 6.1a1 1 0 1 1 1.42-1.42l1.45 1.45 4.53-4.53a1 1 0 0 1 1.16-.22z"
          />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path
            fill="currentColor"
            d="M2.12 1.29a1 1 0 0 0-1.41 1.41L3.59 5 0.71 7.88a1 1 0 1 0 1.41 1.41L5 6.41l2.88 2.88a1 1 0 0 0 1.41-1.41L6.41 5l2.88-2.88a1 1 0 0 0-1.41-1.41L5 3.59 2.12 0.71z"
          />
        </svg>
      )}
    </span>
  );
}

export function AccountsPage({ embedded = false }) {
  const { activeOrganization, token, navItems } = useAuth();
  const isAssignedInNav = Array.isArray(navItems) && navItems.some((n) => {
    const r = String(n.route ?? '').trim().toLowerCase();
    return r === '/app/org/users' || r === '/app/accounts' || r === '/app/admin/actor-registration';
  });
  const canView = roleMatchesCsv(activeOrganization?.roleCode, VIEW_ROLES) || isAssignedInNav;
  const canRegister = roleMatchesCsv(activeOrganization?.roleCode, REGISTRAR_ROLES) || isAssignedInNav;

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [missingMobileSetup, setMissingMobileSetup] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [roles, setRoles] = useState([]);
  const [rolesError, setRolesError] = useState(null);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!token || !canRegister) {
      setLoadingRoles(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingRoles(true);
      setRolesError(null);
      try {
        const res = await enterpriseApi.adminRoles(token);
        const list = res.roles ?? [];
        if (cancelled) return;
        setRoles(list);
        setRole((prev) => (prev && list.some((r) => r.code === prev) ? prev : ''));
      } catch (e) {
        if (!cancelled) {
          setRolesError(e.message || 'Could not load roles');
          setRoles([]);
        }
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, canRegister]);

  useEffect(() => {
    if (!token || !canView) return;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const offset = (page - 1) * PAGE_SIZE;
        const data = await enterpriseApi.adminActorsList(token, {
          limit: PAGE_SIZE,
          offset,
          q: appliedSearch.trim() || undefined,
        });
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(Number(data.total ?? 0));
        setMissingMobileSetup(false);
      } catch (e) {
        if (!cancelled) {
          if (isMissingMobileColumnError(e.message)) {
            setMissingMobileSetup(true);
          } else {
            setMissingMobileSetup(false);
            notify.error(formatActorsDbError(e.message) || 'Could not load accounts');
          }
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, canView, page, appliedSearch, refreshTick]);


  const pageNums = useMemo(() => visiblePages(page, totalPages, 5), [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  function applySearch() {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  async function onExport() {
    if (!token) return;
    setExporting(true);
    try {
      const csv = await enterpriseApi.adminActorsExportCsv(token, {
        q: appliedSearch.trim() || undefined,
      });
      const name = `accounts-export-${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      notify.success('Export complete', name);
    } catch (e) {
      if (isMissingMobileColumnError(e.message)) {
        setMissingMobileSetup(true);
      } else {
        notify.error(formatActorsDbError(e.message) || 'Export failed');
      }
    } finally {
      setExporting(false);
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    if (!token || !canRegister) return;
    const mobileDigits = mobile.replace(/\D/g, '').slice(0, 10);
    const err = validateAll([
      () => v.name(fullName, 'Full name', 120),
      () => v.email(email),
      () => v.mobile10(mobileDigits),
      () => (role ? null : 'Please select a role.'),
    ]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await enterpriseApi.adminRegisterActor(token, {
        email: email.trim(),
        fullName: fullName.trim(),
        mobile: mobileDigits,
        role,
      });
      if (res.actor?.status === 'pending_approval') {
        notify.success('Pending Approval', res.actor?.message || 'The user registration has been submitted for approval.');
      } else {
        notify.success(
          'Account registered',
          `${res.actor?.email ?? email} — sign in with email and mobile as password.`,
        );
      }
      setEmail('');
      setFullName('');
      setMobile('');
      setPage(1);
      const listData = await enterpriseApi.adminActorsList(token, {
        limit: PAGE_SIZE,
        offset: 0,
        q: appliedSearch.trim() || undefined,
      });
      setItems(listData.items ?? []);
      setTotal(Number(listData.total ?? 0));
    } catch (err) {
      if (isMissingMobileColumnError(err.message)) {
        setMissingMobileSetup(true);
      } else {
        notify.error(formatActorsDbError(err.message) || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const row = pendingDelete;
    if (!token || !row) return;
    setDeleting(true);
    try {
      await enterpriseApi.adminDeleteActor(token, row.id);
      notify.success('User removed', row.email);
      setPendingDelete(null);
      setRefreshTick((n) => n + 1);
    } catch (err) {
      notify.error(formatActorsDbError(err.message) || 'Could not remove user');
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return (
      <div className="cp-stack">
        <h1 className="cp-page-title">Accounts</h1>
        <p className="cp-muted">Users in this organization; what you can view or manage depends on your role.</p>
        <div className="cp-alert">You do not have access to this area for your current role.</div>
      </div>
    );
  }

  return (
    <div className="cp-stack">
      {!embedded ? (
        <header className="cp-accounts-head">
          <PageBreadcrumb current="Accounts" />
          <h1 className="cp-accounts-title">Accounts</h1>
          <p className="cp-muted cp-accounts-lead">
            Users in this organization — view, search, export, or register by role.
          </p>
        </header>
      ) : (
        <div className="cp-page-head">
          <div>
            <h1 className="cp-page-title">Onboarding User to Roles</h1>
            <p className="cp-muted">Register users and assign organization roles.</p>
          </div>
          <button
            type="button"
            className="cp-btn cp-btn-secondary"
            onClick={() => {
              setRefreshTick((n) => n + 1);
              notify.info('Refreshed', 'List updated.');
            }}
          >
            Refresh
          </button>
        </div>
      )}

      <div className="cp-accounts-toolbar-stack cp-accounts-toolbar--enterprise">
        {canRegister ? (
          <form className="cp-accounts-toolbar-row cp-accounts-toolbar-row--register" onSubmit={onRegister}>
            <div className="cp-accounts-field cp-accounts-field--reg-name">
              <label htmlFor="acc-full">
                Full name <span className="cp-req">*</span>
              </label>
              <input
                id="acc-full"
                className="cp-accounts-input"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                autoComplete="name"
                required
                placeholder="Enter full name"
              />
            </div>
            <div className="cp-accounts-field cp-accounts-field--reg-email">
              <label htmlFor="acc-email">
                Email <span className="cp-req">*</span>
              </label>
              <input
                id="acc-email"
                type="email"
                className="cp-accounts-input"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="off"
                required
                placeholder="Enter email address"
              />
            </div>
            <div className="cp-accounts-field cp-accounts-field--reg-mobile">
              <label htmlFor="acc-mobile">
                Mobile <span className="cp-req">*</span>
              </label>
              <input
                id="acc-mobile"
                type="tel"
                inputMode="numeric"
                className="cp-accounts-input"
                placeholder="10 digit mobile"
                maxLength={10}
                pattern="[0-9]{10}"
                title="Enter exactly 10 digits"
                value={mobile}
                onChange={(ev) => setMobile(ev.target.value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="off"
                required
              />
            </div>
            <div className="cp-accounts-field cp-accounts-field--reg-role">
              <label htmlFor="acc-role">
                Role <span className="cp-req">*</span>
              </label>
              <select
                id="acc-role"
                className="cp-accounts-select"
                value={role}
                onChange={(ev) => setRole(ev.target.value)}
                disabled={loadingRoles || !roles.length}
                required
              >
                <option value="">Select role…</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {formatRoleName(r.code, r.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="cp-accounts-field cp-accounts-field--reg-action">
              <span className="cp-accounts-field-label-gutter" aria-hidden="true" />
              <AddIconButton
                label="Add User"
                busyLabel="Saving…"
                busy={submitting}
                disabled={loadingRoles || !role || mobile.replace(/\D/g, '').length !== 10}
              />
            </div>
          </form>
        ) : null}

        <div
          className={
            'cp-accounts-toolbar-row cp-accounts-toolbar-row--secondary' +
            (canRegister ? ' cp-accounts-toolbar-row--secondary-divider' : '')
          }
        >
          <div className="cp-accounts-field cp-accounts-field--search-row">
            <label htmlFor="accounts-search">Search</label>
            <div className="cp-accounts-search-wrap">
              <input
                id="accounts-search"
                className="cp-accounts-input"
                placeholder="Name / email / mobile"
                value={searchInput}
                onChange={(ev) => setSearchInput(ev.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applySearch();
                  }
                }}
                autoComplete="off"
              />
              <button type="button" className="cp-accounts-btn" onClick={applySearch}>
                Search
              </button>
            </div>
          </div>
          <div className="cp-accounts-toolbar-export-slot">
            <div className="cp-accounts-field cp-accounts-field--export">
              <span className="cp-accounts-field-label-gutter" aria-hidden="true" />
              <button
                id="accounts-export-btn"
                type="button"
                className="cp-accounts-btn cp-accounts-btn--export"
                onClick={onExport}
                disabled={exporting || listLoading}
                aria-label="Export accounts as CSV"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {missingMobileSetup ? (
        <div className="cp-accounts-setup-banner" role="status">
          <p className="cp-accounts-setup-banner-title">Database setup required</p>
          <p className="cp-accounts-setup-banner-body">
            Add column <code>mobile</code> to <code>tb_cpanel_users</code>. From <code>cpanel-be</code> run{' '}
            <code>npm run db:ensure-mobile</code>, or run <code>database/migration_add_user_mobile_if_missing.sql</code> in
            your SQL client. Restart the API if needed, then refresh.
          </p>
        </div>
      ) : null}
      {rolesError ? <div className="cp-alert">{rolesError}</div> : null}

      <div className="cp-accounts-table-wrap">
        <table className="cp-accounts-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Status</th>
              {canRegister ? <th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={canRegister ? 7 : 6} className="cp-accounts-empty">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canRegister ? 7 : 6} className="cp-accounts-empty">
                  No accounts match your search.
                </td>
              </tr>
            ) : (
              items.map((row, idx) => (
                <tr key={row.id}>
                  <td>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="cp-accounts-name">{row.fullName || '—'}</td>
                  <td>{row.email}</td>
                  <td>{row.mobile || '—'}</td>
                  <td>{formatRoleName(row.roleCode, row.roleName)}</td>
                  <td>
                    {row.status === 'pending_approval' ? (
                      <StatusDot active={false} label="Awaiting approval" />
                    ) : row.status === 'rejected' ? (
                      <StatusDot active={false} label="Rejected" />
                    ) : (
                      <StatusDot active={row.isActive} />
                    )}
                  </td>
                  {canRegister ? (
                    <td>
                      <button
                        type="button"
                        className="cp-btn-icon cp-btn-icon--danger"
                        disabled={row.status === 'inactive' || deleting || row.roleCode === 'org_admin'}
                        onClick={() => setPendingDelete(row)}
                        aria-label={`Delete ${row.fullName || row.email}`}
                        title={row.roleCode === 'org_admin' ? 'Delete disabled for organization admins' : 'Delete user'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="cp-accounts-footer">
        <span>
          Showing {rangeStart}-{rangeEnd} of {total} {total === 1 ? 'account' : 'accounts'}
        </span>
        <nav className="cp-accounts-pagination" aria-label="Pagination">
          <button
            type="button"
            className="cp-accounts-page-btn"
            disabled={page <= 1 || listLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &lt; Previous
          </button>
          {pageNums.map((n) => (
            <button
              key={n}
              type="button"
              className={`cp-accounts-page-btn${n === page ? ' cp-accounts-page-btn--active' : ''}`}
              onClick={() => setPage(n)}
              disabled={listLoading}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="cp-accounts-page-btn"
            disabled={page >= totalPages || listLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </button>
        </nav>
      </footer>

      {pendingDelete ? (
        <ConfirmDeleteCard
          title="Delete this user?"
          message={`${pendingDelete.fullName || pendingDelete.email} will be deactivated.`}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
