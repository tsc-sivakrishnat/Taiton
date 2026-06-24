import { useCallback, useEffect, useMemo, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';

const STATUS_ORDER = [
  'raised',
  'acknowledged',
  'in_progress',
  'completed',
  'live',
];

const STATUS_LABEL = {
  raised: 'Raised',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  completed: 'Completed',
  live: 'Live',
};

const PRIORITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

function isStaffRole(role) {
  return role === 'org_admin' || role === 'super_admin';
}

export function CustomerSupportModal({ open, onClose, token, role, orgName }) {
  const staff = isStaffRole(role);
  const [tab, setTab] = useState('board');
  const [statusFilter, setStatusFilter] = useState('');
  const [scope, setScope] = useState('mine');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [requestType, setRequestType] = useState('issue');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [trackingEmails, setTrackingEmails] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await enterpriseApi.supportTickets(token, {
        scope: staff && scope === 'org' ? 'org' : 'mine',
        limit: 120,
      });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e.message ?? 'Failed to load tickets');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, staff, scope]);

  const loadDetail = useCallback(
    async (id) => {
      if (!token || !id) return;
      setDetailLoading(true);
      setError(null);
      try {
        const res = await enterpriseApi.supportTicket(token, id);
        setDetail(res.ticket ?? null);
      } catch (e) {
        setError(e.message ?? 'Failed to load ticket');
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      loadList();
    }, 0);
    return () => clearTimeout(t);
  }, [open, loadList]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setSelectedId(null);
        setDetail(null);
        setTab('board');
        setStatusFilter('');
      }, 0);
      return () => clearTimeout(t);
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (selectedId) loadDetail(selectedId);
      else setDetail(null);
    }, 0);
    return () => clearTimeout(t);
  }, [selectedId, loadDetail]);

  const filteredTickets = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((t) => t.status === statusFilter);
  }, [items, statusFilter]);

  async function onSubmitNew(e) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('requestType', requestType);
      fd.append('priority', priority);
      fd.append('description', description.trim());
      fd.append('trackingEmails', trackingEmails.trim());
      for (const f of files) {
        fd.append('attachments', f);
      }
      await enterpriseApi.supportCreateTicket(token, fd);
      setTitle('');
      setDescription('');
      setTrackingEmails('');
      setFiles([]);
      setRequestType('issue');
      setPriority('medium');
      setTab('board');
      await loadList();
    } catch (err) {
      setError(err.message ?? 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  }

  async function onStatusChange(next) {
    if (!token || !detail) return;
    setError(null);
    try {
      const res = await enterpriseApi.supportUpdateTicketStatus(
        token,
        detail.id,
        next,
      );
      setDetail(res.ticket);
      await loadList();
    } catch (e) {
      setError(e.message ?? 'Could not update status');
    }
  }

  async function downloadAttachment(att) {
    if (!token || !detail) return;
    try {
      const blob = await enterpriseApi.supportDownloadAttachment(
        token,
        detail.id,
        att.id,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.originalName || 'attachment';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message ?? 'Download failed');
    }
  }

  if (!open) return null;

  const statusIdx = detail ? STATUS_ORDER.indexOf(detail.status) : -1;

  return (
    <div className="cp-support-modal-root" role="dialog" aria-modal="true" aria-labelledby="cp-support-title">
      <button type="button" className="cp-support-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="cp-support-modal">
        <header className="cp-support-modal-head">
          <div>
            <h2 id="cp-support-title" className="cp-support-modal-title">
              Customer service
            </h2>
            <p className="cp-muted cp-support-modal-sub">
              Raise issues, bugs, or enhancements — filter the list by status and open a ticket for details.
              {orgName ? ` · ${orgName}` : ''}
            </p>
          </div>
          <button type="button" className="cp-btn cp-btn-secondary" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="cp-support-modal-body">
          <div className="cp-support-main">
            <div className="cp-support-tabs">
              <button
                type="button"
                className={`cp-support-tab${tab === 'board' ? ' cp-support-tab--active' : ''}`}
                onClick={() => setTab('board')}
              >
                Tickets
              </button>
              <button
                type="button"
                className={`cp-support-tab${tab === 'new' ? ' cp-support-tab--active' : ''}`}
                onClick={() => setTab('new')}
              >
                New request
              </button>
            </div>

            {error ? <div className="cp-alert">{error}</div> : null}

            {tab === 'board' ? (
              <div className="cp-support-board-wrap">
                {staff ? (
                  <div className="cp-support-scope">
                    <span className="cp-muted">View:</span>
                    <button
                      type="button"
                      className={`cp-btn cp-btn-ghost${scope === 'mine' ? ' cp-support-scope--on' : ''}`}
                      onClick={() => setScope('mine')}
                    >
                      My tickets
                    </button>
                    <button
                      type="button"
                      className={`cp-btn cp-btn-ghost${scope === 'org' ? ' cp-support-scope--on' : ''}`}
                      onClick={() => setScope('org')}
                    >
                      All org
                    </button>
                  </div>
                ) : null}
                <div className="cp-support-filter-row">
                  <label className="cp-support-filter-label" htmlFor="cp-support-status-filter">
                    Status
                  </label>
                  <select
                    id="cp-support-status-filter"
                    className="cp-select cp-support-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
                </div>
                {loading ? (
                  <p className="cp-muted">Loading tickets…</p>
                ) : filteredTickets.length === 0 ? (
                  <p className="cp-muted">
                    {items.length === 0
                      ? 'No tickets yet.'
                      : 'No tickets match this filter.'}
                  </p>
                ) : (
                  <div className="cp-support-ticket-list" role="list">
                    {filteredTickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="listitem"
                        className={`cp-support-card${selectedId === t.id ? ' cp-support-card--active' : ''}`}
                        onClick={() => setSelectedId(t.id)}
                      >
                        <div className="cp-support-card-title">{t.title}</div>
                        <div className="cp-support-card-meta">
                          <span className="cp-tag cp-support-status-pill">{STATUS_LABEL[t.status] ?? t.status}</span>
                          <span className={`cp-tag cp-support-pri cp-support-pri--${t.priority}`}>
                            {PRIORITY_LABEL[t.priority] ?? t.priority}
                          </span>
                          <span className="cp-muted">{t.requestType}</span>
                        </div>
                        {scope === 'org' ? (
                          <div className="cp-muted cp-support-card-reporter">{t.reporterName}</div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form className="cp-card cp-card-pad cp-support-form" onSubmit={onSubmitNew}>
                <div className="cp-field">
                  <label htmlFor="sup-title">Title</label>
                  <input
                    id="sup-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={220}
                    placeholder="Short summary of the issue"
                  />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label htmlFor="sup-type">Type</label>
                    <select
                      id="sup-type"
                      className="cp-select"
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value)}
                    >
                      <option value="issue">Issue</option>
                      <option value="bug">Bug</option>
                      <option value="enhancement">Enhancement</option>
                    </select>
                  </div>
                  <div className="cp-field">
                    <label htmlFor="sup-pri">Priority</label>
                    <select
                      id="sup-pri"
                      className="cp-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="cp-field">
                  <label htmlFor="sup-desc">Description</label>
                  <textarea
                    id="sup-desc"
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Steps to reproduce, expected vs actual, links, etc."
                  />
                </div>
                <div className="cp-field">
                  <label htmlFor="sup-track">Tracking emails (optional)</label>
                  <input
                    id="sup-track"
                    value={trackingEmails}
                    onChange={(e) => setTrackingEmails(e.target.value)}
                    placeholder="comma@example.com, separated@example.com"
                  />
                  <span className="cp-muted" style={{ fontSize: 12 }}>
                    These addresses are notified with you and the dev team when the ticket is raised or status changes.
                  </span>
                </div>
                <div className="cp-field">
                  <label htmlFor="sup-files">Attachments (optional, max 5, 4 MB each)</label>
                  <input
                    id="sup-files"
                    type="file"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
                  />
                </div>
                <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit ticket'}
                </button>
              </form>
            )}
          </div>

          <aside className="cp-support-side">
            {!selectedId ? (
              <p className="cp-muted">Select a ticket from the list to see details and tracking.</p>
            ) : detailLoading ? (
              <p className="cp-muted">Loading…</p>
            ) : !detail ? (
              <p className="cp-muted">Ticket not found.</p>
            ) : (
              <>
                <div className="cp-support-side-head">
                  <span className="cp-support-ticket-id">#{detail.id}</span>
                  <h3 className="cp-support-side-title">{detail.title}</h3>
                </div>
                <div className="cp-support-track">
                  {STATUS_ORDER.map((st, i) => (
                    <div
                      key={st}
                      className={`cp-support-track-step${i <= statusIdx ? ' cp-support-track-step--done' : ''}${detail.status === st ? ' cp-support-track-step--current' : ''}`}
                    >
                      <span className="cp-support-track-dot" />
                      <span>{STATUS_LABEL[st]}</span>
                    </div>
                  ))}
                </div>
                <dl className="cp-support-dl">
                  <dt>Type</dt>
                  <dd>{detail.requestType}</dd>
                  <dt>Priority</dt>
                  <dd>
                    <span className={`cp-tag cp-support-pri cp-support-pri--${detail.priority}`}>
                      {PRIORITY_LABEL[detail.priority] ?? detail.priority}
                    </span>
                  </dd>
                  <dt>Reporter</dt>
                  <dd>
                    {detail.reporterName}
                    <div className="cp-muted" style={{ fontSize: 12 }}>
                      {detail.reporterEmail}
                    </div>
                  </dd>
                  <dt>Updated</dt>
                  <dd className="cp-muted">
                    {detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : '—'}
                  </dd>
                </dl>
                {staff ? (
                  <div className="cp-field">
                    <label htmlFor="sup-status">Update status (admin)</label>
                    <select
                      id="sup-status"
                      className="cp-select"
                      value={detail.status}
                      onChange={(e) => onStatusChange(e.target.value)}
                    >
                      {STATUS_ORDER.map((st) => (
                        <option key={st} value={st}>
                          {STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="cp-support-desc">
                  <div className="cp-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Description
                  </div>
                  <div className="cp-support-desc-body">{detail.description}</div>
                </div>
                {detail.attachments?.length ? (
                  <div className="cp-support-atts">
                    <div className="cp-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Attachments
                    </div>
                    <ul className="cp-support-att-list">
                      {detail.attachments.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            className="cp-link"
                            onClick={() => downloadAttachment(a)}
                          >
                            {a.originalName}
                          </button>
                          <span className="cp-muted" style={{ fontSize: 12, marginLeft: 8 }}>
                            {(a.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
