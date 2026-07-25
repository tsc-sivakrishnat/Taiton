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
import { TableFilters } from '../components/TableFilters.jsx';
import { TablePagination } from '../components/TablePagination.jsx';
import { BulkUploadForm } from '../components/BulkUploadForm.jsx';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Reset page when queries/filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, activeTab]);

  // Bulk upload files state
  const [excelFile, setExcelFile] = useState(null);
  const [imagesList, setImagesList] = useState([]);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState('');

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
    setUploadStats(null);
    setUploadErrors([]);
    setDownloadUrl('');
    try {
      const res = await enterpriseApi.bulkUploadBlogs(token, excelFile, imagesList);
      if (res.stats) {
        setUploadStats(res.stats);
      }
      if (res.report) {
        setUploadErrors(res.report.filter(r => r.status === 'failed'));
      }
      if (res.downloadUrl) {
        setDownloadUrl(res.downloadUrl);
      }
      if (res.stats && res.stats.failed > 0) {
        notify.warning(`Bulk upload completed with ${res.stats.failed} failures.`);
      } else {
        notify.success('Bulk Upload Completed Successfully', res.message);
        setExcelFile(null);
        setImagesList([]);
        setActiveTab('list');
      }
      emitUnreadRefresh();
      await loadBlogs();
    } catch (err) {
      notify.apiError(err, 'Bulk upload failed');
    } finally {
      setUploadingBulk(false);
    }
  };

  const clearUploadReport = () => {
    setUploadStats(null);
    setUploadErrors([]);
    setDownloadUrl('');
    setExcelFile(null);
    setImagesList([]);
    setActiveTab('list');
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
            <p className="cp-muted">Create, edit, approve and bulk upload articles and blog posts.</p>
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
            onClick={() => { setActiveTab('list'); setSearchQuery(''); setStatusFilter(''); }}
          >
            All Blog Posts
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'bulk' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => { setActiveTab('bulk'); setSearchQuery(''); setStatusFilter(''); }}
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

            <TableFilters
              searchVal={searchQuery}
              onSearchChange={setSearchQuery}
              statusVal={statusFilter}
              onStatusChange={setStatusFilter}
              searchPlaceholder="Search blogs by title or ID..."
              onReset={() => { setSearchQuery(''); setStatusFilter(''); }}
            />

            {loading ? (
              <p className="cp-muted">Loading blogs…</p>
            ) : (() => {
              const filtered = blogs.filter((row) => {
                const matchesSearch = row.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      (row.payload?.blog_id || '').toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = !statusFilter || row.status === statusFilter;
                return matchesSearch && matchesStatus;
              });

              if (filtered.length === 0) {
                return <p className="cp-muted">No blog posts match your filters.</p>;
              }

              const sliced = filtered.slice((page - 1) * 10, page * 10);

              return (
                <>
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
                        {sliced.map((row) => (
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
                  <TablePagination
                    page={page}
                    onChange={setPage}
                    total={filtered.length}
                    pageSize={10}
                    labelSingle="blog post"
                    labelPlural="blog posts"
                  />
                </>
              );
            })()}
          </section>
        )}

        {/* 2. Blog Bulk Upload */}
        {activeTab === 'bulk' && (
          <PermissionGate permission={PERMISSIONS.BLOGS_WRITE}>
            <BulkUploadForm
              title="Bulk Import Blogs via Excel"
              description="Download the structured template, specify Blog details, and upload both the Excel sheet and optional image files together."
              templateUrl={enterpriseApi.downloadBlogsTemplateUrl(token)}
              processButtonLabel="Start Import Processing"
              uploading={uploadingBulk}
              uploadStats={uploadStats}
              uploadErrors={uploadErrors}
              downloadUrl={downloadUrl}
              onUpload={async (file, images) => {
                setUploadingBulk(true);
                setUploadStats(null);
                setUploadErrors([]);
                setDownloadUrl('');
                try {
                  const res = await enterpriseApi.bulkUploadBlogs(token, file, images);
                  if (res.stats) setUploadStats(res.stats);
                  if (res.report) setUploadErrors(res.report.filter(r => r.status === 'failed'));
                  if (res.downloadUrl) setDownloadUrl(res.downloadUrl);
                  if (res.stats && res.stats.failed > 0) {
                    notify.warning(`Bulk upload completed with ${res.stats.failed} failures.`);
                  } else {
                    notify.success('Bulk Upload Completed Successfully', res.message);
                    setActiveTab('list');
                  }
                  emitUnreadRefresh();
                  await loadBlogs();
                } catch (err) {
                  notify.apiError(err, 'Bulk upload failed');
                } finally {
                  setUploadingBulk(false);
                }
              }}
              onClearReport={clearUploadReport}
              imageLabel="Select Accompanying Image Files (Optional)"
            />
          </PermissionGate>
        )}
      </div>
    </PermissionRoute>
  );
}
