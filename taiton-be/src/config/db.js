import mysql from 'mysql2/promise';
import { env } from './env.js';

/**
 * Single shared pool — reuse across requests. Small default limit for shared hosting.
 */
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: env.db.queueLimit,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}
