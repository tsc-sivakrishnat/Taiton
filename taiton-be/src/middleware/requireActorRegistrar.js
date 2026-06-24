import { pool } from '../config/db.js';

/** Actor (user) registration in admin UI — org admins, super admins, or roles with navigation access. */
export async function requireActorRegistrar(req, res, next) {
  const r = req.auth?.role;
  if (r === 'org_admin' || r === 'super_admin' || r === 'sys_admin') {
    return next();
  }

  const orgId = req.auth?.organizationId;
  if (orgId && r) {
    try {
      const routesToCheck = ['/app/org/users', '/app/accounts', '/app/admin/actor-registration'];
      for (const route of routesToCheck) {
        const [rows] = await pool.query(
          `SELECT roles_csv FROM tb_cpanel_nav_items
           WHERE org_id = :orgId
             AND is_active = 1
             AND TRIM(LOWER(route)) = TRIM(LOWER(:route))
           LIMIT 1`,
          { orgId, route },
        );
        if (rows && rows.length > 0) {
          const rolesCsv = rows[0].roles_csv;
          if (rolesCsv == null || !String(rolesCsv).trim()) {
            return next();
          }
          const list = String(rolesCsv)
            .split(/[,;]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          if (list.includes(String(r).trim().toLowerCase())) {
            return next();
          }
        }
      }
    } catch (e) {
      // Database error falls through
    }
  }

  return res.status(403).json({ error: 'Insufficient permissions for actor registration' });
}
