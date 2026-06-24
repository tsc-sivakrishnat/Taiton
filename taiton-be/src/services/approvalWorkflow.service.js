import { pool } from '../config/db.js';

const CONTENT_TYPE_TO_RESOURCE = {
  product: 'products',
  seo: 'seo',
  ui_element: 'ui_elements',
};

export function contentTypeToResource(contentType) {
  const c = String(contentType ?? '').trim();
  return CONTENT_TYPE_TO_RESOURCE[c] ?? c;
}

/** Active org rule: maker role → checker role for a resource. */
export async function findActiveApprovalRule({ organizationId, resource, makerRole }) {
  const res = String(resource ?? '').trim();
  const maker = String(makerRole ?? '').trim();
  if (!organizationId || !res || !maker) return null;
  try {
    const [rows] = await pool.query(
      `SELECT id, checker_role AS checkerRole
       FROM tb_cpanel_approval_rules
       WHERE org_id = :organizationId AND resource = :resource
         AND maker_role = :makerRole AND is_active = 1
       ORDER BY id DESC LIMIT 1`,
      { organizationId, resource: res, makerRole: maker },
    );
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getUserRole(userId) {
  const [rows] = await pool.query(`SELECT role FROM tb_cpanel_users WHERE id = :id LIMIT 1`, {
    id: userId,
  });
  return rows?.[0]?.role ?? null;
}

/** Who may approve/reject a pending item for this org. */
export async function canApproveContentItem({
  organizationId,
  contentType,
  createdByUserId,
  callerRole,
  publishPermissionCode,
  getPermissionGrant,
}) {
  const role = String(callerRole ?? '').trim();
  if (!role) return false;

  const makerRole = await getUserRole(createdByUserId);
  const resource = contentTypeToResource(contentType);
  const rule = await findActiveApprovalRule({ organizationId, resource, makerRole });
  if (rule) {
    return rule.checkerRole === role;
  }

  if (!publishPermissionCode) return false;

  const publishGrant = await getPermissionGrant(role, publishPermissionCode, organizationId);
  return publishGrant.allowed && publishGrant.accessLevel === 'direct';
}
