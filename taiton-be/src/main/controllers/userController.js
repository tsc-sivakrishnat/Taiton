const userService = require('../services/userService');
const { pool } = require('../../resources/connection');
const { logAudit } = require('../utils/auditLogger');

class UserController {
  // GET /api/users - Retrieves list of users with optional filtering.
  async getUsers(req, res) {
    try {
      const { org_code, status } = req.query;
      const users = await userService.getAllUsers({ org_code, status });
      return res.status(200).json({
        success: true,
        data: users,
        users,
      });
    } catch (error) {
      console.error('[UserController.getUsers] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: error.message,
      });
    }
  }

  // GET /api/users/:id - Retrieves a single user by ID.
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with ID ${id} not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error('[UserController.getUserById] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        error: error.message,
      });
    }
  }

  // POST /api/users - Creates a new user.
  async createUser(req, res) {
    try {
      const { org_code, full_name, email, password, mobile, role, isActive, status } = req.body;
      const targetOrg = org_code || req.user?.org_code;
      const makerRole = req.user?.role || 'employee';
      const makerId = req.user?.id || 0;
      const makerName = req.user?.displayName || req.user?.email || 'User';

      if (!targetOrg || !full_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: org_code, full_name, email, and password are required',
        });
      }

      const newUser = await userService.createUser({
        org_code: targetOrg,
        full_name,
        email,
        password,
        mobile,
        role: role || 'user',
        isActive: isActive !== undefined ? isActive : 1,
        status: status || 'draft',
      });

      // Check active approval rule for User creation
      const [ruleRows] = await pool.execute(
        `SELECT r.*, cr.route as route_path, cr.page as route_name FROM tb_org_rules r
         LEFT JOIN tb_config_routes cr ON r.route_id = cr.id
         WHERE LOWER(r.org_code) = LOWER(?) AND r.status = 'active'
         ORDER BY r.id DESC`,
        [targetOrg]
      );

      let matchedRule = null;
      let makerRoles = [];
      let checkerRoles = [];

      for (const rule of ruleRows) {
        const routeStr = String(rule.route_path || '').toLowerCase();
        const routeName = String(rule.route_name || '').toLowerCase();
        const isUserRule =
          routeStr.includes('user') ||
          routeStr.includes('account') ||
          routeStr.includes('member') ||
          routeName.includes('user') ||
          routeName.includes('account') ||
          routeName.includes('member') ||
          rule.route_id === 16 ||
          rule.route_id === 17;

        if (isUserRule) {
          matchedRule = rule;
          try { makerRoles = typeof rule.maker_role_ids === 'string' ? JSON.parse(rule.maker_role_ids) : (rule.maker_role_ids || []); } catch (e) {}
          try { checkerRoles = typeof rule.check_role_ids === 'string' ? JSON.parse(rule.check_role_ids) : (rule.check_role_ids || []); } catch (e) {}
          break;
        }
      }

      let hasRule = false;
      if (matchedRule) {
        const normMakerRole = String(makerRole || '').toLowerCase().trim().replace(/\s+/g, '_');
        const normMakers = makerRoles.map(r => String(r || '').toLowerCase().trim().replace(/\s+/g, '_'));
        if (
          normMakers.length === 0 ||
          normMakers.includes('*') ||
          normMakers.includes('all') ||
          normMakers.includes(normMakerRole)
        ) {
          hasRule = true;
        }
      }

      let finalStatus = 'active';
      if (hasRule) {
        finalStatus = 'pending_approval';

        await pool.execute(`UPDATE tb_board_users SET status = 'pending_approval' WHERE id = ?`, [newUser.id]);

        await pool.execute(
          `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
           VALUES (?, 'tb_board_users', 'user', ?, ?, ?, ?, ?, 'pending')`,
          [targetOrg, `${full_name} (${email})`, newUser.id, makerId, makerName, `Created user ${full_name} (${email}) pending approval`]
        );

        if (checkerRoles.length > 0) {
          try {
            const rawCheckers = checkerRoles.map(r => String(r || '').toLowerCase().trim());
            const placeholders = rawCheckers.map(() => '?').join(',');
            const [checkerUsers] = await pool.execute(
              `SELECT id, email FROM tb_board_users 
               WHERE LOWER(org_code) = LOWER(?) 
               AND LOWER(role) IN (${placeholders})`,
              [targetOrg, ...rawCheckers]
            );

            const notifMsg = `Approval required: ${makerName} (${makerRole}) created user "${full_name}" (${email}) pending approval.`;

            for (const u of checkerUsers) {
              if (Number(u.id) !== Number(makerId)) {
                await pool.execute(
                  `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
                  [targetOrg, makerId, u.id, notifMsg]
                );
              }
            }
          } catch (nErr) {
            console.error('[userController.createUser] Notification error:', nErr.message);
          }
        }
      } else {
        await pool.execute(`UPDATE tb_board_users SET status = 'active' WHERE id = ?`, [newUser.id]);
      }

      newUser.status = finalStatus;

      await logAudit({
        orgCode: targetOrg,
        tableName: 'tb_board_users',
        recordId: newUser.id,
        action: 'insert',
        maker: makerName || 'Admin User',
        createdBy: makerId || 0,
        message: `Created user "${full_name}" (${email})`,
        newVal: { fullName: full_name, email, mobile, role },
      });

      return res.status(201).json({
        success: true,
        message: hasRule ? 'User creation submitted for approval' : 'User created successfully',
        data: newUser,
      });
    } catch (error) {
      console.error('[UserController.createUser] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: error.message,
      });
    }
  }

  // PUT /api/users/:id - Updates an existing user by ID.
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: `User with ID ${id} not found`,
        });
      }

      const updatedUser = await userService.updateUser(id, updateData);
      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      console.error('[UserController.updateUser] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message,
      });
    }
  }

  // DELETE /api/users/:id - Soft-deletes or deletes a user.
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      return res.status(200).json({
        success: true,
        message: `User with ID ${id} deleted successfully`,
      });
    } catch (error) {
      console.error('[UserController.deleteUser] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message,
      });
    }
  }
}

module.exports = new UserController();
