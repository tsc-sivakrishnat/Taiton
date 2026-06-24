-- Run once on existing databases that lack approval columns (shared hosting / ALTER may need phpMyAdmin).
-- If columns already exist, skip this or remove lines that error.
-- Optional: legacy unused table from older builds:
-- DROP TABLE IF EXISTS `tb_csd_support_ticket_decisions`;

ALTER TABLE `tb_csd_support_tickets`
  ADD COLUMN `approval_token_sha256` CHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hex of email approval token',
  ADD COLUMN `approval_decision` ENUM('accept','decline') NULL DEFAULT NULL,
  ADD COLUMN `approval_decided_at` DATETIME NULL DEFAULT NULL;
