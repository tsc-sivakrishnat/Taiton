const jwt = require('jsonwebtoken');
const orgService = require('../services/org.service');

function normalizeRole(r) {
  const s = String(r || '').toLowerCase().trim();
  if (s === 'org_admin' || s === 'organization_admin') return 'organization_admin';
  if (s === 'super_admin' || s === 'sys_admin' || s === 'system_admin') return 'super_admin';
  if (s === 'super_employee') return 'super_employee';
  if (s === 'employee' || s === 'employee_2') return 'employee';
  return s;
}

function isRoleAllowed(accessMatrix, userRole) {
  if (!accessMatrix || accessMatrix === '' || accessMatrix === '*') return true;
  if (!userRole) return true;

  const targetRole = normalizeRole(userRole);
  if (targetRole === 'super_admin') return true;

  let allowedRoles = [];

  if (typeof accessMatrix === 'string') {
    try {
      const parsed = JSON.parse(accessMatrix);
      if (Array.isArray(parsed)) {
        allowedRoles = parsed;
      } else if (typeof parsed === 'string') {
        allowedRoles = [parsed];
      }
    } catch {
      allowedRoles = accessMatrix.split(',').map((r) => r.trim());
    }
  } else if (Array.isArray(accessMatrix)) {
    allowedRoles = accessMatrix;
  }

  const normAllowed = allowedRoles.map(normalizeRole);

  return normAllowed.some((norm) => {
    return norm === '*' || norm === 'all' || norm === targetRole;
  });
}

class NavigationController {
  // GET /cpanel-api/navigation or /cpanel-api/platform/organizations/:orgId/nav
  async getNavigation(req, res) {
    try {
      let userRole = req.query.role || req.query.user_role;
      let orgCode = null;

      // 1. Check explicit orgId or code in req.params or req.query first
      const targetOrgRef = req.params.orgId || req.params.code || req.query.orgId || req.query.org_code;
      if (targetOrgRef) {
        const org = await orgService.getOrgByIdOrCode(targetOrgRef);
        orgCode = org ? org.org_code : String(targetOrgRef);
      }

      // 2. Extract Bearer token / req.user details for userRole and fallback org_code
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
          const decoded = jwt.verify(token, secret);
          if (decoded) {
            if (!userRole) userRole = decoded.role || decoded.roleCode || decoded.role_code;
            if (!orgCode) orgCode = decoded.org_code || decoded.orgCode;
          }
        } catch {
          try {
            const decoded = jwt.decode(token);
            if (decoded) {
              if (!userRole) userRole = decoded.role || decoded.roleCode || decoded.role_code;
              if (!orgCode) orgCode = decoded.org_code || decoded.orgCode;
            }
          } catch {
            /* ignore token decode error */
          }
        }
      }

      if (!userRole && req.user) {
        userRole = req.user.role || req.user.roleCode || req.user.role_code;
      }
      if (!orgCode && req.user) {
        orgCode = req.user.org_code || req.user.orgCode;
      }

      if (!orgCode) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organization code required to access navigation.',
        });
      }

      const dbItems = await orgService.getNavigation(orgCode);
      const isManageRequest = Boolean(req.params.orgId) || req.query.manage === 'true' || req.query.all === 'true';

      // Map strictly from database JOINs (tb_board_navs, tb_config_icons, and tb_config_routes)
      const filteredItems = (dbItems || [])
        .filter((row) => isManageRequest || isRoleAllowed(row.access_matrix, userRole))
        .map((row) => {
          let route = row.route_path || row.route || '#';
          if (route && route !== '#' && !route.startsWith('/')) {
            route = '/' + route;
          }
          return {
            id: row.id,
            label: row.label,
            icon: row.icon_code || 'LayoutDashboard',
            route,
            position: row.position === 'header' || row.position === 'top' ? 'top' : row.position,
            sortOrder: Number(row.sort_order) || row.id,
            sort_order: Number(row.sort_order) || row.id,
            access_matrix: row.access_matrix,
          };
        });

      return res.status(200).json({
        success: true,
        items: filteredItems,
        data: filteredItems,
      });
    } catch (error) {
      console.error('[NavigationController.getNavigation] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch navigation menu from database',
        error: error.message,
      });
    }
  }
}

module.exports = new NavigationController();
