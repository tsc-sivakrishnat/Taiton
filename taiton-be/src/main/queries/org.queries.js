/**
 * Centralized SQL Queries for Organization Management, Roles, Administrators, Navigation, & Audit.
 */

const ORG_QUERIES = {
  GET_ALL_ORGANIZATIONS: `
    SELECT id, org_code, org_name, ui_prefs, status, created_at, updated_at
    FROM tb_board_organizations
    ORDER BY id DESC
  `,

  GET_ORGANIZATION_BY_CODE: `
    SELECT id, org_code, org_name, ui_prefs, status, created_at, updated_at
    FROM tb_board_organizations
    WHERE LOWER(org_code) = LOWER(?)
  `,

  GET_ORGANIZATION_BY_ID_OR_CODE: `
    SELECT id, org_code, org_name, ui_prefs, status, created_at, updated_at
    FROM tb_board_organizations
    WHERE id = ? OR LOWER(org_code) = LOWER(?)
  `,

  INSERT_ORGANIZATION: `
    INSERT INTO tb_board_organizations (org_code, org_name, status)
    VALUES (?, ?, 'active')
  `,

  UPDATE_ORG_UI_PREFS: `
    UPDATE tb_board_organizations
    SET ui_prefs = ?, updated_at = CURRENT_TIMESTAMP
    WHERE LOWER(org_code) = LOWER(?)
  `,

  // Roles
  GET_ROLES_BY_ORG: `
    SELECT id, org_code, role as code, label as name, description, priority, status
    FROM tb_board_roles
    WHERE LOWER(org_code) = LOWER(?) AND status = 'active'
    ORDER BY COALESCE(priority, id) ASC
  `,

  INSERT_ROLE: `
    INSERT INTO tb_board_roles (org_code, role, label, description, priority, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `,

  DELETE_ROLE: `
    UPDATE tb_board_roles
    SET status = 'inactive'
    WHERE LOWER(org_code) = LOWER(?) AND LOWER(role) = LOWER(?)
  `,

  // Organization Administrators & Members
  GET_ADMINS_BY_ORG: `
    SELECT id, org_code, full_name as fullName, email, mobile, role, isActive, status
    FROM tb_board_users
    WHERE LOWER(org_code) = LOWER(?) AND status = 'active'
  `,

  CHECK_DUPLICATE_MOBILE: `
    SELECT id FROM tb_board_users WHERE mobile = ?
  `,

  CHECK_DUPLICATE_EMAIL: `
    SELECT id FROM tb_board_users WHERE LOWER(email) = LOWER(?)
  `,

  INSERT_ORG_USER: `
    INSERT INTO tb_board_users (org_code, full_name, email, password, mobile, role, isActive, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'active')
  `,

  // Config Icons & Routes
  GET_NAV_ICONS: `
    SELECT id, label, code, status
    FROM tb_config_icons
    WHERE status = 'active'
  `,

  GET_CONFIG_ROUTES: `
    SELECT id, page, route, status
    FROM tb_config_routes
    WHERE status = 'active'
      AND (LOWER(route) LIKE '/app/%' OR LOWER(route) LIKE '/cpanel%' OR LOWER(route) NOT LIKE '/%')
      AND LOWER(route) NOT LIKE '/app/onboarding/%'
      AND LOWER(route) NOT LIKE '/app/platform%'
      AND LOWER(page) NOT LIKE '%onboarding organization%'
      AND LOWER(page) NOT LIKE '%onboarding role%'
      AND LOWER(page) NOT LIKE '%onboarding member%'
      AND LOWER(page) NOT LIKE '%onboarding admin%'
      AND LOWER(page) NOT LIKE '%onboarding nav%'
      AND LOWER(page) NOT LIKE '%configure navigation%'
    ORDER BY id ASC
  `,

  // Navigation (Joined with tb_config_icons & tb_config_routes)
  GET_NAVIGATION_BY_ORG: `
    SELECT n.id, n.org_code, n.icon_id, n.route_id, n.label, n.position, n.sort_order, n.access_matrix, n.status,
           i.code as icon_code, i.label as icon_label,
           r.route as route_path, r.page as page_name
    FROM tb_board_navs n
    LEFT JOIN tb_config_icons i ON n.icon_id = i.id
    LEFT JOIN tb_config_routes r ON n.route_id = r.id
    WHERE LOWER(n.org_code) = LOWER(?) AND n.status != 'inactive'
    ORDER BY n.sort_order ASC
  `,

  INSERT_NAVIGATION: `
    INSERT INTO tb_board_navs (org_code, icon_id, route_id, label, position, sort_order, access_matrix, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,

  DELETE_NAVIGATION: `
    UPDATE tb_board_navs
    SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND LOWER(org_code) = LOWER(?)
  `,

  // Audit Logs
  GET_AUDIT_LOGS_BY_ORG: `
    SELECT id, org_code, table_name, record_id, action, maker, message, old_val, new_val, created_by, created_at
    FROM tb_board_audit_logs
    WHERE LOWER(org_code) = LOWER(?)
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `,

  INSERT_AUDIT_LOG: `
    INSERT INTO tb_board_audit_logs (org_code, table_name, record_id, action, maker, message, old_val, new_val, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
};

module.exports = ORG_QUERIES;
