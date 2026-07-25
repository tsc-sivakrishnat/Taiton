import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';
import { PermissionGate } from '../components/PermissionGate.jsx';
import { notify } from '../utils/notify.js';
import { FieldLabel } from '../components/FieldLabel.jsx';
import { validateAll, v } from '../utils/validation.js';

const STATUSES = ['new', 'in_review', 'responded', 'closed'];
const REQUEST_TYPES = ['inquiry', 'contact', 'quotation'];

const TYPE_LABELS = {
  inquiry: 'Inquiry',
  contact: 'Contact',
  quotation: 'Quotation',
};

const STATUS_LABELS = {
  new: 'New',
  in_review: 'In review',
  responded: 'Responded',
  closed: 'Closed',
};

function formatType(type) {
  return TYPE_LABELS[type] ?? type;
}

function formatStatus(status) {
  return STATUS_LABELS[status] ?? status;
}

export function CustomerRequestsPage({
  embedded = false,
  hidePageHead = false,
  hideNewRequestForm = false,
  title = 'Customer requests',
}) {
  const inner = (
    <CustomerRequestsPageInner
      embedded={embedded}
      hidePageHead={hidePageHead}
      hideNewRequestForm={hideNewRequestForm}
      title={title}
    />
  );
  return <PermissionRoute permission={PERMISSIONS.CUSTOMER_REQUESTS_READ}>{inner}</PermissionRoute>;
}

function CustomerRequestsPageInner({ embedded, hidePageHead, hideNewRequestForm, title }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({
    requestType: 'inquiry',
    customerName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockForm, setMockForm] = useState({
    requestType: 'inquiry',
    customerName: 'Rahul Sen',
    email: 'rahul.sen@gmail.com',
    phone: '9876543210',
    subject: 'Interest in Taiton Hardware Catalog',
    message: 'Hello, I saw your premium architectural hardware products. Could you please send me a PDF catalog and pricing details? Thank you.',
  });

  async function onMockSubmit(e) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await enterpriseApi.customerRequestCreate(token, mockForm);
      notify.success('Mock request submitted', mockForm.subject);
      setShowMockModal(false);
      setMockForm({
        requestType: 'inquiry',
        customerName: 'Rahul Sen',
        email: 'rahul.sen@gmail.com',
        phone: '9876543210',
        subject: 'Interest in Taiton Hardware Catalog',
        message: 'Hello, I saw your premium architectural hardware products. Could you please send me a PDF catalog and pricing details? Thank you.',
      });
      await load();
    } catch (err) {
      notify.apiError(err, 'Mock submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await enterpriseApi.customerRequestsList(token, {
        limit: 50,
        status: statusFilter || undefined,
        requestType: typeFilter || undefined,
      });
      setItems(data.items ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load requests');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e) {
    e.preventDefault();
    if (!token) return;
    const err = validateAll([
      () => v.name(form.customerName, 'Customer name', 120),
      () => (form.email.trim() ? v.email(form.email) : null),
      () => (form.phone && form.phone.length !== 10 ? 'Phone must be exactly 10 digits when provided.' : null),
      () => v.subject(form.subject),
      () => v.message(form.message),
    ]);
    if (err) {
      notify.formWarning(err);
      return;
    }
    setSubmitting(true);
    try {
      const subject = form.subject;
      await enterpriseApi.customerRequestCreate(token, form);
      setForm({
        requestType: 'inquiry',
        customerName: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
      notify.success('Request submitted', subject);
      await load();
    } catch (err) {
      notify.apiError(err, 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onStatusChange(id, status) {
    if (!token) return;
    try {
      await enterpriseApi.customerRequestUpdate(token, id, { status });
      notify.success('Status updated', formatStatus(status));
      await load();
    } catch (err) {
      notify.apiError(err, 'Update failed');
    }
  }

  const filters = (
    <div className="cp-requests-filters">
      <label className="cp-field cp-field--inline">
        <span>Type</span>
        <select
          className="cp-input"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatType(t)}
            </option>
          ))}
        </select>
      </label>
      <label className="cp-field cp-field--inline">
        <span>Status</span>
        <select
          className="cp-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>
      </label>
      {!hidePageHead && (
        <button type="button" className="cp-btn cp-btn-secondary" onClick={load} disabled={loading}>
          Refresh
        </button>
      )}
    </div>
  );

  return (
    <div className={embedded && !hidePageHead ? 'cp-stack' : undefined}>
      {!hidePageHead ? (
        <div className="cp-page-head">
          <div>
            <h1 className="cp-page-title">{title}</h1>
            <p className="cp-muted">
              {embedded
                ? 'Inquiries, contacts, and quotations from the website.'
                : 'Inquiries, contacts, and quotations from customers.'}
            </p>
          </div>
          {filters}
        </div>
      ) : null}

      {!hideNewRequestForm ? (
        <PermissionGate permission={PERMISSIONS.CUSTOMER_REQUESTS_MANAGE}>
          <section className="cp-card cp-card-pad">
            <h2 className="cp-section-title">New request</h2>
            <form className="cp-grid cp-grid-2" onSubmit={onCreate} noValidate>
              <label className="cp-field">
                <FieldLabel required>Type</FieldLabel>
                <select
                  className="cp-input"
                  value={form.requestType}
                  onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value }))}
                >
                  {REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatType(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cp-field">
                <FieldLabel required>Customer name</FieldLabel>
                <input
                  className="cp-input"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  maxLength={120}
                  placeholder="Enter customer name"
                />
              </label>
              <label className="cp-field">
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  className="cp-input"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </label>
              <label className="cp-field">
                <FieldLabel>Phone</FieldLabel>
                <input
                  type="tel"
                  className="cp-input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10 digit mobile"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
                  }
                />
              </label>
              <label className="cp-field cp-field--full">
                <FieldLabel required>Subject</FieldLabel>
                <input
                  className="cp-input"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  maxLength={255}
                  placeholder="Enter subject"
                />
              </label>
              <label className="cp-field cp-field--full">
                <FieldLabel required>Message</FieldLabel>
                <textarea
                  className="cp-input"
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Enter message text"
                />
              </label>
              <div className="cp-field cp-field--full">
                <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </form>
          </section>
        </PermissionGate>
      ) : null}

      <section className="cp-card cp-card-pad">
        <div className="cp-list-head">
          <h2 className="cp-section-title">Requests</h2>
          {hidePageHead ? filters : null}
        </div>
        {loading ? (
          <p className="cp-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="cp-muted">No requests match your filters.</p>
        ) : (
          <div className="cp-table-wrap">
            <table className="cp-table cp-requests-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Received</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="cp-requests-subject">{row.subject}</div>
                      {row.message ? <div className="cp-muted cp-requests-message">{row.message}</div> : null}
                    </td>
                    <td>{row.customerName}</td>
                    <td>
                      <span className={`cp-tag cp-tag-type cp-tag-type--${row.requestType}`}>
                        {formatType(row.requestType)}
                      </span>
                    </td>
                    <td className="cp-requests-contact">
                      {row.email ? <div>{row.email}</div> : null}
                      {row.phone ? <div className="cp-muted">{row.phone}</div> : null}
                      {!row.email && !row.phone ? '—' : null}
                    </td>
                    <td className="cp-muted cp-requests-date">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      <PermissionGate
                        permission={PERMISSIONS.CUSTOMER_REQUESTS_MANAGE}
                        fallback={
                          <span className={`cp-tag cp-tag-status cp-tag-status--${row.status}`}>
                            {formatStatus(row.status)}
                          </span>
                        }
                      >
                        <select
                          className="cp-input cp-input--compact"
                          value={row.status}
                          onChange={(e) => onStatusChange(row.id, e.target.value)}
                          aria-label="Update status"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {formatStatus(s)}
                            </option>
                          ))}
                        </select>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showMockModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="cp-card cp-card-pad" style={{ width: '480px', maxWidth: '90%', animation: 'fadeIn 0.2s' }}>
            <h3 className="cp-section-title" style={{ marginBottom: '16px' }}>Mock Customer Inquiry</h3>
            <form onSubmit={onMockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label className="cp-field">
                <span className="cp-field-label-text">Customer Name <span className="cp-req">*</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={mockForm.customerName}
                  onChange={(e) => setMockForm((f) => ({ ...f, customerName: e.target.value }))}
                  required
                />
              </label>
              <label className="cp-field">
                <span className="cp-field-label-text">Email Address <span className="cp-req">*</span></span>
                <input
                  type="email"
                  className="cp-input"
                  value={mockForm.email}
                  onChange={(e) => setMockForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </label>
              <label className="cp-field">
                <span className="cp-field-label-text">Phone Number</span>
                <input
                  type="text"
                  className="cp-input"
                  value={mockForm.phone}
                  onChange={(e) => setMockForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                />
              </label>
              <label className="cp-field">
                <span className="cp-field-label-text">Request Type <span className="cp-req">*</span></span>
                <select
                  className="cp-input"
                  value={mockForm.requestType}
                  onChange={(e) => setMockForm((f) => ({ ...f, requestType: e.target.value }))}
                  required
                >
                  <option value="inquiry">Inquiry</option>
                  <option value="contact">Contact</option>
                  <option value="quotation">Quotation</option>
                </select>
              </label>
              <label className="cp-field">
                <span className="cp-field-label-text">Subject <span className="cp-req">*</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={mockForm.subject}
                  onChange={(e) => setMockForm((f) => ({ ...f, subject: e.target.value }))}
                  required
                />
              </label>
              <label className="cp-field">
                <span className="cp-field-label-text">Message <span className="cp-req">*</span></span>
                <textarea
                  className="cp-input"
                  rows={3}
                  value={mockForm.message}
                  onChange={(e) => setMockForm((f) => ({ ...f, message: e.target.value }))}
                  required
                />
              </label>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-secondary"
                  onClick={() => setShowMockModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cp-btn cp-btn-primary"
                  disabled={submitting}
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
