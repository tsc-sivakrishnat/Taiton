import { useEffect, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { ConfirmDeleteCard } from './ConfirmDeleteCard.jsx';
import { notify } from '../utils/notify.js';

export const DEFAULT_THEME = {
  sidebarBg: '#1e293b',
  sidebarText: '#f8fafc',
  headerBg: '#ffffff',
  fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
  fontSize: '15',
  navFontSize: '14',
};

export function OrgThemeEditor({ branding, token, refreshSession, activeOrganization }) {
  const isOrgAdmin = activeOrganization?.roleCode === 'org_admin';
  const [theme, setTheme] = useState({ ...DEFAULT_THEME, ...branding?.theme });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setTheme({ ...DEFAULT_THEME, ...branding?.theme });
  }, [branding?.theme]);

  if (!isOrgAdmin) {
    return null;
  }

  async function onSave(e) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await enterpriseApi.orgUpdateTheme(token, theme);
      await refreshSession();
      notify.success('Theme saved');
    } catch (err) {
      notify.apiError(err, 'Could not save theme');
    } finally {
      setSaving(false);
    }
  }

  async function onResetDefaults() {
    if (!token) return;
    setResetting(true);
    try {
      await enterpriseApi.resetOrgAppearance(token);
      setTheme({ ...DEFAULT_THEME });
      await refreshSession();
      notify.success('Reset to default', 'Appearance restored to starting settings.');
      setConfirmReset(false);
    } catch (err) {
      notify.apiError(err, 'Could not reset appearance');
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="cp-card cp-card-pad">
      <div className="cp-section-head-row">
        <div>
          <h2 className="cp-section-title">Organization Appearance</h2>
          <p className="cp-page-lead">Sidebar, header colors, and fonts for this organization.</p>
        </div>
        <button
          type="button"
          className="cp-btn cp-btn-secondary"
          onClick={() => setConfirmReset(true)}
          disabled={resetting || saving}
        >
          {resetting ? 'Resetting…' : 'Reset To Default'}
        </button>
      </div>
      <form className="cp-grid cp-grid-2" onSubmit={onSave}>
        <label className="cp-field">
          <span>Sidebar Background</span>
          <input
            type="color"
            value={theme.sidebarBg?.startsWith('#') ? theme.sidebarBg : '#1e293b'}
            onChange={(e) => setTheme((t) => ({ ...t, sidebarBg: e.target.value }))}
          />
        </label>
        <label className="cp-field">
          <span>Sidebar Text</span>
          <input
            type="color"
            value={theme.sidebarText?.startsWith('#') ? theme.sidebarText : '#f8fafc'}
            onChange={(e) => setTheme((t) => ({ ...t, sidebarText: e.target.value }))}
          />
        </label>
        <label className="cp-field">
          <span>Top Bar Background</span>
          <input
            type="color"
            value={theme.headerBg?.startsWith('#') ? theme.headerBg : '#ffffff'}
            onChange={(e) => setTheme((t) => ({ ...t, headerBg: e.target.value }))}
          />
        </label>
        <label className="cp-field">
          <span>Font Family</span>
          <select
            className="cp-input"
            value={theme.fontFamily}
            onChange={(e) => setTheme((t) => ({ ...t, fontFamily: e.target.value }))}
          >
            <option value="system-ui, Segoe UI, Roboto, sans-serif">System default</option>
            <option value="'Inter', system-ui, sans-serif">Inter</option>
            <option value="'Segoe UI', Tahoma, sans-serif">Segoe UI</option>
            <option value="Georgia, serif">Georgia (serif)</option>
          </select>
        </label>
        <label className="cp-field">
          <span>Base Font Size (px)</span>
          <input
            type="number"
            min={12}
            max={20}
            className="cp-input"
            value={theme.fontSize}
            onChange={(e) => setTheme((t) => ({ ...t, fontSize: e.target.value }))}
          />
        </label>
        <label className="cp-field">
          <span>Sidebar Font Size (px)</span>
          <input
            type="number"
            min={12}
            max={18}
            className="cp-input"
            value={theme.navFontSize}
            onChange={(e) => setTheme((t) => ({ ...t, navFontSize: e.target.value }))}
          />
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="cp-btn cp-btn-primary" disabled={saving || resetting}>
            {saving ? 'Saving…' : 'Save Theme'}
          </button>
        </div>
      </form>

      {confirmReset ? (
        <ConfirmDeleteCard
          title="Reset appearance to defaults?"
          message="Company name, logos, and colors will be restored. Custom uploads will be removed."
          confirmLabel="Reset"
          busy={resetting}
          onConfirm={onResetDefaults}
          onCancel={() => setConfirmReset(false)}
        />
      ) : null}
    </section>
  );
}
