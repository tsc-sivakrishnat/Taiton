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
  const [productId, setProductId] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantSlug, setVariantSlug] = useState('');
  const [variantCode, setVariantCode] = useState('');
  const [colorFinish, setColorFinish] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  const [variantTitle, setVariantTitle] = useState('');
  const [variantSeoTitle, setVariantSeoTitle] = useState('');
  const [variantSeoDesc, setVariantSeoDesc] = useState('');
  const [variantOrder, setVariantOrder] = useState('0');
  const [status, setStatus] = useState('draft');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      enterpriseApi.contentList(token, 'product')
        .then((res) => setProductsList(res.items ?? []))
        .catch((err) => console.error('Failed to load products list:', err));
    }
  }, [token]);

  // Load editing details if editId is provided
  useEffect(() => {
    if (token && editId) {
      enterpriseApi.contentDetails(token, 'variant', editId)
        .then((res) => {
          const p = res.item?.payload || {};
          setVariantId(p.variant_id || '');
          setProductId(p.product_id || '');
          setVariantName(res.item?.title || p.variant_name || '');
          setVariantSlug(p.variant_slug || '');
          setVariantCode(p.variant_code || '');
          setColorFinish(p.color_finish || '');
          setSku(p.sku || '');
          setImageUrl(p.image_url || '');
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

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (!variantId.trim() || !productId.trim() || !variantName.trim()) {
      notify.formWarning('Variant ID, Product ID, and Variant Name are required.');
      return;
    }

    setSubmitting(true);
    try {
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
        variant_seo_title: null,
        variant_seo_description: null,
        variant_order: parseInt(variantOrder || '0', 10),
        status: 'draft',
        canonical_url: null,
        related_products: null,
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
          <p className="cp-muted">Configure variant specific attributes, order ranking, SEO properties, and sharing configs.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
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
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Parent Product <span className="cp-req">*</span></span>
              <SearchableSelect
                options={productOptions}
                value={productId}
                onChange={(val) => setProductId(val)}
                placeholder="Select Product ID reference"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="e.g. var-brass-hinge"
                required
              />
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
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Variant Code</span>
              <input
                type="text"
                className="cp-input"
                value={variantCode}
                onChange={(e) => setVariantCode(e.target.value)}
                placeholder="e.g. VC-001"
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
