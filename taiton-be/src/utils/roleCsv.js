/** Normalize role code for nav / notification matching. */
export function normalizeRoleCode(code) {
  return String(code ?? '').trim().toLowerCase();
}

/** Normalize comma-separated role list stored on nav items. */
export function normalizeRolesCsv(rolesCsv) {
  if (rolesCsv == null || !String(rolesCsv).trim()) return null;
  const codes = String(rolesCsv)
    .split(/[,;]/)
    .map((s) => normalizeRoleCode(s))
    .filter(Boolean);
  return codes.length ? codes.join(',') : null;
}

/** True when roles_csv is empty (all roles) or includes roleCode. */
export function roleMatchesNavCsv(roleCode, rolesCsv) {
  if (rolesCsv == null || !String(rolesCsv).trim()) return true;
  const role = normalizeRoleCode(roleCode);
  const list = String(rolesCsv)
    .split(/[,;]/)
    .map((s) => normalizeRoleCode(s))
    .filter(Boolean);
  return list.includes(role);
}
