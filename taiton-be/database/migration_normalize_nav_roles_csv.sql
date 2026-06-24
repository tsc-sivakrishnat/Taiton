-- Normalize roles_csv on nav items so role matching is reliable (lowercase codes).
UPDATE tb_cpanel_nav_items
SET roles_csv = LOWER(REPLACE(REPLACE(TRIM(roles_csv), ' ', ''), ';', ','))
WHERE roles_csv IS NOT NULL AND TRIM(roles_csv) <> '';
