import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { emitUnreadRefresh } from '../../utils/events.js';
import { canApprovePendingItem, contentTypeToResource } from '../../utils/approvalAccess.js';
import { notify } from '../../utils/notify.js';

export function ApprovalsPage() {
  const { token, activeOrganization } = useAuth();
  const [pending, setPending] = useState([]);
  const [approvalRules, setApprovalRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const roleCode = activeOrganization?.roleCode ?? '';

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rulesRes = await enterpriseApi.orgApprovalRules(token);
      const rules = rulesRes.rules ?? [];
      setApprovalRules(rules);

      const res = await enterpriseApi.pendingApprovals(token);
      const items = (res.items ?? []).map((row) => {
        const resource = contentTypeToResource(row.contentType);
        const typeLabel =
          row.contentType === 'product'
            ? 'Product'
            : row.contentType === 'seo'
              ? 'SEO'
              : row.contentType === 'ui_element'
                ? 'UI Element'
                : row.contentType === '/app/org/users'
                  ? 'User Registration'
                  : 'Page Action';
        return {
          ...row,
          resource,
          typeLabel,
        };
      });
      setPending(items);
    } catch (e) {
      notify.apiError(e, 'Failed to load approvals');
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  function canApproveRow(row) {
    return canApprovePendingItem({
      rules: approvalRules,
      resource: row.resource,
      createdByRole: row.createdByRole,
      roleCode,
    });
  }

  async function onApprove(row, approve) {
    if (!token) return;
    try {
      await enterpriseApi.approveItem(token, row.id, { approve });
      emitUnreadRefresh();
      notify.success(approve ? 'Approved' : 'Rejected', `${row.typeLabel}: ${row.title}`);
      await load();
    } catch (err) {
      notify.apiError(err, 'Action failed');
    }
  }

  const visiblePending = pending.filter(canApproveRow);

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Approvals" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Approvals</h1>
          <p className="cp-muted">Below-priority requests waiting for your approval as checker.</p>
        </div>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>

      <section className="cp-card cp-card-pad">
        {loading ? (
          <p className="cp-muted">Loading…</p>
        ) : visiblePending.length === 0 ? (
          <p className="cp-muted">No items waiting for your approval.</p>
        ) : (
          <ul className="cp-notify-list">
            {visiblePending.map((row) => (
              <li key={`${row.contentType}-${row.id}`} className="cp-notify-item">
                <div>
                  <div className="cp-notify-title">{row.title}</div>
                  <div className="cp-muted">
                    {row.typeLabel} · ✖ pending approval
                    {row.createdByRole ? ` · from ${row.createdByRole}` : ''}
                  </div>
                </div>
                <div className="cp-row">
                  <button
                    type="button"
                    className="cp-btn cp-btn-secondary"
                    onClick={() => onApprove(row, false)}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={() => onApprove(row, true)}
                  >
                    Approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
