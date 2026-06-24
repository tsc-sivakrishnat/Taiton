import { pool } from './src/config/db.js';

async function test() {
  try {
    const [rows] = await pool.query(
      `SELECT rp.role_code, rp.permission_code, rp.access_level
       FROM tb_cpanel_role_permissions rp`
    );
    console.log('All Role Permissions:');
    console.log(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

test();
