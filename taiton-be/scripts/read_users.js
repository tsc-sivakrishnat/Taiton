import mysql from 'mysql2/promise';

async function main() {
  const pool = mysql.createPool({
    host: '193.203.184.29',
    port: 3306,
    user: 'u418448115_taiton',
    password: 'SivaKrishna$00',
    database: 'u418448115_enterprise_adm',
  });

  try {
    const [rows] = await pool.query('SELECT id, email, role, org_code, is_active FROM tb_cpanel_users');
    console.log('--- tb_cpanel_users ---');
    console.log(rows);
  } catch (e) {
    console.error('Database query failed:', e);
  } finally {
    await pool.end();
  }
}

main();
