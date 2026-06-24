import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';

export async function getSummary({ organizationId, userId, roleCode }) {
  const [rows] = await pool.query(queries.dashboardSummary, {
    organizationId,
    userId,
    roleCode: String(roleCode ?? ''),
  });
  const row = rows[0] ?? {};
  return {
    unreadNotifications: Number(row.unread_notifications ?? 0),
    activeMembers: Number(row.active_members ?? 0),
  };
}
