import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { SearchableSelect } from '../../components/SearchableSelect.jsx';
import { RelatedProductsSelect } from '../../components/RelatedProductsSelect.jsx';
import { notify } from '../../utils/notify.js';
import { emitUnreadRefresh } from '../../utils/events.js';

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

export function CreateVariantPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  // Products list for selection
  const [productsList, setProductsList] = useState([]);

  // Form states
  const [variantId, setVariantId] = useState('');
  const [productId, setProductId] = useState(searchParams.get('product_id') || '');
  const [variantName, setVariantName] = useState('');
  const [variantSlug, setVariantSlug] = useState('');
  const [variantCode, setVariantCode] = useState('');
  const [colorFinish, setColorFinish] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [otherImages, setOtherImages] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [imageAltText, setImageAltText] = useState('');
  const [variantTitle, setVariantTitle] = useState('');
  const [variantSeoTitle, setVariantSeoTitle] = useState('');
  const [variantSeoDesc, setVariantSeoDesc] = useState('');
  const [variantOrder, setVariantOrder] = useState('0');
  const [status, setStatus] = useState('draft');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Auto-generate IDs on name change
  useEffect(() => {
    if (!editId) {
      const slug = slugify(variantName);
      setVariantId(slug ? `var-${slug}` : '');
      setVariantSlug(slug);
    }
  }, [variantName, editId]);

  // Load products list
  useEffect(() => {
    if (token) {
      enterpriseApi.contentList(token, 'product', { limit: 100 })
        .then((res) => setProductsList(res.items ?? []))
        .catch((err) => console.error('Failed to load products list:', err));
    }
  }, [token]);

  // Load editing details if editId is provided
  useEffect(() => {
    if (token && editId) {
      enterpriseApi.contentDetail(token, 'variant', editId)
        .then((res) => {
          const p = res.item?.payload || {};
          setVariantId(p.variant_id || '');
          setProductId(p.product_id || '');
          setVariantName(res.item?.title || p.variant_name || '');
          setVariantSlug(p.variant_slug || '');
          setVariantCode(p.variant_code || '');
          setColorFinish(p.color_finish || '');
          setSku(p.sku || '');
          setImageUrl(p.image_url || p.variant_image || '');
          setOtherImages(Array.isArray(p.other_images) ? p.other_images : []);
          setImageAltText(p.image_alt_text || '');
          setVariantTitle(p.variant_title || '');
          setVariantSeoTitle(p.variant_seo_title || '');
          setVariantSeoDesc(p.variant_seo_description || '');
          setVariantOrder(String(p.variant_order || '0'));
          setStatus(res.item?.status || p.status || 'draft');
          setCanonicalUrl(p.canonical_url || '');
          setRelatedProducts(p.related_products || '');
        })
        .catch((err) => notify.apiError(err, 'Failed to load variant details'));
    }
  }, [token, editId]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setImageUrl(res.url);
      notify.success('Uploaded', 'Variant image uploaded successfully!');
    } catch (err) {
      notify.apiError(err, 'Image upload failed');
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

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!token) return;

    // Perform custom validation
    const newErrors = {};
    if (!productId) newErrors.productId = 'Parent Product is required.';
    if (!variantName.trim()) {
      newErrors.variantName = 'Variant Name is required.';
    } else if (variantName.trim().length > 190) {
      newErrors.variantName = 'Variant Name must not exceed 190 characters.';
    }
    if (!variantId.trim()) {
      newErrors.variantId = 'Variant ID is required.';
    } else if (variantId.trim().length > 64) {
      newErrors.variantId = 'Variant ID must not exceed 64 characters.';
    }
    if (!variantSlug.trim()) {
      newErrors.variantSlug = 'Variant Slug is required.';
    }
    if (variantCode.trim().length > 64) {
      newErrors.variantCode = 'Variant Code must not exceed 64 characters.';
    }
    if (sku.trim().length > 64) {
      newErrors.sku = 'SKU must not exceed 64 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.formWarning('Please fix the validation errors.');
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      // Client-side uniqueness check for Variant ID
      const varRes = await enterpriseApi.contentList(token, 'variant', { q: variantId.trim() });
      const vars = varRes.items ?? [];
      const duplicate = vars.find(v =>
        v.payload?.variant_id?.trim().toLowerCase() === variantId.trim().toLowerCase() &&
        String(v.id) !== String(editId || '')
      );
      if (duplicate) {
        const errMsg = `Variant ID "${variantId.trim()}" already exists. Please choose a unique ID.`;
        setErrors({ variantId: errMsg });
        notify.formWarning(errMsg);
        setSubmitting(false);
        return;
      }
      const payload = {
        variant_id: variantId.trim(),
        product_id: productId.trim(),
        variant_name: variantName.trim(),
        variant_slug: variantSlug.trim(),
        variant_code: variantCode.trim() || null,
        color_finish: colorFinish.trim() || null,
        sku: sku.trim() || null,
        image_url: imageUrl.trim() || null,
        image_alt_text: imageAltText.trim() || null,
        variant_title: variantTitle.trim() || null,
        variant_seo_title: variantSeoTitle.trim() || null,
        variant_seo_description: variantSeoDesc.trim() || null,
        variant_order: parseInt(variantOrder || '0', 10),
        status,
        canonical_url: canonicalUrl.trim() || null,
        related_products: relatedProducts.trim() || null,
        other_images: otherImages,
      };

      if (editId) {
        await enterpriseApi.contentUpdate(token, 'variant', editId, {
          title: variantName.trim(),
          summary: variantTitle.trim() || variantName.trim(),
          payload,
        });
        notify.success('Updated', 'Variant has been successfully updated.');
      } else {
        await enterpriseApi.contentCreate(token, 'variant', {
          title: variantName.trim(),
          summary: variantTitle.trim() || variantName.trim(),
          payload,
        });
        notify.success('Created', 'Variant was created successfully.');
      }

      emitUnreadRefresh();
      navigate('/app/products');
    } catch (err) {
      notify.apiError(err, 'Failed to save variant information');
    } finally {
      setSubmitting(false);
    }
  };

  const productOptions = productsList.map((p) => ({
    value: p.payload?.prd_id || '',
    label: `${p.title} (${p.payload?.prd_id || 'No ID'})`
  }));

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="Products" parentUrl="/app/products" current={editId ? "Edit Variant" : "Create Variant"} />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Variant" : "Add Variant"}</h1>
          <p className="cp-muted">Configure variant specific attributes, order ranking and SEO properties.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Main Info */}
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">Variant Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="e.g. Brass Finish Hinge"
                maxLength={190}
                required
              />
              {errors.variantName && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.variantName}</span>}
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Parent Product <span className="cp-req">*</span></span>
              <SearchableSelect
                options={productOptions}
                value={productId}
                onChange={(val) => setProductId(val)}
                placeholder="Select Product ID reference"
              />
              {errors.productId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.productId}</span>}
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="e.g. var-brass-hinge"
                maxLength={64}
                required
              />
              {errors.variantId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.variantId}</span>}
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant Slug <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={variantSlug}
                onChange={(e) => setVariantSlug(e.target.value)}
                placeholder="e.g. brass-finish-hinge"
                required
              />
              {errors.variantSlug && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.variantSlug}</span>}
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant Code</span>
              <input
                type="text"
                className="cp-input"
                value={variantCode}
                onChange={(e) => setVariantCode(e.target.value)}
                placeholder="e.g. VC-001"
                maxLength={64}
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Color / Finish</span>
              <input
                type="text"
                className="cp-input"
                value={colorFinish}
                onChange={(e) => setColorFinish(e.target.value)}
                placeholder="e.g. Antique Brass"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">SKU</span>
              <input
                type="text"
                className="cp-input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. SKU-BR-HINGE"
                maxLength={64}
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant Title</span>
              <input
                type="text"
                className="cp-input"
                value={variantTitle}
                onChange={(e) => setVariantTitle(e.target.value)}
                placeholder="Display title for variant"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant Order</span>
              <input
                type="number"
                className="cp-input"
                value={variantOrder}
                onChange={(e) => setVariantOrder(e.target.value)}
                placeholder="e.g. 0"
              />
            </label>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--cp-border)' }} />

          {/* Media Section */}
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <div className="cp-field">
              <span className="cp-field-label-text">Image File</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                {imageUrl && (
                  <img
                    src={resolveImageUrl(imageUrl)}
                    alt="Preview"
                    style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                  />
                )}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="cp-input"
                    style={{ width: '100%', paddingRight: '110px' }}
                    value={imageUrl}
                    readOnly
                    placeholder="No image uploaded"
                  />
                  <input
                    type="file"
                    id="var-img-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={() => document.getElementById('var-img-file').click()}
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
              <span className="cp-field-label-text">Image Alt Text</span>
              <input
                type="text"
                className="cp-input"
                value={imageAltText}
                onChange={(e) => setImageAltText(e.target.value)}
                placeholder="Alt description of image"
              />
            </label>

            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--cp-border)' }}>
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
                  onClick={() => document.getElementById('var-other-img-file').click()}
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
                  id="var-other-img-file"
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleOtherImageUpload}
                  multiple
                />
              </div>
            </div>
          </div>



          {/* Submit Action */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() => navigate('/app/products')}
              disabled={submitting}
              style={{ minHeight: '44px', width: '120px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cp-btn cp-btn-primary"
              disabled={submitting}
              style={{ minHeight: '44px', width: '200px' }}
            >
              {submitting ? 'Saving Variant…' : editId ? 'Update Variant' : 'Create Variant'}
            </button>
          </div>

        </form>
      </section>
    </div>
  );
}
