import { verifyAccessToken } from '../utils/jwt.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = verifyAccessToken(token);
    if (!decoded?.sub || !decoded?.oid) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.auth = {
      userId: Number(decoded.sub),
      organizationId: Number(decoded.oid),
      role: decoded.role,
      email: decoded.email ?? null,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
