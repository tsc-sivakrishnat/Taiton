/** Update support ticket workflow status (org admins / super admins). */
export function requireSupportStaff(req, res, next) {
  const r = req.auth?.role;
  if (r === 'org_admin' || r === 'super_admin') {
    return next();
  }
  return res.status(403).json({ error: 'Insufficient permissions to change ticket status' });
}
