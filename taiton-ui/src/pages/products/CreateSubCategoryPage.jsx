import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { SearchableSelect } from '../../components/SearchableSelect.jsx';
import { notify } from '../../utils/notify.js';
import { emitUnreadRefresh } from '../../utils/events.js';
import { RelatedProductsSelect } from '../../components/RelatedProductsSelect.jsx';

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

export function CreateSubCategoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  const [categories, setCategories] = useState([]);
  const [parentCatId, setParentCatId] = useState(searchParams.get('parent_cat_id') || '');
  const [subCatId, setSubCatId] = useState('');
  const [isIdEditedManually, setIsIdEditedManually] = useState(false);
  const [subCategoryName, setSubCategoryName] = useState('');
  const [url, setUrl] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [subcategoryImage, setSubcategoryImage] = useState('');
  const [imageAltText, setImageAltText] = useState('');
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

  const slugify = (text) => {
    return 'subcat-' + String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setSubCategoryName(val);
    if (!isIdEditedManually) {
      setSubCatId(slugify(val));
    }
  };

  const handleIdChange = (e) => {
    setSubCatId(e.target.value);
    setIsIdEditedManually(true);
  };

  useEffect(() => {
    async function loadCategories() {
      if (!token) return;
      setLoading(true);
      try {
        const res = await enterpriseApi.contentList(token, 'category', { limit: 100 });
        setCategories(res.items ?? []);
      } catch (err) {
        notify.apiError(err, 'Failed to load categories');
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, [token]);

  useEffect(() => {
    if (editId && token) {
      const loadSubcategoryDetails = async () => {
        try {
          const res = await enterpriseApi.contentDetail(token, 'subcategory', editId);
          const subcategoryItem = res.item;
          if (subcategoryItem) {
            const p = subcategoryItem.payload || {};
            setSubCatId(p.sub_cat_id || '');
            setParentCatId(p.parent_cat_id || '');
            setSubCategoryName(subcategoryItem.title || '');
            setUrl(p.url || '');
            setRelatedProducts(p.related_products || '');
            setSubcategoryImage(p.subcategory_image || '');
            setImageAltText(p.image_alt_text || '');
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
          notify.error('Error loading subcategory details', e.message);
        }
      };
      loadSubcategoryDetails();
    }
  }, [editId, token]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setSubcategoryImage(res.url);
      notify.success('Uploaded', 'Image uploaded successfully!');
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
      notify.apiError(err, 'OG image upload failed');
    }
  };

  const onSubmit = async (e, redirectOpt = null) => {
    if (e) e.preventDefault();
    if (!token) return;

    // Perform custom validation
    const newErrors = {};
    if (!parentCatId) newErrors.parentCatId = 'Parent Category is required.';
    if (!subCategoryName.trim()) {
      newErrors.subCategoryName = 'Sub Category Name is required.';
    } else if (subCategoryName.trim().length > 190) {
      newErrors.subCategoryName = 'Sub Category Name must not exceed 190 characters.';
    }
    if (!subCatId.trim()) {
      newErrors.subCatId = 'Sub Category ID is required.';
    } else if (subCatId.trim().length > 64) {
      newErrors.subCatId = 'Sub Category ID must not exceed 64 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.formWarning('Please fix the validation errors.');
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      // Uniqueness check for Subcategory ID
      const subRes = await enterpriseApi.contentList(token, 'subcategory', { q: subCatId.trim() });
      const subs = subRes.items ?? [];
      const duplicate = subs.find(s =>
        s.payload?.sub_cat_id?.trim().toLowerCase() === subCatId.trim().toLowerCase() &&
        String(s.id) !== String(editId || '')
      );
      if (duplicate) {
        const errMsg = `Sub Category ID "${subCatId.trim()}" already exists. Please choose a unique ID.`;
        setErrors({ subCatId: errMsg });
        notify.formWarning(errMsg);
        setSubmitting(false);
        return;
      }
      const slugify = (text) => {
        return String(text || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      };

      const payload = {
        sub_cat_id: subCatId.trim(),
        parent_cat_id: parentCatId,
        url: `/subcategory/${slugify(subCategoryName)}`,
        seo_meta_title: seoTitle.trim() || null,
        seo_meta_description: seoDesc.trim() || null,
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        related_products: relatedProducts.trim() || null,
        image_alt_text: null,
        subcategory_image: null,
        og_title: null,
        og_description: null,
        og_image: null,
      };

      const res = editId
        ? await enterpriseApi.contentUpdate(token, 'subcategory', editId, {
          title: subCategoryName.trim(),
          summary: seoDesc.trim() || subCategoryName.trim(),
          payload,
        })
        : await enterpriseApi.contentCreate(token, 'subcategory', {
          title: subCategoryName.trim(),
          summary: seoDesc.trim() || subCategoryName.trim(),
          payload,
        });

      notify.success((res.item || res)?.status === 'pending_approval' ? 'Submitted for Approval' : 'Sub Category Saved', (res.item || res)?.message ?? 'Sub Category has been saved.');
      emitUnreadRefresh();

      if (redirectOpt === 'add_product') {
        navigate(`/app/products/create-product?cat_id=${parentCatId}&sub_cat_id=${subCatId.trim()}`);
      } else {
        navigate('/app/products');
      }
    } catch (err) {
      notify.apiError(err, editId ? 'Failed to update subcategory' : 'Failed to create subcategory');
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

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="Products" parentUrl="/app/products" current={editId ? "Edit Sub Category" : "Create Sub Category"} />

      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Sub Category" : "Add Sub Category"}</h1>
          <p className="cp-muted">Configure parent link relations, SEO options and related products.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="cp-grid cp-grid-3" style={{ marginBottom: '20px' }}>
            <div className="cp-field">
              <span className="cp-field-label-text">Parent Category <span className="cp-req">*</span></span>
              <SearchableSelect
                options={categoryOptions}
                value={parentCatId}
                onChange={(val) => setParentCatId(val)}
                placeholder={loading ? 'Loading categories…' : '-- Search & Select Category --'}
                disabled={loading}
              />
              {errors.parentCatId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.parentCatId}</span>}
            </div>

            <label className="cp-field">
              <span className="cp-field-label-text">Sub Category Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={subCategoryName}
                onChange={handleNameChange}
                placeholder="e.g. Hinges"
                maxLength={190}
                required
              />
              {errors.subCategoryName && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.subCategoryName}</span>}
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Sub Category ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={subCatId}
                onChange={handleIdChange}
                placeholder="e.g. subcat-hinges"
                maxLength={64}
                required
              />
              {errors.subCatId && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.subCatId}</span>}
            </label>
          </div>

          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>





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
                {submitting ? 'Saving Sub Category…' : editId ? 'Update Sub Category' : 'Submit Sub Category'}
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
                        onSubmit(e, 'add_product');
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
                      Submit & Add Product
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
