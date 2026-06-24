/** User-facing labels — never show raw role codes or dev terms in the UI. */

const ROLE_LABELS = {
  org_admin: 'Organization Admin',
  sys_admin: 'System Admin',
  super_admin: 'Platform Admin',
  super_employee: 'Super Employee',
  employee: 'Employee',
  employee_2: 'Employee',
  manager: 'Manager',
  member: 'Member',
};

export function formatRoleName(roleOrCode, fallbackName) {
  const name = String(fallbackName ?? '').trim();
  if (name && !looksLikeCode(name)) return name;
  const code = String(roleOrCode ?? name ?? '').trim().toLowerCase();
  if (!code) return '—';
  if (ROLE_LABELS[code]) return ROLE_LABELS[code];
  return humanizeToken(code);
}

function looksLikeCode(s) {
  return /^[a-z][a-z0-9_]*$/i.test(s) && s.includes('_');
}

function humanizeToken(token) {
  return String(token)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Comma-separated role codes → readable list. */
export function formatRolesList(rolesCsv, rolesCatalog = []) {
  if (!rolesCsv || !String(rolesCsv).trim()) return 'All roles';
  const byCode = new Map((rolesCatalog ?? []).map((r) => [r.code, r.name]));
  return String(rolesCsv)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((code) => formatRoleName(code, byCode.get(code)))
    .join(', ');
}

export function formatOrganizationName(org) {
  if (!org) return '';
  return String(org.name ?? '').trim() || 'Organization';
}

/** Sanitize API / notification text — hide codes and dev wording. */
/** Audit / activity action codes → readable phrase. */
export function humanizeAction(action) {
  const key = String(action ?? '').trim();
  const map = {
    'user.create_org_admin': 'Added organization administrator',
    'user.update_org_admin': 'Updated organization administrator',
    'user.deactivate_org_admin': 'Removed organization administrator',
    'user.create_member': 'Added user',
    'user.register': 'Registered user',
    'user.delete': 'Removed user',
    'auth.login': 'Signed in',
    'auth.logout': 'Signed out',
    'auth.session_expired': 'Session expired',
    'org_role.delete': 'Removed organization role',
    'nav.delete': 'Removed navigation item',
    'approval_rule.delete': 'Removed approval rule',
    'organization.create': 'Created organization',
  };
  if (map[key]) return map[key];
  return humanizeToken(key.replace(/\./g, ' '));
}

export function humanizeMessage(message) {
  let s = String(message ?? '').trim();
  if (!s) return 'Something went wrong.';

  if (/Duplicate entry/i.test(s)) {
    const entry = s.match(/Duplicate entry '([^']*)'/i)?.[1] ?? '';
    if (entry.includes('@') || /uk_cpanel_user_email/i.test(s)) {
      return 'This email is already registered.';
    }
    return 'This already exists.';
  }

  const short = {
    'email already registered in this organization': 'This email is already in this organization.',
    'an account with this email already exists in this organization':
      'This email is already in this organization.',
    'email already registered': 'This email is already registered.',
  };
  const lower = s.toLowerCase();
  for (const [key, val] of Object.entries(short)) {
    if (lower.includes(key)) return val;
  }

  const replacements = [
    [/org_admin/gi, 'organization administrator'],
    [/sys_admin/gi, 'system administrator'],
    [/super_admin/gi, 'platform administrator'],
    [/Unknown column/gi, 'Setup required'],
    [/tb_cpanel_\w+/gi, ''],
    [/uk_cpanel_\w+/gi, ''],
    [/npm run \S+/gi, ''],
    [/\.sql/gi, ''],
    [/\s*\([a-z][a-z0-9_]*\)\s*/gi, ' '],
    [/\s{2,}/g, ' '],
  ];
  for (const [pattern, repl] of replacements) {
    s = s.replace(pattern, repl);
  }
  s = s.trim();
  if (s.length > 120) {
    return s.slice(0, 117) + '…';
  }
  return s || 'Something went wrong.';
}
