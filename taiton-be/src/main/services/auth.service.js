const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../resources/connection');
const AUTH_QUERIES = require('../queries/auth.queries');

class AuthService {
  async getRoleLabel(orgCode, roleCode) {
    if (roleCode === 'sys_admin') {
      return 'System Administrator';
    }
    if (!orgCode || !roleCode) {
      return roleCode || 'User';
    }
    try {
      const [rows] = await pool.execute(AUTH_QUERIES.GET_ROLE_LABEL, [orgCode, roleCode]);
      if (rows.length > 0 && rows[0].label) {
        return rows[0].label;
      }
    } catch (e) {
      console.error('[AuthService.getRoleLabel] Error fetching role label from database:', e);
    }
    return roleCode;
  }

  async formatUserData(user, org) {
    const { password: _, ...userWithoutPassword } = user;
    const roleCode = user.role || 'user';
    const roleLabel = await this.getRoleLabel(user.org_code, roleCode);

    const formattedUser = {
      ...userWithoutPassword,
      fullName: user.full_name,
      displayName: user.full_name,
      roleCode,
      roleLabel,
    };

    const activeOrganization = {
      id: org?.id || 1,
      org_code: user.org_code,
      org_name: org?.org_name || user.org_code.toUpperCase(),
      name: org?.org_name || user.org_code.toUpperCase(),
      roleCode,
      roleLabel,
      status: org?.status || 'active',
    };

    let branding = null;
    if (org?.ui_prefs) {
      try {
        const parsedPrefs = typeof org.ui_prefs === 'string' ? JSON.parse(org.ui_prefs) : org.ui_prefs;
        branding = parsedPrefs?.branding || parsedPrefs || null;
      } catch (e) {}
    }

    return {
      user: formattedUser,
      activeOrganization,
      branding,
    };
  }

  async login(email, password) {
    const [rows] = await pool.execute(AUTH_QUERIES.FIND_USER_BY_EMAIL, [email]);
    if (rows.length === 0) {
      return null;
    }

    const user = rows[0];

    // Check if account status is active
    if (user.status !== 'active') {
      throw new Error('User account is inactive or locked');
    }

    // Support bcrypt hash comparison as well as fallback plain-text comparison
    let isPasswordValid = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      isPasswordValid = user.password === password;
    }

    if (!isPasswordValid) {
      return null;
    }

    // Mark user as online (isActive = 1) in database
    await pool.execute(AUTH_QUERIES.UPDATE_USER_ONLINE_STATUS, [1, user.id]);
    user.isActive = 1;

    // Fetch active organization details
    const [orgRows] = await pool.execute(AUTH_QUERIES.FIND_ORG_BY_CODE, [user.org_code]);
    const org = orgRows.length > 0 ? orgRows[0] : null;

    // Format user payload dynamically fetching role label from DB
    const payload = await this.formatUserData(user, org);

    // Generate JWT token
    const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        org_code: user.org_code,
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return {
      token,
      ...payload,
    };
  }

  async logout(userId) {
    if (!userId) return;
    await pool.execute(AUTH_QUERIES.UPDATE_USER_ONLINE_STATUS, [0, userId]);
  }

  async getSession(token) {
    const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
    const decoded = jwt.verify(token, secret);
    const user = await this.getUserById(decoded.id);
    if (!user || user.status !== 'active' || Number(user.isActive) === 0) return null;

    const [orgRows] = await pool.execute(AUTH_QUERIES.FIND_ORG_BY_CODE, [user.org_code]);
    const org = orgRows.length > 0 ? orgRows[0] : null;

    return await this.formatUserData(user, org);
  }

  async getUserById(id) {
    const [rows] = await pool.execute(AUTH_QUERIES.FIND_USER_BY_ID, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async getUserByEmail(email) {
    const [rows] = await pool.execute(AUTH_QUERIES.FIND_USER_BY_EMAIL, [email]);
    return rows.length > 0 ? rows[0] : null;
  }

  async onboard(data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { org_code, org_name, full_name, email, password, mobile = null, role = 'organization_admin' } = data;

      // Hash password with bcrypt before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      // 1. Create Organization
      await connection.execute(AUTH_QUERIES.INSERT_ORG, [org_code, org_name, JSON.stringify({}), 'active']);

      // 2. Create User with isActive = 0 (offline until logged in)
      const [userResult] = await connection.execute(AUTH_QUERIES.INSERT_USER, [
        org_code,
        full_name,
        email,
        hashedPassword,
        mobile,
        role,
        0,
        'active',
      ]);

      // 3. Create Role in database table tb_board_roles
      await connection.execute(AUTH_QUERIES.INSERT_ROLE, [org_code, role, 'Organization Admin', 'active']);

      await connection.commit();

      return {
        userId: userResult.insertId,
        org_code,
        org_name,
        full_name,
        email,
        role,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async forgotPassword(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Email address is required.');
    }

    const [users] = await pool.execute(`SELECT id, full_name, email FROM tb_board_users WHERE LOWER(email) = LOWER(?) AND status != 'deleted'`, [cleanEmail]);
    if (users.length === 0) {
      // Return friendly message even if user not found for security
      return { success: true, message: 'If an account exists for this email, a password reset link has been sent.' };
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour validity

    // Clean old tokens for this email
    await pool.execute(`DELETE FROM tb_password_resets WHERE LOWER(email) = LOWER(?)`, [cleanEmail]);

    // Insert new reset token
    await pool.execute(
      `INSERT INTO tb_password_resets (email, token, expires_at) VALUES (?, ?, ?)`,
      [cleanEmail, token, expiresAt]
    );

    const defaultAppUrl = process.env.NODE_ENV === 'production'
      ? 'https://lightblue-hornet-317974.hostingersite.com'
      : 'http://localhost:5173';
    const publicAppUrl = process.env.APP_PUBLIC_URL || defaultAppUrl;
    const resetUrl = `${publicAppUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

    const { sendPasswordResetEmail } = require('../utils/mailHelper');
    try {
      await sendPasswordResetEmail(cleanEmail, resetUrl);
    } catch (mailErr) {
      console.error('[AuthService.forgotPassword] Mail send warning:', mailErr.message);
    }

    return { success: true, message: 'If an account exists for this email, a password reset link has been sent.' };
  }

  async resetPassword(token, newPassword) {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
      throw new Error('Invalid or missing password reset token.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const [rows] = await pool.execute(
      `SELECT * FROM tb_password_resets WHERE token = ? AND expires_at > CURRENT_TIMESTAMP`,
      [cleanToken]
    );

    if (rows.length === 0) {
      throw new Error('Invalid or expired password reset link. Please request a new link.');
    }

    const resetRecord = rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.execute(
      `UPDATE tb_board_users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)`,
      [hashedPassword, resetRecord.email]
    );

    await pool.execute(`DELETE FROM tb_password_resets WHERE token = ?`, [cleanToken]);

    return { success: true, message: 'Password has been updated successfully.' };
  }

  async changePassword(userId, oldPassword, newPassword) {
    if (!userId) throw new Error('User ID is required');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const [rows] = await pool.execute(`SELECT * FROM tb_board_users WHERE id = ?`, [userId]);
    if (rows.length === 0) throw new Error('User not found');

    const user = rows[0];
    let isValid = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      isValid = await bcrypt.compare(oldPassword, user.password);
    } else {
      isValid = user.password === oldPassword;
    }

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      `UPDATE tb_board_users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hashedPassword, userId]
    );

    return { success: true, message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();
