import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';
import { PermissionGate } from '../components/PermissionGate.jsx';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';
import { notify } from '../utils/notify.js';
import { emitUnreadRefresh } from '../utils/events.js';

export function SeoPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [seoList, setSeoList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Bulk upload files state
  const [excelFile, setExcelFile] = useState(null);
  const [imagesList, setImagesList] = useState([]);
  const [uploadingBulk, setUploadingBulk] = useState(false);

  const loadSeo = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await enterpriseApi.contentList(token, 'seo_page');
      setSeoList(res.items ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load SEO pages');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSeo();
  }, [loadSeo]);

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      notify.formWarning('Please select a template Excel file.');
      return;
    }
    setUploadingBulk(true);
    try {
      const res = await enterpriseApi.bulkUploadSeo(token, excelFile, imagesList);
      notify.success('Bulk Upload Completed', res.message);
      setExcelFile(null);
      setImagesList([]);
      emitUnreadRefresh();
      setActiveTab('list');
      await loadSeo();
    } catch (e) {
      notify.apiError(e, 'Bulk upload failed');
    } finally {
      setUploadingBulk(false);
    }
  };

  const getStatusTag = (status) => {
    let colorClass = 'cp-tag-warning';
    if (status === 'live') colorClass = 'cp-tag-success';
    if (status === 'rejected') colorClass = 'cp-tag-error';
    return <span className={`cp-tag ${colorClass}`}>{status.toUpperCase()}</span>;
  };

  return (
    <PermissionRoute permission={PERMISSIONS.SEO_WRITE}>
      <div className="cp-stack">
        <PageBreadcrumb current="SEO" />
        <div className="cp-page-head">
          <div>
            <h1 className="cp-page-title">SEO Management</h1>
            <p className="cp-muted">Configure SEO page targets, focus keywords, social share og graphics, and canonicals.</p>
          </div>
          <button type="button" className="cp-btn cp-btn-secondary" onClick={loadSeo}>
            Refresh
          </button>
        </div>

        {/* Custom Tab Selector */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'list' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('list')}
          >
            SEO Pages Configurations
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'bulk' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('bulk')}
          >
            Bulk Upload
          </button>
        </div>

        {/* 1. SEO Configuration list */}
        {activeTab === 'list' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">Page Configurations</h2>
              <PermissionGate permission={PERMISSIONS.SEO_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/seo/create')}
                >
                  Add Page SEO
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading SEO pages…</p>
            ) : seoList.length === 0 ? (
              <p className="cp-muted">No SEO pages configured yet.</p>
            ) : (
              <div className="cp-table-wrap">
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th>OG Image</th>
                      <th>Page Name</th>
                      <th>URL / Route</th>
                      <th>URL Slug</th>
                      <th>Meta Title</th>
                      <th>Focus Keyword</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seoList.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.payload?.og_image ? (
                            <img
                              src={row.payload.og_image}
                              alt="OG Preview"
                              style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          ) : (
                            <span className="cp-muted" style={{ fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td><strong>{row.payload?.page_name || row.title}</strong></td>
                        <td>{row.payload?.page_url || '—'}</td>
                        <td>{row.payload?.url_slug || '—'}</td>
                        <td>{row.summary || row.payload?.seo_meta_title || '—'}</td>
                        <td>
                          {row.payload?.focus_keyword ? (
                            <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>{row.payload.focus_keyword}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{getStatusTag(row.status)}</td>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <PermissionGate permission={PERMISSIONS.SEO_WRITE}>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--primary"
                                onClick={() => navigate(`/app/seo/create?editId=${row.id}`)}
                                style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                title="Edit SEO Page"
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

        {/* 2. SEO Bulk Upload form */}
        {activeTab === 'bulk' && (
          <PermissionGate permission={PERMISSIONS.SEO_WRITE}>
            <section className="cp-card cp-card-pad">
              <h2 className="cp-section-title" style={{ marginBottom: '12px' }}>Bulk Import SEO Pages via Excel</h2>
              <p className="cp-muted" style={{ marginBottom: '24px' }}>
                Import keywords and metadata configs for multiple pages simultaneously. Download the spreadsheet template, edit rows, and upload.
              </p>

              <form onSubmit={handleBulkUpload} className="cp-grid" style={{ maxWidth: '600px', gap: '20px' }}>
                <div>
                  <button
                    type="button"
                    className="cp-btn cp-btn-secondary"
                    onClick={() => window.open(enterpriseApi.downloadSeoTemplateUrl(token), '_blank')}
                  >
                    Download Excel Seeding Template
                  </button>
                </div>

                <label className="cp-field">
                  <span className="cp-field-label-text">1. Select Excel File (.xlsx) <span className="cp-req">*</span></span>
                  <input
                    type="file"
                    className="cp-input"
                    accept=".xlsx"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    required
                  />
                </label>

                <label className="cp-field">
                  <span className="cp-field-label-text">2. Choose Accompanying OG Images (Optional)</span>
                  <input
                    type="file"
                    multiple
                    className="cp-input"
                    accept="image/*"
                    onChange={(e) => setImagesList(Array.from(e.target.files || []))}
                  />
                </label>

                <div>
                  <button
                    type="submit"
                    className="cp-btn cp-btn-primary"
                    disabled={!excelFile || uploadingBulk}
                    style={{ minHeight: '44px', width: '220px' }}
                  >
                    {uploadingBulk ? 'Processing Upload…' : 'Process SEO Upload'}
                  </button>
                </div>
              </form>
            </section>
          </PermissionGate>
        )}
      </div>
    </PermissionRoute>
  );
}
