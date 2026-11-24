/**
 * Centralized SQL Queries for Authentication & User Management.
 */

const AUTH_QUERIES = {
  FIND_USER_BY_EMAIL: `
    SELECT id, org_code, full_name, email, password, mobile, role, isActive, status, created_at, updated_at
    FROM tb_board_users
    WHERE email = ?
  `,

  FIND_USER_BY_ID: `
    SELECT id, org_code, full_name, email, mobile, role, isActive, status, created_at, updated_at
    FROM tb_board_users
    WHERE id = ?
  `,

  GET_ROLE_LABEL: `
    SELECT label
    FROM tb_board_roles
    WHERE LOWER(org_code) = LOWER(?) AND LOWER(role) = LOWER(?)
    LIMIT 1
  `,

  INSERT_USER: `
    INSERT INTO tb_board_users (org_code, full_name, email, password, mobile, role, isActive, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_USER_STATUS: `
    UPDATE tb_board_users
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  UPDATE_USER_ONLINE_STATUS: `
    UPDATE tb_board_users
    SET isActive = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  UPDATE_USER_PASSWORD: `
    UPDATE tb_board_users
    SET password = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  FIND_ORG_BY_CODE: `
    SELECT id, org_code, org_name, ui_prefs, status
    FROM tb_board_organizations
    WHERE org_code = ?
  `,

  INSERT_ORG: `
    INSERT INTO tb_board_organizations (org_code, org_name, ui_prefs, status)
    VALUES (?, ?, ?, ?)
  `,

  GET_ALL_ROLES_BY_ORG: `
    SELECT id, org_code, role, label, status
    FROM tb_board_roles
    WHERE org_code = ? AND status = 'active'
  `,

  INSERT_ROLE: `
    INSERT INTO tb_board_roles (org_code, role, label, status)
    VALUES (?, ?, ?, ?)
  `,
};

module.exports = AUTH_QUERIES;
