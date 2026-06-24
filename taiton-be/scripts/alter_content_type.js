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
    console.log('Running ALTER TABLE query on tb_csd_content_items...');
    await pool.query(
      `ALTER TABLE tb_csd_content_items MODIFY COLUMN content_type VARCHAR(160) NOT NULL`
    );
    console.log('Successfully altered content_type column to VARCHAR(160) NOT NULL!');
  } catch (e) {
    console.error('Schema alteration failed:', e);
  } finally {
    await pool.end();
  }
}

main();
