import { pool } from './src/config/db.js';

async function test() {
  try {
    const [rows] = await pool.query('SHOW TABLES;');
    console.log('Tables:');
    console.log(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

test();
