import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const SEVERITIES = new Set(['info', 'success', 'warning', 'error']);

export async function createRoleNotification({
  organizationId,
  rolesCsv,
  userId = null,
  title,
  body,
  severity = 'info',
}) {
  const t = String(title ?? '').trim();
  if (!organizationId || !t) return null;
  const sev = SEVERITIES.has(severity) ? severity : 'info';
  const [result] = await pool.query(
    `INSERT INTO tb_csd_notifications (org_id, user_id, roles_csv, title, body, severity)
     VALUES (:organizationId, :userId, :rolesCsv, :title, :body, :severity)`,
    {
      organizationId,
      userId: userId ?? null,
      rolesCsv: rolesCsv ? String(rolesCsv).trim() : null,
      title: t,
      body: body?.trim() || null,
      severity: sev,
    },
  );
  return result.insertId;
}

export async function listForUser({
  organizationId,
  userId,
  roleCode,
  limit = DEFAULT_LIMIT,
  offset = 0,
}) {
  const lim = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  const off = Math.max(0, Number(offset) || 0);
  const [rows] = await pool.query(queries.notificationsList, {
    organizationId,
    userId,
    roleCode: String(roleCode ?? ''),
    limit: lim,
    offset: off,
  });
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    severity: n.severity,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function markRead({ id, organizationId, userId, roleCode }) {
  const [result] = await pool.query(queries.notificationMarkRead, {
    id,
    organizationId,
    userId,
    roleCode: String(roleCode ?? ''),
  });
  return result.affectedRows > 0;
}

export async function markAllRead({ organizationId, userId, roleCode }) {
  const [result] = await pool.query(queries.notificationsMarkAllRead, {
    organizationId,
    userId,
    roleCode: String(roleCode ?? ''),
  });
  return Number(result.affectedRows ?? 0);
}
