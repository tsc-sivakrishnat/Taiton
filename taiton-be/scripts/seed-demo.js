/**
 * Seeds a demo organization, admin user, notifications, and nav (optional).
 * Prefer importing database/enterprise_adm.sql for full defaults; use this for a minimal extra org.
 *
 *   npm run seed:demo
 */
import '../src/config/env.js';
import { pool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345';
  const email = (process.env.SEED_DEMO_EMAIL ?? 'admin@demo.local').toLowerCase();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orgResult] = await conn.query(
      `INSERT INTO tb_cpanel_organizations (code, name, is_active) VALUES ('demo-corp', 'Demo Corp', 1)`,
    );
    const orgId = orgResult.insertId;

    const hash = await hashPassword(password);
    const [userResult] = await conn.query(
      `INSERT INTO tb_cpanel_users (org_code, email, password_hash, full_name, role, is_active) VALUES ('demo-corp', ?, ?, 'Demo Admin', 'org_admin', 1)`,
      [email, hash],
    );
    const userId = userResult.insertId;

    await conn.query(
      `INSERT INTO tb_csd_notifications (org_id, user_id, roles_csv, title, body, severity) VALUES
       (?, NULL, NULL, 'Welcome', 'This is an organization-wide notice.', 'success'),
       (?, ?, NULL, 'Your account', 'Signed-in context is fixed to this organization for your account.', 'info')`,
      [orgId, userId],
    );

    await conn.query(
      `INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, position, sort_order, is_active, roles_csv) VALUES
       (?, 'Dashboard', 'LayoutDashboard', '/app/dashboard', 'top', 1, 1, NULL),
       (?, 'Notifications', 'Bell', '/app/notifications', 'top', 2, 1, NULL),
       (?, 'Accounts', 'Users', '/app/accounts', 'top', 3, 1, 'org_admin,manager,super_admin'),
       (?, 'Settings', 'Settings', '/app/settings', 'top', 4, 1, 'org_admin,super_admin'),
       (?, 'Profile', 'User', '/app/profile', 'bottom', 100, 1, NULL)`,
      [orgId, orgId, orgId, orgId, orgId],
    );

    await conn.commit();
    // eslint-disable-next-line no-console
    console.log('Seed complete.');
    // eslint-disable-next-line no-console
    console.log(`  Email: ${email}`);
    // eslint-disable-next-line no-console
    console.log(`  Password: ${password}`);
    // eslint-disable-next-line no-console
    console.log(`  Organization id: ${orgId}`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
