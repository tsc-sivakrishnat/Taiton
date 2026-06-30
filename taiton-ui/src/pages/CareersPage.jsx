import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';
import { PermissionGate } from '../components/PermissionGate.jsx';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';
import { notify } from '../utils/notify.js';
import { emitUnreadRefresh } from '../utils/events.js';

export function CareersPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('postings');

  // Sync tab state from query parameter
  useEffect(() => {
    if (tabParam === 'tracking') {
      setActiveTab('tracking');
    } else {
      setActiveTab('postings');
    }
  }, [tabParam]);

  // Candidate apply modal states
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [coverMessage, setCoverMessage] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // Load all jobs and application requests
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [jobsRes, appsRes] = await Promise.all([
        enterpriseApi.contentList(token, 'career'),
        enterpriseApi.customerRequestsList(token, { limit: 100 })
      ]);
      
      const activeJobs = jobsRes.items ?? [];
      setJobs(activeJobs);

      // Filter requests by type = 'job_application'
      const appItems = (appsRes.items ?? []).filter(
        (req) => req.requestType === 'job_application' || req.payload?.request_type === 'job_application'
      );
      setApplications(appItems);

      // Auto-seed sample jobs if none exist
      if (activeJobs.length === 0) {
        const seedJobs = [
          {
            title: 'Senior Software Engineer',
            summary: 'Develop premium software interfaces for Taiton cpanels.',
            payload: {
              job_id: 'job-sse-001',
              department: 'Engineering',
              location: 'Bangalore, India',
              employment_type: 'Full-time',
              status: 'live',
            }
          },
          {
            title: 'Product Designer (UI/UX)',
            summary: 'Design glassmorphic visual components and clean web aesthetics.',
            payload: {
              job_id: 'job-uiux-002',
              department: 'Design',
              location: 'Remote',
              employment_type: 'Contract',
              status: 'live',
            }
          },
          {
            title: 'Fulfillment Operations Specialist',
            summary: 'Supervise products bulk seedings and variant operations.',
            payload: {
              job_id: 'job-ops-003',
              department: 'Operations',
              location: 'Mumbai, India',
              employment_type: 'Full-time',
              status: 'live',
            }
          }
        ];

        for (const sj of seedJobs) {
          await enterpriseApi.contentCreate(token, 'career', sj);
        }
        
        // Reload after seeding
        const updatedJobsRes = await enterpriseApi.contentList(token, 'career');
        setJobs(updatedJobsRes.items ?? []);

        // Also seed 2 mock applications
        const seedApps = [
          {
            customerName: 'Siddharth Verma',
            email: 'siddharth@taiton.in',
            phone: '9876543210',
            subject: 'job-sse-001',
            message: 'I have 6+ years of expertise building high performance React dashboards. I would love to join the Taiton core team.',
            type: 'job_application',
          },
          {
            customerName: 'Ananya Sen',
            email: 'ananya.sen@design.co',
            phone: '9123456789',
            subject: 'job-uiux-002',
            message: 'I design layout templates with clean CSS styling. See my portfolio link in profile.',
            type: 'job_application',
          }
        ];

        for (const sa of seedApps) {
          await enterpriseApi.createCustomerRequest(token, sa);
        }

        const updatedAppsRes = await enterpriseApi.customerRequestsList(token, { limit: 100 });
        const updatedApps = (updatedAppsRes.items ?? []).filter(
          (req) => req.requestType === 'job_application' || req.payload?.request_type === 'job_application'
        );
        setApplications(updatedApps);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle mock candidate apply form submit
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!candidateName.trim() || !candidateEmail.trim() || !selectedJobId) {
      notify.formWarning('Name, Email, and Job target selection are required.');
      return;
    }
    if (candidatePhone && candidatePhone.length !== 10) {
      notify.formWarning('Phone number must be exactly 10 digits.');
      return;
    }

    setSubmittingApp(true);
    try {
      await enterpriseApi.createCustomerRequest(token, {
        customerName: candidateName.trim(),
        email: candidateEmail.trim(),
        phone: candidatePhone.trim() || null,
        subject: selectedJobId,
        message: coverMessage.trim(),
        type: 'job_application',
      });
      notify.success('Application Received', 'Candidate application has been submitted successfully.');
      setCandidateName('');
      setCandidateEmail('');
      setCandidatePhone('');
      setSelectedJobId('');
      setCoverMessage('');
      setShowApplyModal(false);
      emitUnreadRefresh();
      await loadData();
    } catch (err) {
      notify.apiError(err, 'Failed to submit candidate application');
    } finally {
      setSubmittingApp(false);
    }
  };

  // Update candidate review status
  const handleUpdateStatus = async (appId, nextStatus) => {
    if (!token) return;
    try {
      await enterpriseApi.updateCustomerRequestStatus(token, appId, nextStatus);
      notify.success('Status Updated', `Application status has been changed to ${nextStatus.toUpperCase()}`);
      await loadData();
    } catch (err) {
      notify.apiError(err, 'Failed to update application status');
    }
  };

  const getStatusTag = (status) => {
    let colorClass = 'cp-tag-warning';
    if (status === 'live' || status === 'responded') colorClass = 'cp-tag-success';
    if (status === 'rejected' || status === 'closed') colorClass = 'cp-tag-error';
    const label = status === 'responded' ? 'SHORTLISTED' : status === 'closed' ? 'REJECTED' : status.toUpperCase();
    return <span className={`cp-tag ${colorClass}`}>{label}</span>;
  };

  // Find job title helper
  const getJobTitle = (jobId) => {
    const job = jobs.find((j) => (j.payload?.job_id === jobId || String(j.id) === String(jobId)));
    return job ? job.title : jobId || 'Unknown job posting';
  };

  return (
    <PermissionRoute permission={PERMISSIONS.UI_WRITE}>
      <div className="cp-stack">
        <PageBreadcrumb current="Careers" />
        <div className="cp-page-head">
          <div>
            <h1 className="cp-page-title">Careers & Job Openings</h1>
            <p className="cp-muted">Configure job specifications, post vacancy postings, and track candidate submissions.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() => {
                const liveJobs = jobs.filter((j) => j.payload?.job_id);
                if (liveJobs.length > 0) {
                  setSelectedJobId(liveJobs[0].payload.job_id);
                }
                setShowApplyModal(true);
              }}
            >
              Mock Apply Candidate
            </button>
            <button type="button" className="cp-btn cp-btn-secondary" onClick={loadData}>
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="cp-tabs" style={{ marginBottom: '16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`cp-tab-btn ${activeTab === 'postings' ? 'active' : ''}`}
            onClick={() => setActiveTab('postings')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: activeTab === 'postings' ? 'var(--cp-primary-10)' : 'transparent',
              color: activeTab === 'postings' ? 'var(--cp-primary)' : 'var(--cp-text-muted)',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Job Postings
          </button>
          <button
            type="button"
            className={`cp-tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracking')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: activeTab === 'tracking' ? 'var(--cp-primary-10)' : 'transparent',
              color: activeTab === 'tracking' ? 'var(--cp-primary)' : 'var(--cp-text-muted)',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Applications Tracking ({applications.length})
          </button>
        </div>

        {/* Tab 1: Job Postings */}
        {activeTab === 'postings' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">All Job Openings</h2>
              <PermissionGate permission={PERMISSIONS.UI_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/careers/create')}
                >
                  Add Job Opening
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading job openings…</p>
            ) : jobs.length === 0 ? (
              <p className="cp-muted">No job openings yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Title</th>
                      <th>Department</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((row) => (
                      <tr key={row.id}>
                        <td><code>{row.payload?.job_id || '—'}</code></td>
                        <td><strong>{row.title}</strong></td>
                        <td>{row.payload?.department || '—'}</td>
                        <td>{row.payload?.location || '—'}</td>
                        <td>
                          {row.payload?.employment_type ? (
                            <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>
                              {row.payload.employment_type}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{getStatusTag(row.status)}</td>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <PermissionGate permission={PERMISSIONS.UI_WRITE}>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--primary"
                                onClick={() => navigate(`/app/careers/create?editId=${row.id}`)}
                                style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                title="Edit Job Opening"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Applications Tracking */}
        {activeTab === 'tracking' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">Job Applications</h2>
            </div>

            {loading ? (
              <p className="cp-muted">Loading applications…</p>
            ) : applications.length === 0 ? (
              <p className="cp-muted">No candidate applications tracked yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Target Job Openings</th>
                      <th>Cover Note / Pitch</th>
                      <th>Status</th>
                      <th>Applied Date</th>
                      <th aria-label="Actions">Status Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const name = app.customerName || app.payload?.customer_name || '—';
                      const email = app.email || app.payload?.email || '—';
                      const phone = app.phone || app.payload?.phone || '—';
                      const jobId = app.subject || app.payload?.subject || '';
                      const message = app.message || app.payload?.message || '—';
                      const date = app.createdAt || app.created_at;

                      return (
                        <tr key={app.id}>
                          <td><strong>{name}</strong></td>
                          <td><code>{email}</code></td>
                          <td>{phone}</td>
                          <td>
                            <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>
                              {getJobTitle(jobId)}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px', whiteSpace: 'normal', fontSize: '13px' }}>{message}</td>
                          <td>{getStatusTag(app.status)}</td>
                          <td>{date ? new Date(date).toLocaleDateString() : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {app.status === 'new' && (
                                <button
                                  type="button"
                                  className="cp-btn"
                                  onClick={() => handleUpdateStatus(app.id, 'in_review')}
                                  style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', background: 'var(--cp-surface)', border: '1px solid var(--cp-border)' }}
                                >
                                  Review
                                </button>
                              )}
                              {app.status !== 'responded' && app.status !== 'closed' && (
                                <button
                                  type="button"
                                  className="cp-btn cp-btn-primary"
                                  onClick={() => handleUpdateStatus(app.id, 'responded')}
                                  style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto' }}
                                >
                                  Shortlist
                                </button>
                              )}
                              {app.status !== 'closed' && (
                                <button
                                  type="button"
                                  className="cp-btn"
                                  onClick={() => handleUpdateStatus(app.id, 'closed')}
                                  style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Mock Apply Modal */}
        {showApplyModal && (
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
              <h3 className="cp-section-title" style={{ marginBottom: '16px' }}>Mock Job Application</h3>
              <form onSubmit={handleApplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label className="cp-field">
                  <span className="cp-field-label-text">Candidate Full Name <span className="cp-req">*</span></span>
                  <input
                    type="text"
                    className="cp-input"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. Siddharth Verma"
                    required
                  />
                </label>
                <label className="cp-field">
                  <span className="cp-field-label-text">Email Address <span className="cp-req">*</span></span>
                  <input
                    type="email"
                    className="cp-input"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="e.g. siddharth@taiton.in"
                    required
                  />
                </label>
                <label className="cp-field">
                  <span className="cp-field-label-text">Phone Number</span>
                  <input
                    type="text"
                    className="cp-input"
                    value={candidatePhone}
                    onChange={(e) => setCandidatePhone(e.target.value)}
                    placeholder="e.g. 9876543210 (10 digits)"
                  />
                </label>
                <label className="cp-field">
                  <span className="cp-field-label-text">Select Job Target <span className="cp-req">*</span></span>
                  <select
                    className="cp-input"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Job --</option>
                    {jobs.filter((j) => j.payload?.job_id).map((j) => (
                      <option key={j.id} value={j.payload.job_id}>
                        {j.title} ({j.payload.job_id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cp-field">
                  <span className="cp-field-label-text">Pitch / Cover letter</span>
                  <textarea
                    className="cp-input"
                    value={coverMessage}
                    onChange={(e) => setCoverMessage(e.target.value)}
                    placeholder="Describe candidate background..."
                    rows={3}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="cp-btn cp-btn-secondary"
                    onClick={() => setShowApplyModal(false)}
                    disabled={submittingApp}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cp-btn cp-btn-primary"
                    disabled={submittingApp}
                  >
                    {submittingApp ? 'Submitting…' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </PermissionRoute>
  );
}
