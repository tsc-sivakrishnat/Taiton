-- Idempotent: adds tb_cpanel_users.mobile only when it is missing (fixes "Unknown column 'u.mobile' in 'SELECT'").
-- Run once in MySQL / MariaDB (e.g. phpMyAdmin SQL tab or mysql CLI).
--
-- If your host disallows stored procedures, run this single statement instead (ignore error if column already exists):
--   ALTER TABLE `tb_cpanel_users` ADD COLUMN `mobile` varchar(20) NULL DEFAULT NULL AFTER `full_name`;

DELIMITER $$

CREATE PROCEDURE cpanel_add_user_mobile_column()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tb_cpanel_users'
      AND COLUMN_NAME = 'mobile'
  ) THEN
    SELECT 'Column mobile already exists — nothing to do.' AS message;
  ELSE
    ALTER TABLE `tb_cpanel_users`
      ADD COLUMN `mobile` varchar(20) NULL DEFAULT NULL AFTER `full_name`;
    UPDATE `tb_cpanel_users` SET `mobile` = '0000000000' WHERE `mobile` IS NULL;
    SELECT 'Column mobile added.' AS message;
  END IF;
END$$

DELIMITER ;

CALL cpanel_add_user_mobile_column();

DROP PROCEDURE IF EXISTS cpanel_add_user_mobile_column;
