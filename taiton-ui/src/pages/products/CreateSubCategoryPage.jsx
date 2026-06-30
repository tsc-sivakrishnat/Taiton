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
  const [parentCatId, setParentCatId] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [isIdEditedManually, setIsIdEditedManually] = useState(false);
  const [subCategoryName, setSubCategoryName] = useState('');
  const [url, setUrl] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [subcategoryImage, setSubcategoryImage] = useState('');
  const [imageAltText, setImageAltText] = useState('');
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
        const res = await enterpriseApi.contentList(token, 'category');
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
          const res = await enterpriseApi.contentList(token, 'subcategory');
          const subcategoryItem = res.items?.find((item) => String(item.id) === String(editId));
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

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!parentCatId || !subCatId.trim() || !subCategoryName.trim()) {
      notify.formWarning('Parent Category, Sub Category ID and Sub Category Name are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sub_cat_id: subCatId.trim(),
        parent_cat_id: parentCatId,
        url: url.trim() || null,
        seo_meta_title: seoTitle.trim() || null,
        seo_meta_description: seoDesc.trim() || null,
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        related_products: relatedProducts.trim() || null,
        image_alt_text: null,
        subcategory_image: null,
        og_title: ogTitle.trim() || null,
        og_description: ogDesc.trim() || null,
        og_image: ogImage.trim() || null,
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
      navigate('/app/products');
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
          <p className="cp-muted">Configure parent link relations, URLs, SEO options, and sharing previews.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <div className="cp-field">
              <span className="cp-field-label-text">Parent Category <span className="cp-req">*</span></span>
              <SearchableSelect
                options={categoryOptions}
                value={parentCatId}
                onChange={(val) => setParentCatId(val)}
                placeholder={loading ? 'Loading categories…' : '-- Search & Select Category --'}
                disabled={loading}
              />
            </div>

            <label className="cp-field">
              <span className="cp-field-label-text">Sub Category Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={subCategoryName}
                onChange={handleNameChange}
                placeholder="e.g. Hinges"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Sub Category ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={subCatId}
                onChange={handleIdChange}
                placeholder="e.g. subcat-hinges"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">URL Route Path</span>
              <input
                type="text"
                className="cp-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. /products/hinges"
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
              {submitting ? 'Saving Sub Category…' : editId ? 'Update Sub Category' : 'Submit Sub Category'}
            </button>
          </div>

        </form>
      </section>
    </div>
  );
}
