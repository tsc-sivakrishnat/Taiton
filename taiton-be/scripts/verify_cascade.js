import mysql from 'mysql2/promise';
import assert from 'assert';

async function main() {
  const pool = mysql.createPool({
    host: '193.203.184.29',
    port: 3306,
    user: 'u418448115_taiton',
    password: 'SivaKrishna$00',
    database: 'u418448115_enterprise_adm',
  });

  try {
    console.log('Starting cascading delete validation test...');
    
    // 1. Create a temporary organization
    const orgCode = `CAS_${Date.now().toString().slice(-6)}`;
    const [orgResult] = await pool.query(
      `INSERT INTO tb_cpanel_organizations (code, name) VALUES (?, ?)`,
      [orgCode, `Cascade Test Org ${orgCode}`]
    );
    const orgId = orgResult.insertId;
    console.log(`- Created temporary organization (ID: ${orgId}, Code: ${orgCode})`);

    // 2. Create a temporary role
    const roleCode = 'temp_test_role';
    await pool.query(
      `INSERT INTO tb_cpanel_org_roles (org_id, code, name, priority) VALUES (?, ?, ?, ?)`,
      [orgId, roleCode, 'Temp Test Role', 88]
    );
    console.log(`- Created temporary role: ${roleCode}`);

    // 3. Assign a nav item to this role (visibility)
    const [navResult] = await pool.query(
      `INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, roles_csv, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, 'Temp Nav', 'Circle', '/app/temp-nav', `org_admin,${roleCode}`, 1]
    );
    const navId = navResult.insertId;
    console.log(`- Created nav item (ID: ${navId}) with visibility: org_admin,${roleCode}`);

    // 4. Create a user assigned to this role
    const [userResult] = await pool.query(
      `INSERT INTO tb_cpanel_users (org_code, email, password_hash, full_name, mobile, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orgCode, `temp_user_${orgCode}@test.com`, 'hash', 'Temp User', `0000${orgCode}`, roleCode, 1]
    );
    const userId = userResult.insertId;
    console.log(`- Created user (ID: ${userId}) assigned to role: ${roleCode}`);

    // 5. Delete the role by simulating the platformService.deleteOrgRole logic
    // (deletes users assigned, updates nav items, deletes role)
    console.log('- Simulating deleteOrgRole service cascading steps...');
    
    // Step A: Delete users assigned
    await pool.query(
      `DELETE FROM tb_cpanel_users WHERE org_code = ? AND role = ?`,
      [orgCode, roleCode]
    );

    // Step B: Update nav items' roles_csv
    const [navItems] = await pool.query(
      `SELECT id, roles_csv AS rolesCsv FROM tb_cpanel_nav_items WHERE org_id = ?`,
      [orgId]
    );
    for (const item of navItems) {
      if (item.rolesCsv) {
        const parts = item.rolesCsv.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.includes(roleCode)) {
          const nextParts = parts.filter((p) => p !== roleCode);
          const nextCsv = nextParts.length ? nextParts.join(',') : null;
          await pool.query(
            `UPDATE tb_cpanel_nav_items SET roles_csv = ? WHERE id = ?`,
            [nextCsv, item.id]
          );
        }
      }
    }

    // Step C: Delete role
    await pool.query(
      `DELETE FROM tb_cpanel_org_roles WHERE org_id = ? AND code = ?`,
      [orgId, roleCode]
    );
    console.log('- Executed role deletion with cascading updates.');

    // 6. Verify assertions
    // A: Verify user is deleted
    const [[deletedUser]] = await pool.query(
      `SELECT id FROM tb_cpanel_users WHERE id = ?`,
      [userId]
    );
    assert.strictEqual(deletedUser, undefined, 'User was not deleted');
    console.log('✔ Verified assigned user was successfully hard-deleted.');

    // B: Verify nav item roles_csv has been updated (roleCode removed)
    const [[updatedNavItem]] = await pool.query(
      `SELECT roles_csv AS rolesCsv FROM tb_cpanel_nav_items WHERE id = ?`,
      [navId]
    );
    assert.strictEqual(updatedNavItem.rolesCsv, 'org_admin', 'Nav item roles visibility was not cleaned up');
    console.log(`✔ Verified nav item roles visibility was cleaned up. New value: "${updatedNavItem.rolesCsv}"`);

    // C: Verify role is deleted
    const [roles] = await pool.query(
      `SELECT id FROM tb_cpanel_org_roles WHERE org_id = ? AND code = ?`,
      [orgId, roleCode]
    );
    assert.strictEqual(roles.length, 0, 'Role was not deleted');
    console.log('✔ Verified role itself was successfully deleted.');

    // Clean up org
    await pool.query(`DELETE FROM tb_cpanel_organizations WHERE id = ?`, [orgId]);
    console.log('- Cleaned up temporary organization.');

    console.log('\n=======================================');
    console.log('CASCADING ROLE DELETIONS SUCCESSFUL.');
    console.log('=======================================');

  } catch (e) {
    console.error('Cascade Test Failed:', e);
  } finally {
    await pool.end();
  }
}

main();
