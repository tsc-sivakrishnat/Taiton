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
  const { token, setSidebarCollapsed } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);

  // Form inputs
  const [catId, setCatId] = useState(searchParams.get('cat_id') || '');
  const [subCatId, setSubCatId] = useState(searchParams.get('sub_cat_id') || '');
  const [prdId, setPrdId] = useState('');
  const [isIdEditedManually, setIsIdEditedManually] = useState(false);
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [url, setUrl] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSplitMenu, setShowSplitMenu] = useState(false);
  const [errors, setErrors] = useState({});

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
  const [otherImages, setOtherImages] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [activePreviewImage, setActivePreviewImage] = useState(null);
  const [hasVariants, setHasVariants] = useState('no');
  const [variants, setVariants] = useState([{ variantId: '', variantName: '', variantDisplay: '' }]);
  const [hasKits, setHasKits] = useState('no');
  const [kits, setKits] = useState([{ kitId: '', kitName: '', kitDisplay: '' }]);

  // Dynamic Specs & Features
  const [specs, setSpecs] = useState([{ key: '', value: '' }]);
  const [specsType, setSpecsType] = useState('key_values'); // 'points' | 'table' | 'key_values'
  const [specsPoints, setSpecsPoints] = useState(['']);
  const [specsKeyValues, setSpecsKeyValues] = useState([{ key: '', value: '' }]);
  const [specsTable, setSpecsTable] = useState({
    headers: [''],
    rowHeaders: [''],
    rows: [['']]
  });
  const [specsTableHeaderPos, setSpecsTableHeaderPos] = useState('top'); // 'top' | 'left' | 'both'
  const [features, setFeatures] = useState(['']);
  const [featuresType, setFeaturesType] = useState('points'); // 'points' | 'table' | 'key_values'
  const [featuresPoints, setFeaturesPoints] = useState(['']);
  const [featuresKeyValues, setFeaturesKeyValues] = useState([{ key: '', value: '' }]);
  const [featuresTable, setFeaturesTable] = useState({
    headers: [''],
    rowHeaders: [''],
    rows: [['']]
  });
  const [tableHeaderPos, setTableHeaderPos] = useState('top'); // 'top' | 'left' | 'both'

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

  const handleOtherImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !token) return;
    try {
      const uploadPromises = files.map(file => enterpriseApi.uploadImage(token, file));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(res => res.url);
      setOtherImages([...otherImages, ...urls]);
      notify.success('Uploaded', `${files.length} image(s) uploaded successfully!`);
    } catch (err) {
      notify.apiError(err, 'Image upload failed');
    }
  };

  const removeOtherImage = (idx) => {
    setOtherImages(otherImages.filter((_, i) => i !== idx));
  };

  const moveOtherImage = (idx, direction) => {
    const nextList = [...otherImages];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= nextList.length) return;
    const temp = nextList[idx];
    nextList[idx] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setOtherImages(nextList);
  };

  const handleDragStart = (idx) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (toIdx) => {
    if (draggedIndex === null || draggedIndex === toIdx) return;
    const nextList = [...otherImages];
    const draggedItem = nextList[draggedIndex];
    nextList.splice(draggedIndex, 1);
    nextList.splice(toIdx, 0, draggedItem);
    setOtherImages(nextList);
    setDraggedIndex(null);
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
          enterpriseApi.contentList(token, 'category', { limit: 100 }),
          enterpriseApi.contentList(token, 'subcategory', { limit: 100 })
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
          const res = await enterpriseApi.contentDetail(token, 'product', editId);
          const productItem = res.item;
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
            setOtherImages(Array.isArray(p.other_images) ? p.other_images : []);
            setHasVariants(p.has_variants || 'no');
            setHasKits(p.has_kits || 'no');
            if (p.product_features) {
              const pf = p.product_features;
              if (pf && typeof pf === 'object' && pf.type) {
                setFeaturesType(pf.type);
                if (pf.type === 'points') {
                  setFeaturesPoints(Array.isArray(pf.data) ? pf.data : ['']);
                } else if (pf.type === 'key_values') {
                  setFeaturesKeyValues(Array.isArray(pf.data) ? pf.data : [{ key: '', value: '' }]);
                } else if (pf.type === 'table') {
                  setFeaturesTable({
                    headers: pf.data?.headers || [''],
                    rowHeaders: pf.data?.rowHeaders || [''],
                    rows: pf.data?.rows || [['']]
                  });
                  setTableHeaderPos(pf.headerPos || 'top');
                }
              } else if (Array.isArray(pf)) {
                setFeaturesType('points');
                setFeaturesPoints(pf.length > 0 ? pf : ['']);
                setFeatures(pf.length > 0 ? pf : ['']);
              }
            }
            if (p.product_specifications) {
              const ps = p.product_specifications;
              if (ps && typeof ps === 'object' && ps.type) {
                setSpecsType(ps.type);
                if (ps.type === 'points') {
                  setSpecsPoints(Array.isArray(ps.data) ? ps.data : ['']);
                } else if (ps.type === 'key_values') {
                  setSpecsKeyValues(Array.isArray(ps.data) ? ps.data : [{ key: '', value: '' }]);
                } else if (ps.type === 'table') {
                  setSpecsTable({
                    headers: ps.data?.headers || [''],
                    rowHeaders: ps.data?.rowHeaders || [''],
                    rows: ps.data?.rows || [['']]
                  });
                  setSpecsTableHeaderPos(ps.headerPos || 'top');
                }
              } else if (typeof ps === 'object') {
                setSpecsType('key_values');
                const specList = Object.entries(ps).map(([key, value]) => ({ key, value }));
                setSpecsKeyValues(specList.length > 0 ? specList : [{ key: '', value: '' }]);
              }
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

  const addSpecPoint = () => setSpecsPoints([...specsPoints, '']);
  const removeSpecPoint = (idx) => setSpecsPoints(specsPoints.filter((_, i) => i !== idx));
  const updateSpecPoint = (idx, val) => {
    const updated = [...specsPoints];
    updated[idx] = val;
    setSpecsPoints(updated);
  };

  const addSpecKeyValue = () => setSpecsKeyValues([...specsKeyValues, { key: '', value: '' }]);
  const removeSpecKeyValue = (idx) => setSpecsKeyValues(specsKeyValues.filter((_, i) => i !== idx));
  const updateSpecKeyValue = (idx, field, val) => {
    const updated = [...specsKeyValues];
    updated[idx][field] = val;
    setSpecsKeyValues(updated);
  };

  const addSpecTableHeader = () => {
    setSpecsTable({
      ...specsTable,
      headers: [...specsTable.headers, ''],
      rows: specsTable.rows.map(r => [...r, ''])
    });
  };
  const removeSpecTableHeader = (idx) => {
    const newHeaders = specsTable.headers.filter((_, i) => i !== idx);
    const newRows = specsTable.rows.map(r => r.filter((_, i) => i !== idx));
    setSpecsTable({
      ...specsTable,
      headers: newHeaders,
      rows: newRows
    });
  };
  const updateSpecTableHeader = (idx, val) => {
    const newHeaders = [...specsTable.headers];
    newHeaders[idx] = val;
    setSpecsTable({ ...specsTable, headers: newHeaders });
  };

  const addSpecTableRow = () => {
    const newRow = Array(specsTable.headers.length).fill('');
    setSpecsTable({
      ...specsTable,
      rowHeaders: [...(specsTable.rowHeaders || []), ''],
      rows: [...specsTable.rows, newRow]
    });
  };
  const removeSpecTableRow = (idx) => {
    const newRowHeaders = (specsTable.rowHeaders || []).filter((_, i) => i !== idx);
    const newRows = specsTable.rows.filter((_, i) => i !== idx);
    setSpecsTable({
      ...specsTable,
      rowHeaders: newRowHeaders,
      rows: newRows
    });
  };
  const updateSpecTableRowHeader = (idx, val) => {
    const newRowHeaders = [...(specsTable.rowHeaders || [])];
    newRowHeaders[idx] = val;
    setSpecsTable({ ...specsTable, rowHeaders: newRowHeaders });
  };
  const updateSpecTableCell = (rowIdx, colIdx, val) => {
    const newRows = [...specsTable.rows];
    newRows[rowIdx][colIdx] = val;
    setSpecsTable({ ...specsTable, rows: newRows });
  };

  const addFeaturePoint = () => setFeaturesPoints([...featuresPoints, '']);
  const removeFeaturePoint = (idx) => setFeaturesPoints(featuresPoints.filter((_, i) => i !== idx));
  const updateFeaturePoint = (idx, val) => {
    const updated = [...featuresPoints];
    updated[idx] = val;
    setFeaturesPoints(updated);
  };

  const addFeatureKeyValue = () => setFeaturesKeyValues([...featuresKeyValues, { key: '', value: '' }]);
  const removeFeatureKeyValue = (idx) => setFeaturesKeyValues(featuresKeyValues.filter((_, i) => i !== idx));
  const updateFeatureKeyValue = (idx, field, val) => {
    const updated = [...featuresKeyValues];
    updated[idx][field] = val;
    setFeaturesKeyValues(updated);
  };

  const addFeatureTableHeader = () => {
    setFeaturesTable({
      ...featuresTable,
      headers: [...featuresTable.headers, ''],
      rows: featuresTable.rows.map(r => [...r, ''])
    });
  };
  const removeFeatureTableHeader = (idx) => {
    const newHeaders = featuresTable.headers.filter((_, i) => i !== idx);
    const newRows = featuresTable.rows.map(r => r.filter((_, i) => i !== idx));
    setFeaturesTable({
      ...featuresTable,
      headers: newHeaders,
      rows: newRows
    });
  };
  const updateFeatureTableHeader = (idx, val) => {
    const newHeaders = [...featuresTable.headers];
    newHeaders[idx] = val;
    setFeaturesTable({ ...featuresTable, headers: newHeaders });
  };

  const addFeatureTableRow = () => {
    const newRow = Array(featuresTable.headers.length).fill('');
    setFeaturesTable({
      ...featuresTable,
      rowHeaders: [...(featuresTable.rowHeaders || []), ''],
      rows: [...featuresTable.rows, newRow]
    });
  };
  const removeFeatureTableRow = (idx) => {
    const newRowHeaders = (featuresTable.rowHeaders || []).filter((_, i) => i !== idx);
    const newRows = featuresTable.rows.filter((_, i) => i !== idx);
    setFeaturesTable({
      ...featuresTable,
      rowHeaders: newRowHeaders,
      rows: newRows
    });
  };
  const updateFeatureTableRowHeader = (idx, val) => {
    const newRowHeaders = [...(featuresTable.rowHeaders || [])];
    newRowHeaders[idx] = val;
    setFeaturesTable({ ...featuresTable, rowHeaders: newRowHeaders });
  };
  const updateFeatureTableCell = (rowIdx, colIdx, val) => {
    const newRows = [...featuresTable.rows];
    newRows[rowIdx][colIdx] = val;
    setFeaturesTable({ ...featuresTable, rows: newRows });
  };

  const onSubmit = async (e, redirectOpt = null) => {
    if (e) e.preventDefault();
    if (!token) return;

    // Perform custom validation
    const newErrors = {};
    if (!catId) newErrors.catId = 'Category is required.';
    if (!subCatId) newErrors.subCatId = 'Sub Category is required.';
    if (!productName.trim()) {
      newErrors.productName = 'Product Name is required.';
    } else if (productName.trim().length > 190) {
      newErrors.productName = 'Product Name must not exceed 190 characters.';
    }
    if (!prdId.trim()) {
      newErrors.prdId = 'Product ID is required.';
    } else if (prdId.trim().length > 64) {
      newErrors.prdId = 'Product ID must not exceed 64 characters.';
    }
    if (productCode.trim().length > 64) {
      newErrors.productCode = 'Product Code must not exceed 64 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.formWarning('Please fix the validation errors.');
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      // Client-side uniqueness check for Product ID
      const prdRes = await enterpriseApi.contentList(token, 'product', { q: prdId.trim() });
      const prds = prdRes.items ?? [];
      const duplicate = prds.find(p =>
        p.payload?.prd_id?.trim().toLowerCase() === prdId.trim().toLowerCase() &&
        String(p.id) !== String(editId || '')
      );
      if (duplicate) {
        const errMsg = `Product ID "${prdId.trim()}" already exists. Please choose a unique ID.`;
        setErrors({ prdId: errMsg });
        notify.formWarning(errMsg);
        setSubmitting(false);
        return;
      }
      // Construct product_features dynamically
      let productFeaturesPayload = null;
      if (featuresType === 'points') {
        productFeaturesPayload = {
          type: 'points',
          data: featuresPoints.filter(p => p.trim())
        };
      } else if (featuresType === 'key_values') {
        productFeaturesPayload = {
          type: 'key_values',
          data: featuresKeyValues.filter(kv => kv.key.trim())
        };
      } else if (featuresType === 'table') {
        productFeaturesPayload = {
          type: 'table',
          headerPos: tableHeaderPos,
          data: {
            headers: featuresTable.headers.filter(h => h.trim()),
            rowHeaders: featuresTable.rowHeaders ? featuresTable.rowHeaders.filter(r => r.trim()) : [],
            rows: featuresTable.rows.map(r => r.map(cell => cell.trim()))
          }
        };
      }

      // Construct product_specifications dynamically
      let productSpecsPayload = null;
      if (specsType === 'points') {
        productSpecsPayload = {
          type: 'points',
          data: specsPoints.filter(p => p.trim())
        };
      } else if (specsType === 'key_values') {
        productSpecsPayload = {
          type: 'key_values',
          data: specsKeyValues.filter(kv => kv.key.trim())
        };
      } else if (specsType === 'table') {
        productSpecsPayload = {
          type: 'table',
          headerPos: specsTableHeaderPos,
          data: {
            headers: specsTable.headers.filter(h => h.trim()),
            rowHeaders: specsTable.rowHeaders ? specsTable.rowHeaders.filter(r => r.trim()) : [],
            rows: specsTable.rows.map(r => r.map(cell => cell.trim()))
          }
        };
      }

      // Filter variants & kits list
      const filteredVariants = hasVariants === 'yes' ? variants.filter((v) => v.variantId.trim() && v.variantName.trim()) : [];
      const filteredKits = hasKits === 'yes' ? kits.filter((k) => k.kitId.trim() && k.kitName.trim()) : [];

      const payload = {
        prd_id: prdId.trim(),
        cat_id: catId,
        sub_cat_id: subCatId,
        productCode: productCode.trim() || null,
        url: `/product/${String(productName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}`,
        seo_meta_title: seoTitle.trim() || null,
        seo_meta_description: seoDesc.trim() || null,
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        productDescription: seoDesc.trim() || null,
        product_features: productFeaturesPayload,
        product_specifications: productSpecsPayload,
        canonical_url: canonicalUrl.trim() || null,
        product_image: productImage.trim() || null,
        has_variants: hasVariants,
        variants: filteredVariants,
        has_kits: hasKits,
        kits: filteredKits,
        og_title: null,
        og_description: null,
        og_image: null,
        other_images: otherImages,
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

      if (redirectOpt === 'add_variant') {
        navigate(`/app/products/create-variant?product_id=${prdId.trim()}`);
      } else {
        navigate('/app/products');
      }
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
          <p className="cp-muted">Configure product specifications, parent categories and SEO rules.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className={`cp-btn ${showLivePreview ? 'cp-btn-primary' : 'cp-btn-secondary'}`}
            onClick={() => {
              const nextVal = !showLivePreview;
              setShowLivePreview(nextVal);
              setSidebarCollapsed(nextVal);
            }}
          >
            {showLivePreview ? 'Hide Live Preview' : 'Show Live Preview'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', width: '100%', alignItems: 'flex-start' }}>
        <section className="cp-card cp-card-pad" style={{ flex: showLivePreview ? '1 1 50%' : '1 1 100%', minWidth: 0 }}>
          <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div className="cp-grid cp-grid-3" style={{ marginBottom: '20px' }}>
              <div className="cp-field">
                <span className="cp-field-label-text">Category <span className="cp-req">*</span></span>
                <SearchableSelect
                  options={categoryOptions}
                  value={catId}
                  onChange={(val) => setCatId(val)}
                  placeholder={loading ? 'Loading categories…' : '-- Search & Select Category --'}
                  disabled={loading}
                />
                {errors.catId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.catId}</span>}
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
                {errors.subCatId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.subCatId}</span>}
              </div>

              <label className="cp-field">
                <span className="cp-field-label-text">Product Name <span className="cp-req">*</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={productName}
                  onChange={handleNameChange}
                  placeholder="e.g. Premium Brass Hinges 4-inch"
                  maxLength={190}
                  required
                />
                {errors.productName && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.productName}</span>}
              </label>
            </div>

            <div className="cp-grid cp-grid-4" style={{ gap: '16px 20px', marginBottom: '20px' }}>
              <label className="cp-field">
                <span className="cp-field-label-text">Product ID <span className="cp-req">*</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={prdId}
                  onChange={handleIdChange}
                  placeholder="e.g. prd-premium-hinge"
                  maxLength={64}
                  required
                />
                {errors.prdId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.prdId}</span>}
              </label>

              <label className="cp-field">
                <span className="cp-field-label-text">Product Code</span>
                <input
                  type="text"
                  className="cp-input"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="e.g. TA-HINGE-01"
                  maxLength={64}
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

              <label className="cp-field">
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

              <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--cp-border)' }}>
                <span className="cp-field-label-text" style={{ fontWeight: 'bold', fontSize: '13px' }}>Additional Images <span style={{ fontWeight: 'normal', fontSize: '11px', color: 'var(--cp-muted)' }}>(Drag & Drop to reorder)</span></span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  {otherImages.map((img, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                      style={{
                        position: 'relative',
                        width: '80px',
                        height: '80px',
                        border: '1px solid var(--cp-border)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#fff',
                        opacity: draggedIndex === idx ? 0.4 : 1,
                        cursor: 'grab'
                      }}
                      title="Drag to reorder"
                    >
                      <img
                        src={resolveImageUrl(img)}
                        alt={`Other Image ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeOtherImage(idx)}
                        style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
                        title="Delete Image"
                      >
                        &times;
                      </button>
                      <div style={{ position: 'absolute', bottom: '2px', left: '2px', right: '2px', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '1px 4px' }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveOtherImage(idx, -1)}
                          style={{ background: 'none', border: 'none', color: idx === 0 ? '#94a3b8' : 'white', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: '10px', padding: 0 }}
                          title="Move Left"
                        >
                          &larr;
                        </button>
                        <span style={{ color: 'white', fontSize: '9px' }}>#{idx + 1}</span>
                        <button
                          type="button"
                          disabled={idx === otherImages.length - 1}
                          onClick={() => moveOtherImage(idx, 1)}
                          style={{ background: 'none', border: 'none', color: idx === otherImages.length - 1 ? '#94a3b8' : 'white', cursor: idx === otherImages.length - 1 ? 'not-allowed' : 'pointer', fontSize: '10px', padding: 0 }}
                          title="Move Right"
                        >
                          &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                  <div
                    onClick={() => document.getElementById('prd-other-img-file').click()}
                    style={{ width: '80px', height: '80px', border: '2px dashed var(--cp-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--cp-text)', background: '#fff', transition: 'border-color 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--cp-primary)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--cp-border)'}
                    title="Upload Additional Image"
                  >
                    <span style={{ fontSize: '24px', lineHeight: 1 }}>+</span>
                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Add Image</span>
                  </div>
                  <input
                    type="file"
                    id="prd-other-img-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleOtherImageUpload}
                    multiple
                  />
                </div>
              </div>

              {/* Product Features Builder */}
              <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="cp-field-label-text" style={{ fontSize: '14px', margin: 0, fontWeight: 'bold' }}>Product Features</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      className="cp-input"
                      value={featuresType}
                      onChange={(e) => setFeaturesType(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', fontSize: '12px', minWidth: '120px', width: 'auto' }}
                    >
                      <option value="points">Points</option>
                      <option value="key_values">Key Values</option>
                      <option value="table">Table</option>
                    </select>

                    <button
                      type="button"
                      className="cp-btn cp-btn-primary"
                      onClick={() => {
                        if (featuresType === 'points') addFeaturePoint();
                        else if (featuresType === 'key_values') addFeatureKeyValue();
                        else if (featuresType === 'table') addFeatureTableRow();
                      }}
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
                      title={featuresType === 'table' ? 'Add Table Row' : 'Add Feature Item'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* RENDER BY TYPE */}
                {featuresType === 'points' && (
                  <div>
                    {featuresPoints.map((feat, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          className="cp-input"
                          style={{ flex: 1 }}
                          value={feat}
                          onChange={(e) => updateFeaturePoint(idx, e.target.value)}
                          placeholder={`Feature Bullet Point #${idx + 1}`}
                        />
                        {featuresPoints.length > 1 && (
                          <button
                            type="button"
                            className="cp-btn-icon cp-btn-icon--danger"
                            onClick={() => removeFeaturePoint(idx)}
                            style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                            title="Delete Row"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {featuresType === 'key_values' && (
                  <div>
                    {featuresKeyValues.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          className="cp-input"
                          style={{ flex: 1 }}
                          value={item.key}
                          onChange={(e) => updateFeatureKeyValue(idx, 'key', e.target.value)}
                          placeholder="Feature Property (e.g. Warranty)"
                        />
                        <input
                          className="cp-input"
                          style={{ flex: 1 }}
                          value={item.value}
                          onChange={(e) => updateFeatureKeyValue(idx, 'value', e.target.value)}
                          placeholder="Feature Details (e.g. 5 Years)"
                        />
                        {featuresKeyValues.length > 1 && (
                          <button
                            type="button"
                            className="cp-btn-icon cp-btn-icon--danger"
                            onClick={() => removeFeatureKeyValue(idx)}
                            style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                            title="Delete Row"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {featuresType === 'table' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Table Control Panel */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Header Position:</span>
                        <select
                          className="cp-input"
                          value={tableHeaderPos}
                          onChange={(e) => setTableHeaderPos(e.target.value)}
                          style={{ height: '28px', padding: '0 8px', fontSize: '12px', minWidth: '100px', width: 'auto' }}
                        >
                          <option value="top">Top Columns</option>
                          <option value="left">Left Rows</option>
                          <option value="both">Both Sides</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="cp-btn cp-btn-secondary"
                          onClick={addFeatureTableHeader}
                          style={{ height: '28px', padding: '0 10px', fontSize: '11px', minHeight: 'auto' }}
                        >
                          + Add Column
                        </button>
                        <button
                          type="button"
                          className="cp-btn cp-btn-secondary"
                          onClick={addFeatureTableRow}
                          style={{ height: '28px', padding: '0 10px', fontSize: '11px', minHeight: 'auto' }}
                        >
                          + Add Row
                        </button>
                      </div>
                    </div>

                    {/* Interactive Table Grid Editor */}
                    <div style={{ overflowX: 'auto', border: '1px solid var(--cp-border)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {(tableHeaderPos === 'left' || tableHeaderPos === 'both') && (
                              <th style={{ border: '1px solid var(--cp-border)', padding: '6px', textAlign: 'left', minWidth: '120px', background: 'rgba(0,0,0,0.02)' }}>
                                Row Header Label
                              </th>
                            )}
                            {featuresTable.headers.map((h, colIdx) => (
                              <th key={colIdx} style={{ border: '1px solid var(--cp-border)', padding: '6px', textAlign: 'left', minWidth: '100px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    className="cp-input"
                                    style={{ height: '24px', fontSize: '11px', padding: '0 4px', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--cp-border)', borderRadius: 0 }}
                                    value={h}
                                    onChange={(e) => updateFeatureTableHeader(colIdx, e.target.value)}
                                    placeholder={`Column #${colIdx + 1}`}
                                  />
                                  {featuresTable.headers.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeFeatureTableHeader(colIdx)}
                                      style={{ background: 'none', border: 'none', color: 'var(--cp-danger)', cursor: 'pointer', padding: 0, fontWeight: 'bold', fontSize: '14px' }}
                                      title="Remove Column"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              </th>
                            ))}
                            <th style={{ width: '40px', border: '1px solid var(--cp-border)' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {featuresTable.rows.map((rowArr, rIdx) => (
                            <tr key={rIdx}>
                              {(tableHeaderPos === 'left' || tableHeaderPos === 'both') && (
                                <td style={{ border: '1px solid var(--cp-border)', padding: '4px', background: 'rgba(0,0,0,0.02)' }}>
                                  <input
                                    className="cp-input"
                                    style={{ height: '28px', padding: '0 6px', fontSize: '11px', fontWeight: 'bold' }}
                                    value={(featuresTable.rowHeaders && featuresTable.rowHeaders[rIdx]) || ''}
                                    onChange={(e) => updateFeatureTableRowHeader(rIdx, e.target.value)}
                                    placeholder={`Row #${rIdx + 1} Label`}
                                  />
                                </td>
                              )}
                              {featuresTable.headers.map((_, cIdx) => (
                                <td key={cIdx} style={{ border: '1px solid var(--cp-border)', padding: '4px' }}>
                                  <input
                                    className="cp-input"
                                    style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                                    value={rowArr[cIdx] || ''}
                                    onChange={(e) => updateFeatureTableCell(rIdx, cIdx, e.target.value)}
                                    placeholder="Value..."
                                  />
                                </td>
                              ))}
                              <td style={{ border: '1px solid var(--cp-border)', textAlign: 'center', padding: '4px' }}>
                                {featuresTable.rows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeFeatureTableRow(rIdx)}
                                    style={{ border: 'none', background: 'none', color: 'var(--cp-danger)', cursor: 'pointer', fontSize: '16px' }}
                                    title="Delete Row"
                                  >
                                    &times;
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Specifications Builder */}
              <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="cp-field-label-text" style={{ fontSize: '14px', margin: 0, fontWeight: 'bold' }}>Product Specifications</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      className="cp-input"
                      value={specsType}
                      onChange={(e) => setSpecsType(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', fontSize: '12px', minWidth: '120px', width: 'auto' }}
                    >
                      <option value="points">Points</option>
                      <option value="key_values">Key Values</option>
                      <option value="table">Table</option>
                    </select>

                    <button
                      type="button"
                      className="cp-btn cp-btn-primary"
                      onClick={() => {
                        if (specsType === 'points') addSpecPoint();
                        else if (specsType === 'key_values') addSpecKeyValue();
                        else if (specsType === 'table') addSpecTableRow();
                      }}
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
                      title="Add Specification Item"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 1. Specs Points Layout */}
                {specsType === 'points' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {specsPoints.map((pt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          className="cp-input"
                          style={{ flex: 1 }}
                          value={pt}
                          onChange={(e) => updateSpecPoint(idx, e.target.value)}
                          placeholder="Specification Point (e.g. ANSI Grade 1 certified strength)"
                        />
                        {specsPoints.length > 1 && (
                          <button
                            type="button"
                            className="cp-btn-icon cp-btn-icon--danger"
                            onClick={() => removeSpecPoint(idx)}
                            style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                            title="Delete Point"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Specs Key-Values Layout */}
                {specsType === 'key_values' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {specsKeyValues.map((kv, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          className="cp-input"
                          style={{ flex: 1 }}
                          value={kv.key}
                          onChange={(e) => updateSpecKeyValue(idx, 'key', e.target.value)}
                          placeholder="Specification Name (e.g. Material)"
                        />
                        <input
                          className="cp-input"
                          style={{ flex: 1 }}
                          value={kv.value}
                          onChange={(e) => updateSpecKeyValue(idx, 'value', e.target.value)}
                          placeholder="Specification Value (e.g. Solid Brass)"
                        />
                        {specsKeyValues.length > 1 && (
                          <button
                            type="button"
                            className="cp-btn-icon cp-btn-icon--danger"
                            onClick={() => removeSpecKeyValue(idx)}
                            style={{ minWidth: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                            title="Delete Key Value Row"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Specs Table Grid Layout */}
                {specsType === 'table' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Header Position:</span>
                        <select
                          className="cp-input"
                          value={specsTableHeaderPos}
                          onChange={(e) => setSpecsTableHeaderPos(e.target.value)}
                          style={{ height: '28px', padding: '0 8px', fontSize: '11px', width: 'auto' }}
                        >
                          <option value="top">Top (Columns only)</option>
                          <option value="left">Left (Rows only)</option>
                          <option value="both">Both (Grid)</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="cp-btn cp-btn-secondary"
                          onClick={addSpecTableHeader}
                          style={{ height: '28px', padding: '0 10px', fontSize: '11px', minHeight: 'auto' }}
                        >
                          + Add Column
                        </button>
                        <button
                          type="button"
                          className="cp-btn cp-btn-secondary"
                          onClick={addSpecTableRow}
                          style={{ height: '28px', padding: '0 10px', fontSize: '11px', minHeight: 'auto' }}
                        >
                          + Add Row
                        </button>
                      </div>
                    </div>

                    {/* Interactive Table Grid Editor */}
                    <div style={{ overflowX: 'auto', border: '1px solid var(--cp-border)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {(specsTableHeaderPos === 'left' || specsTableHeaderPos === 'both') && (
                              <th style={{ border: '1px solid var(--cp-border)', padding: '6px', textAlign: 'left', minWidth: '120px', background: 'rgba(0,0,0,0.02)' }}>
                                Row Header Label
                              </th>
                            )}
                            {specsTable.headers.map((h, colIdx) => (
                              <th key={colIdx} style={{ border: '1px solid var(--cp-border)', padding: '6px', textAlign: 'left', minWidth: '100px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    className="cp-input"
                                    style={{ height: '24px', fontSize: '11px', padding: '0 4px', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--cp-border)', borderRadius: 0 }}
                                    value={h}
                                    onChange={(e) => updateSpecTableHeader(colIdx, e.target.value)}
                                    placeholder={`Column #${colIdx + 1}`}
                                  />
                                  {specsTable.headers.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeSpecTableHeader(colIdx)}
                                      style={{ background: 'none', border: 'none', color: 'var(--cp-danger)', cursor: 'pointer', padding: 0, fontWeight: 'bold', fontSize: '14px' }}
                                      title="Remove Column"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              </th>
                            ))}
                            <th style={{ width: '40px', border: '1px solid var(--cp-border)' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {specsTable.rows.map((rowArr, rIdx) => (
                            <tr key={rIdx}>
                              {(specsTableHeaderPos === 'left' || specsTableHeaderPos === 'both') && (
                                <td style={{ border: '1px solid var(--cp-border)', padding: '4px', background: 'rgba(0,0,0,0.02)' }}>
                                  <input
                                    className="cp-input"
                                    style={{ height: '28px', padding: '0 6px', fontSize: '11px', fontWeight: 'bold' }}
                                    value={(specsTable.rowHeaders && specsTable.rowHeaders[rIdx]) || ''}
                                    onChange={(e) => updateSpecTableRowHeader(rIdx, e.target.value)}
                                    placeholder={`Row #${rIdx + 1} Label`}
                                  />
                                </td>
                              )}
                              {specsTable.headers.map((_, cIdx) => (
                                <td key={cIdx} style={{ border: '1px solid var(--cp-border)', padding: '4px' }}>
                                  <input
                                    className="cp-input"
                                    style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                                    value={rowArr[cIdx] || ''}
                                    onChange={(e) => updateSpecTableCell(rIdx, cIdx, e.target.value)}
                                    placeholder="Value..."
                                  />
                                </td>
                              ))}
                              <td style={{ border: '1px solid var(--cp-border)', textAlign: 'center', padding: '4px' }}>
                                {specsTable.rows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSpecTableRow(rIdx)}
                                    style={{ border: 'none', background: 'none', color: 'var(--cp-danger)', cursor: 'pointer', fontSize: '16px' }}
                                    title="Delete Row"
                                  >
                                    &times;
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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

            </div>

            <div className="cp-grid cp-grid-4" style={{ marginBottom: '20px' }}>
              <label className="cp-field">
                <span className="cp-field-label-text">SEO Meta Title <span style={{ opacity: 0.7, fontSize: '11px', display: 'block' }}>Display title tag for search engines</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Display title tag for search engines"
                />
              </label>

              <label className="cp-field">
                <span className="cp-field-label-text">Canonical URL <span style={{ opacity: 0.7, fontSize: '11px', display: 'block' }}>e.g. https://taiton.in/product/...</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  placeholder="https://taiton.in/product/..."
                />
              </label>

              <label className="cp-field">
                <span className="cp-field-label-text">Focus Keyword <span style={{ opacity: 0.7, fontSize: '11px', display: 'block' }}>Primary search phrase</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="Primary search phrase"
                />
              </label>

              <label className="cp-field">
                <span className="cp-field-label-text">Secondary Keywords <span style={{ opacity: 0.7, fontSize: '11px', display: 'block' }}>Comma-separated keywords</span></span>
                <input
                  type="text"
                  className="cp-input"
                  value={secondaryKeywords}
                  onChange={(e) => setSecondaryKeywords(e.target.value)}
                  placeholder="Comma-separated keywords"
                />
              </label>
            </div>

            <div className="cp-grid" style={{ marginBottom: '20px' }}>
              <label className="cp-field cp-field--full">
                <span className="cp-field-label-text">SEO Meta Description</span>
                <textarea
                  className="cp-input"
                  value={seoDesc}
                  onChange={(e) => setSeoDesc(e.target.value)}
                  placeholder="Snippet description for search engines"
                  rows={5}
                  style={{ minHeight: '120px', height: '120px', resize: 'vertical' }}
                />
              </label>
            </div>

            {/* SUBMIT BUTTON CONTAINER */}
            <div style={{ borderTop: '1px solid var(--cp-border)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'inline-flex', position: 'relative' }}>
                <button
                  type="submit"
                  className="cp-btn cp-btn-primary"
                  disabled={submitting}
                  style={{
                    height: '44px',
                    width: '180px',
                    borderTopRightRadius: '0',
                    borderBottomRightRadius: '0',
                    borderRight: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  {submitting ? 'Saving Product…' : editId ? 'Update Product' : 'Submit Product'}
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    disabled={submitting}
                    onClick={() => setShowSplitMenu(!showSplitMenu)}
                    style={{
                      height: '44px',
                      width: '40px',
                      minWidth: 'auto',
                      borderTopLeftRadius: '0',
                      borderBottomLeftRadius: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title="More actions"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showSplitMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showSplitMenu && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      bottom: '48px',
                      backgroundColor: 'var(--cp-bg-card, #ffffff)',
                      border: '1px solid var(--cp-border)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                      zIndex: 100,
                      minWidth: '240px',
                      padding: '4px 0',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          setShowSplitMenu(false);
                          onSubmit(e, 'add_variant');
                        }}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          color: 'var(--cp-text)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          width: '100%',
                          display: 'block'
                        }}
                      >
                        Submit & Add Variant
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </form>
        </section>

        {showLivePreview && (
          <div style={{ flex: '1 1 50%', minWidth: 0, position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="cp-card cp-card-pad" style={{ background: 'var(--cp-surface, #ffffff)', border: '1px solid var(--cp-border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--cp-border)', paddingBottom: '10px', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 className="cp-section-title" style={{ margin: 0 }}>Real-time Product Preview</h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="cp-btn"
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                    disabled={zoom <= 0.5}
                    title="Zoom Out"
                    style={{ minWidth: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: '1px solid var(--cp-border)', background: 'var(--cp-surface)', color: 'var(--cp-text)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    —
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: '700', minWidth: '38px', textAlign: 'center', color: 'var(--cp-text)' }}>{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    className="cp-btn"
                    onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
                    disabled={zoom >= 2.0}
                    title="Zoom In"
                    style={{ minWidth: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: '1px solid var(--cp-border)', background: 'var(--cp-surface)', color: 'var(--cp-text)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="cp-btn"
                    onClick={() => setZoom(1.0)}
                    style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', height: '28px', borderRadius: '4px', border: '1px solid var(--cp-border)', background: 'var(--cp-surface)', color: 'var(--cp-text)', cursor: 'pointer' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div style={{ overflow: 'auto', flex: 1, padding: '4px' }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out', width: zoom > 1 ? `${100 / zoom}%` : '100%', margin: '0 auto' }}>
                  {/* Product Image Gallery (Amazon/Flipkart Style) */}
                  {(productImage || otherImages.length > 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      <div style={{ width: '100%', height: '220px', background: '#f8fafc', border: '1px solid var(--cp-border)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={resolveImageUrl(activePreviewImage || productImage)}
                          alt="Main Preview"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      
                      {/* Thumbnails Row */}
                      {[productImage, ...otherImages].filter(Boolean).length > 1 && (
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {[productImage, ...otherImages].filter(Boolean).map((img, i) => {
                            const isSelected = (activePreviewImage || productImage) === img;
                            return (
                              <div
                                key={i}
                                onMouseOver={() => setActivePreviewImage(img)}
                                onClick={() => setActivePreviewImage(img)}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '4px',
                                  border: isSelected ? '2px solid var(--cp-primary, #2563eb)' : '1px solid var(--cp-border)',
                                  overflow: 'hidden',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  boxSizing: 'border-box',
                                  opacity: isSelected ? 1 : 0.7,
                                  transition: 'border-color 0.15s, opacity 0.15s'
                                }}
                              >
                                <img
                                  src={resolveImageUrl(img)}
                                  alt={`Thumbnail ${i + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ height: '140px', background: '#f8fafc', border: '1px dashed var(--cp-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cp-muted)', marginBottom: '14px' }}>
                      No Product Image Uploaded
                    </div>
                  )}

                  <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--cp-text)' }}>{productName || 'Unnamed Product'}</h2>
                  {productCode && <code style={{ fontSize: '12px', color: 'var(--cp-muted)', display: 'block', marginBottom: '12px' }}>Code: {productCode}</code>}

                  {/* Category & Subcategory Reference */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {catId && <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>Category: {catId}</span>}
                    {subCatId && <span className="cp-tag cp-tag-info" style={{ textTransform: 'none' }}>Subcategory: {subCatId}</span>}
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>Description:</strong>
                    <p style={{ fontSize: '13px', color: 'var(--cp-text-muted)', margin: 0, lineHeight: '1.5' }}>
                      {seoDesc || 'No description preview filled yet.'}
                    </p>
                  </div>

                  {/* Key Features */}
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>Key Features:</strong>

                    {featuresType === 'points' && (
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--cp-text-muted)' }}>
                        {featuresPoints.filter(Boolean).map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    )}

                    {featuresType === 'key_values' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {featuresKeyValues.filter(kv => kv.key).map((kv, i) => (
                          <div key={i} style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--cp-muted)' }}>{kv.key}: </span>
                            <strong>{kv.value || '—'}</strong>
                          </div>
                        ))}
                      </div>
                    )}

                    {featuresType === 'table' && (
                      <div style={{ overflowX: 'auto', marginTop: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--cp-border)' }}>
                          <thead>
                            {(tableHeaderPos === 'top' || tableHeaderPos === 'both') ? (
                              <tr style={{ background: '#f8fafc' }}>
                                {tableHeaderPos === 'both' && <th style={{ border: '1px solid var(--cp-border)', padding: '6px' }}></th>}
                                {featuresTable.headers.map((h, i) => (
                                  <th key={i} style={{ border: '1px solid var(--cp-border)', padding: '6px', textAlign: 'left' }}>{h || `Col #${i + 1}`}</th>
                                ))}
                              </tr>
                            ) : null}
                          </thead>
                          <tbody>
                            {featuresTable.rows.map((rowArr, rIdx) => (
                              <tr key={rIdx}>
                                {(tableHeaderPos === 'left' || tableHeaderPos === 'both') && (
                                  <th style={{ background: '#f8fafc', border: '1px solid var(--cp-border)', padding: '6px', textAlign: 'left' }}>
                                    {(featuresTable.rowHeaders && featuresTable.rowHeaders[rIdx]) || `Row #${rIdx + 1}`}
                                  </th>
                                )}
                                {featuresTable.headers.map((_, colIdx) => (
                                  <td key={colIdx} style={{ border: '1px solid var(--cp-border)', padding: '6px' }}>
                                    {rowArr[colIdx] || ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Specifications */}
                  {specs.filter(s => s.key || s.value).length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Specifications:</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {specs.filter(s => s.key || s.value).map((s, i) => (
                          <div key={i} style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--cp-muted)' }}>{s.key || '—'}: </span>
                            <strong>{s.value || '—'}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
