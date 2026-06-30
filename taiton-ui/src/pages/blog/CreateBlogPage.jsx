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

export function CreateBlogPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  // Form states
  const [blogId, setBlogId] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [url, setUrl] = useState('');
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
  const [schemaType, setSchemaType] = useState('Article');
  const [robotsTag, setRobotsTag] = useState('index, follow');
  const [imageAltText, setImageAltText] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [blogCategory, setBlogCategory] = useState('');
  const [readingTime, setReadingTime] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [modifiedDate, setModifiedDate] = useState('');
  const [internalLinking, setInternalLinking] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [status, setStatus] = useState('draft');
  const [submitting, setSubmitting] = useState(false);

  // Dynamic FAQs
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }]);

  useEffect(() => {
    if (editId && token) {
      const loadBlogDetails = async () => {
        try {
          const res = await enterpriseApi.contentList(token, 'blog');
          const blogItem = res.items?.find((item) => String(item.id) === String(editId));
          if (blogItem) {
            const p = blogItem.payload || {};
            setBlogId(p.blog_id || '');
            setBlogTitle(blogItem.title || '');
            setUrl(p.url || '');
            setUrlSlug(p.url_slug || '');
            setH1Tag(p.h1_tag || '');
            setSeoTitle(p.seo_meta_title || '');
            setSeoDesc(p.seo_meta_description || '');
            setFocusKeyword(p.focus_keyword || '');
            setSecondaryKeywords(p.secondary_keywords || '');
            setCanonicalUrl(p.canonical_url || '');
            setOgTitle(p.og_title || '');
            setOgDescription(p.og_description || '');
            setOgImage(p.og_image || '');
            setSchemaType(p.schema_type || 'Article');
            setRobotsTag(p.robots_tag || 'index, follow');
            setImageAltText(p.image_alt_text || '');
            setBlogContent(p.blog_content || '');
            setAuthorName(p.author_name || '');
            setBlogCategory(p.blog_category || '');
            setReadingTime(p.reading_time || '');
            setFeaturedImage(p.featured_image || '');
            if (p.publish_date) setPublishDate(p.publish_date.replace(' ', 'T').slice(0, 16));
            if (p.modified_date) setModifiedDate(p.modified_date.replace(' ', 'T').slice(0, 16));
            setInternalLinking(p.internal_linking_targets || '');
            setRelatedProducts(p.related_products || '');
            setRedirectUrl(p.redirect_url_301 || '');
            if (p.last_updated_date) setLastUpdated(p.last_updated_date.replace(' ', 'T').slice(0, 16));
            setStatus(blogItem.status || 'draft');
            if (Array.isArray(p.faq_section)) {
              setFaqs(p.faq_section.length > 0 ? p.faq_section : [{ question: '', answer: '' }]);
            }
          }
        } catch (e) {
          notify.error('Error loading blog details', e.message);
        }
      };
      loadBlogDetails();
    }
  }, [editId, token]);

  const handleImageUpload = async (e, setImageField) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const res = await enterpriseApi.uploadImage(token, file);
      setImageField(res.url);
      notify.success('Uploaded', 'Image uploaded successfully!');
    } catch (err) {
      notify.apiError(err, 'Image upload failed');
    }
  };

  const addFaqRow = () => setFaqs([...faqs, { question: '', answer: '' }]);
  const removeFaqRow = (idx) => setFaqs(faqs.filter((_, i) => i !== idx));
  const updateFaqRow = (idx, field, value) => {
    const updated = [...faqs];
    updated[idx][field] = value;
    setFaqs(updated);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!blogId.trim() || !blogTitle.trim() || !urlSlug.trim() || !seoTitle.trim() || !seoDesc.trim() || !blogContent.trim()) {
      notify.formWarning('Blog ID, Title, URL Slug, SEO Title, Description, and Content are required.');
      return;
    }
    setSubmitting(true);
    try {
      // Filter FAQs
      const faqList = faqs.map(f => ({ question: f.question.trim(), answer: f.answer.trim() })).filter(f => f.question && f.answer);

      const payload = {
        blog_id: blogId.trim(),
        url: url.trim() || null,
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
        blog_content: blogContent.trim(),
        author_name: authorName.trim() || null,
        blog_category: blogCategory.trim() || null,
        reading_time: readingTime.trim() || null,
        featured_image: featuredImage.trim() || null,
        publish_date: publishDate ? new Date(publishDate).toISOString().slice(0, 19).replace('T', ' ') : null,
        modified_date: modifiedDate ? new Date(modifiedDate).toISOString().slice(0, 19).replace('T', ' ') : null,
        faq_section: faqList,
        internal_linking_targets: internalLinking.trim() || null,
        related_products: relatedProducts.trim() || null,
        redirect_url_301: redirectUrl.trim() || null,
        last_updated_date: lastUpdated ? new Date(lastUpdated).toISOString().slice(0, 19).replace('T', ' ') : null,
        status,
      };

      const res = editId
        ? await enterpriseApi.contentUpdate(token, 'blog', editId, {
            title: blogTitle.trim(),
            summary: seoDesc.trim().slice(0, 150) || blogTitle.trim(),
            payload,
          })
        : await enterpriseApi.contentCreate(token, 'blog', {
            title: blogTitle.trim(),
            summary: seoDesc.trim().slice(0, 150) || blogTitle.trim(),
            payload,
          });

      notify.success((res.item || res)?.status === 'pending_approval' ? 'Submitted for Approval' : 'Blog Post Saved', (res.item || res)?.message ?? 'Blog post has been saved.');
      emitUnreadRefresh();
      navigate('/app/blog');
    } catch (err) {
      notify.apiError(err, editId ? 'Failed to update blog post' : 'Failed to create blog post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="Blogs" parentUrl="/app/blog" current={editId ? "Edit Blog Post" : "Create Blog Post"} />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Blog Post" : "Add Blog Post"}</h1>
          <p className="cp-muted">Configure article headers, body content, categories, reading times, and meta tags.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} className="cp-grid cp-grid-2">
          {/* Core Info */}
          <label className="cp-field">
            <span className="cp-field-label-text">Blog ID <span className="cp-req">*</span></span>
            <input
              type="text"
              className="cp-input"
              value={blogId}
              onChange={(e) => setBlogId(e.target.value)}
              placeholder="e.g. blog-new-trends"
              required
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Blog Title <span className="cp-req">*</span></span>
            <input
              type="text"
              className="cp-input"
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
              placeholder="Article Heading"
              required
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">URL (Full Link)</span>
            <input
              type="text"
              className="cp-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /blog/trends"
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">URL Slug <span className="cp-req">*</span></span>
            <input
              type="text"
              className="cp-input"
              value={urlSlug}
              onChange={(e) => setUrlSlug(e.target.value)}
              placeholder="e.g. trends"
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
              placeholder="H1 tag on page"
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Author Name</span>
            <input
              type="text"
              className="cp-input"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Jane Doe"
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Blog Category</span>
            <input
              type="text"
              className="cp-input"
              value={blogCategory}
              onChange={(e) => setBlogCategory(e.target.value)}
              placeholder="Hardware / Design"
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Reading Time</span>
            <input
              type="text"
              className="cp-input"
              value={readingTime}
              onChange={(e) => setReadingTime(e.target.value)}
              placeholder="e.g. 5 mins"
            />
          </label>

          {/* SEO Details */}
          <label className="cp-field">
            <span className="cp-field-label-text">SEO Meta Title <span className="cp-req">*</span></span>
            <input
              type="text"
              className="cp-input"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Display search title tag"
              required
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Canonical URL</span>
            <input
              type="text"
              className="cp-input"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              placeholder="https://example.com/blog/..."
            />
          </label>

          <label className="cp-field cp-field--full">
            <span className="cp-field-label-text">SEO Meta Description <span className="cp-req">*</span></span>
            <textarea
              className="cp-input"
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
              placeholder="Snippet description for search results"
              rows={3}
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
              placeholder="Primary target keyword"
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

          {/* OG details */}
          <label className="cp-field">
            <span className="cp-field-label-text">OG Title</span>
            <input
              type="text"
              className="cp-input"
              value={ogTitle}
              onChange={(e) => setOgTitle(e.target.value)}
              placeholder="Social share title"
            />
          </label>

          <label className="cp-field cp-field--full">
            <span className="cp-field-label-text">OG Description</span>
            <textarea
              className="cp-input"
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
              placeholder="Social share description summary"
              rows={2}
            />
          </label>

          <div className="cp-field">
            <span className="cp-field-label-text">Featured Image</span>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {featuredImage && (
                <img
                  src={resolveImageUrl(featuredImage)}
                  alt="Featured Preview"
                  style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--cp-border)' }}
                />
              )}
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  className="cp-input"
                  style={{ width: '100%', paddingRight: '110px' }}
                  value={featuredImage}
                  readOnly
                  placeholder="No image uploaded"
                />
                <input
                  type="file"
                  id="feat-img-file"
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, setFeaturedImage)}
                />
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => document.getElementById('feat-img-file').click()}
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
                  placeholder="No image uploaded"
                />
                <input
                  type="file"
                  id="og-blog-file"
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, setOgImage)}
                />
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => document.getElementById('og-blog-file').click()}
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
              placeholder="Alt text for screen readers"
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Schema Type</span>
            <input
              type="text"
              className="cp-input"
              value={schemaType}
              onChange={(e) => setSchemaType(e.target.value)}
              placeholder="e.g. Article"
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

          <div className="cp-field" />

          {/* Dates */}
          <label className="cp-field">
            <span className="cp-field-label-text">Publish Date</span>
            <input
              type="datetime-local"
              className="cp-input"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Modified Date</span>
            <input
              type="datetime-local"
              className="cp-input"
              value={modifiedDate}
              onChange={(e) => setModifiedDate(e.target.value)}
            />
          </label>

          <label className="cp-field">
            <span className="cp-field-label-text">Last Updated Date</span>
            <input
              type="datetime-local"
              className="cp-input"
              value={lastUpdated}
              onChange={(e) => setLastUpdated(e.target.value)}
            />
          </label>

          <div className="cp-field" />

          {/* Linking / Related / Status */}
          <label className="cp-field">
            <span className="cp-field-label-text">Internal Linking Targets</span>
            <input
              type="text"
              className="cp-input"
              value={internalLinking}
              onChange={(e) => setInternalLinking(e.target.value)}
              placeholder="e.g. /home, /about"
            />
          </label>

            <RelatedProductsSelect
              value={relatedProducts}
              onChange={(val) => setRelatedProducts(val)}
            />

          <label className="cp-field cp-field--full">
            <span className="cp-field-label-text">Redirect URL (301)</span>
            <input
              type="text"
              className="cp-input"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="e.g. /old-blog/post"
            />
          </label>

          {/* Blog Content */}
          <label className="cp-field cp-field--full">
            <span className="cp-field-label-text">Blog Content (HTML allowed) <span className="cp-req">*</span></span>
            <textarea
              className="cp-input"
              value={blogContent}
              onChange={(e) => setBlogContent(e.target.value)}
              placeholder="<p>Body copy here...</p>"
              rows={8}
              required
            />
          </label>

          {/* FAQ builder */}
          <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
            <span className="cp-field-label-text" style={{ fontSize: '14px', marginBottom: '12px' }}>FAQ Section</span>
            {faqs.map((faq, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className="cp-input"
                  style={{ flex: 1 }}
                  value={faq.question}
                  onChange={(e) => updateFaqRow(idx, 'question', e.target.value)}
                  placeholder="Question text"
                />
                <input
                  className="cp-input"
                  style={{ flex: 1 }}
                  value={faq.answer}
                  onChange={(e) => updateFaqRow(idx, 'answer', e.target.value)}
                  placeholder="Answer text"
                />
                {faqs.length > 1 && (
                  <button
                    type="button"
                    className="cp-btn cp-btn-secondary"
                    onClick={() => removeFaqRow(idx)}
                    style={{ color: 'red', borderColor: '#fca5a5' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={addFaqRow}
            >
              + Add FAQ Item
            </button>
          </div>

          <label className="cp-field">
            <span className="cp-field-label-text">Status</span>
            <select
              className="cp-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="live">Published</option>
            </select>
          </label>

          <div className="cp-field">
            <span className="cp-field-label-text" style={{ visibility: 'hidden' }}>Submit</span>
            <button
              type="submit"
              className="cp-btn cp-btn-primary"
              disabled={submitting}
              style={{ height: '42px', width: '100%', whiteSpace: 'nowrap' }}
            >
              {submitting ? 'Saving Article…' : editId ? 'Update Article' : 'Submit Article'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
