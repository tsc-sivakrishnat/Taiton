/** Org branding (logo / name) may be edited by these user roles (tb_cpanel_users.role). */
export function requireBrandingEditor(req, res, next) {
  const r = req.auth?.role;
  if (r === 'org_admin' || r === 'super_admin' || r === 'sys_admin') {
    return next();
  }
  return res.status(403).json({ error: 'Insufficient permissions to update company appearance' });
}
