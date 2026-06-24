import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';

/** After migration_org_config_value_mediumtext.sql; keep under MySQL MEDIUMTEXT max (16MB - 1). */
const MAX_LOGO_VALUE_CHARS = 15 * 1024 * 1024;

function coerceDbText(v) {
  if (v == null) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return v.toString('utf8');
  return String(v);
}

/** Strip BOM / zero-width chars and line breaks inside data: URLs (breaks img src → ERR_INVALID_URL). */
function normalizeStoredLogoUrl(v) {
  let s = coerceDbText(v)
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();
  if (!s) return '';
  if (s.startsWith('data:')) {
    s = s.replace(/\s+/g, '');
    const comma = s.indexOf(',');
    if (comma === -1 || comma >= s.length - 1) return '';
    return s;
  }
  return s;
}

function normalizeProfile(v) {
  const s = String(v ?? '').toLowerCase();
  if (s === 'logo_name' || s === 'logo_and_name') return 'logo_name';
  if (s === 'horizontal' || s === 'rectangle' || s === 'full') return 'horizontal';
  return 'horizontal';
}

export function mapBrandingRows(rows) {
  if (!rows?.length) {
    return {
      appName: 'Company',
      logoUrl: '',
      logoUrlCollapsed: '',
      logoProfile: 'horizontal',
    };
  }
  const first = rows[0];
  const orgDefaultName = first.org_default_name ?? 'Company';
  const map = {};
  for (const r of rows) {
    if (r.config_key) {
      map[r.config_key] = coerceDbText(r.config_value);
    }
  }
  const theme = {
    sidebarBg: coerceDbText(map.theme_sidebar_bg ?? '').trim(),
    sidebarText: coerceDbText(map.theme_sidebar_text ?? '').trim(),
    headerBg: coerceDbText(map.theme_header_bg ?? '').trim(),
    fontFamily: coerceDbText(map.theme_font_family ?? '').trim(),
    fontSize: coerceDbText(map.theme_font_size ?? '').trim(),
    navFontSize: coerceDbText(map.theme_nav_font_size ?? '').trim(),
  };
  const hasTheme = Object.values(theme).some(Boolean);
  return {
    appName: coerceDbText(map.app_name ?? '').trim() || orgDefaultName,
    logoUrl: normalizeStoredLogoUrl(map.logo_url ?? ''),
    logoUrlCollapsed: normalizeStoredLogoUrl(map.logo_url_sidebar ?? ''),
    logoProfile: normalizeProfile(map.logo_profile),
    theme: hasTheme ? theme : null,
  };
}

export async function updateOrgTheme({ organizationId, theme }) {
  const t = theme ?? {};
  const entries = [
    ['theme_sidebar_bg', t.sidebarBg],
    ['theme_sidebar_text', t.sidebarText],
    ['theme_header_bg', t.headerBg],
    ['theme_font_family', t.fontFamily],
    ['theme_font_size', t.fontSize],
    ['theme_nav_font_size', t.navFontSize],
  ];
  for (const [key, val] of entries) {
    if (val === undefined) continue;
    await pool.query(queries.orgConfigUpsert, {
      organizationId,
      configKey: key,
      configValue: String(val ?? '').trim(),
    });
  }
  return getBranding(organizationId);
}

export async function getBranding(organizationId) {
  const [rows] = await pool.query(queries.orgBrandingWithDefaults, {
    organizationId,
  });
  return mapBrandingRows(rows);
}

export async function getBrandingByOrgCode(orgCode) {
  const raw = String(orgCode ?? '').trim();
  const fallback = process.env.DEFAULT_PUBLIC_ORG_CODE || 'acme';
  const code = raw || fallback;
  const [rows] = await pool.query(queries.orgBrandingByOrgCode, { orgCode: code });
  if (rows?.length) return mapBrandingRows(rows);
  if (code !== fallback) {
    const [rows2] = await pool.query(queries.orgBrandingByOrgCode, { orgCode: fallback });
    return mapBrandingRows(rows2);
  }
  return mapBrandingRows([]);
}

function assertNoEmbeddedDataUrl(label, raw) {
  const s = String(raw ?? '').trim();
  if (s.startsWith('data:')) {
    const err = new Error(
      `${label}: base64 data URLs are not stored. Use the file upload button, or paste an https or /uploads/… URL.`,
    );
    err.status = 400;
    throw err;
  }
}

export async function updateBranding({
  organizationId,
  appName,
  logoUrl,
  logoUrlCollapsed,
  logoProfile,
}) {
  const profile = normalizeProfile(logoProfile);
  const name = String(appName ?? '').trim();
  assertNoEmbeddedDataUrl('Wide logo', logoUrl);
  assertNoEmbeddedDataUrl('Collapsed logo', logoUrlCollapsed);
  const logo = normalizeStoredLogoUrl(logoUrl);
  const logoSide = normalizeStoredLogoUrl(logoUrlCollapsed);
  if (!name) {
    const err = new Error('Company name is required');
    err.status = 400;
    throw err;
  }
  for (const [label, val] of [
    ['Wide logo', logo],
    ['Collapsed logo', logoSide],
  ]) {
    if (val.length > MAX_LOGO_VALUE_CHARS) {
      const err = new Error(
        `${label} is too large to store (${val.length} characters). Use a smaller image, a shorter URL, or host the file and paste an https link.`,
      );
      err.status = 400;
      throw err;
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(queries.orgConfigUpsert, {
      organizationId,
      configKey: 'app_name',
      configValue: name,
    });
    await conn.query(queries.orgConfigUpsert, {
      organizationId,
      configKey: 'logo_url',
      configValue: logo,
    });
    await conn.query(queries.orgConfigUpsert, {
      organizationId,
      configKey: 'logo_url_sidebar',
      configValue: logoSide,
    });
    await conn.query(queries.orgConfigUpsert, {
      organizationId,
      configKey: 'logo_profile',
      configValue: profile,
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getBranding(organizationId);
}

/** Clear custom logos, name overrides, and theme — back to app defaults for this org. */
export async function resetOrgAppearanceToDefaults(organizationId) {
  const { clearOrgBrandingLogoFiles } = await import('./brandingLogo.service.js');
  await clearOrgBrandingLogoFiles(organizationId);
  await pool.query(queries.orgConfigDeleteAppearance, { organizationId });
  return getBranding(organizationId);
}
