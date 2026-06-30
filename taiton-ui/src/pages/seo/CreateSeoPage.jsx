import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
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

export function CreateSeoPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  // Form states
  const [pageName, setPageName] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [urlSlug, setUrlSlug] = useState('');
  const [h1Tag, setH1Tag] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [schemaType, setSchemaType] = useState('');
  const [robotsTag, setRobotsTag] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  const [status, setStatus] = useState('draft');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto generate URL Slug from Page Name if not editing
  useEffect(() => {
    if (!editId) {
      setUrlSlug(slugify(pageName));
    }
  }, [pageName, editId]);

  // Load editing details if editing
  useEffect(() => {
    if (token && editId) {
      enterpriseApi.contentDetails(token, 'seo_page', editId)
        .then((res) => {
          const p = res.item?.payload || {};
          setPageName(p.page_name || res.item?.title || '');
          setPageUrl(p.page_url || p.url || '');
          setUrlSlug(p.url_slug || '');
          setH1Tag(p.h1_tag || '');
          setSeoTitle(p.seo_meta_title || res.item?.summary || '');
          setSeoDesc(p.seo_meta_description || '');
          setFocusKeyword(p.focus_keyword || '');
          setSecondaryKeywords(p.secondary_keywords || '');
          setCanonicalUrl(p.canonical_url || '');
          setOgTitle(p.og_title || '');
          setOgDescription(p.og_description || '');
          setOgImage(p.og_image || '');
          setSchemaType(p.schema_type || '');
          setRobotsTag(p.robots_tag || '');
          setImageAltText(p.image_alt_text || '');
          setStatus(res.item?.status || p.status || 'draft');
          setRelatedProducts(p.related_products || '');
        })
        .catch((err) => notify.apiError(err, 'Failed to load SEO page details'));
    }
  }, [token, editId]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setOgImage(res.url);
      notify.success('Uploaded', 'OG Image uploaded successfully!');
    } catch (err) {
      notify.apiError(err, 'Image upload failed');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (!pageName.trim() || !pageUrl.trim() || !seoTitle.trim() || !seoDesc.trim()) {
      notify.formWarning('Page Name, URL, SEO Meta Title, and SEO Meta Description are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        page_name: pageName.trim(),
        page_url: pageUrl.trim(),
        url_slug: urlSlug.trim(),
        h1_tag: h1Tag.trim() || null,
        seo_meta_title: seoTitle.trim(),
        seo_meta_description: seoDesc.trim(),
        focus_keyword: focusKeyword.trim() || null,
        secondary_keywords: secondaryKeywords.trim() || null,
        canonical_url: canonicalUrl.trim() || null,
        og_title: ogTitle.trim() || null,
        og_description: ogDescription.trim() || null,
        og_image: ogImage.trim() || null,
        schema_type: schemaType.trim() || null,
        robots_tag: robotsTag.trim() || null,
        image_alt_text: imageAltText.trim() || null,
        status,
        related_products: relatedProducts.trim() || null,
      };

      if (editId) {
        await enterpriseApi.contentUpdate(token, 'seo_page', editId, {
          title: pageName.trim(),
          summary: seoTitle.trim(),
          payload,
        });
        notify.success('Updated', 'SEO Page configurations have been successfully updated.');
      } else {
        await enterpriseApi.contentCreate(token, 'seo_page', {
          title: pageName.trim(),
          summary: seoTitle.trim(),
          payload,
        });
        notify.success('Created', 'SEO Page configurations were successfully created.');
      }

      emitUnreadRefresh();
      navigate('/app/seo');
    } catch (err) {
      notify.apiError(err, 'Failed to save SEO parameters');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="SEO" parentUrl="/app/seo" current={editId ? "Edit Page SEO" : "Create Page SEO"} />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Page SEO" : "Add Page SEO"}</h1>
          <p className="cp-muted">Configure SEO page targets, keywords, social graphs, schema types, and metadata.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Page details */}
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">Page Name <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder="e.g. Home Page"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">URL / Route Path <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="e.g. /home or /contact-us"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">URL Slug <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={urlSlug}
                onChange={(e) => setUrlSlug(e.target.value)}
                placeholder="e.g. home"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">H1 Tag</span>
              <input
                type="text"
                className="cp-input"
                value={h1Tag}
                onChange={(e) => setH1Tag(e.target.value)}
                placeholder="Page main H1 heading text"
              />
            </label>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--cp-border)' }} />

          {/* Section 2: SEO Meta info */}
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">SEO Meta Title <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Meta title displayed on search engines"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">SEO Meta Description <span className="cp-req">*</span></span>
              <textarea
                className="cp-input"
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                placeholder="Snippet description displayed on search result pages"
                style={{ height: '40px', minHeight: '40px', resize: 'vertical' }}
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Focus Keyword</span>
              <input
                type="text"
                className="cp-input"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="Primary target keyword phrase"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Secondary Keywords</span>
              <input
                type="text"
                className="cp-input"
                value={secondaryKeywords}
                onChange={(e) => setSecondaryKeywords(e.target.value)}
                placeholder="Comma-separated secondary search phrases"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Canonical URL</span>
              <input
                type="text"
                className="cp-input"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="e.g. https://taiton.com/home"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Schema Type</span>
              <input
                type="text"
                className="cp-input"
                value={schemaType}
                onChange={(e) => setSchemaType(e.target.value)}
                placeholder="e.g. WebSite, WebPage, Article"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Robots Tag</span>
              <input
                type="text"
                className="cp-input"
                value={robotsTag}
                onChange={(e) => setRobotsTag(e.target.value)}
                placeholder="e.g. index, follow"
              />
            </label>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--cp-border)' }} />

          {/* Section 3: Open Graph / Social Sharing */}
          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">OG Title</span>
              <input
                type="text"
                className="cp-input"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="Social media sharing card title"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">OG Description</span>
              <textarea
                className="cp-input"
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                placeholder="Social media sharing card description snippet"
                style={{ height: '40px', minHeight: '40px', resize: 'vertical' }}
              />
            </label>

            <div className="cp-field">
              <span className="cp-field-label-text">OG Image</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                {ogImage && (
                  <img
                    src={resolveImageUrl(ogImage)}
                    alt="Preview"
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
                    placeholder="No image uploaded"
                  />
                  <input
                    type="file"
                    id="og-seo-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <button
                    type="button"
                    className="cp-btn cp-btn-primary"
                    onClick={() => document.getElementById('og-seo-file').click()}
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
              <span className="cp-field-label-text">OG Image Alt Text</span>
              <input
                type="text"
                className="cp-input"
                value={imageAltText}
                onChange={(e) => setImageAltText(e.target.value)}
                placeholder="Alt description of social sharing image"
              />
            </label>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--cp-border)' }} />

          {/* Section 4: Related Products multi-select */}
          <RelatedProductsSelect
            value={relatedProducts}
            onChange={(val) => setRelatedProducts(val)}
          />

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() => navigate('/app/seo')}
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
              {submitting ? 'Saving Configurations…' : editId ? 'Update SEO Page' : 'Create SEO Page'}
            </button>
          </div>

        </form>
      </section>
    </div>
  );
}
