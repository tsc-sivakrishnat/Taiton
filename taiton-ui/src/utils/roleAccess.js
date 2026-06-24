/** Comma-separated role codes from DB (e.g. nav or feature flags). */
export function roleMatchesCsv(roleCode, rolesCsv) {
  if (rolesCsv == null || String(rolesCsv).trim() === '') {
    return true;
  }
  const r = String(roleCode ?? '').trim();
  return String(rolesCsv)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(r);
}
