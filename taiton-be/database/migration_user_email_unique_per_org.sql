-- Optional: allow the same email in different organizations (unique per org, not global).
-- Run in phpMyAdmin if you need per-organization email uniqueness.
-- WARNING: only run if you understand duplicate emails across orgs are intentional.

SET NAMES utf8mb4;

-- Drop global unique on email if it exists
ALTER TABLE `tb_cpanel_users` DROP INDEX `uk_cpanel_user_email`;

-- Add composite unique per organization
ALTER TABLE `tb_cpanel_users`
  ADD UNIQUE KEY `uk_cpanel_user_org_email` (`org_code`, `email`);

SELECT 'Email uniqueness is now per organization (org_code + email).' AS message;
