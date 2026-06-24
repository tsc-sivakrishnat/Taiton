import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/authContext.js';
import { useNotifications } from '../hooks/useEnterpriseQueries.js';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';
import { emitUnreadRefresh } from '../utils/events.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { canApprovePendingItem, contentTypeToResource } from '../utils/approvalAccess.js';
import { notify } from '../utils/notify.js';

export function NotificationsPage() {
  const { token, activeOrganization } = useAuth();
  const { items, loading, error, refresh, markRead, markAllRead } =
    useNotifications(token, { limit: 50 });

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalRules, setApprovalRules] = useState([]);
  const roleCode = activeOrganization?.roleCode ?? '';

  const loadApprovals = useCallback(async () => {
    if (!token) return;
    try {
      const [rulesRes, approvalsRes] = await Promise.all([
        enterpriseApi.orgApprovalRules(token),
        enterpriseApi.pendingApprovals(token),
      ]);
      setApprovalRules(rulesRes.rules ?? []);
      setPendingApprovals(approvalsRes.items ?? []);
    } catch (e) {
      console.error('Failed to load approvals context in notifications', e);
    }
  }, [token]);

  useEffect(() => {
    loadApprovals();
  }, [token, loadApprovals]);

  useEffect(() => {
    emitUnreadRefresh();
  }, [items.length]);

  // 10s background polling for notifications and approvals
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
      loadApprovals();
    }, 10000);
    return () => clearInterval(interval);
  }, [refresh, loadApprovals]);

  const handleItemClick = async (n, e) => {
    if (e.target.closest('button')) return;
    if (!n.readAt) {
      try {
        await markRead(n.id);
      } catch (err) {
        notify.apiError(err, 'Failed to mark read');
      }
    }
  };

  async function handleApproveInline(row, approve, notificationId) {
    if (!token) return;
    try {
      await enterpriseApi.approveItem(token, row.id, { approve });
      await enterpriseApi.markNotificationRead(token, notificationId);
      notify.success(approve ? 'Approved' : 'Rejected', `${row.title}`);
      emitUnreadRefresh();
      refresh();
      loadApprovals();
    } catch (err) {
      notify.apiError(err, 'Action failed');
    }
  }

  function findMatchingApproval(n) {
    if (!n.body) return null;
    const match = n.body.match(/"([^"]+)"/);
    if (!match) return null;
    const quotedText = match[1].toLowerCase();

    return pendingApprovals.find((p) => {
      if (p.contentType === '/app/org/users') {
        return p.title.toLowerCase().includes(quotedText);
      }
      return p.title.toLowerCase() === quotedText || p.title.toLowerCase().includes(quotedText);
    });
  }

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Notifications" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Notifications</h1>
          <p className="cp-muted">
            Items shown for your role and account (including broadcasts where you are included).
          </p>
        </div>
        <div className="cp-row">
          <button type="button" className="cp-btn cp-btn-secondary" onClick={() => { refresh(); loadApprovals(); }}>
            Refresh
          </button>
          <button type="button" className="cp-btn cp-btn-primary" onClick={markAllRead}>
            Mark all read
          </button>
        </div>
      </div>

      {error ? <div className="cp-alert">{error}</div> : null}

      <section className="cp-card cp-card-pad">
        {loading ? (
          <p className="cp-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="cp-muted">No notifications yet.</p>
        ) : (
          <ul className="cp-notify-list">
            {items.map((n) => {
              const matchedApproval = findMatchingApproval(n);
              const userCanApprove = matchedApproval && canApprovePendingItem({
                rules: approvalRules,
                resource: contentTypeToResource(matchedApproval.contentType),
                createdByRole: matchedApproval.createdByRole,
                roleCode,
              });

              return (
                <li
                  key={n.id}
                  className={`cp-notify-item cp-notify-item--clickable ${!n.readAt ? 'cp-notify-item--unread' : ''}`}
                  onClick={(e) => handleItemClick(n, e)}
                >
                  <div className="cp-notify-content-wrapper">
                    <div className="cp-notify-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!n.readAt && <span className="cp-notify-unread-dot" />}
                      {n.title}
                    </div>
                    {n.body ? <div className="cp-muted cp-notify-body">{n.body}</div> : null}
                    <div className="cp-muted cp-notify-meta">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                  {userCanApprove ? (
                    <div className="cp-row" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cp-btn cp-btn-secondary"
                        onClick={() => handleApproveInline(matchedApproval, false, n.id)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-primary"
                        onClick={() => handleApproveInline(matchedApproval, true, n.id)}
                      >
                        Approve
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
