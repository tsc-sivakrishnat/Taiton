import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import { enterpriseApi } from '../../api/enterpriseApi.js';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';
import { notify } from '../../utils/notify.js';
import { emitUnreadRefresh } from '../../utils/events.js';

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return new URL(path, base).toString();
};

export function CreateCareerPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');

  // Form states
  const [jobId, setJobId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('Full Time');
  const [experience, setExperience] = useState('');
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [status, setStatus] = useState('draft');
  const [submitting, setSubmitting] = useState(false);

  // Dynamic requirements list
  const [requirements, setRequirements] = useState(['']);

  useEffect(() => {
    if (editId && token) {
      const loadJobDetails = async () => {
        try {
          const res = await enterpriseApi.contentDetail(token, 'career', editId);
          const jobItem = res.item;
          if (jobItem) {
            const p = jobItem.payload || {};
            setJobId(p.job_id || '');
            setJobTitle(jobItem.title || '');
            setDepartment(p.department || '');
            setLocation(p.location || '');
            setEmploymentType(p.employment_type || 'Full Time');
            setExperience(p.experience || '');
            setDescription(p.description || '');
            setSeoTitle(p.seo_meta_title || '');
            setSeoDesc(p.seo_meta_description || '');
            setFocusKeyword(p.focus_keyword || '');
            setCanonicalUrl(p.canonical_url || '');
            setOgTitle(p.og_title || '');
            setOgDescription(p.og_description || '');
            setOgImage(p.og_image || '');
            setStatus(jobItem.status || 'draft');
            if (Array.isArray(p.requirements)) {
              setRequirements(p.requirements.length > 0 ? p.requirements : ['']);
            }
          }
        } catch (e) {
          notify.error('Error loading career details', e.message);
        }
      };
      loadJobDetails();
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

  const addRequirement = () => setRequirements([...requirements, '']);
  const removeRequirement = (idx) => setRequirements(requirements.filter((_, i) => i !== idx));
  const updateRequirement = (idx, value) => {
    const updated = [...requirements];
    updated[idx] = value;
    setRequirements(updated);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!jobId.trim() || !jobTitle.trim() || !seoTitle.trim() || !seoDesc.trim() || !description.trim()) {
      notify.formWarning('Job ID, Title, SEO Title, Description, and Details are required.');
      return;
    }
    setSubmitting(true);
    try {
      const reqList = requirements.map(r => r.trim()).filter(Boolean);

      const payload = {
        job_id: jobId.trim(),
        department: department.trim(),
        location: location.trim(),
        employment_type: employmentType,
        experience: experience.trim(),
        description: description.trim(),
        requirements: reqList,
        seo_meta_title: seoTitle.trim(),
        seo_meta_description: seoDesc.trim(),
        focus_keyword: focusKeyword.trim() || null,
        canonical_url: canonicalUrl.trim() || null,
        og_title: null,
        og_description: null,
        og_image: null,
        status,
      };

      const res = editId
        ? await enterpriseApi.contentUpdate(token, 'career', editId, {
          title: jobTitle.trim(),
          summary: seoDesc.trim().slice(0, 150) || jobTitle.trim(),
          payload,
        })
        : await enterpriseApi.contentCreate(token, 'career', {
          title: jobTitle.trim(),
          summary: seoDesc.trim().slice(0, 150) || jobTitle.trim(),
          payload,
        });

      notify.success((res.item || res)?.status === 'pending_approval' ? 'Submitted for Approval' : 'Job Opening Saved', (res.item || res)?.message ?? 'Job details saved.');
      emitUnreadRefresh();
      navigate('/app/careers');
    } catch (err) {
      notify.apiError(err, editId ? 'Failed to update job opening' : 'Failed to create job opening');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cp-stack">
      <PageBreadcrumb parent="Careers" parentUrl="/app/careers" current={editId ? "Edit Job Opening" : "Create Job Opening"} />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">{editId ? "Edit Job Opening" : "Add Job Opening"}</h1>
          <p className="cp-muted">Configure role specifications and department requirements.</p>
        </div>
      </div>

      <section className="cp-card cp-card-pad">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="cp-grid cp-grid-2" style={{ gap: '16px 20px' }}>
            <label className="cp-field">
              <span className="cp-field-label-text">Job ID <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="e.g. job-ui-designer"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Job Title <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Lead UI Designer"
                required
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Department</span>
              <input
                type="text"
                className="cp-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Design Team"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Job Location</span>
              <input
                type="text"
                className="cp-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bangalore, India (Hybrid)"
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Employment Type</span>
              <select
                className="cp-input"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Experience Required</span>
              <input
                type="text"
                className="cp-input"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. 3-5 Years"
              />
            </label>

            <label className="cp-field cp-field--full">
              <span className="cp-field-label-text">Job Description <span className="cp-req">*</span></span>
              <textarea
                className="cp-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a description of the opening responsibilities and guidelines..."
                rows={5}
                required
              />
            </label>

            {/* Dynamic Job Requirements list */}
            <div className="cp-field cp-field--full" style={{ background: 'var(--cp-surface)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--cp-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="cp-field-label-text" style={{ fontSize: '14px', margin: 0 }}>Job Requirements</span>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={addRequirement}
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
                  title="Add Requirement"
                >
                  +
                </button>
              </div>
              {requirements.map((req, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    className="cp-input"
                    style={{ flex: 1 }}
                    value={req}
                    onChange={(e) => updateRequirement(idx, e.target.value)}
                    placeholder={`Requirement Point #${idx + 1}`}
                  />
                  {requirements.length > 1 && (
                    <button
                      type="button"
                      className="cp-btn-icon cp-btn-icon--danger"
                      onClick={() => removeRequirement(idx)}
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

            <label className="cp-field">
              <span className="cp-field-label-text">SEO Meta Title <span className="cp-req">*</span></span>
              <input
                type="text"
                className="cp-input"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Search engine title tag"
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
                placeholder="https://taiton.in/careers/..."
              />
            </label>

            <label className="cp-field">
              <span className="cp-field-label-text">Focus Keyword</span>
              <input
                type="text"
                className="cp-input"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="Target phrase"
              />
            </label>

            <div className="cp-field" />

            <label className="cp-field cp-field--full">
              <span className="cp-field-label-text">SEO Meta Description <span className="cp-req">*</span></span>
              <textarea
                className="cp-input"
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                placeholder="Short job summary for search result snippets"
                rows={3}
                required
              />
            </label>



            <label className="cp-field">
              <span className="cp-field-label-text">Publish Status</span>
              <select
                className="cp-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="live">Live</option>
              </select>
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--cp-border)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() => navigate('/app/careers')}
              style={{ height: '44px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cp-btn cp-btn-primary"
              disabled={submitting}
              style={{ height: '44px', width: '220px' }}
            >
              {submitting ? 'Saving Opening…' : editId ? 'Update Job Opening' : 'Submit Job Opening'}
            </button>
          </div>

        </form>
      </section>
    </div>
  );
}
