import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { notify } from '../../utils/notify.js';
import { emitUnreadRefresh } from '../../utils/events.js';
import { RelatedProductsSelect } from '../../components/RelatedProductsSelect.jsx';

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

export function CreateCategoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  const [catId, setCatId] = useState('');
  const [isIdEditedManually, setIsIdEditedManually] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // SEO & OG fields
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDesc, setOgDesc] = useState('');
  const [ogImage, setOgImage] = useState('');

  useEffect(() => {
    if (editId && token) {
      const loadCategoryDetails = async () => {
        try {
          const res = await enterpriseApi.contentList(token, 'category');
          const categoryItem = res.items?.find((item) => String(item.id) === String(editId));
          if (categoryItem) {
            const p = categoryItem.payload || {};
            setCatId(p.cat_id || '');
            setCategoryName(categoryItem.title || '');
            setCategoryImage(p.category_image || '');
            setImageAltText(p.image_alt_text || '');
            setRelatedProducts(p.related_products || '');
            setSeoTitle(p.seo_meta_title || '');
            setSeoDesc(p.seo_meta_description || '');
            setFocusKeyword(p.focus_keyword || '');
            setSecondaryKeywords(p.secondary_keywords || '');
            setOgTitle(p.og_title || '');
            setOgDesc(p.og_description || '');
            setOgImage(p.og_image || '');
            setIsIdEditedManually(true);
          }
        } catch (e) {
          notify.error('Error loading category details', e.message);
        }
      };
      loadCategoryDetails();
    }
  }, [editId, token]);

  const slugify = (text) => {
    return 'cat-' + String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setCategoryName(val);
    if (!isIdEditedManually) {
      setCatId(slugify(val));
    }
  };

  const handleIdChange = (e) => {
    setCatId(e.target.value);
    setIsIdEditedManually(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setCategoryImage(res.url);
      notify.success('Uploaded', 'Category image uploaded successfully!');
    } catch (err) {
      notify.apiError(err, 'Image upload failed');
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
      notify.apiError(err, 'Image upload failed');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!catId.trim() || !categoryName.trim()) {
      notify.formWarning('Category ID and Category Name are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        cat_id: catId.trim(),
        seo_meta_title: seoTitle.trim() || null,
        seo_meta_description: seoDesc.trim() || null,
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        category_image: null,
        image_alt_text: null,
        related_products: relatedProducts.trim() || null,
        og_title: ogTitle.trim() || null,
        og_description: ogDesc.trim() || null,
        og_image: ogImage.trim() || null,
      };

      const res = editId
        ? await enterpriseApi.contentUpdate(token, 'category', editId, {
            title: categoryName.trim(),
            summary: seoDesc.trim() || categoryName.trim(),
            payload,
          })
        : await enterpriseApi.contentCreate(token, 'category', {
            title: categoryName.trim(),
            summary: seoDesc.trim() || categoryName.trim(),
            payload,
          });

      notify.success((res.item || res)?.status === 'pending_approval' ? 'Submitted for Approval' : 'Category Saved', (res.item || res)?.message ?? 'Category has been saved.');
      emitUnreadRefresh();
      navigate('/app/products');
    } catch (err) {
      notify.apiError(err, editId ? 'Failed to update category' : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="Products" parentUrl="/app/products" current={editId ? "Edit Category" : "Create Category"} />
      
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Category" : "Add Category"}</h1>
          <p className="cp-muted">Configure category attributes, SEO meta tags, and open graph sharing previews.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">Category Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={categoryName}
                onChange={handleNameChange}
                placeholder="e.g. Electronics"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Category ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={catId}
                onChange={handleIdChange}
                placeholder="e.g. cat-electronics"
                required
              />
            </label>



            <RelatedProductsSelect
              value={relatedProducts}
              onChange={(val) => setRelatedProducts(val)}
            />

            <label className="cp-field">
              <span className="cp-field-label-text">SEO Meta Title</span>
              <input
                type="text"
                className="cp-input"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Display title for search engine queries"
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

            <label className="cp-field cp-field--full">
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
              {submitting ? 'Saving Category…' : editId ? 'Update Category' : 'Submit Category'}
            </button>
          </div>

        </form>
      </section>
    </div>
  );
}
