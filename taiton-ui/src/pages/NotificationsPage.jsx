import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/authContext.js';
import { useNotifications } from '../hooks/useEnterpriseQueries.js';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';
import { emitUnreadRefresh } from '../utils/events.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { canApprovePendingItem, contentTypeToResource } from '../utils/approvalAccess.js';
import { notify } from '../utils/notify.js';

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

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
                     {n.body ? (
                      <div className="cp-muted cp-notify-body">
                        {n.body.startsWith('DOWNLOAD_EXCEL:') ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', marginTop: '4px' }}>
                            <span>{n.body.split('|')[1] || 'Excel upload details'}</span>
                            <a
                              href={resolveImageUrl(n.body.split('|')[0].replace('DOWNLOAD_EXCEL:', ''))}
                              download
                              className="cp-btn cp-btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '6px 12px', fontSize: '12px', minHeight: 'auto' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              Download Uploaded Excel
                            </a>
                          </div>
                        ) : (
                          n.body
                        )}
                      </div>
                    ) : null}
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
