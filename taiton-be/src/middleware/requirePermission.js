import { assertPermission } from '../services/permissions.service.js';

/** Factory: require a permission code on the authenticated user role. */
export function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      await assertPermission(req.auth?.role, permissionCode);
      return next();
    } catch (e) {
      return res.status(e.status ?? 403).json({ error: e.message ?? 'Forbidden' });
    }
  };
}
