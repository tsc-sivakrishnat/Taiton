import { isPlatformRole } from '../services/permissions.service.js';

export function requirePlatformAdmin(req, res, next) {
  if (isPlatformRole(req.auth?.role)) {
    return next();
  }
  return res.status(403).json({ error: 'Platform administrator access required' });
}
