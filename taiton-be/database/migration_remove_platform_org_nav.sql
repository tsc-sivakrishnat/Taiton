-- Removes legacy Platform / customer-requests entries from org sidebars (sys_admin uses static nav only).
DELETE FROM tb_cpanel_nav_items
WHERE route IN ('/app/platform', '/app/customer-requests')
   OR LOWER(TRIM(label)) IN ('platform', 'customer requests');
