-- =============================================================================
-- Enterprise flow migration — run in phpMyAdmin on database u418448115_enterprise_adm
-- Safe to re-run: uses procedures / IF NOT EXISTS where possible.
-- Order: run this entire script once.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1) Roles: priority + scope (platform vs organization)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS cpanel_migrate_roles_columns;
DELIMITER $$
CREATE PROCEDURE cpanel_migrate_roles_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tb_cpanel_roles' AND COLUMN_NAME = 'priority'
  ) THEN
    ALTER TABLE `tb_cpanel_roles`
      ADD COLUMN `priority` int(11) NOT NULL DEFAULT 100 COMMENT 'Lower number = higher rank' AFTER `description`;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tb_cpanel_roles' AND COLUMN_NAME = 'scope'
  ) THEN
    ALTER TABLE `tb_cpanel_roles`
      ADD COLUMN `scope` enum('platform','organization') NOT NULL DEFAULT 'organization' AFTER `priority`;
  END IF;
END$$
DELIMITER ;
CALL cpanel_migrate_roles_columns();
DROP PROCEDURE IF EXISTS cpanel_migrate_roles_columns;

-- Platform + TAITON role catalogue
INSERT INTO `tb_cpanel_roles` (`code`, `name`, `description`, `priority`, `scope`) VALUES
  ('sys_admin', 'System Admin', 'Platform operator — organizations, roles, nav, org_admin provisioning', 0, 'platform'),
  ('super_admin', 'Super Admin', 'Legacy platform admin (same privileges as sys_admin)', 1, 'platform'),
  ('org_admin', 'Organization Admin', 'Full administration within an organization', 10, 'organization'),
  ('super_employee', 'Super Employee', 'Senior ops — products/SEO live; UI needs org_admin approval', 20, 'organization'),
  ('manager', 'Manager', 'Team management (legacy)', 25, 'organization'),
  ('employee', 'Employee', 'Standard ops — products need super_employee approval', 30, 'organization'),
  ('employee_2', 'Employee 2', 'Secondary employee tier', 35, 'organization'),
  ('member', 'Member', 'Limited member access', 40, 'organization')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `priority` = VALUES(`priority`),
  `scope` = VALUES(`scope`);

-- -----------------------------------------------------------------------------
-- 2) Permissions catalogue + role grants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_cpanel_permissions` (
  `code` varchar(64) NOT NULL,
  `resource` varchar(48) NOT NULL,
  `action` varchar(48) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`code`),
  KEY `idx_perm_resource` (`resource`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `tb_cpanel_role_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `role_code` varchar(48) NOT NULL,
  `permission_code` varchar(64) NOT NULL,
  `access_level` enum('deny','direct','approval_required') NOT NULL DEFAULT 'direct',
  `approver_role_code` varchar(48) DEFAULT NULL COMMENT 'Required when access_level = approval_required',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_perm` (`role_code`,`permission_code`),
  KEY `fk_role_perm_code` (`permission_code`),
  CONSTRAINT `fk_role_perm_permission` FOREIGN KEY (`permission_code`) REFERENCES `tb_cpanel_permissions` (`code`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT INTO `tb_cpanel_permissions` (`code`, `resource`, `action`, `description`) VALUES
  ('platform.orgs.manage', 'platform', 'orgs', 'Create/update organizations'),
  ('platform.roles.manage', 'platform', 'roles', 'Manage role catalogue'),
  ('platform.nav.manage', 'platform', 'nav', 'Manage navigation items'),
  ('platform.users.org_admin', 'platform', 'users', 'Create org_admin users only'),
  ('org.config.manage', 'org', 'config', 'Organization configuration'),
  ('org.users.manage', 'org', 'users', 'Manage organization users (non org_admin)'),
  ('org.approval_rules.manage', 'org', 'approval_rules', 'Maker/checker rules'),
  ('org.audit.view', 'org', 'audit', 'View audit log'),
  ('content.products.read', 'products', 'read', 'View products'),
  ('content.products.write', 'products', 'write', 'Create/edit products'),
  ('content.products.publish', 'products', 'publish', 'Publish products live'),
  ('content.seo.write', 'seo', 'write', 'Create/edit SEO'),
  ('content.seo.publish', 'seo', 'publish', 'Publish SEO live'),
  ('content.ui.write', 'ui_elements', 'write', 'Create/edit UI elements'),
  ('content.ui.publish', 'ui_elements', 'publish', 'Publish UI elements'),
  ('customer_requests.read', 'customer_requests', 'read', 'View customer requests'),
  ('customer_requests.manage', 'customer_requests', 'manage', 'Manage customer requests')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- TAITON matrix (your spec)
DELETE FROM `tb_cpanel_role_permissions` WHERE `role_code` IN (
  'sys_admin','super_admin','org_admin','super_employee','employee','employee_2','member'
);

INSERT INTO `tb_cpanel_role_permissions` (`role_code`, `permission_code`, `access_level`, `approver_role_code`) VALUES
  ('sys_admin', 'platform.orgs.manage', 'direct', NULL),
  ('sys_admin', 'platform.roles.manage', 'direct', NULL),
  ('sys_admin', 'platform.nav.manage', 'direct', NULL),
  ('sys_admin', 'platform.users.org_admin', 'direct', NULL),
  ('super_admin', 'platform.orgs.manage', 'direct', NULL),
  ('super_admin', 'platform.roles.manage', 'direct', NULL),
  ('super_admin', 'platform.nav.manage', 'direct', NULL),
  ('super_admin', 'platform.users.org_admin', 'direct', NULL),
  ('org_admin', 'org.config.manage', 'direct', NULL),
  ('org_admin', 'org.users.manage', 'direct', NULL),
  ('org_admin', 'org.approval_rules.manage', 'direct', NULL),
  ('org_admin', 'org.audit.view', 'direct', NULL),
  ('org_admin', 'content.products.read', 'direct', NULL),
  ('org_admin', 'content.products.write', 'direct', NULL),
  ('org_admin', 'content.products.publish', 'direct', NULL),
  ('org_admin', 'content.seo.write', 'direct', NULL),
  ('org_admin', 'content.seo.publish', 'direct', NULL),
  ('org_admin', 'content.ui.write', 'direct', NULL),
  ('org_admin', 'content.ui.publish', 'direct', NULL),
  ('org_admin', 'customer_requests.read', 'direct', NULL),
  ('org_admin', 'customer_requests.manage', 'direct', NULL),
  ('super_employee', 'content.products.read', 'direct', NULL),
  ('super_employee', 'content.products.write', 'direct', NULL),
  ('super_employee', 'content.products.publish', 'direct', NULL),
  ('super_employee', 'content.seo.write', 'direct', NULL),
  ('super_employee', 'content.seo.publish', 'direct', NULL),
  ('super_employee', 'content.ui.write', 'approval_required', 'org_admin'),
  ('super_employee', 'customer_requests.read', 'direct', NULL),
  ('super_employee', 'customer_requests.manage', 'direct', NULL),
  ('employee', 'content.products.read', 'direct', NULL),
  ('employee', 'content.products.write', 'approval_required', 'super_employee'),
  ('employee', 'content.products.publish', 'approval_required', 'super_employee'),
  ('employee', 'customer_requests.read', 'direct', NULL),
  ('employee_2', 'content.products.read', 'direct', NULL),
  ('employee_2', 'content.products.write', 'approval_required', 'super_employee'),
  ('member', 'customer_requests.read', 'direct', NULL);

-- -----------------------------------------------------------------------------
-- 3) Maker / checker rules (per org)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_cpanel_approval_rules` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `resource` varchar(48) NOT NULL,
  `maker_role` varchar(48) NOT NULL,
  `checker_role` varchar(48) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_approval_org_resource` (`org_id`,`resource`),
  CONSTRAINT `fk_approval_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- 4) Audit log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_cpanel_audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) DEFAULT NULL,
  `actor_user_id` bigint(20) DEFAULT NULL,
  `actor_role` varchar(48) DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `resource_type` varchar(48) NOT NULL,
  `resource_id` varchar(64) DEFAULT NULL,
  `detail_json` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_org_created` (`org_id`,`created_at`),
  KEY `idx_audit_actor` (`actor_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- 5) Customer requests (inquiries / contact / quotations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_csd_customer_requests` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `request_type` enum('inquiry','contact','quotation') NOT NULL,
  `customer_name` varchar(140) NOT NULL,
  `email` varchar(190) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `subject` varchar(220) NOT NULL,
  `message` text NOT NULL,
  `status` enum('new','in_review','responded','closed') NOT NULL DEFAULT 'new',
  `assigned_user_id` bigint(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cr_org_status` (`org_id`,`status`),
  CONSTRAINT `fk_cr_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_assignee` FOREIGN KEY (`assigned_user_id`) REFERENCES `tb_cpanel_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- 6) Content items (products, SEO, UI elements) with approval workflow
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_csd_content_items` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `content_type` enum('product','seo','ui_element') NOT NULL,
  `title` varchar(220) NOT NULL,
  `summary` varchar(500) DEFAULT NULL,
  `payload_json` mediumtext DEFAULT NULL,
  `status` enum('draft','pending_approval','live','rejected') NOT NULL DEFAULT 'draft',
  `created_by` bigint(20) NOT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `approved_by` bigint(20) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_content_org_type_status` (`org_id`,`content_type`,`status`),
  CONSTRAINT `fk_content_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_creator` FOREIGN KEY (`created_by`) REFERENCES `tb_cpanel_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_approver` FOREIGN KEY (`approved_by`) REFERENCES `tb_cpanel_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- -----------------------------------------------------------------------------
-- 7) Nav items for new modules (org 1 = TAITON / acme)
-- -----------------------------------------------------------------------------
INSERT INTO `tb_cpanel_nav_items` (`org_id`, `label`, `icon`, `route`, `position`, `sort_order`, `is_active`, `roles_csv`) VALUES
  (1, 'Customer requests', 'Inbox', '/app/customer-requests', 'top', 5, 1, NULL),
  (1, 'Products', 'Package', '/app/products', 'top', 6, 1, 'org_admin,super_employee,employee,employee_2'),
  (1, 'SEO', 'Search', '/app/seo', 'top', 7, 1, 'org_admin,super_employee'),
  (1, 'UI elements', 'Layout', '/app/ui-elements', 'top', 8, 1, 'org_admin,super_employee'),
  (1, 'Platform', 'Building2', '/app/platform', 'top', 9, 1, 'sys_admin,super_admin')
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

-- Default approval rules for org 1 (maker employee → checker super_employee for products)
INSERT INTO `tb_cpanel_approval_rules` (`org_id`, `resource`, `maker_role`, `checker_role`, `is_active`) VALUES
  (1, 'products', 'employee', 'super_employee', 1),
  (1, 'products', 'employee_2', 'super_employee', 1),
  (1, 'ui_elements', 'super_employee', 'org_admin', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Enterprise flow migration completed.' AS message;
