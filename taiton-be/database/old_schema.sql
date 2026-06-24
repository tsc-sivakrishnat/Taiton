-- --------------------------------------------------------
-- Host:                         193.203.184.29
-- Server version:               11.8.6-MariaDB-log - MariaDB Server
-- Server OS:                    Linux
-- HeidiSQL Version:             12.17.0.7270
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for u418448115_enterprise_adm
CREATE DATABASE IF NOT EXISTS `u418448115_enterprise_adm` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `u418448115_enterprise_adm`;

-- Dumping structure for table u418448115_enterprise_adm.tb_config_org_config
CREATE TABLE IF NOT EXISTS `tb_config_org_config` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `config_key` varchar(120) NOT NULL,
  `config_value` text NOT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_config` (`org_id`,`config_key`),
  CONSTRAINT `fk_org_config_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_config_org_config: ~13 rows (approximately)
INSERT INTO `tb_config_org_config` (`id`, `org_id`, `config_key`, `config_value`, `updated_at`) VALUES
	(1, 1, 'app_name', 'Acme Admin', '2026-05-07 09:40:48'),
	(2, 1, 'logo_url', '/uploads/logos/org-1-logo-1778395706616.png', '2026-05-10 06:48:26'),
	(3, 1, 'color_root', '#4F46E5', '2026-05-07 12:08:58'),
	(4, 1, 'color_secondary', '#06B6D4', '2026-05-07 09:40:48'),
	(5, 1, 'color_tertiary', '#F59E0B', '2026-05-07 09:40:48'),
	(6, 1, 'support_widget_enabled', 'true', '2026-05-10 06:59:01'),
	(7, 2, 'app_name', 'Globex Control Center', '2026-05-07 09:40:48'),
	(8, 2, 'logo_url', '/logos/globex.svg', '2026-05-07 09:40:48'),
	(9, 2, 'color_root', '#0F766E', '2026-05-07 09:40:48'),
	(10, 2, 'color_secondary', '#0284C7', '2026-05-07 09:40:48'),
	(11, 2, 'color_tertiary', '#9333EA', '2026-05-07 09:40:48'),
	(12, 2, 'support_widget_enabled', 'true', '2026-05-07 09:40:48'),
	(70, 1, 'logo_profile', 'rectangle', '2026-05-11 14:18:55');

-- Dumping structure for table u418448115_enterprise_adm.tb_cpanel_nav_items
CREATE TABLE IF NOT EXISTS `tb_cpanel_nav_items` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `label` varchar(80) NOT NULL,
  `icon` varchar(60) NOT NULL,
  `route` varchar(160) NOT NULL,
  `position` enum('top','bottom') NOT NULL DEFAULT 'top',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `roles_csv` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_nav_org` (`org_id`),
  CONSTRAINT `fk_nav_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_cpanel_nav_items: ~5 rows (approximately)
INSERT INTO `tb_cpanel_nav_items` (`id`, `org_id`, `label`, `icon`, `route`, `position`, `sort_order`, `is_active`, `roles_csv`) VALUES
	(31, 1, 'Dashboard', 'LayoutDashboard', '/dashboard', 'top', 1, 1, 'admin,employee,merchant'),
	(32, 1, 'Accounts', 'Users', '/accounts', 'top', 2, 1, 'admin,employee,merchant'),
	(33, 1, 'Records', 'Folder', '/records', 'top', 3, 1, 'admin,employee,merchant'),
	(34, 1, 'Trash', 'Trash2', '/trash', 'top', 4, 1, 'admin,employee,merchant'),
	(35, 1, 'Profile', 'User', '/profile', 'bottom', 100, 1, 'admin,employee,merchant');

-- Dumping structure for table u418448115_enterprise_adm.tb_cpanel_organizations
CREATE TABLE IF NOT EXISTS `tb_cpanel_organizations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL,
  `name` varchar(180) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_cpanel_organizations: ~2 rows (approximately)
INSERT INTO `tb_cpanel_organizations` (`id`, `code`, `name`, `is_active`, `created_at`) VALUES
	(1, 'acme', 'Acme Corporation', 1, '2026-05-07 09:40:48'),
	(2, 'globex', 'Globex Inc', 1, '2026-05-07 09:40:48');

-- Dumping structure for table u418448115_enterprise_adm.tb_cpanel_users
CREATE TABLE IF NOT EXISTS `tb_cpanel_users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `full_name` varchar(140) NOT NULL,
  `email` varchar(160) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(60) NOT NULL DEFAULT 'user',
  `theme_preference` enum('light','dark') DEFAULT 'light',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_user_org` (`org_id`),
  CONSTRAINT `fk_user_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_cpanel_users: ~1 rows (approximately)
INSERT INTO `tb_cpanel_users` (`id`, `org_id`, `full_name`, `email`, `password_hash`, `role`, `theme_preference`, `is_active`, `created_at`) VALUES
	(1, 1, 'Admin User', 'admin@acme.com', '$2a$10$ECLVZGNxVILPJ8LhMe30nO4naEDKYhx3Dj3fNMglkfqdmXTRQvI8C', 'admin', 'light', 1, '2026-05-07 09:40:48');

-- Dumping structure for table u418448115_enterprise_adm.tb_csd_dashboard_widgets
CREATE TABLE IF NOT EXISTS `tb_csd_dashboard_widgets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `code` varchar(80) NOT NULL,
  `title` varchar(120) NOT NULL,
  `layout_size` enum('sm','md','lg') NOT NULL DEFAULT 'md',
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `config_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config_json`)),
  PRIMARY KEY (`id`),
  KEY `fk_widget_org` (`org_id`),
  CONSTRAINT `fk_widget_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_csd_dashboard_widgets: ~4 rows (approximately)
INSERT INTO `tb_csd_dashboard_widgets` (`id`, `org_id`, `code`, `title`, `layout_size`, `enabled`, `sort_order`, `config_json`) VALUES
	(1, 1, 'sales_today', 'Sales Today', 'sm', 1, 1, NULL),
	(2, 1, 'open_tickets', 'Open Tickets', 'sm', 1, 2, NULL),
	(3, 1, 'uptime', 'Service Uptime', 'md', 1, 3, NULL),
	(4, 1, 'announcement', 'Announcements', 'lg', 1, 4, NULL);

-- Dumping structure for table u418448115_enterprise_adm.tb_csd_home_cards
CREATE TABLE IF NOT EXISTS `tb_csd_home_cards` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `code` varchar(80) NOT NULL,
  `title` varchar(140) NOT NULL,
  `subtitle` varchar(220) DEFAULT NULL,
  `accent` enum('root','secondary','tertiary') NOT NULL DEFAULT 'root',
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `config_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config_json`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_home_cards` (`org_id`,`code`),
  CONSTRAINT `fk_home_cards_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_csd_home_cards: ~3 rows (approximately)
INSERT INTO `tb_csd_home_cards` (`id`, `org_id`, `code`, `title`, `subtitle`, `accent`, `enabled`, `sort_order`, `config_json`) VALUES
	(1, 1, 'sales_overview', 'Sales Overview', 'Track your sales performance', 'root', 1, 1, '{"rows":[{"label":"Total Sales","value":"₹ 0.00","delta":0},{"label":"Transactions","value":"0","delta":0},{"label":"Average Order","value":"₹ 0.00"}]}'),
	(2, 1, 'accounts_summary', 'Accounts Summary', 'Manage your accounts', 'secondary', 1, 2, '{"rows":[{"label":"Active Accounts","value":"0"},{"label":"New Accounts","value":"0"},{"label":"Total Accounts","value":"0"}]}'),
	(3, 1, 'outstandings', 'Outstandings', 'Track pending payments', 'tertiary', 1, 3, '{"rows":[{"label":"Total Outstanding","value":"₹ 0.00","delta":0},{"label":"Overdue","value":"₹ 0.00","delta":0},{"label":"Due This Month","value":"₹ 0.00"}]}');

-- Dumping structure for table u418448115_enterprise_adm.tb_csd_org_metric_values
CREATE TABLE IF NOT EXISTS `tb_csd_org_metric_values` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `metric_key` varchar(80) NOT NULL,
  `description` varchar(240) DEFAULT NULL,
  `value_text` varchar(2048) NOT NULL DEFAULT '',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_metric` (`org_id`,`metric_key`),
  CONSTRAINT `fk_org_metric_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_csd_org_metric_values: ~0 rows (approximately)

-- Dumping structure for table u418448115_enterprise_adm.tb_project_module_fields
CREATE TABLE IF NOT EXISTS `tb_project_module_fields` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `module_id` bigint(20) NOT NULL,
  `field_key` varchar(80) NOT NULL,
  `label` varchar(120) NOT NULL,
  `field_type` enum('text','number','date','datetime','boolean','select','multiselect','textarea','email','phone','url','json') NOT NULL DEFAULT 'text',
  `is_required` tinyint(1) NOT NULL DEFAULT 0,
  `is_listed` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `options_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`options_json`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_module_field` (`module_id`,`field_key`),
  KEY `fk_module_fields_org` (`org_id`),
  CONSTRAINT `fk_module_fields_module` FOREIGN KEY (`module_id`) REFERENCES `tb_project_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_fields_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_project_module_fields: ~0 rows (approximately)

-- Dumping structure for table u418448115_enterprise_adm.tb_project_module_records
CREATE TABLE IF NOT EXISTS `tb_project_module_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `module_id` bigint(20) NOT NULL,
  `data_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data_json`)),
  `created_by` bigint(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_records_org` (`org_id`),
  KEY `fk_module_records_module` (`module_id`),
  KEY `fk_module_records_user` (`created_by`),
  CONSTRAINT `fk_module_records_module` FOREIGN KEY (`module_id`) REFERENCES `tb_project_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_records_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`),
  CONSTRAINT `fk_module_records_user` FOREIGN KEY (`created_by`) REFERENCES `tb_cpanel_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_project_module_records: ~0 rows (approximately)

-- Dumping structure for table u418448115_enterprise_adm.tb_project_modules
CREATE TABLE IF NOT EXISTS `tb_project_modules` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `code` varchar(80) NOT NULL,
  `name` varchar(140) NOT NULL,
  `icon` varchar(60) NOT NULL DEFAULT 'CircleDot',
  `route` varchar(160) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `ui_config_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ui_config_json`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_modules` (`org_id`,`code`),
  CONSTRAINT `fk_modules_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_project_modules: ~3 rows (approximately)
INSERT INTO `tb_project_modules` (`id`, `org_id`, `code`, `name`, `icon`, `route`, `is_active`, `created_at`, `ui_config_json`) VALUES
	(12, 1, 'accounts', 'Accounts', 'Users', '/accounts', 1, '2026-05-10 15:01:47', '{"pageTitle":"Accounts","pageSubtitle":"Configured from sidebar item","filterDefs":[{"key":"q","label":"Search","filterType":"search","placeholder":"Search…"},{"key":"asOf","label":"Date","filterType":"date"}],"cards":[],"tableColumns":[],"tableTitle":"Accounts Table","tableSubtitle":"Configure columns in Settings (metrics and/or record fields)."}'),
	(15, 1, 'records', 'Records', 'Folder', '/records', 1, '2026-05-10 15:01:47', '{"pageTitle":"Records","pageSubtitle":"Configured from sidebar item","filterDefs":[{"key":"q","label":"Search","filterType":"search","placeholder":"Search…"},{"key":"asOf","label":"Date","filterType":"date"}],"cards":[],"tableColumns":[],"tableTitle":"Records Table","tableSubtitle":"Configure columns in Settings (metrics and/or record fields)."}'),
	(16, 1, 'trash', 'Trash', 'Trash2', '/trash', 1, '2026-05-10 15:01:47', '{"pageTitle":"Trash","pageSubtitle":"Configured from sidebar item","filterDefs":[{"key":"q","label":"Search","filterType":"search","placeholder":"Search…"},{"key":"asOf","label":"Date","filterType":"date"}],"cards":[],"tableColumns":[],"tableTitle":"Trash Table","tableSubtitle":"Configure columns in Settings (metrics and/or record fields)."}');

-- Dumping structure for table u418448115_enterprise_adm.tb_project_support_tickets
CREATE TABLE IF NOT EXISTS `tb_project_support_tickets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `created_by` bigint(20) NOT NULL,
  `ticket_type` enum('bug','enhancement','new_project','service') NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `attachments_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments_json`)),
  `decision_status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `decision_note` text DEFAULT NULL,
  `decided_by` bigint(20) DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ticket_org` (`org_id`),
  KEY `fk_ticket_user` (`created_by`),
  KEY `fk_ticket_decider` (`decided_by`),
  CONSTRAINT `fk_ticket_decider` FOREIGN KEY (`decided_by`) REFERENCES `tb_cpanel_users` (`id`),
  CONSTRAINT `fk_ticket_org` FOREIGN KEY (`org_id`) REFERENCES `tb_cpanel_organizations` (`id`),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (`created_by`) REFERENCES `tb_cpanel_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table u418448115_enterprise_adm.tb_project_support_tickets: ~9 rows (approximately)
INSERT INTO `tb_project_support_tickets` (`id`, `org_id`, `created_by`, `ticket_type`, `title`, `description`, `status`, `created_at`, `updated_at`, `attachments_json`, `decision_status`, `decision_note`, `decided_by`, `decided_at`) VALUES
	(1, 1, 1, 'bug', 'first', 'first', 'open', '2026-05-07 12:25:41', '2026-05-07 12:25:41', NULL, 'pending', NULL, NULL, NULL),
	(2, 1, 1, 'bug', 'new bug', 'my bug', 'open', '2026-05-11 12:40:05', '2026-05-11 13:44:54', '[{"name":"taiton_logo.png","mime":"image/png","size":6320,"url":"/uploads/support/org-1-ticket-1778503205009-lj3mwj.png"}]', 'declined', NULL, 1, '2026-05-11 13:44:54'),
	(3, 1, 1, 'bug', 'ghj', 'fghj', 'open', '2026-05-11 13:34:59', '2026-05-11 13:44:56', '[]', 'accepted', NULL, 1, '2026-05-11 13:44:56'),
	(4, 1, 1, 'bug', 'fghj', 'ghj', 'open', '2026-05-11 13:45:04', '2026-05-11 13:45:04', '[]', 'pending', NULL, NULL, NULL),
	(5, 1, 1, 'bug', 'fghj', 'ghj', 'open', '2026-05-11 13:45:27', '2026-05-11 13:45:27', '[]', 'pending', NULL, NULL, NULL),
	(6, 1, 1, 'enhancement', 'fzbzxcv', 'dcczx', 'open', '2026-05-11 14:00:19', '2026-05-11 14:00:19', '[{"name":"taiton_logo.png","mime":"image/png","size":6320,"url":"/uploads/support/org-1-ticket-1778508018213-kuy6kk.png"}]', 'pending', NULL, NULL, NULL),
	(7, 1, 1, 'enhancement', 'Enhance Records Pagination', 'In Reports tab enhance the table pagination', 'open', '2026-05-11 14:16:50', '2026-05-11 14:16:50', '[{"name":"image_1.png","mime":"image/png","size":412558,"url":"/uploads/support/org-1-ticket-1778509010187-bx6tfx.png"}]', 'pending', NULL, NULL, NULL),
	(8, 1, 1, 'enhancement', 'Enhance Records Pagination', 'In Reports tab enhance the table pagination', 'open', '2026-05-11 14:16:57', '2026-05-11 14:16:57', '[{"name":"image_1.png","mime":"image/png","size":412558,"url":"/uploads/support/org-1-ticket-1778509016653-skj3m8.png"}]', 'pending', NULL, NULL, NULL),
	(9, 1, 1, 'enhancement', 'Enhance Records Pagination', 'In Reports tab enhance the table pagination', 'open', '2026-05-11 14:17:23', '2026-05-11 14:17:23', '[{"name":"image_1.png","mime":"image/png","size":412558,"url":"/uploads/support/org-1-ticket-1778509042201-e01svm.png"}]', 'pending', NULL, NULL, NULL);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
