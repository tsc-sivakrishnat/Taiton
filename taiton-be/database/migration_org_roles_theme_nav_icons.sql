-- Organization-scoped roles, nav icon catalogue, theme keys via tb_config_org_config
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_cpanel_org_roles` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `code` varchar(48) NOT NULL,
  `name` varchar(80) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `priority` int(11) NOT NULL DEFAULT 100,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_role` (`org_id`,`code`),
  KEY `fk_org_roles_org` (`org_id`),
  CONSTRAINT `fk_org_roles_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `tb_cpanel_nav_icons` (
  `code` varchar(48) NOT NULL,
  `label` varchar(80) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT INTO `tb_cpanel_nav_icons` (`code`, `label`, `sort_order`) VALUES
  ('LayoutDashboard', 'Dashboard', 1),
  ('Bell', 'Notifications', 2),
  ('Users', 'Users', 3),
  ('Settings', 'Settings', 4),
  ('User', 'Profile', 5),
  ('Package', 'Products', 6),
  ('Search', 'SEO', 7),
  ('Layout', 'UI layout', 8),
  ('Inbox', 'Inbox', 9),
  ('Building2', 'Organization', 10),
  ('Shield', 'Roles', 11),
  ('Menu', 'Menu', 12),
  ('CheckCircle', 'Approvals', 13),
  ('GitBranch', 'Rules', 14),
  ('ScrollText', 'Audit', 15),
  ('UserPlus', 'Add user', 16),
  ('Briefcase', 'Careers', 17),
  ('Circle', 'Default', 99)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`), `sort_order` = VALUES(`sort_order`);

SELECT 'org_roles, nav_icons migration completed.' AS message;

-- Notifications belong in the header bell, not the sidebar.
UPDATE tb_cpanel_nav_items SET is_active = 0 WHERE route = '/app/notifications';
