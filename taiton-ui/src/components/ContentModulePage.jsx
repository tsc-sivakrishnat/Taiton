import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { contentPermissionKeys } from '../constants/permissions.js';
import { PermissionGate } from './PermissionGate.jsx';
import { emitUnreadRefresh } from '../utils/events.js';
import { canApprovePendingItem, contentTypeToResource } from '../utils/approvalAccess.js';
import { notify } from '../utils/notify.js';
import { FieldLabel } from './FieldLabel.jsx';
import { validateAll, v } from '../utils/validation.js';
import { PageBreadcrumb } from './PageBreadcrumb.jsx';

const TYPE_LABELS = {
  product: 'Products',
  seo: 'SEO',
  ui_element: 'UI elements',
};

/**
 * Reusable content list + create + approve (products / SEO / UI).
 */
export function ContentModulePage({ contentType, title, subtitle }) {
  const { token, activeOrganization } = useAuth();
  const [items, setItems] = useState([]);
  const [approvalRules, setApprovalRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [titleInput, setTitleInput] = useState('');
  const [summaryInput, setSummaryInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roleCode = activeOrganization?.roleCode ?? '';
  const resource = contentTypeToResource(contentType);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [data, rulesRes] = await Promise.all([
        enterpriseApi.contentList(token, contentType),
        enterpriseApi.orgApprovalRules(token).catch(() => ({ rules: [] })),
      ]);
      setItems(data.items ?? []);
      setApprovalRules(rulesRes.rules ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, contentType]);

  useEffect(() => {
    load();
  }, [load]);

  function showApproveFor(row) {
    if (row.status !== 'pending_approval') return false;
    return canApprovePendingItem({
      rules: approvalRules,
      resource,
      createdByRole: row.createdByRole,
      roleCode,
    });
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!token) return;
    const err = validateAll([() => v.name(titleInput, 'Title', 200)]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await enterpriseApi.contentCreate(token, contentType, {
        title: titleInput.trim(),
        summary: summaryInput.trim() || undefined,
      });
      setTitleInput('');
      setSummaryInput('');
      const msg = res.item?.message ?? (res.item?.status === 'live' ? 'Published live.' : 'Saved.');
      notify.success(res.item?.status === 'pending_approval' ? 'Submitted for approval' : 'Content saved', msg);
      if (res.item?.status === 'pending_approval') {
        emitUnreadRefresh();
      }
      await load();
    } catch (err) {
      notify.apiError(err, 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onApprove(id, approve) {
    if (!token) return;
    try {
      await enterpriseApi.contentApprove(token, contentType, id, { approve });
      emitUnreadRefresh();
      notify.success(approve ? 'Approved' : 'Rejected', `${TYPE_LABELS[contentType] ?? contentType} #${id}`);
      await load();
    } catch (err) {
      notify.apiError(err, 'Action failed');
    }
  }

  const pageTitle = title ?? TYPE_LABELS[contentType] ?? 'Content';
  const { write: writePerm } = contentPermissionKeys(contentType);

  return (
    <div className="cp-stack">
      <PageBreadcrumb current={pageTitle} />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{pageTitle}</h1>
          <p className="cp-muted">
            {subtitle ?? 'Create items; some changes may need approval before they go live.'}
          </p>
        </div>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>

      <PermissionGate permission={writePerm}>
        <section className="cp-card cp-card-pad">
          <h2 className="cp-section-title" style={{ marginBottom: '16px' }}>Add {pageTitle.slice(0, -1) || 'item'}</h2>
          <form className="cp-grid cp-grid-2" onSubmit={onCreate} noValidate>
            <label className="cp-field">
              <FieldLabel required>Title</FieldLabel>
              <input
                className="cp-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                maxLength={200}
                placeholder="Enter title"
              />
            </label>
            <label className="cp-field">
              <FieldLabel>Summary</FieldLabel>
              <input
                className="cp-input"
                value={summaryInput}
                onChange={(e) => setSummaryInput(e.target.value)}
                maxLength={500}
                placeholder="Enter summary"
              />
            </label>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </section>
      </PermissionGate>

      <section className="cp-card cp-card-pad">
        <h2 className="cp-section-title" style={{ marginBottom: '16px' }}>Items</h2>
        {loading ? (
          <p className="cp-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="cp-muted">No items yet.</p>
        ) : (
          <ul className="cp-notify-list">
            {items.map((row) => (
              <li key={row.id} className="cp-notify-item">
                <div>
                  <div className="cp-notify-title">{row.title}</div>
                  {row.summary ? <div className="cp-muted cp-notify-body">{row.summary}</div> : null}
                  <span className={`cp-tag cp-tag-${row.status === 'live' ? 'success' : row.status === 'pending_approval' ? 'warning' : 'info'}`}>
                    {row.status === 'pending_approval'
                      ? '✖ Awaiting approval'
                      : row.status === 'live'
                        ? '✔ Published'
                        : row.status === 'rejected'
                          ? '✖ Rejected'
                          : row.status}
                  </span>
                </div>
                {showApproveFor(row) ? (
                  <div className="cp-row">
                    <button type="button" className="cp-btn cp-btn-secondary" onClick={() => onApprove(row.id, false)}>
                      Reject
                    </button>
                    <button type="button" className="cp-btn cp-btn-primary" onClick={() => onApprove(row.id, true)}>
                      Approve
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
