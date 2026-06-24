const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const NAME_IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;

const INVISIBLE_CHARS = /[\uFEFF\u200B-\u200D\u2060]/g;

/**
 * Prefix API origin for stored paths like `/uploads/branding/...` when the UI is on another host (e.g. Vite dev).
 * @param {unknown} href
 * @returns {string}
 */
export function resolveBrandingAssetUrl(href) {
  const raw = String(href ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE || '')
    .replace(/\/$/, '');
  if (raw.startsWith('/') && base) return `${base}${raw}`;
  return raw;
}

/**
 * Normalizes logo values for display (legacy data: URLs only; new logos use file paths).
 * @param {unknown} url
 * @returns {string}
 */
export function sanitizeLogoSrcForImg(url) {
  let s = url == null ? '' : String(url);
  s = s.replace(/^\uFEFF/, '').replace(INVISIBLE_CHARS, '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) {
    s = s.replace(/\s+/g, '');
    const comma = s.indexOf(',');
    if (comma === -1) return '';
    const payload = s.slice(comma + 1);
    if (!payload || payload.length < 12) return '';
    return s;
  }
  return s;
}

/**
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
const ALLOWED_LOGO_MIMES = new Set(['image/png', 'image/webp']);

function isAllowedLogoMime(mime, name) {
  if (ALLOWED_LOGO_MIMES.has(mime)) return true;
  return /\.(png|webp)$/i.test(String(name || ''));
}

function validateLogoAspectRatio(width, height, slot) {
  if (!width || !height) return { ok: true };
  const ratio = width / height;
  if (slot === 'square') {
    const delta = Math.abs(ratio - 1);
    if (delta > 0.08) {
      return { ok: false, message: 'Square logo must be close to a 1:1 ratio.' };
    }
    return { ok: true };
  }
  const near32 = Math.abs(ratio - 1.5) <= 0.12;
  const near41 = Math.abs(ratio - 4) <= 0.2;
  if (!near32 && !near41) {
    return { ok: false, message: 'Wide logo must be close to 3:2 or 4:1 ratio.' };
  }
  return { ok: true };
}

function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * @param {File} file
 * @param {'wide' | 'square'} [slot]
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function validateImageFileObjectAsync(file, slot = 'wide') {
  const base = validateImageFileObject(file, slot);
  if (!base.ok) return base;
  const dims = await readImageDimensions(file);
  if (!dims) return { ok: true };
  return validateLogoAspectRatio(dims.width, dims.height, slot);
}

export function validateImageFileObject(file, slot = 'wide') {
  if (!(file instanceof File)) {
    return { ok: false, message: 'Invalid file: please choose a file from your device.' };
  }
  const name = String(file.name || '').trim();
  if (!name) {
    return { ok: false, message: 'Invalid file: missing file name.' };
  }
  if (typeof file.size !== 'number' || Number.isNaN(file.size)) {
    return { ok: false, message: 'Invalid file: could not read file size.' };
  }
  if (file.size <= 0) {
    return { ok: false, message: 'Invalid file: the file is empty.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'Image too large (max 5 MB).' };
  }
  const mime = String(file.type || '').toLowerCase().trim();
  if (!isAllowedLogoMime(mime, name)) {
    return { ok: false, message: 'Only PNG or WebP images are allowed.' };
  }
  void slot;
  return { ok: true };
}

/**
 * @param {string} value trimmed or raw
 * @param {string} label e.g. "Wide logo"
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateLogoUrlValue(value, label) {
  const rawTrim = String(value ?? '').trim();
  if (rawTrim.startsWith('data:')) {
    return {
      ok: false,
      message: `${label}: pasted base64 is not saved. Use the upload button (stores a file under /uploads) or an https / /uploads/… URL.`,
    };
  }
  const s = sanitizeLogoSrcForImg(rawTrim);
  if (rawTrim && !s) {
    return {
      ok: false,
      message: `${label} is not usable (invalid characters). Fix the URL or upload a file.`,
    };
  }
  if (!s) return { ok: true };

  if (s.startsWith('/')) {
    if (s.length > 2000) {
      return { ok: false, message: `${label}: path is too long.` };
    }
    if (/\s/.test(s)) {
      return { ok: false, message: `${label}: path must not contain spaces (encode or rename).` };
    }
    return { ok: true };
  }

  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, message: `${label} must be an http(s) or site-relative path starting with /.` };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: `${label} is not a valid URL.` };
  }
}
