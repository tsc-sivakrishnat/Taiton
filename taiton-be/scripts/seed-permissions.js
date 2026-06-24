import '../src/config/env.js';
import { pool } from '../src/config/db.js';

const PERMISSIONS = [
  ['platform.orgs.manage', 'platform', 'orgs', 'Create/update organizations'],
  ['platform.roles.manage', 'platform', 'roles', 'Manage role catalogue'],
  ['platform.nav.manage', 'platform', 'nav', 'Manage navigation items'],
  ['platform.users.org_admin', 'platform', 'users', 'Create org_admin users only'],
  ['org.config.manage', 'org', 'config', 'Organization configuration'],
  ['org.users.manage', 'org', 'users', 'Manage organization users (non org_admin)'],
  ['org.approval_rules.manage', 'org', 'approval_rules', 'Maker/checker rules'],
  ['org.audit.view', 'org', 'audit', 'View audit log'],
  ['content.products.read', 'products', 'read', 'View products'],
  ['content.products.write', 'products', 'write', 'Create/edit products'],
  ['content.products.publish', 'products', 'publish', 'Publish products live'],
  ['content.seo.write', 'seo', 'write', 'Create/edit SEO'],
  ['content.seo.publish', 'seo', 'publish', 'Publish SEO live'],
  ['content.ui.write', 'ui_elements', 'write', 'Create/edit UI elements'],
  ['content.ui.publish', 'ui_elements', 'publish', 'Publish UI elements'],
  ['customer_requests.read', 'customer_requests', 'read', 'View customer requests'],
  ['customer_requests.manage', 'customer_requests', 'manage', 'Manage customer requests']
];

const GRANTS = [
  ['sys_admin', 'platform.orgs.manage', 'direct', null],
  ['sys_admin', 'platform.roles.manage', 'direct', null],
  ['sys_admin', 'platform.nav.manage', 'direct', null],
  ['sys_admin', 'platform.users.org_admin', 'direct', null],
  ['super_admin', 'platform.orgs.manage', 'direct', null],
  ['super_admin', 'platform.roles.manage', 'direct', null],
  ['super_admin', 'platform.nav.manage', 'direct', null],
  ['super_admin', 'platform.users.org_admin', 'direct', null],
  ['org_admin', 'org.config.manage', 'direct', null],
  ['org_admin', 'org.users.manage', 'direct', null],
  ['org_admin', 'org.approval_rules.manage', 'direct', null],
  ['org_admin', 'org.audit.view', 'direct', null],
  ['org_admin', 'content.products.read', 'direct', null],
  ['org_admin', 'content.products.write', 'direct', null],
  ['org_admin', 'content.products.publish', 'direct', null],
  ['org_admin', 'content.seo.write', 'direct', null],
  ['org_admin', 'content.seo.publish', 'direct', null],
  ['org_admin', 'content.ui.write', 'direct', null],
  ['org_admin', 'content.ui.publish', 'direct', null],
  ['org_admin', 'customer_requests.read', 'direct', null],
  ['org_admin', 'customer_requests.manage', 'direct', null],
  ['super_employee', 'content.products.read', 'direct', null],
  ['super_employee', 'content.products.write', 'direct', null],
  ['super_employee', 'content.products.publish', 'direct', null],
  ['super_employee', 'content.seo.write', 'direct', null],
  ['super_employee', 'content.seo.publish', 'direct', null],
  ['super_employee', 'content.ui.write', 'approval_required', 'org_admin'],
  ['super_employee', 'customer_requests.read', 'direct', null],
  ['super_employee', 'customer_requests.manage', 'direct', null],
  ['employee', 'content.products.read', 'direct', null],
  ['employee', 'content.products.write', 'approval_required', 'super_employee'],
  ['employee', 'content.products.publish', 'approval_required', 'super_employee'],
  ['employee', 'customer_requests.read', 'direct', null],
  ['employee_2', 'content.products.read', 'direct', null],
  ['employee_2', 'content.products.write', 'approval_required', 'super_employee'],
  ['member', 'customer_requests.read', 'direct', null]
];

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Seeding permissions table...');
    for (const [code, resource, action, desc] of PERMISSIONS) {
      await conn.query(
        `INSERT INTO tb_cpanel_permissions (code, resource, action, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [code, resource, action, desc]
      );
    }

    console.log('Deleting existing grants...');
    await conn.query(
      `DELETE FROM tb_cpanel_role_permissions WHERE role_code IN (
         'sys_admin','super_admin','org_admin','super_employee','employee','employee_2','member'
       )`
    );

    console.log('Inserting new grants...');
    for (const [role, perm, level, approver] of GRANTS) {
      await conn.query(
        `INSERT INTO tb_cpanel_role_permissions (role_code, permission_code, access_level, approver_role_code)
         VALUES (?, ?, ?, ?)`,
        [role, perm, level, approver]
      );
    }

    await conn.commit();
    console.log('Permissions and grants seeded successfully!');
  } catch (e) {
    await conn.rollback();
    console.error('Failed to seed permissions:', e);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
