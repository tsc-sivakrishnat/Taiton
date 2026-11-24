const dashboardService = require('../services/dashboard.service');
const jwt = require('jsonwebtoken');

function extractUserFromReq(req) {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.decode(token);
      if (decoded) return decoded;
    } catch {}
  }
  return null;
}

class DashboardController {
  // GET /cpanel-api/dashboard/summary or /api/dashboard/summary
  async getSummary(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || user?.org_code || user?.orgCode || null;
      const userId = user?.id || user?.userId || 0;
      const userRole = user?.role || user?.roleCode || user?.role_code || 'employee';
      const result = await dashboardService.getSummary(orgCode, userId, userRole);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[DashboardController.getSummary] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard summary',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/dashboard/hosting-metrics or /api/dashboard/hosting-metrics
  async getHostingMetrics(req, res) {
    try {
      const metrics = await dashboardService.getHostingMetrics();
      return res.status(200).json({
        success: true,
        ...metrics,
      });
    } catch (error) {
      console.error('[DashboardController.getHostingMetrics] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hosting metrics',
        error: error.message,
      });
    }
  }
}

module.exports = new DashboardController();
