const spacesService = require('../services/spaces.service');
const { pool } = require('../../resources/connection');
const jwt = require('jsonwebtoken');

function extractUserFromReq(req) {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
      const decoded = jwt.verify(token, secret);
      if (decoded) return decoded;
    } catch {
      try {
        const decoded = jwt.decode(token);
        if (decoded) return decoded;
      } catch { }
    }
  }
  return null;
}

async function getUserFullName(req) {
  const user = extractUserFromReq(req);
  const userEmail = user?.email;
  const userId = user?.id;

  if (userEmail || userId) {
    try {
      const [uRows] = await pool.execute(
        'SELECT full_name FROM tb_board_users WHERE LOWER(email) = LOWER(?) OR id = ? LIMIT 1',
        [String(userEmail || ''), Number(userId) || 0]
      );
      if (uRows.length > 0 && uRows[0].full_name) {
        return uRows[0].full_name;
      }
    } catch (e) {
      console.error('[getUserFullName] Error querying tb_board_users:', e.message);
    }
  }

  return user?.fullName || user?.full_name || user?.displayName || user?.email || 'User';
}

function normalizeRole(r) {
  const s = String(r || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (s === 'org_admin' || s === 'organization_admin') return 'organization_admin';
  if (s === 'super_admin' || s === 'sys_admin' || s === 'system_admin') return 'super_admin';
  if (s === 'super_employee') return 'super_employee';
  if (s === 'employee' || s === 'employee_2') return 'employee';
  return s;
}

async function evaluateApprovalRuleAndStatus({ orgCode, type, title, insertId, tableName, req }) {
  try {
    const user = extractUserFromReq(req);
    const userRole = user?.role || user?.roleCode || user?.role_code || 'organization_admin';
    const userId = user?.id || 0;
    const userName = await getUserFullName(req);

    const normUserRole = normalizeRole(userRole);
    const rawUserRole = String(userRole || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

    // Fetch active rules for orgCode
    const [ruleRows] = await pool.execute(
      `SELECT r.*, cr.route as route_path, cr.page as route_name FROM tb_org_rules r
       LEFT JOIN tb_config_routes cr ON r.route_id = cr.id
       WHERE LOWER(r.org_code) = LOWER(?) AND r.status = 'active'
       ORDER BY r.id DESC`,
      [orgCode]
    );

    const matchingResourceRules = ruleRows.filter((rule) => {
      const routeStr = String(rule.route_path || '').toLowerCase();
      const routeName = String(rule.route_name || '').toLowerCase();
      return routeStr.includes('space') || routeName.includes('space') || rule.route_id === 34;
    });

    let hasMatchingMakerRule = false;
    let allCheckerRoles = [];

    for (const rule of matchingResourceRules) {
      let makerRoles = [];
      try {
        makerRoles = typeof rule.maker_role_ids === 'string'
          ? JSON.parse(rule.maker_role_ids)
          : (rule.maker_role_ids || []);
      } catch (e) {
        makerRoles = typeof rule.maker_role_ids === 'string' ? rule.maker_role_ids.split(',').map(s => s.trim()) : [];
      }
      const normMakerRoles = makerRoles.map(normalizeRole);
      const rawMakerRoles = makerRoles.map(m => String(m || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));

      if (
        normMakerRoles.includes('*') ||
        normMakerRoles.includes('all') ||
        normMakerRoles.includes(normUserRole) ||
        rawMakerRoles.includes(rawUserRole)
      ) {
        hasMatchingMakerRule = true;
        let checkers = [];
        try {
          checkers = typeof rule.check_role_ids === 'string'
            ? JSON.parse(rule.check_role_ids)
            : (rule.check_role_ids || []);
        } catch (e) {
          checkers = typeof rule.check_role_ids === 'string' ? rule.check_role_ids.split(',').map(s => s.trim()) : [];
        }
        allCheckerRoles.push(...checkers);
      }
    }

    if (!hasMatchingMakerRule) {
      return 'ready_to_live';
    }

    const pendingStatus = 'pending_approval';

    await pool.execute(
      `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orgCode, tableName, type, title, insertId, userId, userName, `Submitted ${type} "${title}" for approval`]
    );

    if (allCheckerRoles.length > 0) {
      try {
        const rawCheckers = allCheckerRoles.map(r => String(r || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
        const normCheckers = allCheckerRoles.map(normalizeRole);
        const allCheckerTerms = Array.from(new Set([...rawCheckers, ...normCheckers]));
        const placeholders = allCheckerTerms.map(() => '?').join(',');

        const [checkerUsers] = await pool.execute(
          `SELECT id FROM tb_board_users 
           WHERE LOWER(org_code) = LOWER(?) 
           AND LOWER(role) IN (${placeholders})`,
          [orgCode, ...allCheckerTerms]
        );

        const notifMsg = `Approval required: ${userName} (${userRole}) submitted explore space "${title}" for approval.`;
        for (const u of checkerUsers) {
          if (Number(u.id) !== Number(userId)) {
            await pool.execute(
              `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
              [orgCode, userId, u.id, notifMsg]
            );
          }
        }
      } catch (nErr) {
        console.error('[evaluateApprovalRuleAndStatus:spaces] Notification error:', nErr.message);
      }
    }

    return pendingStatus;
  } catch (e) {
    console.error('[evaluateApprovalRuleAndStatus:spaces] Error:', e.message);
    return 'ready_to_live';
  }
}

class SpacesController {
  // GET /cpanel-api/spaces
  async getSpaces(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || req.body?.org_code || user?.org_code || req.user?.org_code || 'taiton';
      const status = req.query.status ? String(req.query.status).trim() : undefined;
      const q = req.query.q ? String(req.query.q).trim() : undefined;
      const limit = Math.max(1, Number(req.query.limit) || 50);
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const spaces = await spacesService.getSpaces(orgCode, { status, q, limit, offset });

      // Transform into standard format expected by cPanel
      const items = spaces.map((s) => ({
        id: s.id,
        orgCode: s.org_code,
        type: 'explore_space',
        title: s.title,
        name: s.title,
        description: s.description,
        image_url: s.image_url,
        img: s.image_url,
        hotspots: s.hotspots || [],
        summary: s.description || `${s.hotspots?.length || 0} hotspots configured`,
        status: s.status,
        view: s.view,
        sort_order: s.sort_order,
        hotspot_count: s.hotspot_count || s.hotspots?.length || 0,
        payload: {
          id: s.id,
          name: s.title,
          title: s.title,
          description: s.description,
          image_url: s.image_url,
          img: s.image_url,
          status: s.status,
          view: s.view,
          sort_order: s.sort_order,
          hotspots: s.hotspots || [],
          pts: (s.hotspots || []).map((h) => ({
            id: h.id,
            product_id: h.product_id,
            product_code: h.product_code,
            c: h.product_code,
            x: h.x,
            y: h.y,
            label: h.label,
          })),
        },
        createdBy: s.created_by_name || 'Admin',
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));

      return res.status(200).json({
        success: true,
        type: 'explore_space',
        data: items,
        items,
        total: items.length,
      });
    } catch (error) {
      console.error('[SpacesController.getSpaces] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch explore spaces',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/spaces/:id
  async getSpaceById(req, res) {
    try {
      const { id } = req.params;
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || user?.org_code || req.user?.org_code || 'taiton';

      const space = await spacesService.getSpaceById(id, orgCode);
      if (!space) {
        return res.status(404).json({
          success: false,
          message: `Explore Space #${id} not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: space,
        item: space,
      });
    } catch (error) {
      console.error('[SpacesController.getSpaceById] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch space details',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/spaces
  async createSpace(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || user?.org_code || req.user?.org_code || 'taiton';
      const title = (req.body.title || req.body.name || '').trim();
      const imageUrl = (req.body.image_url || req.body.img || '').trim();

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Space title/name is required',
        });
      }

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Space image is required',
        });
      }

      const userName = await getUserFullName(req);
      const userInfo = {
        id: user?.id || 0,
        fullName: userName,
        role: user?.role || user?.roleCode || 'organization_admin',
      };

      const requestedStatus = req.body.status || 'ready_to_live';
      const createdSpace = await spacesService.createSpace(orgCode, {
        ...req.body,
        status: requestedStatus,
      }, userInfo);

      // Evaluate approval rule for spaces
      const finalStatus = await evaluateApprovalRuleAndStatus({
        orgCode,
        type: 'explore_space',
        title,
        insertId: createdSpace.id,
        tableName: 'tb_web_spaces',
        req,
      });

      if (finalStatus !== requestedStatus) {
        await pool.execute(
          `UPDATE tb_web_spaces SET status = ? WHERE id = ?`,
          [finalStatus, createdSpace.id]
        );
        createdSpace.status = finalStatus;
      }

      return res.status(201).json({
        success: true,
        message: finalStatus === 'pending_approval' ? 'Explore Space submitted for approval' : 'Explore Space created successfully',
        data: createdSpace,
        item: createdSpace,
      });
    } catch (error) {
      console.error('[SpacesController.createSpace] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create explore space',
        error: error.message,
      });
    }
  }

  // PUT /cpanel-api/spaces/:id (and PATCH)
  async updateSpace(req, res) {
    try {
      const { id } = req.params;
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || user?.org_code || req.user?.org_code || 'taiton';

      const userName = await getUserFullName(req);
      const userInfo = {
        id: user?.id || 0,
        fullName: userName,
        role: user?.role || user?.roleCode || 'organization_admin',
      };

      const updatedSpace = await spacesService.updateSpace(id, orgCode, req.body, userInfo);

      return res.status(200).json({
        success: true,
        message: 'Explore Space updated successfully',
        data: updatedSpace,
        item: updatedSpace,
      });
    } catch (error) {
      console.error('[SpacesController.updateSpace] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update explore space',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/spaces/:id
  async deleteSpace(req, res) {
    try {
      const { id } = req.params;
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || user?.org_code || req.user?.org_code || 'taiton';

      const userName = await getUserFullName(req);
      const userInfo = {
        id: user?.id || 0,
        fullName: userName,
        role: user?.role || user?.roleCode || 'organization_admin',
      };

      await spacesService.deleteSpace(id, orgCode, userInfo);

      return res.status(200).json({
        success: true,
        message: `Explore Space #${id} deleted successfully`,
      });
    } catch (error) {
      console.error('[SpacesController.deleteSpace] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete explore space',
        error: error.message,
      });
    }
  }

  // PATCH /cpanel-api/spaces/:id/view
  async toggleView(req, res) {
    try {
      const { id } = req.params;
      const { view } = req.body;
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || user?.org_code || req.user?.org_code || 'taiton';

      const userName = await getUserFullName(req);
      const result = await spacesService.toggleView(id, orgCode, view, {
        id: user?.id || 0,
        fullName: userName,
      });

      return res.status(200).json({
        success: true,
        message: `Space visibility updated to ${result.view}`,
        data: result,
      });
    } catch (error) {
      console.error('[SpacesController.toggleView] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to toggle visibility',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/public/spaces
  async getPublicSpaces(req, res) {
    try {
      const orgCode = req.query.org_code || 'taiton';
      const spaces = await spacesService.getPublicSpaces(orgCode);
      return res.status(200).json({
        success: true,
        data: spaces,
        spaces,
      });
    } catch (error) {
      console.error('[SpacesController.getPublicSpaces] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch public spaces',
        error: error.message,
      });
    }
  }
}

module.exports = new SpacesController();
