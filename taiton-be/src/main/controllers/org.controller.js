const orgService = require('../services/org.service');
const { pool } = require('../../resources/connection');

function extractUserFromReq(req) {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded) return decoded;
    } catch {}
  }
  return null;
}

class OrgController {
  // GET /cpanel-api/organizations or /cpanel-api/platform/organizations
  async getOrganizations(req, res) {
    try {
      const orgs = await orgService.getOrganizations();
      return res.status(200).json({
        success: true,
        organizations: orgs,
        data: orgs,
      });
    } catch (error) {
      console.error('[OrgController.getOrganizations] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/organizations/:code
  async getOrgByCode(req, res) {
    try {
      const { code } = req.params;
      const org = await orgService.getOrgByCode(code);
      if (!org) {
        return res.status(404).json({
          success: false,
          message: `Organization with code '${code}' not found`,
        });
      }
      return res.status(200).json({
        success: true,
        organization: org,
        data: org,
      });
    } catch (error) {
      console.error('[OrgController.getOrgByCode] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch organization detail',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/organizations or /cpanel-api/platform/organizations
  async createOrganization(req, res) {
    try {
      const { code, name, org_code, org_name } = req.body;
      const targetCode = code || org_code;
      const targetName = name || org_name;

      if (!targetCode || !targetName) {
        return res.status(400).json({
          success: false,
          message: 'Organization code and name are required',
        });
      }

      const org = await orgService.createOrganization(targetCode, targetName);
      return res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        organization: org,
        data: org,
      });
    } catch (error) {
      console.error('[OrgController.createOrganization] Error:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to create organization',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/org/roles or /cpanel-api/platform/organizations/:orgId/roles
  async getOrgRoles(req, res) {
    try {
      const { orgId } = req.params;
      let orgCode = null;

      if (orgId && String(orgId).trim() !== 'undefined' && String(orgId).trim() !== 'null') {
        const org = await orgService.getOrgByIdOrCode(orgId);
        orgCode = org ? org.org_code : String(orgId);
      }

      if (!orgCode) {
        const user = extractUserFromReq(req);
        orgCode = req.query.org_code || req.body?.org_code || user?.org_code || user?.orgCode || req.user?.org_code || null;
      }

      if (!orgCode) {
        return res.status(200).json({ success: true, roles: [], data: [] });
      }
      const roles = await orgService.getRoles(orgCode);
      return res.status(200).json({
        success: true,
        roles,
        data: roles,
      });
    } catch (error) {
      console.error('[OrgController.getOrgRoles] Error:', error);
      return res.status(200).json({
        success: true,
        roles: [],
        data: [],
      });
    }
  }

  // POST /cpanel-api/platform/organizations/:orgId/roles
  async createOrgRole(req, res) {
    try {
      const { orgId } = req.params;
      const role = await orgService.createRole(orgId, req.body);
      return res.status(201).json({
        success: true,
        message: 'Role created successfully',
        role,
        data: role,
      });
    } catch (error) {
      console.error('[OrgController.createOrgRole] Error:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to create role',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/platform/organizations/:orgId/roles/:roleCode
  async deleteOrgRole(req, res) {
    try {
      const { orgId, roleCode } = req.params;
      await orgService.deleteRole(orgId, roleCode);
      return res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      console.error('[OrgController.deleteOrgRole] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete role',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/platform/organizations/:orgId/org-admins
  async getOrgAdmins(req, res) {
    try {
      const { orgId } = req.params;
      let orgCode = req.query.org_code;
      if (!orgCode && orgId) {
        const org = await orgService.getOrgByIdOrCode(orgId);
        orgCode = org ? org.org_code : null;
      }
      if (!orgCode) {
        return res.status(200).json({ success: true, admins: [], data: [] });
      }
      const admins = await orgService.getOrgAdmins(orgCode);
      return res.status(200).json({
        success: true,
        admins,
        data: admins,
      });
    } catch (error) {
      return res.status(200).json({
        success: true,
        admins: [],
        data: [],
      });
    }
  }

  // POST /cpanel-api/platform/organizations/:orgId/org-admin
  async createOrgAdmin(req, res) {
    try {
      const { orgId } = req.params;
      const admin = await orgService.createOrgAdmin(orgId, req.body);
      return res.status(201).json({
        success: true,
        message: 'Organization administrator created successfully',
        admin,
        data: admin,
      });
    } catch (error) {
      console.error('[OrgController.createOrgAdmin] Error:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to create organization administrator',
        error: error.message,
      });
    }
  }

  // PATCH or PUT /cpanel-api/platform/organizations/:orgId/org-admins/:userId
  async updateOrgAdmin(req, res) {
    try {
      const { orgId, userId } = req.params;
      const targetUserId = userId || req.params.id;
      const admin = await orgService.updateOrgAdmin(orgId, targetUserId, req.body);
      return res.status(200).json({
        success: true,
        message: 'Organization administrator updated successfully',
        admin,
        data: admin,
      });
    } catch (error) {
      console.error('[OrgController.updateOrgAdmin] Error:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to update organization administrator',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/platform/organizations/:orgId/org-admins/:userId or /members/:userId
  async deleteOrgAdmin(req, res) {
    try {
      const { orgId, userId } = req.params;
      const targetUserId = userId || req.params.id;
      await orgService.deleteOrgAdmin(orgId, targetUserId);
      return res.status(200).json({
        success: true,
        message: 'Organization administrator removed successfully',
      });
    } catch (error) {
      console.error('[OrgController.deleteOrgAdmin] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove organization administrator',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/platform/nav-icons
  async getNavIcons(req, res) {
    try {
      const icons = await orgService.getNavIcons();
      return res.status(200).json({
        success: true,
        icons,
        data: icons,
      });
    } catch (error) {
      return res.status(200).json({
        success: true,
        icons: [],
        data: [],
      });
    }
  }

  // GET /cpanel-api/platform/routes or /cpanel-api/platform/config-routes
  async getConfigRoutes(req, res) {
    try {
      const routes = await orgService.getConfigRoutes();
      return res.status(200).json({
        success: true,
        routes,
        data: routes,
      });
    } catch (error) {
      return res.status(200).json({
        success: true,
        routes: [],
        data: [],
      });
    }
  }

  // GET /cpanel-api/navigation
  async getNavigation(req, res) {
    const navigationController = require('./navigation.controller');
    return navigationController.getNavigation(req, res);
  }

  // POST /cpanel-api/navigation or /cpanel-api/platform/organizations/:orgId/nav
  async createNavigation(req, res) {
    try {
      const targetOrgRef = req.params.orgId || req.params.code || req.body.orgId || req.body.org_code || req.query.org_code;
      let orgCode = null;
      if (targetOrgRef) {
        const org = await orgService.getOrgByIdOrCode(targetOrgRef);
        orgCode = org ? org.org_code : String(targetOrgRef);
      }

      const { route_id, route, label } = req.body;
      if (!orgCode || (!route_id && !route) || !label) {
        return res.status(400).json({
          success: false,
          message: 'org_code, route/route_id and label are required for navigation item',
        });
      }

      const navItem = await orgService.createNavigation(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Navigation item created successfully',
        data: navItem,
      });
    } catch (error) {
      console.error('[OrgController.createNavigation] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create navigation item',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/platform/organizations/:orgId/nav/reorder
  async reorderNavigation(req, res) {
    try {
      const { orgId } = req.params;
      const items = req.body.items || req.body;
      const org = await orgService.getOrgByIdOrCode(orgId);
      const orgCode = org ? org.org_code : String(orgId);
      await orgService.reorderNavigation(orgCode, items);
      return res.status(200).json({
        success: true,
        message: 'Navigation items reordered successfully',
      });
    } catch (error) {
      console.error('[OrgController.reorderNavigation] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reorder navigation items',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/platform/organizations/:orgId/nav/:navId
  async deleteNavigation(req, res) {
    try {
      const { orgId, navId } = req.params;
      const org = await orgService.getOrgByIdOrCode(orgId);
      const orgCode = org ? org.org_code : String(orgId);
      await orgService.deleteNavigation(navId, orgCode);
      return res.status(200).json({
        success: true,
        message: 'Navigation item deleted successfully',
      });
    } catch (error) {
      console.error('[OrgController.deleteNavigation] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete navigation item',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/audit-logs
  async getAuditLogs(req, res) {
    try {
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const limit = Number(req.query.limit || 100);
      const offset = Number(req.query.offset || 0);
      let tableName = req.query.table_name || req.query.tableName || null;
      const recordId = req.query.record_id || req.query.recordId || null;
      const entityType = req.query.type || req.query.entity_type || null;

      if (entityType) {
        const typeMap = {
          category: 'tb_pdt_categories',
          subcategory: 'tb_pdt_categories',
          product: 'tb_pdt_products',
          variant: 'tb_pdt_variants'
        };
        if (typeMap[entityType]) {
          tableName = typeMap[entityType];
        }
      }

      let sql = `SELECT a.id, a.org_code, a.table_name, a.record_id, a.action, COALESCE(u.full_name, a.maker) as maker, a.message, a.old_val, a.new_val, a.created_by, a.created_at 
                 FROM tb_board_audit_logs a 
                 LEFT JOIN tb_board_users u ON (LOWER(u.email) = LOWER(a.maker) OR CAST(u.id AS CHAR) = CAST(a.maker AS CHAR))
                 WHERE 1=1`;
      const params = [];

      if (orgCode) {
        sql += ` AND LOWER(a.org_code) = LOWER(?)`;
        params.push(orgCode);
      }

      if (tableName) {
        sql += ` AND (LOWER(a.table_name) = LOWER(?) OR a.table_name LIKE ?)`;
        params.push(tableName, `%${tableName.replace('tb_pdt_', '')}%`);
      }
      if (recordId) {
        sql += ` AND (a.record_id = ? OR CAST(a.record_id AS CHAR) = ?)`;
        params.push(recordId, String(recordId));
      }

      sql += ` ORDER BY a.id DESC LIMIT ${limit} OFFSET ${offset}`;

      const [rows] = await pool.execute(sql, params);

      let approvalRows = [];
      if (recordId && tableName) {
        try {
          let apprSql = `SELECT a.*, COALESCE(c.full_name, a.checker) as checker_name, COALESCE(m.full_name, a.maker_name, a.maker) as maker_full_name 
                         FROM tb_org_approvals a 
                         LEFT JOIN tb_board_users c ON (LOWER(c.email) = LOWER(a.checker) OR CAST(c.id AS CHAR) = CAST(a.checker AS CHAR))
                         LEFT JOIN tb_board_users m ON (LOWER(m.email) = LOWER(a.maker) OR CAST(m.id AS CHAR) = CAST(a.maker AS CHAR))
                         WHERE LOWER(a.table_name) = LOWER(?) AND (a.record_id = ? OR CAST(a.record_id AS CHAR) = ?)`;
          const apprParams = [tableName, recordId, String(recordId)];
          if (orgCode) {
            apprSql += ` AND LOWER(a.org_code) = LOWER(?)`;
            apprParams.push(orgCode);
          }
          apprSql += ` ORDER BY a.id ASC`;
          const [apprs] = await pool.query(apprSql, apprParams);
          approvalRows = apprs;
        } catch (e) { }
      }

      return res.status(200).json({
        success: true,
        data: rows,
        approvals: approvalRows,
      });
    } catch (error) {
      console.error('[OrgController.getAuditLogs] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/org/approval-rules
  async getApprovalRules(req, res) {
    try {
      const authHeader = req.headers.authorization;
      let tokenOrg = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.split(' ')[1];
          const decoded = jwt.decode(token);
          tokenOrg = decoded?.org_code || decoded?.orgCode || null;
        } catch {}
      }
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || tokenOrg;

      if (!orgCode) {
        return res.status(200).json({ success: true, rules: [], data: [] });
      }

      const [rows] = await pool.execute(
        `SELECT r.id, r.org_code, r.route_id, r.maker_role_ids, r.check_role_ids, r.status, cr.route as resource
         FROM tb_org_rules r
         LEFT JOIN tb_config_routes cr ON r.route_id = cr.id
         WHERE LOWER(r.org_code) = LOWER(?) ORDER BY r.id DESC`,
        [orgCode]
      );

      const rules = rows.map((r) => {
        let makerRole = [];
        let checkerRole = [];
        try { makerRole = typeof r.maker_role_ids === 'string' ? JSON.parse(r.maker_role_ids) : (r.maker_role_ids || []); } catch (e) { }
        try { checkerRole = typeof r.check_role_ids === 'string' ? JSON.parse(r.check_role_ids) : (r.check_role_ids || []); } catch (e) { }

        return {
          id: r.id,
          resource: r.resource || '/app/products',
          makerRole,
          checkerRole,
          isActive: r.status === 'active',
        };
      });

      return res.status(200).json({
        success: true,
        rules,
        data: rules,
      });
    } catch (error) {
      console.error('[OrgController.getApprovalRules] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch approval rules',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/org/approval-rules
  async upsertApprovalRule(req, res) {
    try {
      const { id, resource, makerRole, checkerRole, isActive } = req.body;
      const orgCode = req.body.org_code || req.user?.org_code;

      const targetRoute = String(resource || '/app/products').trim();

      const [rRows] = await pool.execute(`SELECT id FROM tb_config_routes WHERE route = ? LIMIT 1`, [targetRoute]);
      let routeId = rRows[0]?.id;
      if (!routeId) {
        const pageName = targetRoute.split('/').pop().replace(/-/g, ' ');
        const [ins] = await pool.execute(`INSERT INTO tb_config_routes (page, route, status) VALUES (?, ?, 'active')`, [pageName, targetRoute]);
        routeId = ins.insertId;
      }

      const makerArray = Array.isArray(makerRole) ? makerRole : String(makerRole || '').split(',').map((s) => s.trim()).filter(Boolean);
      const checkerArray = Array.isArray(checkerRole) ? checkerRole : String(checkerRole || '').split(',').map((s) => s.trim()).filter(Boolean);

      const makerJson = JSON.stringify(makerArray);
      const checkerJson = JSON.stringify(checkerArray);
      const ruleStatus = isActive !== false ? 'active' : 'inactive';

      if (id) {
        await pool.execute(
          `UPDATE tb_org_rules SET route_id = ?, maker_role_ids = ?, check_role_ids = ?, status = ? WHERE id = ?`,
          [routeId, makerJson, checkerJson, ruleStatus, id]
        );
      } else {
        await pool.execute(
          `INSERT INTO tb_org_rules (org_code, route_id, maker_role_ids, check_role_ids, status) VALUES (?, ?, ?, ?, ?)`,
          [orgCode, routeId, makerJson, checkerJson, ruleStatus]
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Approval rule saved successfully',
      });
    } catch (error) {
      console.error('[OrgController.upsertApprovalRule] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save approval rule',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/org/approval-rules/:id
  async deleteApprovalRule(req, res) {
    try {
      const { id } = req.params;
      await pool.execute(`DELETE FROM tb_org_rules WHERE id = ?`, [id]);
      return res.status(200).json({
        success: true,
        message: 'Approval rule deleted successfully',
      });
    } catch (error) {
      console.error('[OrgController.deleteApprovalRule] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete approval rule',
        error: error.message,
      });
    }
  }
}

module.exports = new OrgController();
