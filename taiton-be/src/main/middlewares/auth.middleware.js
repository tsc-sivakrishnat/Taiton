const jwt = require('jsonwebtoken');
const { pool } = require('../../resources/connection');

// Public endpoints that bypass authentication
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/onboard',
  '/public/branding',
  '/export-template',
  '/uploads',
];

const userStatusCache = new Map();

async function verifyToken(req, res, next) {
  const path = req.path || req.originalUrl || '';
  if (PUBLIC_PATHS.some((p) => path.includes(p))) {
    return next();
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  const parts = authHeader.split(' ');
  const token = parts.length === 2 ? parts[1] : parts[0];

  try {
    const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
    const decoded = jwt.verify(token, secret);

    // Short 30-second cache for account status to eliminate 500ms remote database latency on every request
    const cacheKey = `user_status_${decoded.id}`;
    const cached = userStatusCache.get(cacheKey);
    let userRecord = null;

    if (cached && (Date.now() - cached.timestamp < 30000)) {
      userRecord = cached.data;
    } else {
      const [rows] = await pool.execute(
        `SELECT id, status, isActive FROM tb_board_users WHERE id = ?`,
        [decoded.id]
      );
      if (rows.length > 0) {
        userRecord = rows[0];
        userStatusCache.set(cacheKey, { data: userRecord, timestamp: Date.now() });
      }
    }

    if (!userRecord || userRecord.status !== 'active' || Number(userRecord.isActive) === 0) {
      userStatusCache.delete(cacheKey);
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account has been deactivated by an administrator.',
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: err.message,
    });
  }
}

module.exports = {
  verifyToken,
};
