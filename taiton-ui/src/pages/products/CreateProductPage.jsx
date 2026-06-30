import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { SearchableSelect } from '../../components/SearchableSelect.jsx';
import { notify } from '../../utils/notify.js';
import { emitUnreadRefresh } from '../../utils/events.js';

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

export function CreateProductPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);

  // Form inputs
  const [catId, setCatId] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [prdId, setPrdId] = useState('');
  const [isIdEditedManually, setIsIdEditedManually] = useState(false);
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [url, setUrl] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // SEO & OG fields
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDesc, setOgDesc] = useState('');
  const [ogImage, setOgImage] = useState('');

  // Product Image, Variants & Kits State
  const [productImage, setProductImage] = useState('');
  const [hasVariants, setHasVariants] = useState('no');
  const [variants, setVariants] = useState([{ variantId: '', variantName: '', variantDisplay: '' }]);
  const [hasKits, setHasKits] = useState('no');
  const [kits, setKits] = useState([{ kitId: '', kitName: '', kitDisplay: '' }]);

  // Dynamic Specs & Features
  const [specs, setSpecs] = useState([{ key: '', value: '' }]);
  const [features, setFeatures] = useState(['']);

  const slugify = (text) => {
    return 'prd-' + String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setProductName(val);
    if (!isIdEditedManually) {
      setPrdId(slugify(val));
    }
  };

  const handleIdChange = (e) => {
    setPrdId(e.target.value);
    setIsIdEditedManually(true);
  };

  const addVariantRow = () => setVariants([...variants, { variantId: '', variantName: '', variantDisplay: '' }]);
  const removeVariantRow = (idx) => setVariants(variants.filter((_, i) => i !== idx));
  const updateVariantRow = (idx, field, value) => {
    const updated = [...variants];
    updated[idx][field] = value;
    setVariants(updated);
  };

  const addKitRow = () => setKits([...kits, { kitId: '', kitName: '', kitDisplay: '' }]);
  const removeKitRow = (idx) => setKits(kits.filter((_, i) => i !== idx));
  const updateKitRow = (idx, field, value) => {
    const updated = [...kits];
    updated[idx][field] = value;
    setKits(updated);
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setProductImage(res.url);
      notify.success('Uploaded', 'Product image uploaded successfully!');
    } catch (err) {
      notify.apiError(err, 'Product image upload failed');
    }
  };

  const handleOgImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setOgImage(res.url);
      notify.success('Uploaded', 'OG image uploaded successfully!');
    } catch (err) {
      notify.apiError(err, 'OG image upload failed');
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      setLoading(true);
      try {
        const [catRes, subRes] = await Promise.all([
          enterpriseApi.contentList(token, 'category'),
          enterpriseApi.contentList(token, 'subcategory')
        ]);
        setCategories(catRes.items ?? []);
        setSubcategories(subRes.items ?? []);
      } catch (err) {
        notify.apiError(err, 'Failed to load filters');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token]);

  useEffect(() => {
    if (editId && token) {
      const loadProductDetails = async () => {
        try {
          const res = await enterpriseApi.contentList(token, 'product');
          const productItem = res.items?.find((item) => String(item.id) === String(editId));
          if (productItem) {
            const p = productItem.payload || {};
            setPrdId(p.prd_id || '');
            setProductName(productItem.title || '');
            setProductCode(p.productCode || '');
            setCatId(p.cat_id || '');
            setSubCatId(p.sub_cat_id || '');
            setUrl(p.url || '');
            setCanonicalUrl(p.canonical_url || '');
            setSeoTitle(p.seo_meta_title || '');
            setSeoDesc(p.seo_meta_description || '');
            setFocusKeyword(p.focus_keyword || '');
            setSecondaryKeywords(p.secondary_keywords || '');
            setOgTitle(p.og_title || '');
            setOgDesc(p.og_description || '');
            setOgImage(p.og_image || '');
            setProductImage(p.product_image || '');
            setHasVariants(p.has_variants || 'no');
            setHasKits(p.has_kits || 'no');
            if (Array.isArray(p.product_features)) {
              setFeatures(p.product_features.length > 0 ? p.product_features : ['']);
            }
            if (p.product_specifications && typeof p.product_specifications === 'object') {
              const specList = Object.entries(p.product_specifications).map(([key, value]) => ({ key, value }));
              setSpecs(specList.length > 0 ? specList : [{ key: '', value: '' }]);
            }
            if (Array.isArray(p.variants)) {
              setVariants(p.variants.length > 0 ? p.variants : [{ variantId: '', variantName: '', variantDisplay: '' }]);
            }
            if (Array.isArray(p.kits)) {
              setKits(p.kits.length > 0 ? p.kits : [{ kitId: '', kitName: '', kitDisplay: '' }]);
            }
            setIsIdEditedManually(true);
          }
        } catch (e) {
          notify.error('Error loading product details', e.message);
        }
      };
      loadProductDetails();
    }
  }, [editId, token]);

  // Filter subcategories when category changes
  useEffect(() => {
    if (catId) {
      setFilteredSubcategories(
        subcategories.filter((s) => s.payload?.parent_cat_id === catId)
      );
    } else {
      setFilteredSubcategories([]);
    }
  }, [catId, subcategories]);

  const addSpecRow = () => setSpecs([...specs, { key: '', value: '' }]);
  const removeSpecRow = (idx) => setSpecs(specs.filter((_, i) => i !== idx));
  const updateSpecRow = (idx, field, value) => {
    const updated = [...specs];
    updated[idx][field] = value;
    setSpecs(updated);
  };

  const addFeatureRow = () => setFeatures([...features, '']);
  const removeFeatureRow = (idx) => setFeatures(features.filter((_, i) => i !== idx));
  const updateFeatureRow = (idx, value) => {
    const updated = [...features];
    updated[idx] = value;
    setFeatures(updated);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!catId || !subCatId || !prdId.trim() || !productName.trim()) {
      notify.formWarning('Category, Sub Category, Product ID and Product Name are required.');
      return;
    }
    setSubmitting(true);
    try {
      // Build specs object
      const specificationsObj = {};
      specs.forEach((s) => {
        if (s.key.trim()) specificationsObj[s.key.trim()] = s.value.trim();
      });

      // Filter features list
      const featuresList = features.map((f) => f.trim()).filter(Boolean);

      // Filter variants & kits list
      const filteredVariants = hasVariants === 'yes' ? variants.filter((v) => v.variantId.trim() && v.variantName.trim()) : [];
      const filteredKits = hasKits === 'yes' ? kits.filter((k) => k.kitId.trim() && k.kitName.trim()) : [];

      const payload = {
        prd_id: prdId.trim(),
        cat_id: catId,
        sub_cat_id: subCatId,
        productCode: productCode.trim() || null,
        url: url.trim() || null,
        seo_meta_title: seoTitle.trim() || null,
        seo_meta_description: seoDesc.trim() || null,
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        productDescription: seoDesc.trim() || null,
        product_features: featuresList,
        product_specifications: specificationsObj,
        canonical_url: canonicalUrl.trim() || null,
        product_image: productImage.trim() || null,
        has_variants: hasVariants,
        variants: filteredVariants,
        has_kits: hasKits,
        kits: filteredKits,
        og_title: ogTitle.trim() || null,
        og_description: ogDesc.trim() || null,
        og_image: ogImage.trim() || null,
      };

      const res = editId
        ? await enterpriseApi.contentUpdate(token, 'product', editId, {
            title: productName.trim(),
            summary: seoDesc.trim() || productName.trim(),
            payload,
          })
        : await enterpriseApi.contentCreate(token, 'product', {
            title: productName.trim(),
            summary: seoDesc.trim() || productName.trim(),
            payload,
          });

      notify.success((res.item || res)?.status === 'pending_approval' ? 'Submitted for Approval' : 'Product Saved', (res.item || res)?.message ?? 'Product has been saved.');
      emitUnreadRefresh();
      navigate('/app/products');
    } catch (err) {
      notify.apiError(err, editId ? 'Failed to update product' : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  // Map category options for SearchableSelect
  const categoryOptions = categories
    .map((c) => ({
      value: c.payload?.cat_id || '',
      label: c.title,
    }));

  // Map subcategory options for SearchableSelect
  const subcategoryOptions = filteredSubcategories.map((s) => ({
    value: s.payload?.sub_cat_id || '',
    label: s.title,
  }));

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="Products" parentUrl="/app/products" current={editId ? "Edit Product" : "Create Product"} />
      
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Product" : "Add Product"}</h1>
          <p className="cp-muted">Configure product specifications, parent categories, SEO rules, and OG preview options.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px', marginBottom: '20px' }}>
            <div className="cp-field">
              <span className="cp-field-label-text">Category <span className="cp-req">*</span></span>
              <SearchableSelect
                options={categoryOptions}
                value={catId}
                onChange={(val) => setCatId(val)}
                placeholder={loading ? 'Loading categories…' : '-- Search & Select Category --'}
                disabled={loading}
              />
            </div>

            <div className="cp-field">
              <span className="cp-field-label-text">Sub Category <span className="cp-req">*</span></span>
              <SearchableSelect
                options={subcategoryOptions}
                value={subCatId}
                onChange={(val) => setSubCatId(val)}
                placeholder={!catId ? '-- Select Category First --' : '-- Search & Select Sub Category --'}
                disabled={loading || !catId}
              />
            </div>

            <label className="cp-field">
              <span className="cp-field-label-text">Product Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={productName}
                onChange={handleNameChange}
                placeholder="e.g. Premium Brass Hinges 4-inch"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Product ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={prdId}
                onChange={handleIdChange}
                placeholder="e.g. prd-premium-hinge"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Product Code</span>
              <input
                type="text"
                className="cp-input"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="e.g. TA-HINGE-01"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">URL Route Path</span>
              <input
                type="text"
                className="cp-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. /product/premium-hinges"
              />
            </label>

            <div className="cp-field">
              <span className="cp-field-label-text">Product Image</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {productImage && (
                  <img
                    src={resolveImageUrl(productImage)}
                    alt="Product Preview"
                    style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                  />
                )}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="cp-input"
                    style={{ width: '100%', paddingRight: '110px' }}
                    value={productImage}
                    readOnly
                    placeholder="No image uploaded"
                  />
                  <input
                    type="file"
                    id="prd-img-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleProductImageUpload}
                  />
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={() => document.getElementById('prd-img-file').click()}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '4px',
                      bottom: '4px',
                      minHeight: 'auto',
                      padding: '0 12px',
                      fontSize: '12px',
                      borderRadius: '6px'
                    }}
                  >
                    Choose File
                  </button>
                </div>
              </div>
            </div>

            <label className="cp-field" style={{ gridColumn: 'span 1' }}>
              <span className="cp-field-label-text">Has Kits?</span>
              <select
                className="cp-input"
                value={hasKits}
                onChange={(e) => setHasKits(e.target.value)}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            {/* Product Features Builder */}
            <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="cp-field-label-text" style={{ fontSize: '14px', margin: 0 }}>Product Features</span>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={addFeatureRow}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                  }}
                  title="Add Feature"
                >
                  +
                </button>
              </div>
              {features.map((feat, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    className="cp-input"
                    style={{ flex: 1 }}
                    value={feat}
                    onChange={(e) => updateFeatureRow(idx, e.target.value)}
                    placeholder={`Feature Bullet Point #${idx + 1}`}
                  />
                  {features.length > 1 && (
                    <button
                      type="button"
                      className="cp-btn-icon cp-btn-icon--danger"
                      onClick={() => removeFeatureRow(idx)}
                      style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                      title="Delete Row"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Specifications Builder */}
            <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="cp-field-label-text" style={{ fontSize: '14px', margin: 0 }}>Product Specifications (Key-Value Grid)</span>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={addSpecRow}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                  }}
                  title="Add Specification"
                >
                  +
                </button>
              </div>
              {specs.map((spec, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    className="cp-input"
                    style={{ flex: 1 }}
                    value={spec.key}
                    onChange={(e) => updateSpecRow(idx, 'key', e.target.value)}
                    placeholder="Specification Name (e.g. Material)"
                  />
                  <input
                    className="cp-input"
                    style={{ flex: 1 }}
                    value={spec.value}
                    onChange={(e) => updateSpecRow(idx, 'value', e.target.value)}
                    placeholder="Specification Value (e.g. Solid Brass)"
                  />
                  {specs.length > 1 && (
                    <button
                      type="button"
                      className="cp-btn-icon cp-btn-icon--danger"
                      onClick={() => removeSpecRow(idx)}
                      style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                      title="Delete Row"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>



            {/* Dynamic Kits Grid Builder */}
            {hasKits === 'yes' && (
              <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="cp-field-label-text" style={{ fontSize: '14px', margin: 0, color: 'var(--cp-primary)' }}>Product Kits (Bundles/Packs)</span>
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={addKitRow}
                    style={{
                      width: '32px',
                      height: '32px',
                      minWidth: 'auto',
                      minHeight: 'auto',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                    }}
                    title="Add Kit"
                  >
                    +
                  </button>
                </div>
                {kits.map((kRow, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      className="cp-input"
                      style={{ flex: 1 }}
                      value={kRow.kitId}
                      onChange={(e) => updateKitRow(idx, 'kitId', e.target.value)}
                      placeholder="Kit ID (e.g. TA-HINGE-KIT-5)"
                    />
                    <input
                      className="cp-input"
                      style={{ flex: 1 }}
                      value={kRow.kitName}
                      onChange={(e) => updateKitRow(idx, 'kitName', e.target.value)}
                      placeholder="Kit Name (e.g. Starter Pack of 5)"
                    />
                    <input
                      className="cp-input"
                      style={{ flex: 1 }}
                      value={kRow.kitDisplay}
                      onChange={(e) => updateKitRow(idx, 'kitDisplay', e.target.value)}
                      placeholder="Kit Display (e.g. Pack of 5 Brass Hinges)"
                    />
                    {kits.length > 1 && (
                      <button
                        type="button"
                        className="cp-btn-icon cp-btn-icon--danger"
                        onClick={() => removeKitRow(idx)}
                        style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                        title="Delete Row"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="cp-field">
              <span className="cp-field-label-text">SEO Meta Title</span>
              <input
                type="text"
                className="cp-input"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Display title tag for search engines"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Canonical URL</span>
              <input
                type="text"
                className="cp-input"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://taiton.in/product/..."
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Focus Keyword</span>
              <input
                type="text"
                className="cp-input"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="Primary search phrase"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Secondary Keywords</span>
              <input
                type="text"
                className="cp-input"
                value={secondaryKeywords}
                onChange={(e) => setSecondaryKeywords(e.target.value)}
                placeholder="Comma-separated keywords"
              />
            </label>

            <label className="cp-field cp-field--full">
              <span className="cp-field-label-text">SEO Meta Description</span>
              <textarea
                className="cp-input"
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                placeholder="Snippet description for search engines"
                rows={3}
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">OG Title</span>
              <input
                type="text"
                className="cp-input"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="Title for social media links"
              />
            </label>

            <div className="cp-field">
              <span className="cp-field-label-text">OG Image</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {ogImage && (
                  <img
                    src={resolveImageUrl(ogImage)}
                    alt="OG Preview"
                    style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                  />
                )}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="cp-input"
                    style={{ width: '100%', paddingRight: '110px' }}
                    value={ogImage}
                    readOnly
                    placeholder="No OG image uploaded"
                  />
                  <input
                    type="file"
                    id="og-img-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleOgImageUpload}
                  />
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={() => document.getElementById('og-img-file').click()}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '4px',
                      bottom: '4px',
                      minHeight: 'auto',
                      padding: '0 12px',
                      fontSize: '12px',
                      borderRadius: '6px'
                    }}
                  >
                    Choose File
                  </button>
                </div>
              </div>
            </div>

            <label className="cp-field cp-field--full">
              <span className="cp-field-label-text">OG Description</span>
              <textarea
                className="cp-input"
                value={ogDesc}
                onChange={(e) => setOgDesc(e.target.value)}
                placeholder="Description for social media link previews"
                rows={2}
              />
            </label>
          </div>

          {/* SUBMIT BUTTON CONTAINER */}
          <div style={{ borderTop: '1px solid var(--cp-border)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="cp-btn cp-btn-primary"
              disabled={submitting}
              style={{ height: '44px', width: '220px' }}
            >
              {submitting ? 'Saving Product…' : editId ? 'Update Product' : 'Submit Product'}
            </button>
          </div>

        </form>
      </section>
    </div>
  );
}
