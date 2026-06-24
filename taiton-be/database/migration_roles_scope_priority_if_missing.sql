-- Adds priority + scope to tb_cpanel_roles if missing (fixes "Unknown column 'scope' in 'WHERE'").
-- Run in phpMyAdmin after migration_add_user_mobile_if_missing.sql.
-- Safe to re-run.

SET NAMES utf8mb4;

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
  UPDATE `tb_cpanel_roles` SET `scope` = 'platform' WHERE `code` IN ('sys_admin', 'super_admin');
  UPDATE `tb_cpanel_roles` SET `priority` = 0 WHERE `code` = 'sys_admin';
  UPDATE `tb_cpanel_roles` SET `priority` = 1 WHERE `code` = 'super_admin';
  UPDATE `tb_cpanel_roles` SET `priority` = 10 WHERE `code` = 'org_admin';
END$$
DELIMITER ;
CALL cpanel_migrate_roles_columns();
DROP PROCEDURE IF EXISTS cpanel_migrate_roles_columns;

SELECT 'Roles priority/scope columns ready.' AS message;
