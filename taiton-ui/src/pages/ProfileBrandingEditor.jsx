import { useEffect, useRef, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { CompanyBranding } from '../components/CompanyBranding.jsx';
import { LogoUploadPlaceholder } from '../components/LogoUploadPlaceholder.jsx';
import {
  resolveBrandingAssetUrl,
  validateImageFileObjectAsync,
} from '../utils/brandingAssetValidation.js';
import { notify } from '../utils/notify.js';

function previewSrcFromPath(path) {
  if (!path) return '';
  if (path.startsWith('blob:')) return path;
  const resolved = resolveBrandingAssetUrl(path);
  const sep = resolved.includes('?') ? '&' : '?';
  return `${resolved}${sep}v=${Date.now()}`;
}

export function ProfileBrandingEditor({
  branding,
  activeOrganization,
  token,
  refreshSession,
}) {
  const wideBlobRef = useRef(null);
  const collapsedBlobRef = useRef(null);

  const [appName, setAppName] = useState(
    () => branding?.appName || activeOrganization?.name || '',
  );
  const [logoProfile, setLogoProfile] = useState(() =>
    branding?.logoProfile === 'logo_name' ? 'logo_name' : 'horizontal',
  );
  const [logoUrl, setLogoUrl] = useState(() => branding?.logoUrl || '');
  const [logoUrlCollapsed, setLogoUrlCollapsed] = useState(() => branding?.logoUrlCollapsed || '');
  const [readingLogo, setReadingLogo] = useState(false);
  const [readingLogoCollapsed, setReadingLogoCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (wideBlobRef.current) URL.revokeObjectURL(wideBlobRef.current);
      if (collapsedBlobRef.current) URL.revokeObjectURL(collapsedBlobRef.current);
    };
  }, []);

  useEffect(() => {
    if (wideBlobRef.current || collapsedBlobRef.current) return;
    setAppName(branding?.appName || activeOrganization?.name || '');
    setLogoUrl(branding?.logoUrl || '');
    setLogoUrlCollapsed(branding?.logoUrlCollapsed || '');
    setLogoProfile(branding?.logoProfile === 'logo_name' ? 'logo_name' : 'horizontal');
  }, [
    branding?.appName,
    branding?.logoUrl,
    branding?.logoUrlCollapsed,
    branding?.logoProfile,
    activeOrganization?.name,
  ]);

  function setWidePreviewFromFile(file) {
    if (wideBlobRef.current) URL.revokeObjectURL(wideBlobRef.current);
    wideBlobRef.current = URL.createObjectURL(file);
    setLogoUrl(wideBlobRef.current);
  }

  function setCollapsedPreviewFromFile(file) {
    if (collapsedBlobRef.current) URL.revokeObjectURL(collapsedBlobRef.current);
    collapsedBlobRef.current = URL.createObjectURL(file);
    setLogoUrlCollapsed(collapsedBlobRef.current);
  }

  function commitWideFromServer(path) {
    if (wideBlobRef.current) {
      URL.revokeObjectURL(wideBlobRef.current);
      wideBlobRef.current = null;
    }
    setLogoUrl(path ? previewSrcFromPath(path) : '');
  }

  function commitCollapsedFromServer(path) {
    if (collapsedBlobRef.current) {
      URL.revokeObjectURL(collapsedBlobRef.current);
      collapsedBlobRef.current = null;
    }
    setLogoUrlCollapsed(path ? previewSrcFromPath(path) : '');
  }

  async function onSaveBranding(e) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const widePath = logoUrl.startsWith('blob:') ? branding?.logoUrl : logoUrl.split('?')[0];
      const collapsedPath = logoUrlCollapsed.startsWith('blob:')
        ? branding?.logoUrlCollapsed
        : logoUrlCollapsed.split('?')[0];
      await enterpriseApi.patchOrgBranding(token, {
        appName: appName.trim(),
        logoUrl: widePath || null,
        logoUrlCollapsed: collapsedPath || null,
        logoProfile,
      });
      await refreshSession();
      notify.success('Appearance saved');
    } catch (err) {
      notify.apiError(err, 'Could not save appearance');
    } finally {
      setSaving(false);
    }
  }

  const previewBranding = {
    appName: appName.trim() || activeOrganization?.name || 'Company',
    logoUrl,
    logoUrlCollapsed,
    logoProfile,
  };

  async function onPickLogoFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const pre = await validateImageFileObjectAsync(f, 'wide');
    if (!pre.ok) {
      notify.error(pre.message);
      e.target.value = '';
      return;
    }
    if (!token) return;
    setWidePreviewFromFile(f);
    setReadingLogo(true);
    try {
      const { branding: next } = await enterpriseApi.uploadOrgBrandingLogo(token, f, 'wide');
      commitWideFromServer(next?.logoUrl ?? '');
      await refreshSession();
      notify.success('Wide logo uploaded', f.name);
    } catch (err) {
      if (wideBlobRef.current) URL.revokeObjectURL(wideBlobRef.current);
      wideBlobRef.current = null;
      setLogoUrl(branding?.logoUrl ? previewSrcFromPath(branding.logoUrl) : '');
      notify.apiError(err, 'Upload failed');
    } finally {
      setReadingLogo(false);
      e.target.value = '';
    }
  }

  async function onPickLogoCollapsedFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const pre = await validateImageFileObjectAsync(f, 'square');
    if (!pre.ok) {
      notify.error(pre.message);
      e.target.value = '';
      return;
    }
    if (!token) return;
    setCollapsedPreviewFromFile(f);
    setReadingLogoCollapsed(true);
    try {
      const { branding: next } = await enterpriseApi.uploadOrgBrandingLogo(token, f, 'collapsed');
      commitCollapsedFromServer(next?.logoUrlCollapsed ?? '');
      await refreshSession();
      notify.success('Collapsed logo uploaded', f.name);
    } catch (err) {
      if (collapsedBlobRef.current) URL.revokeObjectURL(collapsedBlobRef.current);
      collapsedBlobRef.current = null;
      setLogoUrlCollapsed(
        branding?.logoUrlCollapsed ? previewSrcFromPath(branding.logoUrlCollapsed) : '',
      );
      notify.apiError(err, 'Upload failed');
    } finally {
      setReadingLogoCollapsed(false);
      e.target.value = '';
    }
  }

  const showCollapsedFields = logoProfile === 'horizontal';

  return (
    <section className="cp-card cp-card-pad">
      <h2 className="cp-section-title">Company Appearance</h2>
      <p className="cp-page-lead">Upload logos and set the company name shown in the sidebar.</p>

      <form className="cp-branding-form" onSubmit={onSaveBranding}>
        <label className="cp-field">
          <span>Company Name</span>
          <input value={appName} onChange={(e) => setAppName(e.target.value)} required placeholder="Enter company name" />
        </label>

        <div className="cp-branding-logos-row">
          <LogoUploadPlaceholder
            id="cp-logo-upload"
            label="Wide Logo"
            aspect="wide"
            src={logoUrl}
            busy={readingLogo}
            onPick={onPickLogoFile}
            hint="PNG or WebP — 3:2 or 4:1 ratio — max 5 MB."
          />
          {showCollapsedFields ? (
            <LogoUploadPlaceholder
              id="cp-logo-upload-collapsed"
              label="Collapsed Logo"
              aspect="square"
              src={logoUrlCollapsed}
              busy={readingLogoCollapsed}
              onPick={onPickLogoCollapsedFile}
              hint="PNG or WebP — 1:1 square — max 5 MB."
            />
          ) : null}
        </div>

        <label className="cp-field">
          <span>Sidebar Layout</span>
          <select value={logoProfile} onChange={(e) => setLogoProfile(e.target.value)}>
            <option value="horizontal">Wide Banner</option>
            <option value="logo_name">Logo + Name</option>
          </select>
        </label>

        <button type="submit" className="cp-btn cp-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Appearance'}
        </button>
      </form>
    </section>
  );
}
