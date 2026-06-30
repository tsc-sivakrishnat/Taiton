import '../src/config/env.js';
import { pool } from '../src/config/db.js';

const PERMISSIONS = [
  ['content.blogs.read', 'blogs', 'read', 'View blogs'],
  ['content.blogs.write', 'blogs', 'write', 'Create/edit blogs'],
  ['content.blogs.publish', 'blogs', 'publish', 'Publish blogs live']
];

const GRANTS = [
  ['org_admin', 'content.blogs.read', 'direct', null],
  ['org_admin', 'content.blogs.write', 'direct', null],
  ['org_admin', 'content.blogs.publish', 'direct', null],
  ['super_employee', 'content.blogs.read', 'direct', null],
  ['super_employee', 'content.blogs.write', 'direct', null],
  ['super_employee', 'content.blogs.publish', 'direct', null],
  ['employee', 'content.blogs.read', 'direct', null],
  ['employee', 'content.blogs.write', 'approval_required', 'super_employee'],
  ['employee', 'content.blogs.publish', 'approval_required', 'super_employee'],
  ['employee_2', 'content.blogs.read', 'direct', null],
  ['employee_2', 'content.blogs.write', 'approval_required', 'super_employee'],
  ['employee_2', 'content.blogs.publish', 'approval_required', 'super_employee']
];

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Inserting blog permissions...');
    for (const [code, resource, action, desc] of PERMISSIONS) {
      await conn.query(
        `INSERT INTO tb_cpanel_permissions (code, resource, action, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [code, resource, action, desc]
      );
    }

    console.log('Deleting old blog grants...');
    await conn.query(
      `DELETE FROM tb_cpanel_role_permissions WHERE permission_code LIKE 'content.blogs.%'`
    );

    console.log('Inserting blog grants...');
    for (const [role, perm, level, approver] of GRANTS) {
      await conn.query(
        `INSERT INTO tb_cpanel_role_permissions (role_code, permission_code, access_level, approver_role_code)
         VALUES (?, ?, ?, ?)`,
        [role, perm, level, approver]
      );
    }

    console.log('Adding Blog Management to navigation for all organizations...');
    const [orgs] = await conn.query('SELECT id FROM tb_cpanel_organizations');
    for (const org of orgs) {
      const orgId = org.id;
      // Check if already exists
      const [existing] = await conn.query(
        `SELECT id FROM tb_cpanel_nav_items WHERE org_id = ? AND route = ?`,
        [orgId, '/app/blog']
      );
      if (!existing.length) {
        await conn.query(
          `INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, position, sort_order, is_active, roles_csv)
           VALUES (?, 'Blog Management', 'ScrollText', '/app/blog', 'top', 12, 1, 'org_admin,super_employee,employee,employee_2')`,
          [orgId]
        );
        console.log(`Added Blog Management nav item for org_id = ${orgId}`);
      }
    }

    await conn.commit();
    console.log('Blog permissions, grants, and navigation seeded successfully!');
    process.exit(0);
  } catch (e) {
    await conn.rollback();
    console.error('Failed to seed blog permissions:', e);
    process.exit(1);
  } finally {
    conn.release();
  }
}

main();
