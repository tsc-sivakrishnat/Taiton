/**
 * Enterprise UI tokens. Primary brand: #1e293b (slate-800).
 * Use `applyThemeToDocument` once at startup to sync CSS variables.
 */

export const constants = {
  brandName: 'Enterprise CPanel',
  colors: {
    primary: '#1e293b',
    primaryHover: '#334155',
    primaryMuted: '#0f172a',
    surface: '#f8fafc',
    surfaceElevated: '#ffffff',
    border: '#e2e8f0',
    text: '#334155',
    textMuted: '#64748b',
    textOnPrimary: '#f8fafc',
    danger: '#b91c1c',
    dangerBg: '#fef2f2',
    success: '#15803d',
    warning: '#b45309',
    info: '#1d4ed8',
  },
  fonts: {
    sans: '"Inter", system-ui, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "Cascadia Code", Consolas, monospace',
  },
  layout: {
    maxContentWidth: '1200px',
    sidebarWidth: '260px',
    headerHeight: '56px',
    radius: '10px',
    radiusSm: '6px',
  },
  motion: {
    fast: '120ms ease',
    base: '200ms ease',
  },
  shadow: {
    menu: '0 10px 30px rgba(15, 23, 42, 0.12)',
  },
};

export function getConstant(path) {
  const parts = String(path).split('.');
  let cur = constants;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

/**
 * Mirrors `constants.colors` into CSS variables on `:root` for stylesheet use.
 */
export function applyThemeToDocument() {
  const r = document.documentElement;
  const { colors, fonts, layout, shadow } = constants;
  r.style.setProperty('--cp-primary', colors.primary);
  r.style.setProperty('--cp-primary-hover', colors.primaryHover);
  r.style.setProperty('--cp-primary-muted', colors.primaryMuted);
  r.style.setProperty('--cp-surface', colors.surface);
  r.style.setProperty('--cp-surface-elevated', colors.surfaceElevated);
  r.style.setProperty('--cp-border', colors.border);
  r.style.setProperty('--cp-text', colors.text);
  r.style.setProperty('--cp-text-muted', colors.textMuted);
  r.style.setProperty('--cp-text-on-primary', colors.textOnPrimary);
  r.style.setProperty('--cp-danger', colors.danger);
  r.style.setProperty('--cp-danger-bg', colors.dangerBg);
  r.style.setProperty('--cp-success', colors.success);
  r.style.setProperty('--cp-warning', colors.warning);
  r.style.setProperty('--cp-info', colors.info);
  r.style.setProperty('--cp-font-sans', fonts.sans);
  r.style.setProperty('--cp-font-mono', fonts.mono);
  r.style.setProperty('--cp-sidebar-width', layout.sidebarWidth);
  r.style.setProperty('--cp-header-height', layout.headerHeight);
  r.style.setProperty('--cp-radius', layout.radius);
  r.style.setProperty('--cp-radius-sm', layout.radiusSm);
  r.style.setProperty('--cp-max-width', layout.maxContentWidth);
  r.style.setProperty('--cp-shadow', shadow.menu);
}

export default constants;
