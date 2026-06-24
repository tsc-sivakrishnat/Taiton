-- =============================================================================
-- Enterprise CPanel — core schema (multi-tenant, RBAC, notifications, nav)
-- Naming (aligned with legacy enterprise dumps):
--   tb_cpanel_*   — platform / control-panel entities
--   tb_csd_*      — client-specific (per-organization) operational data
--   tb_config_*   — key/value configuration (typically org-scoped)
-- MariaDB / MySQL 8+ compatible
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `tb_config_org_config`;
DROP TABLE IF EXISTS `tb_cpanel_nav_items`;
DROP TABLE IF EXISTS `tb_csd_support_ticket_attachments`;
DROP TABLE IF EXISTS `tb_csd_support_tickets`;
DROP TABLE IF EXISTS `tb_csd_notifications`;
DROP TABLE IF EXISTS `tb_cpanel_users`;
DROP TABLE IF EXISTS `tb_cpanel_roles`;
DROP TABLE IF EXISTS `tb_cpanel_organizations`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- tb_cpanel_organizations — tenant registry (control panel)
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_cpanel_organizations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL COMMENT 'Stable org identifier (URL-safe); legacy "slug"',
  `name` varchar(180) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cpanel_org_code` (`code`),
  KEY `idx_cpanel_org_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- tb_cpanel_roles — global role catalogue (codes align with tb_cpanel_users.role)
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_cpanel_roles` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(48) NOT NULL,
  `name` varchar(80) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cpanel_role_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT INTO `tb_cpanel_roles` (`code`, `name`, `description`) VALUES
  ('super_admin', 'Super Admin', 'Platform-level access across organizations'),
  ('org_admin', 'Organization Admin', 'Full administration within an organization'),
  ('manager', 'Manager', 'Team management within an organization'),
  ('employee', 'Employee', 'Standard operational access');

-- -----------------------------------------------------------------------------
-- tb_cpanel_users — one row per login identity; tenant = org_code → organizations.code
--   role: RBAC code (nav / notifications filter on this; should match tb_cpanel_roles.code)
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_cpanel_users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_code` varchar(40) NOT NULL COMMENT 'FK to tb_cpanel_organizations.code',
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(140) NOT NULL,
  `mobile` varchar(20) DEFAULT NULL COMMENT 'Digits only; login uses email + mobile as password',
  `role` varchar(60) NOT NULL DEFAULT 'employee',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cpanel_user_email` (`email`),
  KEY `idx_cpanel_user_org_code` (`org_code`),
  KEY `idx_cpanel_user_active` (`is_active`),
  KEY `idx_cpanel_user_role` (`role`),
  CONSTRAINT `fk_cpanel_user_org_code` FOREIGN KEY (`org_code`) REFERENCES `tb_cpanel_organizations` (`code`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- tb_csd_notifications — per-organization notices
--   user_id NULL = broadcast; roles_csv NULL = visible to all roles in org
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_csd_notifications` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `user_id` bigint(20) DEFAULT NULL COMMENT 'NULL = all members of the organization',
  `roles_csv` varchar(255) DEFAULT NULL COMMENT 'Comma-separated tb_cpanel_roles.code; NULL = all roles',
  `title` varchar(200) NOT NULL,
  `body` text,
  `severity` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_csd_notif_org_user_created` (`org_id`,`user_id`,`created_at`),
  KEY `idx_csd_notif_org_created` (`org_id`,`created_at`),
  CONSTRAINT `fk_csd_notif_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_csd_notif_user` FOREIGN KEY (`user_id`) REFERENCES `tb_cpanel_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- tb_cpanel_nav_items — left navigation (per org, filtered by user role)
--   roles_csv NULL or empty = visible to every role
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_cpanel_nav_items` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `label` varchar(80) NOT NULL,
  `icon` varchar(60) NOT NULL DEFAULT 'Circle',
  `route` varchar(160) NOT NULL,
  `position` enum('top','bottom') NOT NULL DEFAULT 'top',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `roles_csv` varchar(255) DEFAULT NULL COMMENT 'Comma-separated role codes; NULL = all',
  PRIMARY KEY (`id`),
  KEY `idx_nav_org_active` (`org_id`,`is_active`),
  CONSTRAINT `fk_nav_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- tb_config_org_config — org-scoped key/value settings
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_config_org_config` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `config_key` varchar(120) NOT NULL,
  `config_value` mediumtext NOT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_org_key` (`org_id`,`config_key`),
  CONSTRAINT `fk_config_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- tb_csd_support_tickets — portal issues / bugs / enhancements (per org)
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_csd_support_tickets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `reporter_user_id` bigint(20) NOT NULL,
  `request_type` enum('issue','bug','enhancement') NOT NULL DEFAULT 'issue',
  `title` varchar(220) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('raised','acknowledged','in_progress','completed','live') NOT NULL DEFAULT 'raised',
  `tracking_emails` varchar(600) DEFAULT NULL COMMENT 'Comma-separated CC addresses for status updates',
  `approval_token_sha256` char(64) DEFAULT NULL COMMENT 'SHA256 hex of email Accept/Decline token',
  `approval_decision` enum('accept','decline') DEFAULT NULL,
  `approval_decided_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_support_org_status` (`org_id`,`status`),
  KEY `idx_support_org_reporter` (`org_id`,`reporter_user_id`),
  CONSTRAINT `fk_support_ticket_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_support_ticket_reporter` FOREIGN KEY (`reporter_user_id`) REFERENCES `tb_cpanel_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- tb_csd_support_ticket_attachments — files stored on app server disk (path only)
-- -----------------------------------------------------------------------------
CREATE TABLE `tb_csd_support_ticket_attachments` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_path` varchar(500) NOT NULL COMMENT 'Relative to uploads root',
  `mime_type` varchar(120) NOT NULL,
  `size_bytes` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_support_att_ticket` (`ticket_id`),
  CONSTRAINT `fk_support_att_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tb_csd_support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- =============================================================================
-- Default seed data (dev / fresh install)
-- Demo password for all seeded users below: Demo@12345
-- =============================================================================

INSERT INTO `tb_cpanel_organizations` (`id`, `code`, `name`, `is_active`, `created_at`) VALUES
  (1, 'acme', 'Acme Corporation', 1, CURRENT_TIMESTAMP),
  (2, 'globex', 'Globex Inc', 1, CURRENT_TIMESTAMP);

ALTER TABLE `tb_cpanel_organizations` AUTO_INCREMENT = 3;

INSERT INTO `tb_cpanel_users` (`id`, `org_code`, `email`, `password_hash`, `full_name`, `mobile`, `role`, `is_active`, `created_at`) VALUES
  (1, 'acme', 'admin@acme.com', '$2b$10$DgO83YYvsLrigH4s7GaiCOk/E9k0d1DzzKgpsD/0e5FWEBgofP8fO', 'Acme Admin', '0000000000', 'org_admin', 1, CURRENT_TIMESTAMP),
  (2, 'globex', 'lead@globex.com', '$2b$10$DgO83YYvsLrigH4s7GaiCOk/E9k0d1DzzKgpsD/0e5FWEBgofP8fO', 'Globex Lead', '0000000001', 'manager', 1, CURRENT_TIMESTAMP);

ALTER TABLE `tb_cpanel_users` AUTO_INCREMENT = 3;

INSERT INTO `tb_csd_notifications` (`id`, `org_id`, `user_id`, `roles_csv`, `title`, `body`, `severity`, `created_at`) VALUES
  (1, 1, NULL, NULL, 'Welcome to Acme', 'Organization-wide notice for all roles.', 'success', CURRENT_TIMESTAMP),
  (2, 1, 1, 'org_admin,super_admin', 'Admin checklist', 'Only org admins and super admins see this item.', 'info', CURRENT_TIMESTAMP),
  (3, 2, NULL, NULL, 'Welcome to Globex', 'Default seed data (see enterprise_adm.sql).', 'info', CURRENT_TIMESTAMP),
  (4, 2, 2, NULL, 'Team digest', 'Targeted notification for Globex Lead.', 'warning', CURRENT_TIMESTAMP);

ALTER TABLE `tb_csd_notifications` AUTO_INCREMENT = 5;

INSERT INTO `tb_cpanel_nav_items` (`id`, `org_id`, `label`, `icon`, `route`, `position`, `sort_order`, `is_active`, `roles_csv`) VALUES
  (1, 1, 'Dashboard', 'LayoutDashboard', '/app/dashboard', 'top', 1, 1, NULL),
  (2, 1, 'Notifications', 'Bell', '/app/notifications', 'top', 2, 1, NULL),
  (3, 1, 'Accounts', 'Users', '/app/accounts', 'top', 3, 1, 'org_admin,manager,super_admin'),
  (4, 1, 'Settings', 'Settings', '/app/settings', 'top', 4, 1, 'org_admin,super_admin'),
  (5, 1, 'Profile', 'User', '/app/profile', 'bottom', 100, 1, NULL),
  (6, 2, 'Dashboard', 'LayoutDashboard', '/app/dashboard', 'top', 1, 1, NULL),
  (7, 2, 'Notifications', 'Bell', '/app/notifications', 'top', 2, 1, NULL),
  (8, 2, 'Accounts', 'Users', '/app/accounts', 'top', 3, 1, 'org_admin,manager,super_admin'),
  (9, 2, 'Settings', 'Settings', '/app/settings', 'top', 4, 1, 'org_admin,super_admin'),
  (10, 2, 'Profile', 'User', '/app/profile', 'bottom', 100, 1, NULL);

ALTER TABLE `tb_cpanel_nav_items` AUTO_INCREMENT = 11;

INSERT INTO `tb_config_org_config` (`id`, `org_id`, `config_key`, `config_value`, `updated_at`) VALUES
  (1, 1, 'app_name', 'Acme Admin', CURRENT_TIMESTAMP),
  (2, 1, 'logo_url', '/uploads/logos/org-1-logo.png', CURRENT_TIMESTAMP),
  (3, 1, 'color_root', '#1e293b', CURRENT_TIMESTAMP),
  (4, 1, 'color_secondary', '#06B6D4', CURRENT_TIMESTAMP),
  (5, 1, 'color_tertiary', '#F59E0B', CURRENT_TIMESTAMP),
  (6, 1, 'support_widget_enabled', 'true', CURRENT_TIMESTAMP),
  (7, 1, 'logo_profile', 'rectangle', CURRENT_TIMESTAMP),
  (8, 2, 'app_name', 'Globex Control Center', CURRENT_TIMESTAMP),
  (9, 2, 'logo_url', '/logos/globex.svg', CURRENT_TIMESTAMP),
  (10, 2, 'color_root', '#0F766E', CURRENT_TIMESTAMP),
  (11, 2, 'color_secondary', '#0284C7', CURRENT_TIMESTAMP),
  (12, 2, 'color_tertiary', '#9333EA', CURRENT_TIMESTAMP),
  (13, 2, 'support_widget_enabled', 'true', CURRENT_TIMESTAMP);

ALTER TABLE `tb_config_org_config` AUTO_INCREMENT = 14;
