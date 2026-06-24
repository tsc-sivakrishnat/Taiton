import { pool } from '../config/db.js';
import { assertPermission, clearGrantCache } from './permissions.service.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { writeAudit } from './audit.service.js';

/** Roles for dropdowns (approval rules, etc.) — organization catalogue only. */
export async function listOrgRoleOptions({ organizationId }) {
  let rows = [];
  try {
    const [orgRoles] = await pool.query(
      `SELECT code, name FROM tb_cpanel_org_roles WHERE org_id = :organizationId ORDER BY name`,
      { organizationId },
    );
    rows = orgRoles ?? [];
  } catch {
    rows = [];
  }
  const [inOrg] = await pool.query(
    `SELECT DISTINCT u.role AS code
     FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.role NOT IN ('sys_admin', 'super_admin')`,
    { organizationId },
  );
  const codes = new Set(rows.map((r) => r.code));
  const merged = [...rows];
  for (const row of inOrg) {
    if (row.code && !codes.has(row.code)) {
      merged.push({ code: row.code, name: row.code });
      codes.add(row.code);
    }
  }
  return merged.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function listApprovalRules({ organizationId, callerRole }) {
  await assertPermission(callerRole, PERMISSIONS.ORG_APPROVAL_RULES);
  const [rows] = await pool.query(
    `SELECT id, resource, maker_role AS makerRole, checker_role AS checkerRole,
            is_active AS isActive, created_at AS createdAt
     FROM tb_cpanel_approval_rules WHERE org_id = :organizationId ORDER BY resource, id`,
    { organizationId },
  );
  return rows;
}

export async function upsertApprovalRule({
  organizationId,
  id,
  resource,
  makerRole,
  checkerRole,
  isActive,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.ORG_APPROVAL_RULES);
  if (id) {
    await pool.query(
      `UPDATE tb_cpanel_approval_rules SET resource = :resource, maker_role = :makerRole,
        checker_role = :checkerRole, is_active = :isActive
       WHERE id = :id AND org_id = :organizationId`,
      {
        id,
        organizationId,
        resource,
        makerRole,
        checkerRole,
        isActive: isActive === false ? 0 : 1,
      },
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO tb_cpanel_approval_rules (org_id, resource, maker_role, checker_role, is_active)
       VALUES (:organizationId, :resource, :makerRole, :checkerRole, 1)`,
      { organizationId, resource, makerRole, checkerRole },
    );
    id = result.insertId;
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'approval_rule.upsert',
    resourceType: 'approval_rule',
    resourceId: id,
    detail: { resource, makerRole, checkerRole },
  });
  clearGrantCache();
  return { id };
}

export async function deleteApprovalRule({ organizationId, ruleId, callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.ORG_APPROVAL_RULES);
  const id = Number(ruleId);
  if (!Number.isFinite(id)) {
    const err = new Error('Invalid rule id');
    err.status = 400;
    throw err;
  }
  const [[rule]] = await pool.query(
    `SELECT id, resource, maker_role AS makerRole, checker_role AS checkerRole, is_active AS isActive
     FROM tb_cpanel_approval_rules WHERE id = :id AND org_id = :organizationId LIMIT 1`,
    { id, organizationId },
  );
  const [result] = await pool.query(
    `DELETE FROM tb_cpanel_approval_rules WHERE id = :id AND org_id = :organizationId LIMIT 1`,
    { id, organizationId },
  );
  if (!result.affectedRows) {
    const err = new Error('Approval rule not found');
    err.status = 404;
    throw err;
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'approval_rule.delete',
    resourceType: 'approval_rule',
    resourceId: id,
    detail: rule
      ? {
          resource: rule.resource,
          makerRole: rule.makerRole,
          checkerRole: rule.checkerRole,
          isActive: rule.isActive,
        }
      : { id },
  });
  clearGrantCache();
  return { ok: true };
}

export async function listOrgConfigKeys({ organizationId, callerRole }) {
  await assertPermission(callerRole, PERMISSIONS.ORG_CONFIG);
  const [rows] = await pool.query(
    `SELECT config_key AS configKey, config_value AS configValue, updated_at AS updatedAt
     FROM tb_config_org_config WHERE org_id = :organizationId ORDER BY config_key`,
    { organizationId },
  );
  return rows;
}

export async function setOrgConfigKey({
  organizationId,
  configKey,
  configValue,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.ORG_CONFIG);
  await pool.query(
    `INSERT INTO tb_config_org_config (org_id, config_key, config_value)
     VALUES (:organizationId, :configKey, :configValue)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP`,
    { organizationId, configKey, configValue: String(configValue ?? '') },
  );
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'org_config.set',
    resourceType: 'org_config',
    resourceId: configKey,
  });
  return { configKey, configValue };
}
