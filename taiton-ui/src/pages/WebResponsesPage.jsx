import { useState } from 'react';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { notify } from '../utils/notify.js';
import { CustomerRequestsPage } from './CustomerRequestsPage.jsx';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';

/** Web Responses — org-facing customer inquiries (alias of customer requests). */
export function WebResponsesPage() {
  const { token } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMockModal, setShowMockModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      setRefreshKey((k) => k + 1);
    } catch (err) {
      notify.apiError(err, 'Mock submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Web Responses" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Web Responses</h1>
          <p className="cp-muted">Inquiries, contacts and quotations from the website.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="cp-btn cp-btn-secondary"
            onClick={() => setShowMockModal(true)}
          >
            Mock Web Response
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-secondary"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </button>
        </div>
      </div>

      <CustomerRequestsPage
        key={refreshKey}
        embedded
        hidePageHead
        hideNewRequestForm
        title="Web Responses"
      />

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
