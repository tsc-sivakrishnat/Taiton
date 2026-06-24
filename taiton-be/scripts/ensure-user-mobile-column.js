/**
 * Ensures tb_cpanel_users.mobile exists (required for Accounts / actor APIs).
 * Uses DB_* from cpanel-be/.env (same as the API).
 *
 *   npm run db:ensure-mobile
 */
import '../src/config/env.js';
import { pool } from '../src/config/db.js';

async function columnExists(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tb_cpanel_users'
       AND COLUMN_NAME = 'mobile'`,
  );
  return Number(rows[0]?.c) > 0;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    if (await columnExists(conn)) {
      console.log('tb_cpanel_users.mobile already exists — nothing to do.');
      return;
    }
    console.log('Adding column tb_cpanel_users.mobile …');
    await conn.query(
      'ALTER TABLE tb_cpanel_users ADD COLUMN mobile varchar(20) NULL DEFAULT NULL AFTER full_name',
    );
    await conn.query(`UPDATE tb_cpanel_users SET mobile = '0000000000' WHERE mobile IS NULL`);
    console.log('Done. Column added; existing rows use placeholder mobile until you edit them.');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
