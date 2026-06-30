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

export function ProductsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('categories');
  const [loading, setLoading] = useState(false);

  // Data lists
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);

  // Bulk uploads state
  const [excelFile, setExcelFile] = useState(null);
  const [imagesList, setImagesList] = useState([]);
  const [uploadingBulk, setUploadingBulk] = useState(false);

  const loadAllData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [catRes, subRes, prdRes, varRes] = await Promise.all([
        enterpriseApi.contentList(token, 'category'),
        enterpriseApi.contentList(token, 'subcategory'),
        enterpriseApi.contentList(token, 'product'),
        enterpriseApi.contentList(token, 'variant')
      ]);
      setCategories(catRes.items ?? []);
      setSubcategories(subRes.items ?? []);
      setProducts(prdRes.items ?? []);
      setVariants(varRes.items ?? []);
    } catch (e) {
      notify.apiError(e, 'Failed to load content lists');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      notify.formWarning('Please select a template Excel file.');
      return;
    }
    setUploadingBulk(true);
    try {
      const res = await enterpriseApi.bulkUploadProducts(token, excelFile, imagesList);
      notify.success('Bulk Upload Completed', res.message);
      setExcelFile(null);
      setImagesList([]);
      emitUnreadRefresh();
      setActiveTab('products');
      await loadAllData();
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
    <PermissionRoute permission={PERMISSIONS.PRODUCTS_READ}>
      <div className="cp-stack">
        <PageBreadcrumb current="Products" />
        <div className="cp-page-head">
          <div>
            <h1 className="cp-page-title">Onboarding Products</h1>
            <p className="cp-muted">Configure hierarchy categorization, parent-child relations, and imports.</p>
          </div>
          <button type="button" className="cp-btn cp-btn-secondary" onClick={loadAllData}>
            Refresh
          </button>
        </div>

        {/* Dynamic Tab Selector using Native CSS Buttons */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'categories' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'subcategories' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('subcategories')}
          >
            Sub Categories
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'products' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'variants' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('variants')}
          >
            Variants
          </button>
          <button
            type="button"
            className={`cp-btn ${activeTab === 'bulk' ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => setActiveTab('bulk')}
          >
            Bulk Upload
          </button>
        </div>

        {/* 1. Categories List */}
        {activeTab === 'categories' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">Categories</h2>
              <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/products/create-category')}
                >
                  Add Category
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading Categories…</p>
            ) : categories.length === 0 ? (
              <p className="cp-muted">No Categories yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Category ID</th>
                      <th>Name</th>
                      <th>Focus Keyword</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((row) => (
                      <tr key={row.id}>
                        <td>{row.payload?.cat_id || '—'}</td>
                        <td><strong>{row.title}</strong></td>
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
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--primary"
                                onClick={() => navigate(`/app/products/create-category?editId=${row.id}`)}
                                style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                title="Edit Category"
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

        {/* 2. SubCategories List */}
        {activeTab === 'subcategories' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">Sub Categories</h2>
              <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/products/create-subcategory')}
                >
                  Add Sub Category
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading Sub Categories…</p>
            ) : subcategories.length === 0 ? (
              <p className="cp-muted">No Sub Categories yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Sub Category ID</th>
                      <th>Parent Category ID</th>
                      <th>Name</th>
                      <th>URL Path</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subcategories.map((row) => (
                      <tr key={row.id}>
                        <td>{row.payload?.sub_cat_id || '—'}</td>
                        <td>{row.payload?.parent_cat_id || '—'}</td>
                        <td><strong>{row.title}</strong></td>
                        <td>{row.payload?.url || '—'}</td>
                        <td>{getStatusTag(row.status)}</td>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--primary"
                                onClick={() => navigate(`/app/products/create-subcategory?editId=${row.id}`)}
                                style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                title="Edit Sub Category"
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

        {/* 3. Products List */}
        {activeTab === 'products' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">Products</h2>
              <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/products/create-product')}
                >
                  Add Product
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading Products…</p>
            ) : products.length === 0 ? (
              <p className="cp-muted">No Products yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Product ID</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Sub Category</th>
                      <th>Variants?</th>
                      <th>Kits?</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row) => {
                      const hasVar = row.payload?.has_variants === 'yes';
                      const varCount = Array.isArray(row.payload?.variants) ? row.payload.variants.length : 0;
                      const hasKit = row.payload?.has_kits === 'yes';
                      const kitCount = Array.isArray(row.payload?.kits) ? row.payload.kits.length : 0;

                      return (
                        <tr key={row.id}>
                          <td>
                            {row.payload?.product_image ? (
                              <img
                                src={resolveImageUrl(row.payload.product_image)}
                                alt="Thumbnail"
                                style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            ) : (
                              <span className="cp-muted" style={{ fontSize: '12px' }}>—</span>
                            )}
                          </td>
                          <td>{row.payload?.prd_id || '—'}</td>
                          <td>{row.payload?.productCode || '—'}</td>
                          <td><strong>{row.title}</strong></td>
                          <td>{row.payload?.cat_id || '—'}</td>
                          <td>{row.payload?.sub_cat_id || '—'}</td>
                          <td>
                            {hasVar ? (
                              <span className="cp-tag cp-tag-success" style={{ textTransform: 'none' }}>Yes ({varCount})</span>
                            ) : (
                              <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>No</span>
                            )}
                          </td>
                          <td>
                            {hasKit ? (
                              <span className="cp-tag cp-tag-success" style={{ textTransform: 'none' }}>Yes ({kitCount})</span>
                            ) : (
                              <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>No</span>
                            )}
                          </td>
                          <td>{getStatusTag(row.status)}</td>
                          <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="cp-btn cp-btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '12px', minHeight: 'auto' }}
                                onClick={() => setSelectedProductDetails(row)}
                              >
                                View Info
                              </button>
                              <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                                <button
                                  type="button"
                                  className="cp-btn-icon cp-btn-icon--primary"
                                  onClick={() => navigate(`/app/products/create-product?editId=${row.id}`)}
                                  style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                  title="Edit Product"
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Variants Tab Content */}
        {activeTab === 'variants' && (
          <section className="cp-card cp-card-pad">
            <div className="cp-list-head" style={{ marginBottom: '16px' }}>
              <h2 className="cp-section-title">Product Variants</h2>
              <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => navigate('/app/products/create-variant')}
                >
                  Add Variant
                </button>
              </PermissionGate>
            </div>

            {loading ? (
              <p className="cp-muted">Loading Variants…</p>
            ) : variants.length === 0 ? (
              <p className="cp-muted">No Variants yet.</p>
            ) : (
              <div className="cp-accounts-table-wrap">
                <table className="cp-accounts-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Variant ID</th>
                      <th>Product ID</th>
                      <th>Name</th>
                      <th>Code</th>
                      <th>SKU</th>
                      <th>Color / Finish</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th aria-label="Actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.payload?.image_url ? (
                            <img
                              src={resolveImageUrl(row.payload.image_url)}
                              alt="Thumbnail"
                              style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          ) : (
                            <span className="cp-muted" style={{ fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td>{row.payload?.variant_id || '—'}</td>
                        <td>{row.payload?.product_id || '—'}</td>
                        <td><strong>{row.title}</strong></td>
                        <td>{row.payload?.variant_code || '—'}</td>
                        <td>{row.payload?.sku || '—'}</td>
                        <td>{row.payload?.color_finish || '—'}</td>
                        <td>{getStatusTag(row.status)}</td>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
                              <button
                                type="button"
                                className="cp-btn-icon cp-btn-icon--primary"
                                onClick={() => navigate(`/app/products/create-variant?editId=${row.id}`)}
                                style={{ minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--cp-border)' }}
                                title="Edit Variant"
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

        {/* 4. Bulk Upload Form */}
        {activeTab === 'bulk' && (
          <PermissionGate permission={PERMISSIONS.PRODUCTS_WRITE}>
            <section className="cp-card cp-card-pad">
              <h2 className="cp-section-title" style={{ marginBottom: '12px' }}>Bulk Import Hierarchy via Excel</h2>
              <p className="cp-muted" style={{ marginBottom: '24px' }}>
                Download the structured template, specify Category, Sub Category, and Product records, then select files and import.
              </p>

              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={handleBulkUpload} className="cp-grid" style={{ gap: '20px' }}>
                  <div>
                    <button
                      type="button"
                      className="cp-btn cp-btn-secondary"
                      onClick={() => window.open(enterpriseApi.downloadProductsTemplateUrl(token), '_blank')}
                      style={{ width: '100%', minHeight: '44px' }}
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
                    <span className="cp-field-label-text">2. Choose Accompanying Product Images (Optional)</span>
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
                      style={{ minHeight: '44px', width: '100%' }}
                    >
                      {uploadingBulk ? 'Processing Upload…' : 'Process Hierarchy Upload'}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </PermissionGate>
        )}

        {selectedProductDetails && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
              padding: '24px'
            }}
            onClick={() => setSelectedProductDetails(null)}
          >
            <div
              style={{
                backgroundColor: 'var(--cp-surface, #ffffff)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--cp-border, #e2e8f0)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--cp-border, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--cp-surface, #ffffff)'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--cp-text, #0f172a)', margin: 0 }}>
                    Product Details: {selectedProductDetails.title}
                  </h3>
                  <p className="cp-muted" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    ID: {selectedProductDetails.payload?.prd_id} | Code: {selectedProductDetails.payload?.productCode || 'N/A'}
                  </p>
                </div>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--cp-muted, #64748b)',
                    fontSize: '24px',
                    lineHeight: '1',
                    padding: '4px'
                  }}
                  onClick={() => setSelectedProductDetails(null)}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Main Product Section */}
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {/* Product Image */}
                  <div style={{ flexShrink: 0 }}>
                    {selectedProductDetails.payload?.product_image ? (
                      <img
                        src={resolveImageUrl(selectedProductDetails.payload.product_image)}
                        alt={selectedProductDetails.title}
                        style={{
                          width: '180px',
                          height: '180px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '1px solid var(--cp-border, #e2e8f0)',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '180px',
                          height: '180px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--cp-bg, #f8fafc)',
                          border: '1px dashed var(--cp-border, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--cp-muted)'
                        }}
                      >
                        No Image Uploaded
                      </div>
                    )}
                  </div>

                  {/* Hierarchy Info */}
                  <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: 'var(--cp-bg, #f8fafc)', padding: '12px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--cp-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Category ID</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cp-text)' }}>{selectedProductDetails.payload?.cat_id || '—'}</span>
                      </div>
                      <div style={{ background: 'var(--cp-bg, #f8fafc)', padding: '12px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--cp-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Sub Category ID</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cp-text)' }}>{selectedProductDetails.payload?.sub_cat_id || '—'}</span>
                      </div>
                    </div>

                    <div style={{ background: 'var(--cp-bg, #f8fafc)', padding: '12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--cp-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>URL Route Path</span>
                      <a href={selectedProductDetails.payload?.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--cp-primary)', wordBreak: 'break-all' }}>
                        {selectedProductDetails.payload?.url || '—'}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: 'var(--cp-text)' }}>Product Description</h4>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--cp-text-muted, #475569)', background: 'var(--cp-bg, #f8fafc)', padding: '16px', borderRadius: '8px' }}>
                    {selectedProductDetails.payload?.productDescription || 'No description provided.'}
                  </p>
                </div>

                {/* Features (Bullet Points) */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: 'var(--cp-text)' }}>Key Features</h4>
                  {Array.isArray(selectedProductDetails.payload?.product_features) && selectedProductDetails.payload.product_features.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--cp-text-muted)' }}>
                      {selectedProductDetails.payload.product_features.map((feat, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{feat}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-muted)', fontStyle: 'italic' }}>No features configured.</p>
                  )}
                </div>

                {/* Specifications Grid */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: 'var(--cp-text)' }}>Product Specifications</h4>
                  {selectedProductDetails.payload?.product_specifications && Object.keys(selectedProductDetails.payload.product_specifications).length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                      {Object.entries(selectedProductDetails.payload.product_specifications).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--cp-bg, #f8fafc)', borderRadius: '6px', fontSize: '12px' }}>
                          <strong style={{ color: 'var(--cp-muted)' }}>{key}</strong>
                          <span style={{ fontWeight: '600', color: 'var(--cp-text)' }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-muted)', fontStyle: 'italic' }}>No specifications configured.</p>
                  )}
                </div>

                {/* Variants Section - Only loaded if has_variants is yes */}
                <div style={{ borderTop: '1px solid var(--cp-border, #e2e8f0)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--cp-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Variants 
                    {selectedProductDetails.payload?.has_variants === 'yes' ? (
                      <span className="cp-tag cp-tag-success" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none' }}>Yes ({selectedProductDetails.payload?.variants?.length || 0})</span>
                    ) : (
                      <span className="cp-tag cp-tag-info" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none' }}>No</span>
                    )}
                  </h4>
                  {selectedProductDetails.payload?.has_variants === 'yes' && Array.isArray(selectedProductDetails.payload?.variants) && selectedProductDetails.payload.variants.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginTop: '8px' }}>
                      {selectedProductDetails.payload.variants.map((v, i) => (
                        <div key={i} style={{
                          background: 'var(--cp-bg, #f8fafc)',
                          border: '1px solid var(--cp-border, #e2e8f0)',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                          {/* Image box */}
                          <div style={{ width: '100%', height: '100px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {v.image_url ? (
                              <img
                                src={resolveImageUrl(v.image_url)}
                                alt={v.variantName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--cp-muted)' }}>No Image</span>
                            )}
                          </div>
                          {/* Text info */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--cp-muted)', fontFamily: 'monospace' }}>{v.variantId}</span>
                            <strong style={{ fontSize: '12px', color: 'var(--cp-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.variantName}>
                              {v.variantName}
                            </strong>
                            {v.color_finish && (
                              <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)', display: 'block' }}>
                                🎨 {v.color_finish}
                              </span>
                            )}
                            {v.sku && (
                              <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                                SKU: {v.sku}
                              </span>
                            )}
                            {typeof v.variant_order !== 'undefined' && (
                              <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>
                                Order: {v.variant_order}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-muted)' }}>
                      No variants configured. Time saved by skipping variant checks.
                    </p>
                  )}
                </div>

                {/* Kits Section */}
                <div style={{ borderTop: '1px solid var(--cp-border, #e2e8f0)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--cp-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Kits/Bundles
                    {selectedProductDetails.payload?.has_kits === 'yes' ? (
                      <span className="cp-tag cp-tag-success" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none' }}>Yes ({selectedProductDetails.payload?.kits?.length || 0})</span>
                    ) : (
                      <span className="cp-tag cp-tag-info" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none' }}>No</span>
                    )}
                  </h4>
                  {selectedProductDetails.payload?.has_kits === 'yes' && Array.isArray(selectedProductDetails.payload?.kits) && selectedProductDetails.payload.kits.length > 0 ? (
                    <div className="cp-accounts-table-wrap" style={{ margin: 0 }}>
                      <table className="cp-accounts-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Kit ID</th>
                            <th>Kit Name</th>
                            <th>Kit Display</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProductDetails.payload.kits.map((k, i) => (
                            <tr key={i}>
                              <td><code>{k.kitId}</code></td>
                              <td><strong>{k.kitName}</strong></td>
                              <td>{k.kitDisplay}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-muted)' }}>
                      No kits configured.
                    </p>
                  )}
                </div>

                {/* SEO & Meta Section */}
                <div style={{ borderTop: '1px solid var(--cp-border, #e2e8f0)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--cp-text)' }}>SEO & Social Media Previews</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--cp-muted)', fontWeight: '600' }}>SEARCH ENGINE PREVIEW</span>
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', fontFamily: 'Arial, sans-serif' }}>
                          <span style={{ color: '#1a0dab', fontSize: '16px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedProductDetails.payload?.seo_meta_title || selectedProductDetails.title}
                          </span>
                          <span style={{ color: '#006621', fontSize: '12px', display: 'block', margin: '2px 0' }}>
                            {selectedProductDetails.payload?.canonical_url || `https://taiton.in${selectedProductDetails.payload?.url || ''}`}
                          </span>
                          <span style={{ color: '#545454', fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {selectedProductDetails.payload?.seo_meta_description || 'Snippet description for search engines.'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--cp-muted)', fontWeight: '600' }}>SOCIAL MEDIA (OG) PREVIEW</span>
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', fontFamily: 'sans-serif' }}>
                          {selectedProductDetails.payload?.og_image && (
                            <img src={resolveImageUrl(selectedProductDetails.payload.og_image)} alt="OG Card" style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                          )}
                          <div style={{ padding: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', color: '#1d2129' }}>
                              {selectedProductDetails.payload?.og_title || selectedProductDetails.payload?.seo_meta_title || selectedProductDetails.title}
                            </span>
                            <span style={{ fontSize: '11px', color: '#90949c', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '4px' }}>
                              {selectedProductDetails.payload?.og_description || selectedProductDetails.payload?.seo_meta_description || ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--cp-border, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  background: 'var(--cp-bg, #f8fafc)'
                }}
              >
                <button
                  type="button"
                  className="cp-btn cp-btn-secondary"
                  onClick={() => setSelectedProductDetails(null)}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionRoute>
  );
}
