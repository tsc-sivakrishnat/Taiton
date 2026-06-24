-- Mobile number for users; login password is the bcrypt of this value (see actor registration).
-- If you see "Duplicate column name 'mobile'", use migration_add_user_mobile_if_missing.sql instead.
ALTER TABLE `tb_cpanel_users`
  ADD COLUMN `mobile` varchar(20) NULL DEFAULT NULL AFTER `full_name`;

UPDATE `tb_cpanel_users` SET `mobile` = '0000000000' WHERE `mobile` IS NULL;
