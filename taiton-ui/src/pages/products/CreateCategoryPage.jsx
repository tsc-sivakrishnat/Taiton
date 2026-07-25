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

  useEffect(() => {
    if (editId && token) {
      const loadCategoryDetails = async () => {
        try {
          const res = await enterpriseApi.contentDetail(token, 'category', editId);
          const categoryItem = res.item;
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

  const onSubmit = async (e, redirectOpt = null) => {
    if (e) e.preventDefault();
    if (!token) return;

    // Perform custom validation
    const newErrors = {};
    if (!categoryName.trim()) {
      newErrors.categoryName = 'Category Name is required.';
    } else if (categoryName.trim().length > 190) {
      newErrors.categoryName = 'Category Name must not exceed 190 characters.';
    }
    if (!catId.trim()) {
      newErrors.catId = 'Category ID is required.';
    } else if (catId.trim().length > 64) {
      newErrors.catId = 'Category ID must not exceed 64 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.formWarning('Please fix the validation errors.');
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      // Client-side uniqueness check for Category ID
      const catRes = await enterpriseApi.contentList(token, 'category', { q: catId.trim() });
      const cats = catRes.items ?? [];
      const duplicate = cats.find(c =>
        c.payload?.cat_id?.trim().toLowerCase() === catId.trim().toLowerCase() &&
        String(c.id) !== String(editId || '')
      );
      if (duplicate) {
        const errMsg = `Category ID "${catId.trim()}" already exists. Please choose a unique ID.`;
        setErrors({ catId: errMsg });
        notify.formWarning(errMsg);
        setSubmitting(false);
        return;
      }

      const payload = {
        cat_id: catId.trim(),
        seo_meta_title: seoTitle.trim() || null,
        seo_meta_description: seoDesc.trim() || null,
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        category_image: categoryImage.trim() || null,
        image_alt_text: imageAltText.trim() || null,
        related_products: relatedProducts.trim() || null,
        og_title: null,
        og_description: null,
        og_image: null,
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

      if (redirectOpt === 'add_subcategory') {
        navigate(`/app/products/create-subcategory?parent_cat_id=${catId.trim()}`);
      } else {
        navigate('/app/products');
      }
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
          <p className="cp-muted">Configure category attributes and SEO meta tags.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="cp-grid cp-grid-3" style={{ marginBottom: '20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">Category Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={categoryName}
                onChange={handleNameChange}
                placeholder="e.g. Electronics"
                maxLength={190}
                required
              />
              {errors.categoryName && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.categoryName}</span>}
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Category ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={catId}
                onChange={handleIdChange}
                placeholder="e.g. cat-electronics"
                maxLength={64}
                required
              />
              {errors.catId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.catId}</span>}
            </label>

            <div className="cp-field">
              <span className="cp-field-label-text">Category Image</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                {categoryImage && (
                  <img
                    src={resolveImageUrl(categoryImage)}
                    alt="Category Preview"
                    style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                  />
                )}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="cp-input"
                    style={{ width: '100%', paddingRight: '110px' }}
                    value={categoryImage}
                    readOnly
                    placeholder="No image uploaded"
                  />
                  <input
                    type="file"
                    id="cat-img-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={() => document.getElementById('cat-img-file').click()}
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
          </div>

          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>

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
                {submitting ? 'Saving Category…' : editId ? 'Update Category' : 'Submit Category'}
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
                        onSubmit(e, 'add_subcategory');
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
                      Submit & Add Subcategory
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </form>
      </section>
    </div>
  );
}
