/** Shared field validators — return error string or null if valid. */

export const v = {
  required(value, label = 'This field') {
    if (String(value ?? '').trim()) return null;
    return `${label} is required.`;
  },

  email(value) {
    const s = String(value ?? '').trim();
    if (!s) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Enter a valid email address.';
    return null;
  },

  mobile10(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length !== 10) return 'Mobile number must be exactly 10 digits.';
    return null;
  },

  orgCode(value) {
    const s = String(value ?? '').trim();
    if (!s) return 'Organization code is required.';
    if (!/^[A-Z0-9_-]{1,40}$/.test(s)) {
      return 'Use 1–40 characters: letters, numbers, hyphens, or underscores.';
    }
    return null;
  },

  name(value, label = 'Name', max = 120) {
    const s = String(value ?? '').trim();
    if (!s) return `${label} is required.`;
    if (s.length > max) return `${label} must be at most ${max} characters.`;
    return null;
  },

  roleCode(value) {
    const s = String(value ?? '').trim().toLowerCase();
    if (!s) return 'Role code is required.';
    if (!/^[a-z][a-z0-9_]{0,47}$/.test(s)) {
      return 'Use lowercase letters, numbers, or underscores (e.g. employee).';
    }
    return null;
  },

  route(value) {
    const s = String(value ?? '').trim();
    if (!s) return 'Route is required.';
    if (!s.startsWith('/')) return 'Route must start with / (e.g. /app/dashboard).';
    return null;
  },

  subject(value) {
    const s = String(value ?? '').trim();
    if (!s) return 'Subject is required.';
    if (s.length > 255) return 'Subject must be at most 255 characters.';
    return null;
  },

  message(value) {
    const s = String(value ?? '').trim();
    if (!s) return 'Message is required.';
    return null;
  },

  priority(value) {
    if (value === '' || value == null) return 'Rank is required.';
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 9999) return 'Rank must be between 1 and 9999.';
    return null;
  },

  sortOrder(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 9999) return 'Sort order must be between 0 and 9999.';
    return null;
  },
};

/** Run validators in order; returns first error or null. */
export function validateAll(checks) {
  for (const check of checks) {
    const err = check();
    if (err) return err;
  }
  return null;
}
