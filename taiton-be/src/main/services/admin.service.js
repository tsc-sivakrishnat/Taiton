const bcrypt = require('bcryptjs');
const { pool } = require('../../resources/connection');
const { logAudit } = require('../utils/auditLogger');

class AdminService {
  async getRoles(orgCode) {
    const isDeveloperOrg = orgCode && ['techtrole'].includes(String(orgCode).toLowerCase());

    if (orgCode) {
      const [rows] = await pool.execute(
        `SELECT role AS code, label AS name FROM tb_board_roles WHERE LOWER(org_code) = LOWER(?) AND status = 'active' ${isDeveloperOrg ? '' : "AND LOWER(role) != 'sys_admin'"} ORDER BY id ASC`,
        [orgCode]
      );
      return rows || [];
    }
    const [allRows] = await pool.execute(
      `SELECT DISTINCT role AS code, label AS name FROM tb_board_roles WHERE status = 'active' AND LOWER(role) != 'sys_admin'`
    );
    return allRows || [];
  }

  async getActors({ orgCode, limit = 10, offset = 0, q = '' }) {
    let whereClause = `WHERE u.status != 'deleted' AND u.status != 'archived'`;
    const params = [];

    if (orgCode && !['sys_admin', 'super_admin', 'techtrole'].includes(String(orgCode).toLowerCase())) {
      whereClause += ` AND LOWER(u.org_code) = LOWER(?)`;
      params.push(orgCode);
    }

    if (q && q.trim()) {
      whereClause += ` AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.mobile) LIKE ? OR LOWER(u.role) LIKE ?)`;
      const term = `%${q.trim().toLowerCase()}%`;
      params.push(term, term, term, term);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM tb_board_users u ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const numLimit = Math.max(1, Number(limit) || 10);
    const numOffset = Math.max(0, Number(offset) || 0);

    const [rows] = await pool.execute(
      `SELECT u.id, u.org_code, u.full_name, u.email, u.mobile, u.role, u.isActive, u.status, u.created_at,
              COALESCE(appr.maker_name, al.maker, 'Admin User') as created_by_name
       FROM tb_board_users u
       LEFT JOIN tb_org_approvals appr ON appr.table_name = 'tb_board_users' AND appr.record_id = u.id
       LEFT JOIN tb_board_audit_logs al ON al.table_name = 'tb_board_users' AND al.record_id = u.id AND (al.action = 'insert' OR al.action = 'create')
       ${whereClause} 
       GROUP BY u.id
       ORDER BY u.id DESC LIMIT ${numLimit} OFFSET ${numOffset}`,
      params
    );

    const items = rows.map((u) => ({
      id: u.id,
      orgCode: u.org_code,
      fullName: u.full_name,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      roleCode: u.role,
      roleName: u.role,
      created_by_name: u.created_by_name || 'Admin User',
      createdBy: u.created_by_name || 'Admin User',
      createdAt: u.created_at,
      created_at: u.created_at,
      isActive: u.status === 'active' || u.isActive === 1 || u.isActive === true || u.isActive === '1',
      status: u.status || 'active',
    }));

    return { total, items };
  }

  async exportActorsCsv({ orgCode, q = '' }) {
    const { items } = await this.getActors({ orgCode, limit: 5000, offset: 0, q });
    const headers = ['Organization Code', 'Full Name', 'Email', 'Mobile', 'Role', 'Status'];
    const rows = items.map((u) => [
      u.orgCode || '',
      `"${String(u.fullName || '').replace(/"/g, '""')}"`,
      `"${String(u.email || '').replace(/"/g, '""')}"`,
      `"${String(u.mobile || '').replace(/"/g, '""')}"`,
      `"${String(u.role || '').replace(/"/g, '""')}"`,
      u.status || 'active'
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async registerActor({ orgCode, fullName, email, mobile, role, status, makerId = 0, makerName = 'Admin User' }) {
    const targetOrg = orgCode;
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanMobile = String(mobile).trim();
    const initialStatus = status || 'active';

    // Duplicate email check
    const [existingEmail] = await pool.execute(
      `SELECT id FROM tb_board_users WHERE LOWER(email) = LOWER(?)`,
      [cleanEmail]
    );
    if (existingEmail.length > 0) {
      throw new Error(`Email ${cleanEmail} is already registered.`);
    }

    // Duplicate mobile check
    const [existingMobile] = await pool.execute(
      `SELECT id FROM tb_board_users WHERE mobile = ?`,
      [cleanMobile]
    );
    if (existingMobile.length > 0) {
      throw new Error(`Mobile number ${cleanMobile} is already registered.`);
    }

    const hashedPassword = await bcrypt.hash(cleanMobile, 10);

    const [result] = await pool.execute(
      `INSERT INTO tb_board_users (org_code, full_name, email, password, mobile, role, isActive, status) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [targetOrg, fullName, cleanEmail, hashedPassword, cleanMobile, role || 'employee', initialStatus]
    );

    await logAudit({
      orgCode: targetOrg,
      tableName: 'tb_board_users',
      recordId: result.insertId,
      action: 'insert',
      maker: makerName || 'Admin User',
      createdBy: makerId || 0,
      message: `Created user "${fullName}" (${cleanEmail})`,
      newVal: { fullName, email: cleanEmail, mobile: cleanMobile, role: role || 'employee' },
    });

    return {
      id: result.insertId,
      orgCode: targetOrg,
      fullName,
      email: cleanEmail,
      mobile: cleanMobile,
      role: role || 'employee',
      roleCode: role || 'employee',
      roleName: role || 'employee',
      created_by_name: makerName,
      createdBy: makerName,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      isActive: true,
      status: initialStatus,
    };
  }

  async updateActor(id, data) {
    const { fullName, email, mobile, role, status } = data;
    const [existing] = await pool.execute(`SELECT * FROM tb_board_users WHERE id = ?`, [id]);
    if (existing.length === 0) {
      throw new Error(`User with ID #${id} not found.`);
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : existing[0].email;
    const cleanMobile = mobile ? String(mobile).trim() : existing[0].mobile;
    const cleanName = fullName ? String(fullName).trim() : existing[0].full_name;
    const cleanRole = role || existing[0].role;
    const cleanStatus = status || existing[0].status;

    if (cleanEmail !== existing[0].email) {
      const [dupeEmail] = await pool.execute(`SELECT id FROM tb_board_users WHERE LOWER(email) = LOWER(?) AND id != ?`, [cleanEmail, id]);
      if (dupeEmail.length > 0) {
        throw new Error(`Email ${cleanEmail} is already registered.`);
      }
    }

    if (cleanMobile !== existing[0].mobile) {
      const [dupeMobile] = await pool.execute(`SELECT id FROM tb_board_users WHERE mobile = ? AND id != ?`, [cleanMobile, id]);
      if (dupeMobile.length > 0) {
        throw new Error(`Mobile number ${cleanMobile} is already registered.`);
      }
    }

    await pool.execute(
      `UPDATE tb_board_users SET full_name = ?, email = ?, mobile = ?, role = ?, status = ? WHERE id = ?`,
      [cleanName, cleanEmail, cleanMobile, cleanRole, cleanStatus, id]
    );

    return {
      id: Number(id),
      orgCode: existing[0].org_code,
      fullName: cleanName,
      email: cleanEmail,
      mobile: cleanMobile,
      role: cleanRole,
      status: cleanStatus,
    };
  }

  async deleteActor(id) {
    const [rows] = await pool.execute(`SELECT * FROM tb_board_users WHERE id = ?`, [id]);
    const oldUser = rows[0] || null;

    await pool.execute(`DELETE FROM tb_board_users WHERE id = ?`, [id]);

    await logAudit({
      orgCode: oldUser?.org_code,
      tableName: 'tb_board_users',
      recordId: id,
      action: 'delete',
      message: `Deleted user ID #${id} (${oldUser?.email || ''})`,
      oldVal: oldUser,
    });

    return true;
  }
}

module.exports = new AdminService();
