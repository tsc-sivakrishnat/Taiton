const adminService = require('../services/admin.service');
const { pool } = require('../../resources/connection');

function normalizeRole(r) {
  const s = String(r || '').toLowerCase().trim();
  if (s === 'org_admin' || s === 'organization_admin') return 'organization_admin';
  if (s === 'super_admin' || s === 'sys_admin' || s === 'system_admin') return 'super_admin';
  if (s === 'super_employee') return 'super_employee';
  if (s === 'employee' || s === 'employee_2') return 'employee';
  return s;
}

class AdminController {
  // GET /cpanel-api/admin/roles
  async getRoles(req, res) {
    try {
      const orgCode = req.user?.org_code || req.query?.org_code;
      const roles = await adminService.getRoles(orgCode);
      return res.status(200).json({
        success: true,
        roles,
      });
    } catch (err) {
      console.error('[AdminController.getRoles] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch roles',
        error: err.message,
      });
    }
  }

  // GET /cpanel-api/admin/actors
  async getActors(req, res) {
    try {
      const { limit, offset, q } = req.query;
      const orgCode = req.user?.org_code || req.query?.org_code;
      const result = await adminService.getActors({ orgCode, limit, offset, q });
      return res.status(200).json({
        success: true,
        total: result.total,
        items: result.items,
      });
    } catch (err) {
      console.error('[AdminController.getActors] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch actors',
        error: err.message,
      });
    }
  }

  // GET /cpanel-api/admin/actors/export
  async exportActorsCsv(req, res) {
    try {
      const { q } = req.query;
      const orgCode = req.user?.org_code || req.query?.org_code;
      const csvData = await adminService.exportActorsCsv({ orgCode, q });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=accounts-export.csv');
      return res.status(200).send(csvData);
    } catch (err) {
      console.error('[AdminController.exportActorsCsv] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to export CSV',
        error: err.message,
      });
    }
  }

  // POST /cpanel-api/admin/actors
  async registerActor(req, res) {
    try {
      const { fullName, email, mobile, role, org_code } = req.body;
      const targetOrg = req.user?.org_code || org_code;
      const makerRole = req.user?.role || 'organization_admin';
      const makerId = req.user?.id || 0;
      const makerName = req.user?.displayName || req.user?.full_name || req.user?.email || 'Organization Admin';

      if (!fullName || !email || !mobile) {
        return res.status(400).json({
          success: false,
          message: 'Full name, email, and mobile number are required',
        });
      }

      // Check active approval rules for targetOrg
      const [ruleRows] = await pool.execute(
        `SELECT r.*, cr.route as resource FROM tb_org_rules r
         LEFT JOIN tb_config_routes cr ON r.route_id = cr.id
         WHERE LOWER(r.org_code) = LOWER(?) AND r.status = 'active'
         ORDER BY r.id DESC`,
        [targetOrg]
      );

      const normalizedMaker = normalizeRole(makerRole);
      const rawMaker = String(makerRole || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
      let hasMatchingMakerRule = false;
      let allCheckerRoles = [];

      for (const rule of ruleRows) {
        const routeStr = String(rule.resource || '').toLowerCase();
        if (
          routeStr.includes('user') ||
          routeStr.includes('account') ||
          routeStr.includes('member') ||
          rule.route_id === 16 ||
          rule.route_id === 17
        ) {
          let makerRoles = [];
          try {
            makerRoles = typeof rule.maker_role_ids === 'string'
              ? JSON.parse(rule.maker_role_ids)
              : (rule.maker_role_ids || []);
          } catch (e) {
            makerRoles = typeof rule.maker_role_ids === 'string' ? rule.maker_role_ids.split(',').map(s => s.trim()) : [];
          }

          const normalizedMakers = makerRoles.map(normalizeRole);
          const rawMakers = makerRoles.map(m => String(m || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));

          if (
            normalizedMakers.length > 0 && (
              normalizedMakers.includes('*') ||
              normalizedMakers.includes('all') ||
              normalizedMakers.includes(normalizedMaker) ||
              rawMakers.includes(rawMaker)
            )
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
      }

      const initialStatus = hasMatchingMakerRule ? 'pending_approval' : 'active';

      const actor = await adminService.registerActor({
        orgCode: targetOrg,
        fullName,
        email,
        mobile,
        role: role || 'employee',
        status: initialStatus,
        makerId,
        makerName,
      });

      if (hasMatchingMakerRule) {
        await pool.execute(
          `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
           VALUES (?, 'tb_board_users', 'user', ?, ?, ?, ?, ?, 'pending')`,
          [targetOrg, `${fullName} (${email})`, actor.id, makerId, makerName, `Created user ${fullName} (${email}) pending approval`]
        );

        if (allCheckerRoles.length > 0) {
          try {
            const rawCheckers = allCheckerRoles.map(r => String(r || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
            const normalizedCheckers = allCheckerRoles.map(normalizeRole);
            const allCheckerTerms = Array.from(new Set([...rawCheckers, ...normalizedCheckers]));
            const placeholders = allCheckerTerms.map(() => '?').join(',');

            const [checkerUsers] = await pool.execute(
              `SELECT id FROM tb_board_users 
               WHERE LOWER(org_code) = LOWER(?) 
               AND LOWER(role) IN (${placeholders})`,
              [targetOrg, ...allCheckerTerms]
            );

            for (const u of checkerUsers) {
              if (Number(u.id) !== Number(makerId)) {
                await pool.execute(
                  `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
                  [targetOrg, makerId, u.id, `Approval required: User creation for "${fullName}" (${email})`]
                );
              }
            }
          } catch (nErr) {
            console.error('[admin.controller.registerActor] Notification error:', nErr.message);
          }
        }

        actor.status = 'pending_approval';
        actor.message = 'The user registration has been submitted for approval.';
      }

      return res.status(201).json({
        success: true,
        message: hasMatchingMakerRule ? 'User registration submitted for approval' : 'Actor registered successfully',
        actor,
      });
    } catch (err) {
      console.error('[AdminController.registerActor] Error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to register actor',
      });
    }
  }

  // PATCH or PUT /cpanel-api/admin/actors/:id
  async updateActor(req, res) {
    try {
      const { id } = req.params;
      const actor = await adminService.updateActor(id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Actor updated successfully',
        actor,
      });
    } catch (err) {
      console.error('[AdminController.updateActor] Error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to update actor',
      });
    }
  }

  // DELETE /cpanel-api/admin/actors/:id
  async deleteActor(req, res) {
    try {
      const { id } = req.params;
      await pool.execute(`UPDATE tb_board_users SET status = 'deleted' WHERE id = ?`, [id]);
      return res.status(200).json({
        success: true,
        message: 'Actor deleted successfully',
      });
    } catch (err) {
      console.error('[AdminController.deleteActor] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete actor',
        error: err.message,
      });
    }
  }
}

module.exports = new AdminController();
