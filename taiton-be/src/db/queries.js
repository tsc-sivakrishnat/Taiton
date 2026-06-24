/**
 * Central definition of all SQL used by the API.
 * Prefer one round-trip with JOINs / subqueries over multiple sequential queries.
 *
 * Role-aware filters use JWT `role` (tb_cpanel_users.role) against `roles_csv`
 * on notifications and nav items. NULL/empty roles_csv = all roles.
 */

/** Matches :roleCode against comma-separated list (spaces / semicolons tolerated). */
const roleCsvMatchSql = `(
  roles_csv IS NULL OR TRIM(roles_csv) = ''
    OR FIND_IN_SET(:roleCode, REPLACE(REPLACE(TRIM(roles_csv), ' ', ''), ';', ',')) > 0
)`;

export const queries = {
  /** Login: user + organization (via org_code) in one round-trip */
  loginUserWithOrg: `
    SELECT
      u.id AS user_id,
      u.email,
      u.full_name AS display_name,
      u.role AS user_role,
      u.password_hash,
      IF(u.is_active = 1, 'active', 'disabled') AS user_status,
      o.id AS organization_id,
      o.name AS org_name,
      o.code AS org_slug,
      IF(o.is_active = 1, 'active', 'suspended') AS org_status,
      u.role AS role_code,
      r.name AS role_name
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o
      ON o.code = u.org_code
    LEFT JOIN tb_cpanel_org_roles r
      ON r.org_id = o.id AND r.code = u.role
    WHERE u.email = :email
    LIMIT 1
  `,

  /** Org + branding keys in one round-trip */
  orgBrandingWithDefaults: `
    SELECT
      o.id AS org_id,
      o.name AS org_default_name,
      c.config_key,
      c.config_value
    FROM tb_cpanel_organizations o
    LEFT JOIN tb_config_org_config c
      ON c.org_id = o.id
      AND c.config_key IN (
        'app_name', 'logo_url', 'logo_url_sidebar', 'logo_profile',
        'theme_sidebar_bg', 'theme_sidebar_text', 'theme_header_bg',
        'theme_font_family', 'theme_font_size', 'theme_nav_font_size'
      )
    WHERE o.id = :organizationId
  `,

  orgBrandingByOrgCode: `
    SELECT
      o.id AS org_id,
      o.name AS org_default_name,
      c.config_key,
      c.config_value
    FROM tb_cpanel_organizations o
    LEFT JOIN tb_config_org_config c
      ON c.org_id = o.id
      AND c.config_key IN (
        'app_name', 'logo_url', 'logo_url_sidebar', 'logo_profile',
        'theme_sidebar_bg', 'theme_sidebar_text', 'theme_header_bg',
        'theme_font_family', 'theme_font_size', 'theme_nav_font_size'
      )
    WHERE o.code = :orgCode
      AND o.is_active = 1
    LIMIT 50
  `,

  orgConfigUpsert: `
    INSERT INTO tb_config_org_config (org_id, config_key, config_value)
    VALUES (:organizationId, :configKey, :configValue)
    ON DUPLICATE KEY UPDATE
      config_value = VALUES(config_value),
      updated_at = CURRENT_TIMESTAMP
  `,

  orgConfigDeleteAppearance: `
    DELETE FROM tb_config_org_config
    WHERE org_id = :organizationId
      AND config_key IN (
        'app_name', 'logo_url', 'logo_url_sidebar', 'logo_profile',
        'theme_sidebar_bg', 'theme_sidebar_text', 'theme_header_bg',
        'theme_font_family', 'theme_font_size', 'theme_nav_font_size'
      )
  `,

  /** Restore session after reload — user + org via org_code */
  sessionUserWithOrg: `
    SELECT
      u.id AS user_id,
      u.email,
      u.full_name AS display_name,
      u.role AS user_role,
      o.id AS organization_id,
      o.name AS org_name,
      o.code AS org_slug,
      u.role AS role_code,
      r.name AS role_name
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o
      ON o.code = u.org_code AND o.is_active = 1
    LEFT JOIN tb_cpanel_org_roles r
      ON r.org_id = o.id AND r.code = u.role
    WHERE u.id = :userId AND u.is_active = 1
    LIMIT 1
  `,

  updateUserLastLogin: `
    UPDATE tb_cpanel_users
    SET last_login_at = UTC_TIMESTAMP()
    WHERE id = :userId
    LIMIT 1
  `,

  /** Active nav rows for an org (role filter applied in navigation.service.js). */
  navigationForOrg: `
    SELECT
      id,
      label,
      icon,
      route,
      position,
      sort_order,
      roles_csv
    FROM tb_cpanel_nav_items
    WHERE org_id = :organizationId
      AND is_active = 1
    ORDER BY FIELD(position, 'top', 'bottom'), sort_order ASC, id ASC
  `,

  /** Left navigation for active org + user role (legacy SQL filter) */
  navigationForOrgAndRole: `
    SELECT
      id,
      label,
      icon,
      route,
      position,
      sort_order,
      roles_csv
    FROM tb_cpanel_nav_items
    WHERE org_id = :organizationId
      AND is_active = 1
      AND ${roleCsvMatchSql}
    ORDER BY FIELD(position, 'top', 'bottom'), sort_order ASC, id ASC
  `,

  /** Dashboard widgets — single query (unread respects role visibility) */
  dashboardSummary: `
    SELECT
      (
        SELECT COUNT(*)
        FROM tb_csd_notifications n
        WHERE n.org_id = :organizationId
          AND (n.user_id IS NULL OR n.user_id = :userId)
          AND n.read_at IS NULL
          AND (n.roles_csv IS NULL OR TRIM(n.roles_csv) = ''
            OR FIND_IN_SET(:roleCode, REPLACE(REPLACE(TRIM(n.roles_csv), ' ', ''), ';', ',')) > 0)
      ) AS unread_notifications,
      (
        SELECT COUNT(*)
        FROM tb_cpanel_users u
        WHERE u.org_code = (SELECT o2.code FROM tb_cpanel_organizations o2 WHERE o2.id = :organizationId LIMIT 1)
          AND u.is_active = 1
      ) AS active_members
  `,

  notificationsList: `
    SELECT
      id,
      title,
      body,
      severity,
      read_at,
      created_at
    FROM tb_csd_notifications
    WHERE org_id = :organizationId
      AND (user_id IS NULL OR user_id = :userId)
      AND (roles_csv IS NULL OR TRIM(roles_csv) = ''
        OR FIND_IN_SET(:roleCode, REPLACE(REPLACE(TRIM(roles_csv), ' ', ''), ';', ',')) > 0)
    ORDER BY created_at DESC
    LIMIT :limit OFFSET :offset
  `,

  notificationMarkRead: `
    UPDATE tb_csd_notifications
    SET read_at = UTC_TIMESTAMP()
    WHERE id = :id
      AND org_id = :organizationId
      AND (user_id IS NULL OR user_id = :userId)
      AND (roles_csv IS NULL OR TRIM(roles_csv) = ''
        OR FIND_IN_SET(:roleCode, REPLACE(REPLACE(TRIM(roles_csv), ' ', ''), ';', ',')) > 0)
    LIMIT 1
  `,

  notificationsMarkAllRead: `
    UPDATE tb_csd_notifications
    SET read_at = UTC_TIMESTAMP()
    WHERE org_id = :organizationId
      AND (user_id IS NULL OR user_id = :userId)
      AND read_at IS NULL
      AND (roles_csv IS NULL OR TRIM(roles_csv) = ''
        OR FIND_IN_SET(:roleCode, REPLACE(REPLACE(TRIM(roles_csv), ' ', ''), ';', ',')) > 0)
  `,

  supportTicketsList: `
    SELECT
      t.id,
      t.org_id,
      t.reporter_user_id,
      t.request_type,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.tracking_emails,
      t.created_at,
      t.updated_at,
      u.full_name AS reporter_name,
      u.email AS reporter_email
    FROM tb_csd_support_tickets t
    INNER JOIN tb_cpanel_users u ON u.id = t.reporter_user_id
    WHERE t.org_id = :organizationId
      AND (
        :scopeAll = 1
        OR t.reporter_user_id = :userId
      )
    ORDER BY t.updated_at DESC, t.id DESC
    LIMIT :limit OFFSET :offset
  `,

  supportTicketById: `
    SELECT
      t.id,
      t.org_id,
      t.reporter_user_id,
      t.request_type,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.tracking_emails,
      t.created_at,
      t.updated_at,
      u.full_name AS reporter_name,
      u.email AS reporter_email,
      o.name AS org_name
    FROM tb_csd_support_tickets t
    INNER JOIN tb_cpanel_users u ON u.id = t.reporter_user_id
    INNER JOIN tb_cpanel_organizations o ON o.id = t.org_id
    WHERE t.id = :ticketId
      AND t.org_id = :organizationId
      AND (
        :scopeAll = 1
        OR t.reporter_user_id = :userId
      )
    LIMIT 1
  `,

  supportTicketInsert: `
    INSERT INTO tb_csd_support_tickets (
      org_id,
      reporter_user_id,
      request_type,
      title,
      description,
      priority,
      status,
      tracking_emails
    ) VALUES (
      :organizationId,
      :reporterUserId,
      :requestType,
      :title,
      :description,
      :priority,
      'raised',
      :trackingEmails
    )
  `,

  supportAttachmentInsert: `
    INSERT INTO tb_csd_support_ticket_attachments (
      ticket_id,
      original_name,
      stored_path,
      mime_type,
      size_bytes
    ) VALUES (
      :ticketId,
      :originalName,
      :storedPath,
      :mimeType,
      :sizeBytes
    )
  `,

  supportAttachmentsByTicket: `
    SELECT
      id,
      original_name,
      mime_type,
      size_bytes,
      created_at
    FROM tb_csd_support_ticket_attachments
    WHERE ticket_id = :ticketId
    ORDER BY id ASC
  `,

  supportAttachmentRowForDownload: `
    SELECT
      a.id,
      a.ticket_id,
      a.original_name,
      a.stored_path,
      a.mime_type,
      a.size_bytes
    FROM tb_csd_support_ticket_attachments a
    INNER JOIN tb_csd_support_tickets t ON t.id = a.ticket_id
    WHERE a.id = :attachmentId
      AND a.ticket_id = :ticketId
      AND t.org_id = :organizationId
      AND (
        :scopeAll = 1
        OR t.reporter_user_id = :userId
      )
    LIMIT 1
  `,

  supportTicketUpdateStatus: `
    UPDATE tb_csd_support_tickets t
    SET t.status = :status,
        t.updated_at = CURRENT_TIMESTAMP
    WHERE t.id = :ticketId
      AND t.org_id = :organizationId
    LIMIT 1
  `,

  supportTicketSetApprovalToken: `
    UPDATE tb_csd_support_tickets
    SET approval_token_sha256 = :tokenSha256,
        approval_decision = NULL,
        approval_decided_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :ticketId
    LIMIT 1
  `,

  supportTicketApplyApproval: `
    UPDATE tb_csd_support_tickets
    SET approval_decision = :decision,
        approval_decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :ticketId
      AND approval_token_sha256 = :tokenSha256
      AND approval_decision IS NULL
    LIMIT 1
  `,

  supportTicketGetApproval: `
    SELECT approval_decision AS decision, approval_decided_at AS decided_at
    FROM tb_csd_support_tickets
    WHERE id = :ticketId
    LIMIT 1
  `,

  supportAttachmentsEnsureTable: `
    CREATE TABLE IF NOT EXISTS tb_csd_support_ticket_attachments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      ticket_id BIGINT NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      size_bytes INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_support_att_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,

  orgRoleExistsByCode: `
    SELECT code, name FROM tb_cpanel_org_roles
    WHERE org_id = :organizationId AND code = :code
    LIMIT 1
  `,

  orgCodeByOrganizationId: `
    SELECT code FROM tb_cpanel_organizations
    WHERE id = :organizationId AND is_active = 1
    LIMIT 1
  `,

  userEmailExists: `
    SELECT id FROM tb_cpanel_users WHERE email = :email LIMIT 1
  `,

  userEmailExistsInOrg: `
    SELECT u.id FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    WHERE o.id = :organizationId AND u.email = :email
    LIMIT 1
  `,

  userMobileExistsInOrg: `
    SELECT u.id FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    WHERE o.id = :organizationId AND u.mobile = :mobile
    LIMIT 1
  `,

  userInsert: `
    INSERT INTO tb_cpanel_users (org_code, email, password_hash, full_name, mobile, role, is_active)
    VALUES (:orgCode, :email, :passwordHash, :fullName, :mobile, :role, 1)
  `,

  actorsListByOrgPaginated: `
    SELECT
      u.id,
      u.email,
      u.full_name AS fullName,
      u.mobile,
      u.role AS roleCode,
      r.name AS roleName,
      u.is_active AS isActive
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    LEFT JOIN tb_cpanel_org_roles r ON r.org_id = o.id AND r.code = u.role
    WHERE o.id = :organizationId
      AND u.role NOT IN ('sys_admin', 'super_admin')
      AND (
        TRIM(IFNULL(:search, '')) = ''
        OR u.full_name LIKE CONCAT('%', :search, '%')
        OR u.email LIKE CONCAT('%', :search, '%')
        OR IFNULL(u.mobile, '') LIKE CONCAT('%', :search, '%')
      )
    ORDER BY u.id DESC
    LIMIT :limit OFFSET :offset
  `,

  actorsCountByOrg: `
    SELECT COUNT(*) AS total
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    WHERE o.id = :organizationId
      AND u.role NOT IN ('sys_admin', 'super_admin')
      AND (
        TRIM(IFNULL(:search, '')) = ''
        OR u.full_name LIKE CONCAT('%', :search, '%')
        OR u.email LIKE CONCAT('%', :search, '%')
        OR IFNULL(u.mobile, '') LIKE CONCAT('%', :search, '%')
      )
  `,

  actorsListByOrgForExport: `
    SELECT
      u.id,
      u.email,
      u.full_name AS fullName,
      u.mobile,
      u.role AS roleCode,
      r.name AS roleName,
      u.is_active AS isActive
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    LEFT JOIN tb_cpanel_org_roles r ON r.org_id = o.id AND r.code = u.role
    WHERE o.id = :organizationId
      AND u.role NOT IN ('sys_admin', 'super_admin')
      AND (
        TRIM(IFNULL(:search, '')) = ''
        OR u.full_name LIKE CONCAT('%', :search, '%')
        OR u.email LIKE CONCAT('%', :search, '%')
        OR IFNULL(u.mobile, '') LIKE CONCAT('%', :search, '%')
      )
    ORDER BY u.id DESC
    LIMIT 10000
  `,
};
