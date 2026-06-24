import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PermissionRoute } from '../../routes/PermissionRoute.jsx';
import { PERMISSIONS } from '../../constants/permissions.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { FieldLabel } from '../../components/FieldLabel.jsx';
import { formatRoleName, humanizeAction } from '../../utils/displayLabels.js';
import { notify } from '../../utils/notify.js';

export function AuditPage() {
  return (
    <PermissionRoute permission={PERMISSIONS.ORG_AUDIT_VIEW}>
      <AuditPageInner />
    </PermissionRoute>
  );
}

function AuditPageInner() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const audit = await enterpriseApi.auditLog(token, { limit: 100 });
      setItems(audit.items ?? []);
    } catch (e) {
      notify.apiError(e, 'Could not load activity log');
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const orgOnly = items.filter(
    (a) => a.actorRole && !['sys_admin', 'super_admin'].includes(a.actorRole),
  );
  const roles = [...new Set(orgOnly.map((a) => a.actorRole).filter(Boolean))].sort();
  const filtered = roleFilter
    ? orgOnly.filter((a) => a.actorRole === roleFilter)
    : orgOnly;

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Role Specific Audit Tracking" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Role Specific Audit Tracking</h1>
          <p className="cp-muted">Filter audit entries by actor role.</p>
        </div>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>
      <section className="cp-card cp-card-pad">
        <label className="cp-field">
          <FieldLabel>Filter by role</FieldLabel>
          <select className="cp-input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {formatRoleName(r)}
              </option>
            ))}
          </select>
        </label>
        <ul className="cp-notify-list" style={{ marginTop: '1rem' }}>
          {filtered.length === 0 ? (
            <li className="cp-muted">No audit entries.</li>
          ) : (
            filtered.map((a) => (
              <li key={a.id} className="cp-notify-item">
                <div>
                  <div className="cp-notify-title">{humanizeAction(a.action)}</div>
                  <div className="cp-muted">
                    <span className="cp-tag cp-tag-info">{formatRoleName(a.actorRole)}</span>{' '}
                    {a.resourceType ? `${a.resourceType} ` : ''}
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
