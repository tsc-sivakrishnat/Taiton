-- Adds "Actor registration" to the left nav for every org (org_admin + super_admin only).
-- Safe to run more than once.
INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, position, sort_order, is_active, roles_csv)
SELECT o.id, 'Actor registration', 'UserPlus', '/app/admin/actor-registration', 'top', 5, 1, 'org_admin,super_admin'
FROM tb_cpanel_organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM tb_cpanel_nav_items n
  WHERE n.org_id = o.id AND n.route = '/app/admin/actor-registration'
);
