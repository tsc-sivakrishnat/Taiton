import { pool } from './config/db.js';

const orgsToMigrate = [1, 25, 26];

const defaultItems = [
  // Dashboard & Profile visible to all roles
  ['Dashboard', 'LayoutDashboard', '/app/dashboard', 'top', 1, 'sys_admin,super_admin,org_admin,super_employee,employee,employee_2,member'],
  ['Profile', 'User', '/app/profile', 'bottom', 100, 'sys_admin,super_admin,org_admin,super_employee,employee,employee_2,member'],
  
  // Platform Operator routes
  ['Onboarding Organization', 'Building2', '/app/onboarding/organizations', 'top', 2, 'sys_admin,super_admin'],
  ['Onboarding Roles', 'Shield', '/app/onboarding/roles', 'top', 3, 'sys_admin,super_admin'],
  ['Onboarding Members', 'UserPlus', '/app/onboarding/members', 'top', 4, 'sys_admin,super_admin'],
  ['Onboarding Nav Items', 'Menu', '/app/onboarding/nav', 'top', 5, 'sys_admin,super_admin'],
  
  // Org Admin routes (for org 1, we also map users onboarding to super_employee)
  ['Onboarding User to Roles', 'Users', '/app/org/users', 'top', 6, 'org_admin'],
  ['Onboarding Rules to Roles', 'GitBranch', '/app/org/approval-rules', 'top', 7, 'org_admin'],
  ['Role Specific Audit Tracking', 'ScrollText', '/app/org/audit', 'top', 8, 'org_admin'],
  ['Approvals', 'CheckCircle', '/app/org/approvals', 'top', 9, 'org_admin'],
  ['Settings', 'Settings', '/app/settings', 'bottom', 101, 'org_admin'],

  // Super Employee / Employee routes
  ['Onboarding Products', 'Package', '/app/products', 'top', 10, 'super_employee,employee,employee_2'],
  ['SEO Management', 'Search', '/app/seo', 'top', 11, 'super_employee'],
  ['UI Elements', 'Layout', '/app/ui-elements', 'top', 12, 'super_employee'],
  ['Careers', 'Briefcase', '/app/careers', 'top', 13, 'super_employee'],
  ['Catalogs', 'Layout', '/app/catalogs', 'top', 14, 'super_employee'],
  ['Events & achievements', 'Briefcase', '/app/events', 'top', 15, 'super_employee'],
  ['Web Responses', 'Inbox', '/app/web-responses', 'top', 16, 'org_admin,super_employee,employee,employee_2,member'],
];

async function run() {
  console.log('Starting migration for navigation items...');
  
  for (const orgId of orgsToMigrate) {
    console.log(`Migrating org_id = ${orgId}...`);
    // Delete existing nav items for this org
    await pool.query('DELETE FROM tb_cpanel_nav_items WHERE org_id = :orgId', { orgId });
    
    // Seed new ones
    for (let [label, icon, route, position, sortOrder, rolesCsv] of defaultItems) {
      // For organization 1, map 'Onboarding User to Roles' to 'org_admin,super_employee'
      if (orgId === 1 && label === 'Onboarding User to Roles') {
        rolesCsv = 'org_admin,super_employee';
      }
      
      await pool.query(
        `INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, position, sort_order, is_active, roles_csv)
         VALUES (:orgId, :label, :icon, :route, :position, :sortOrder, 1, :rolesCsv)`,
        { orgId, label, icon, route, position, sortOrder, rolesCsv }
      );
    }
  }
  
  console.log('Migration completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
