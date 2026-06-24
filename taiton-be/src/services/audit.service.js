import { pool } from '../config/db.js';

export async function writeAudit({
  organizationId,
  actorUserId,
  actorRole,
  action,
  resourceType,
  resourceId = null,
  detail = null,
}) {
  const detailJson = detail != null ? JSON.stringify(detail) : null;
  await pool.query(
    `INSERT INTO tb_cpanel_audit_log
      (org_id, actor_user_id, actor_role, action, resource_type, resource_id, detail_json)
     VALUES (:organizationId, :actorUserId, :actorRole, :action, :resourceType, :resourceId, :detailJson)`,
    {
      organizationId: organizationId ?? null,
      actorUserId: actorUserId ?? null,
      actorRole: actorRole ?? null,
      action,
      resourceType,
      resourceId: resourceId != null ? String(resourceId) : null,
      detailJson,
    },
  );
}

export async function listAudit({ organizationId, limit = 50, offset = 0 }) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const [rows] = await pool.query(
    `SELECT id, org_id AS orgId, actor_user_id AS actorUserId, actor_role AS actorRole,
            action, resource_type AS resourceType, resource_id AS resourceId,
            detail_json AS detailJson, created_at AS createdAt
     FROM tb_cpanel_audit_log
     WHERE org_id = :organizationId
     ORDER BY id DESC
     LIMIT :limit OFFSET :offset`,
    { organizationId, limit: lim, offset: off },
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tb_cpanel_audit_log WHERE org_id = :organizationId`,
    { organizationId },
  );
  return {
    items: rows.map((r) => ({
      ...r,
      detail: r.detailJson ? JSON.parse(r.detailJson) : null,
    })),
    total: Number(countRow?.total ?? 0),
    limit: lim,
    offset: off,
  };
}
