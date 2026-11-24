const { pool } = require('../../resources/connection');


class UserService {

  async getAllUsers(filters = {}) {
    let query = `
      SELECT id, org_code, full_name, email, mobile, role, isActive, status, created_at, updated_at 
      FROM tb_board_users 
      WHERE status != 'deleted' AND status != 'archived'
    `;
    const params = [];

    if (filters.org_code) {
      query += ` AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)`;
      params.push(filters.org_code, filters.org_code);
    }

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY id DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  }


  async getUserById(id) {
    const query = `
      SELECT id, org_code, full_name, email, mobile, role, isActive, status, created_at, updated_at 
      FROM tb_board_users 
      WHERE id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }


  async createUser(userData) {
    const {
      org_code,
      full_name,
      email,
      password,
      mobile = null,
      role = 'user',
      isActive = 1,
      status = 'active',
    } = userData;

    const query = `
      INSERT INTO tb_board_users 
        (org_code, full_name, email, password, mobile, role, isActive, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      org_code,
      full_name,
      email,
      password,
      mobile,
      role,
      isActive ? 1 : 0,
      status,
    ]);

    return {
      id: result.insertId,
      org_code,
      full_name,
      email,
      mobile,
      role,
      isActive: Boolean(isActive),
      status,
    };
  }


  async updateUser(id, updateData) {
    const fields = [];
    const params = [];

    const allowedFields = ['org_code', 'full_name', 'email', 'password', 'mobile', 'role', 'isActive', 'status'];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(field === 'isActive' ? (updateData[field] ? 1 : 0) : updateData[field]);
      }
    }

    if (fields.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE tb_board_users SET ${fields.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(query, params);

    return result.affectedRows > 0;
  }


  async deleteUser(id) {
    const query = `DELETE FROM tb_board_users WHERE id = ?`;
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = new UserService();
