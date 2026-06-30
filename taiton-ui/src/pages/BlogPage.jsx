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

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

export function BlogPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Bulk upload files state
  const [excelFile, setExcelFile] = useState(null);
  const [imagesList, setImagesList] = useState([]);
  const [uploadingBulk, setUploadingBulk] = useState(false);

  // Load blogs list
  const loadBlogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await enterpriseApi.contentList(token, 'blog');
      setBlogs(res.items ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load blogs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);

  // Bulk upload handler
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      notify.formWarning('Please select a template Excel file.');
      return;
    }
    setUploadingBulk(true);
    try {
      const res = await enterpriseApi.bulkUploadBlogs(token, excelFile, imagesList);
      notify.success('Bulk Upload Completed', res.message);
      setExcelFile(null);
      setImagesList([]);
      // Clear file inputs
      const formEl = e.target;
      formEl.reset();
      emitUnreadRefresh();
      setActiveTab('list');
      await loadBlogs();
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
    <PermissionRoute permission={PERMISSIONS.BLOGS_READ}>
      <div className="cp-stack">
        <PageBreadcrumb current="Blogs" />
        <div className="cp-page-head">
          <div>
            <h1 className="cp-page-title">Blog Management</h1>
            <p className="cp-muted">Create, edit, approve, and bulk upload articles and blog posts.</p>
          </div>
          <button type="button" className="cp-btn cp-btn-secondary" onClick={loadBlogs}>
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
            All Blog Posts
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'bulk' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('bulk')}
          >
            Bulk Upload
          </button>
        </div>

        {/* 1. Blog Posts List */}
        {activeTab === 'list' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">All Blog Posts</h2>
              <PermissionGate permission={PERMISSIONS.BLOGS_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/blog/create')}
                >
                  Add Blog Post
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading blogs…</p>
            ) : blogs.length === 0 ? (
              <p className="cp-muted">No blog posts yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Featured Image</th>
                      <th>Blog ID</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Author</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blogs.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.payload?.featured_image ? (
                            <img
                              src={resolveImageUrl(row.payload.featured_image)}
                              alt="Featured"
                              style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          ) : (
                            <div style={{
                              width: '80px',
                              height: '50px',
                              background: 'var(--cp-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--cp-text-muted)',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: '1px solid var(--cp-border)'
                            }}>
                              No Image
                            </div>
                          )}
                        </td>
                        <td>{row.payload?.blog_id || '—'}</td>
                        <td><strong>{row.title}</strong></td>
                        <td>
                          {row.payload?.blog_category ? (
                            <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>
                              {row.payload.blog_category}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{row.payload?.author_name || '—'}</td>
                        <td>{getStatusTag(row.status)}</td>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <PermissionGate permission={PERMISSIONS.BLOGS_WRITE}>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--primary"
                                onClick={() => navigate(`/app/blog/create?editId=${row.id}`)}
                                style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                title="Edit Blog"
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

        {/* 2. Blog Bulk Upload */}
        {activeTab === 'bulk' && (
          <PermissionGate permission={PERMISSIONS.BLOGS_WRITE}>
            <section className="cp-card cp-card-pad">
              <h2 className="cp-section-title" style={{ marginBottom: '12px' }}>Bulk Import Blogs via Excel</h2>
              <p className="cp-muted" style={{ marginBottom: '24px' }}>
                Download the structured template, specify Blog details, and upload both the Excel sheet and optional image files together.
              </p>

              <form onSubmit={handleBulkUpload} className="cp-grid" style={{ maxWidth: '600px', gap: '20px' }}>
                <div>
                  <button
                    type="button"
                    className="cp-btn cp-btn-secondary"
                    onClick={() => window.open(enterpriseApi.downloadBlogsTemplateUrl(token), '_blank')}
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
                  <span className="cp-field-label-text">2. Select Accompanying Image Files (Optional)</span>
                  <input
                    type="file"
                    className="cp-input"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setImagesList(Array.from(e.target.files));
                      }
                    }}
                  />
                  {imagesList.length > 0 && (
                    <span className="cp-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {imagesList.length} image(s) selected
                    </span>
                  )}
                </label>

                <div style={{ marginTop: '10px' }}>
                  <button type="submit" className="cp-btn cp-btn-primary" disabled={uploadingBulk || !excelFile}>
                    {uploadingBulk ? 'Processing Bulk Import…' : 'Start Import Processing'}
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
