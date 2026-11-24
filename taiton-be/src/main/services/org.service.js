const bcrypt = require('bcryptjs');
const { pool } = require('../../resources/connection');
const ORG_QUERIES = require('../queries/org.queries');

class OrgService {
  async getOrganizations() {
    const [rows] = await pool.execute(ORG_QUERIES.GET_ALL_ORGANIZATIONS);
    return rows;
  }

  async getOrgByCode(orgCode) {
    if (!orgCode) return null;
    const [rows] = await pool.execute(ORG_QUERIES.GET_ORGANIZATION_BY_CODE, [orgCode]);
    return rows.length > 0 ? rows[0] : null;
  }

  async getOrgByIdOrCode(idOrCode) {
    if (!idOrCode) return null;
    const numericId = Number(idOrCode) || 0;
    const strCode = String(idOrCode || '');
    const [rows] = await pool.execute(ORG_QUERIES.GET_ORGANIZATION_BY_ID_OR_CODE, [numericId, strCode]);
    return rows.length > 0 ? rows[0] : null;
  }

  async createOrganization(code, name) {
    const orgCode = String(code).trim().toLowerCase();
    const orgName = String(name).trim();

    const existing = await this.getOrgByCode(orgCode);
    if (existing) {
      const err = new Error(`Organization with code '${orgCode}' already exists`);
      err.status = 400;
      throw err;
    }

    const [result] = await pool.execute(ORG_QUERIES.INSERT_ORGANIZATION, [orgCode, orgName]);

    // Automatically create default Organization Admin role for the newly created organization
    try {
      await pool.execute(
        `INSERT INTO tb_board_roles (org_code, role, label, description, priority, status)
         VALUES (?, 'organization_admin', 'Organization Admin', 'Organization Administrator with full tenant access', 1, 'active')`,
        [orgCode]
      );
    } catch (e) {
      console.error('[OrgService.createOrganization] Failed to create default Organization Admin role:', e.message);
    }

    return {
      id: result.insertId,
      org_code: orgCode,
      org_name: orgName,
      status: 'active',
    };
  }

  async getRoles(orgCode) {
    if (!orgCode) return [];
    let [rows] = await pool.execute(ORG_QUERIES.GET_ROLES_BY_ORG, [orgCode]);

    // Ensure the default Organization Admin role exists for active organizations (except techtrole sys admin org)
    if (orgCode.toLowerCase() !== 'techtrole') {
      const hasAdmin = (rows || []).some((r) => {
        const code = String(r.code || r.role || '').toLowerCase();
        return code === 'organization_admin' || code === 'org_admin';
      });

      if (!hasAdmin) {
        const org = await this.getOrgByCode(orgCode);
        if (org) {
          try {
            await pool.execute(
              `INSERT INTO tb_board_roles (org_code, role, label, description, priority, status)
               VALUES (?, 'organization_admin', 'Organization Admin', 'Organization Administrator with full tenant access', 1, 'active')`,
              [org.org_code]
            );
            const [refreshed] = await pool.execute(ORG_QUERIES.GET_ROLES_BY_ORG, [org.org_code]);
            rows = refreshed;
          } catch (e) {
            console.error('[OrgService.getRoles] Auto-create Organization Admin role error:', e.message);
          }
        }
      }
    }

    return rows || [];
  }

  async createRole(orgIdOrCode, data) {
    const org = await this.getOrgByIdOrCode(orgIdOrCode);
    const orgCode = org ? org.org_code : String(orgIdOrCode || '');
    if (!orgCode) {
      const err = new Error(`Organization with ID/code '${orgIdOrCode}' not found`);
      err.status = 404;
      throw err;
    }

    const { code, name, role, label, description, priority } = data;
    const roleCode = String(code || role || '').trim().toLowerCase();
    const roleLabel = String(name || label || '').trim();
    const roleDesc = description ? String(description).trim() : null;

    if (!roleCode || !roleLabel) {
      const err = new Error('Role code and role name/label are required');
      err.status = 400;
      throw err;
    }

    const existingRoles = await this.getRoles(orgCode);
    if (existingRoles.some((r) => String(r.code || r.role).toLowerCase() === roleCode)) {
      const err = new Error(`Role '${roleCode}' already exists in organization '${orgCode}'`);
      err.status = 400;
      throw err;
    }

    const rolePriority = Number(priority) || (existingRoles.length + 1);

    const [result] = await pool.execute(ORG_QUERIES.INSERT_ROLE, [
      orgCode,
      roleCode,
      roleLabel,
      roleDesc,
      rolePriority,
    ]);

    return {
      id: result.insertId,
      org_code: orgCode,
      code: roleCode,
      name: roleLabel,
      role: roleCode,
      label: roleLabel,
      description: roleDesc,
      priority: rolePriority,
      status: 'active',
    };
  }

  async deleteRole(orgIdOrCode, roleCode) {
    const org = await this.getOrgByIdOrCode(orgIdOrCode);
    const orgCode = org ? org.org_code : String(orgIdOrCode || '');
    if (!orgCode) return false;
    const cleanCode = String(roleCode || '').trim().toLowerCase();
    if (cleanCode === 'org_admin' || cleanCode === 'organization_admin') {
      const err = new Error('Organization administrator role is protected and cannot be deleted');
      err.status = 400;
      throw err;
    }
    const [result] = await pool.execute(ORG_QUERIES.DELETE_ROLE, [orgCode, roleCode]);
    return result.affectedRows > 0;
  }

  async getOrgAdmins(orgCode) {
    if (!orgCode) return [];
    const [rows] = await pool.execute(ORG_QUERIES.GET_ADMINS_BY_ORG, [orgCode]);
    return rows;
  }

  async createOrgAdmin(orgIdOrCode, data) {
    const org = await this.getOrgByIdOrCode(orgIdOrCode);
    const orgCode = org ? org.org_code : String(orgIdOrCode || '');
    if (!orgCode) {
      const err = new Error(`Organization with ID/code '${orgIdOrCode}' not found`);
      err.status = 404;
      throw err;
    }

    const { email, fullName, full_name, mobile } = data;
    const userEmail = String(email || '').trim().toLowerCase();
    const userFullName = String(fullName || full_name || '').trim();
    const userMobile = String(mobile || '').trim();

    if (!userEmail || !userFullName || !userMobile) {
      const err = new Error('Email, Full Name, and Mobile Number are required');
      err.status = 400;
      throw err;
    }

    const orgRoles = await this.getRoles(orgCode);
    let targetRole = data.role || data.roleCode;
    if (!targetRole) {
      if (orgRoles.length > 0) {
        targetRole = orgRoles[0].code || orgRoles[0].role;
      } else {
        targetRole = 'organization_admin';
      }
    }

    const [existingMobile] = await pool.execute(ORG_QUERIES.CHECK_DUPLICATE_MOBILE, [userMobile]);
    if (existingMobile.length > 0) {
      const err = new Error(`Mobile number '${userMobile}' is already registered`);
      err.status = 400;
      throw err;
    }

    const [existingEmail] = await pool.execute(ORG_QUERIES.CHECK_DUPLICATE_EMAIL, [userEmail]);
    if (existingEmail.length > 0) {
      const err = new Error(`Email '${userEmail}' is already registered`);
      err.status = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(userMobile, 10);

    const [result] = await pool.execute(ORG_QUERIES.INSERT_ORG_USER, [
      orgCode,
      userFullName,
      userEmail,
      hashedPassword,
      userMobile,
      targetRole,
    ]);

    return {
      id: result.insertId,
      org_code: orgCode,
      fullName: userFullName,
      full_name: userFullName,
      email: userEmail,
      mobile: userMobile,
      role: targetRole,
      isActive: 0,
      status: 'active',
    };
  }

  async updateOrgAdmin(orgIdOrCode, userId, data) {
    const org = await this.getOrgByIdOrCode(orgIdOrCode);
    const orgCode = org ? org.org_code : String(orgIdOrCode || '');

    const { email, fullName, full_name, mobile, role, roleCode, status } = data;
    const userEmail = email ? String(email).trim().toLowerCase() : null;
    const userFullName = fullName || full_name ? String(fullName || full_name).trim() : null;
    const userMobile = mobile ? String(mobile).trim() : null;
    const targetRole = role || roleCode || null;

    const [existing] = await pool.execute(`SELECT * FROM tb_board_users WHERE id = ?`, [userId]);
    if (existing.length === 0) {
      const err = new Error(`User with ID #${userId} not found`);
      err.status = 404;
      throw err;
    }

    if (userEmail && userEmail !== existing[0].email) {
      const [dupeEmail] = await pool.execute(`SELECT id FROM tb_board_users WHERE LOWER(email) = LOWER(?) AND id != ?`, [userEmail, userId]);
      if (dupeEmail.length > 0) {
        const err = new Error(`Email '${userEmail}' is already registered`);
        err.status = 400;
        throw err;
      }
    }

    if (userMobile && userMobile !== existing[0].mobile) {
      const [dupeMobile] = await pool.execute(`SELECT id FROM tb_board_users WHERE mobile = ? AND id != ?`, [userMobile, userId]);
      if (dupeMobile.length > 0) {
        const err = new Error(`Mobile number '${userMobile}' is already registered`);
        err.status = 400;
        throw err;
      }
    }

    const updatedFullName = userFullName || existing[0].full_name;
    const updatedEmail = userEmail || existing[0].email;
    const updatedMobile = userMobile || existing[0].mobile;
    const updatedRole = targetRole || existing[0].role;
    const updatedStatus = status || existing[0].status;

    await pool.execute(
      `UPDATE tb_board_users SET full_name = ?, email = ?, mobile = ?, role = ?, status = ?, isActive = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [updatedFullName, updatedEmail, updatedMobile, updatedRole, updatedStatus, updatedStatus === 'active' ? 1 : 0, userId]
    );

    return {
      id: Number(userId),
      org_code: orgCode || existing[0].org_code,
      fullName: updatedFullName,
      full_name: updatedFullName,
      email: updatedEmail,
      mobile: updatedMobile,
      role: updatedRole,
      status: updatedStatus,
    };
  }

  async deleteOrgAdmin(orgIdOrCode, userId) {
    const [rows] = await pool.execute(`SELECT * FROM tb_board_users WHERE id = ?`, [userId]);
    if (rows.length === 0) return false;
    await pool.execute(`UPDATE tb_board_users SET status = 'deleted', isActive = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);
    return true;
  }

  async getNavIcons() {
    const [rows] = await pool.execute(ORG_QUERIES.GET_NAV_ICONS);
    return rows;
  }

  async getConfigRoutes() {
    const [rows] = await pool.execute(ORG_QUERIES.GET_CONFIG_ROUTES);
    return rows;
  }

  async updateUiPrefs(orgCode, uiPrefs) {
    const [result] = await pool.execute(ORG_QUERIES.UPDATE_ORG_UI_PREFS, [JSON.stringify(uiPrefs), orgCode]);
    return result.affectedRows > 0;
  }

  async getNavigation(orgCode) {
    if (!orgCode) return [];
    const [rows] = await pool.execute(ORG_QUERIES.GET_NAVIGATION_BY_ORG, [orgCode]);
    return rows;
  }

  async createNavigation(orgCode, data) {
    let { icon_id = null, icon, route_id = null, route, label, position = 'header', access_matrix = null, rolesCsv, status = 'active' } = data;
    const sort_order = Number(data.sort_order ?? data.sortOrder ?? data.sort ?? 0);

    // Resolve route_id from tb_config_routes if missing
    if (!route_id && route) {
      const numericRouteId = Number(route);
      if (!isNaN(numericRouteId) && numericRouteId > 0) {
        route_id = numericRouteId;
      } else {
        const [rRows] = await pool.execute('SELECT id FROM tb_config_routes WHERE route = ? OR LOWER(page) = LOWER(?)', [route, route]);
        if (rRows.length > 0) {
          route_id = rRows[0].id;
        }
      }
    }

    // Resolve icon_id from tb_config_icons if missing
    if (!icon_id && icon) {
      const numericIconId = Number(icon);
      if (!isNaN(numericIconId) && numericIconId > 0) {
        icon_id = numericIconId;
      } else {
        const [iRows] = await pool.execute('SELECT id FROM tb_config_icons WHERE LOWER(code) = LOWER(?) OR LOWER(label) = LOWER(?)', [icon, icon]);
        if (iRows.length > 0) {
          icon_id = iRows[0].id;
        }
      }
    }

    if (!route_id) route_id = 1;

    let matrixVal = access_matrix;
    if (!matrixVal && rolesCsv) {
      matrixVal = rolesCsv;
    }
    if (!matrixVal && data.roleCodes?.length) {
      matrixVal = data.roleCodes.join(',');
    }

    const dbPosition = position === 'top' ? 'header' : position;

    // Support updating existing nav item
    if (data.id) {
      await pool.execute(
        `UPDATE tb_board_navs 
         SET icon_id = ?, route_id = ?, label = ?, position = ?, sort_order = ?, access_matrix = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND LOWER(org_code) = LOWER(?)`,
        [icon_id, route_id, label, dbPosition, sort_order, matrixVal ? String(matrixVal) : null, status, data.id, orgCode]
      );
      return { id: data.id, org_code: orgCode, icon_id, route_id, label, position: dbPosition, sort_order };
    }

    const [result] = await pool.execute(ORG_QUERIES.INSERT_NAVIGATION, [
      orgCode,
      icon_id,
      route_id,
      label,
      dbPosition,
      sort_order,
      matrixVal ? String(matrixVal) : null,
      status,
    ]);

    return {
      id: result.insertId,
      org_code: orgCode,
      icon_id,
      route_id,
      label,
      position: dbPosition,
      sort_order,
    };
  }

  async reorderNavigation(orgCode, items) {
    if (!Array.isArray(items)) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const navId = item.id;
      const sortOrder = Number(item.sort_order ?? item.sortOrder ?? i + 1);
      await pool.execute(
        `UPDATE tb_board_navs SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND LOWER(org_code) = LOWER(?)`,
        [sortOrder, navId, orgCode]
      );
    }
  }

  async deleteNavigation(id, orgCode) {
    const [result] = await pool.execute(ORG_QUERIES.DELETE_NAVIGATION, [id, orgCode]);
    return result.affectedRows > 0;
  }

  async getAuditLogs(orgCode, limit = 50, offset = 0) {
    if (!orgCode) return [];
    const [rows] = await pool.execute(ORG_QUERIES.GET_AUDIT_LOGS_BY_ORG, [orgCode, String(limit), String(offset)]);
    return rows;
  }

  async createAuditLog(data) {
    const { org_code, table_name, record_id, action, maker, message = null, old_val = null, new_val = null, created_by } = data;

    const [result] = await pool.execute(ORG_QUERIES.INSERT_AUDIT_LOG, [
      org_code,
      table_name,
      record_id,
      action,
      maker,
      message,
      old_val ? JSON.stringify(old_val) : null,
      new_val ? JSON.stringify(new_val) : null,
      created_by,
    ]);

    return result.insertId;
  }
}

module.exports = new OrgService();
