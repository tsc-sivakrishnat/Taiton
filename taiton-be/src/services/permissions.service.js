import { pool } from '../config/db.js';
import { PLATFORM_ROLES } from '../constants/permissions.js';

const grantCache = new Map();

function cacheKey(roleCode, permissionCode, organizationId = null) {
  return `${roleCode}::${permissionCode}::${organizationId ?? ''}`;
}

export function isPlatformRole(roleCode) {
  return PLATFORM_ROLES.has(String(roleCode ?? '').trim());
}

const PLATFORM_ROLE_PRIORITY = {
  sys_admin: 0,
  super_admin: 1,
  org_admin: 10,
};

/** org_admin inherits all organization-scoped permissions at direct level */
export async function getRolePriority(roleCode, organizationId = null) {
  const code = String(roleCode ?? '').trim();
  if (PLATFORM_ROLE_PRIORITY[code] != null) {
    return PLATFORM_ROLE_PRIORITY[code];
  }
  if (organizationId) {
    const [rows] = await pool.query(
      `SELECT priority FROM tb_cpanel_org_roles
       WHERE org_id = :organizationId AND code = :code LIMIT 1`,
      { organizationId, code },
    );
    if (rows?.length) return Number(rows[0].priority ?? 999);
  }
  return 999;
}

export async function getPermissionGrant(roleCode, permissionCode, organizationId = null) {
  const role = String(roleCode ?? '').trim();
  const perm = String(permissionCode ?? '').trim();
  if (!role || !perm) return { allowed: false, accessLevel: 'deny' };

  if (role === 'org_admin') {
    if (perm.startsWith('platform.')) {
      return { allowed: false, accessLevel: 'deny', approverRoleCode: null };
    }
    return { allowed: true, accessLevel: 'direct', approverRoleCode: null };
  }

  if (isPlatformRole(role) && perm.startsWith('platform.')) {
    return { allowed: true, accessLevel: 'direct', approverRoleCode: null };
  }

  if (organizationId) {
    const PERMISSION_TO_RESOURCE = {
      'content.products.read': 'products',
      'content.products.write': 'products',
      'content.products.publish': 'products',
      'content.seo.write': 'seo',
      'content.seo.publish': 'seo',
      'content.ui.write': 'ui_elements',
      'content.ui.publish': 'ui_elements',
      'content.blogs.read': 'blogs',
      'content.blogs.write': 'blogs',
      'content.blogs.publish': 'blogs',
    };
    const resName = PERMISSION_TO_RESOURCE[perm];
    if (resName) {
      const [rules] = await pool.query(
        `SELECT id, maker_role AS makerRole, checker_role AS checkerRole
         FROM tb_cpanel_approval_rules
         WHERE org_id = :organizationId AND resource = :resource AND is_active = 1
           AND (maker_role = :role OR checker_role = :role)
         ORDER BY id DESC LIMIT 1`,
        { organizationId, resource: resName, role }
      );
      if (rules?.length) {
        const rule = rules[0];
        return {
          allowed: true,
          accessLevel: rule.makerRole === role ? 'approval_required' : 'direct',
          approverRoleCode: rule.makerRole === role ? rule.checkerRole : null,
        };
      }
    }
  }

  const key = cacheKey(role, perm, organizationId);
  if (grantCache.has(key)) return grantCache.get(key);

  const [rows] = await pool.query(
    `SELECT access_level AS accessLevel, approver_role_code AS approverRoleCode
     FROM tb_cpanel_role_permissions
     WHERE role_code = :role AND permission_code = :permission
     LIMIT 1`,
    { role, permission: perm },
  );
  const row = rows?.[0];
  let grant;
  if (!row) {
    grant = { allowed: false, accessLevel: 'deny', approverRoleCode: null };
  } else if (row.accessLevel === 'deny') {
    grant = { allowed: false, accessLevel: 'deny', approverRoleCode: null };
  } else {
    grant = {
      allowed: true,
      accessLevel: row.accessLevel,
      approverRoleCode: row.approverRoleCode ?? null,
    };
  }
  grantCache.set(key, grant);
  return grant;
}

export async function assertPermission(roleCode, permissionCode, organizationId = null) {
  const grant = await getPermissionGrant(roleCode, permissionCode, organizationId);
  if (!grant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }
  return grant;
}

export async function listPermissionsForRole(roleCode) {
  const [rows] = await pool.query(
    `SELECT p.code, p.resource, p.action, p.description,
            rp.access_level AS accessLevel, rp.approver_role_code AS approverRoleCode
     FROM tb_cpanel_role_permissions rp
     INNER JOIN tb_cpanel_permissions p ON p.code = rp.permission_code
     WHERE rp.role_code = :role
     ORDER BY p.resource, p.action`,
    { role: roleCode },
  );
  return rows;
}

export async function listMyPermissions(roleCode, organizationId = null) {
  let list = [];
  if (roleCode === 'org_admin') {
    const [rows] = await pool.query(
      `SELECT code, resource, action, description FROM tb_cpanel_permissions
       WHERE code NOT LIKE 'platform.%' ORDER BY resource, action`,
    );
    list = rows.map((p) => ({
      ...p,
      accessLevel: 'direct',
      approverRoleCode: null,
    }));
  } else {
    list = await listPermissionsForRole(roleCode);
  }

  if (organizationId) {
    const [activeRules] = await pool.query(
      `SELECT resource, maker_role AS makerRole, checker_role AS checkerRole
       FROM tb_cpanel_approval_rules
       WHERE org_id = :organizationId AND is_active = 1
         AND (maker_role = :role OR checker_role = :role)`,
      { organizationId, role: roleCode }
    );
    
    const resourceToPermissions = {
      products: ['content.products.read', 'content.products.write', 'content.products.publish'],
      seo: ['content.seo.write', 'content.seo.publish'],
      ui_elements: ['content.ui.write', 'content.ui.publish'],
      blogs: ['content.blogs.read', 'content.blogs.write', 'content.blogs.publish'],
    };

    const hasCodes = new Set(list.map((p) => p.code));

    for (const rule of activeRules) {
      const codes = resourceToPermissions[rule.resource] ?? [];
      for (const code of codes) {
        if (!hasCodes.has(code)) {
          const [permRows] = await pool.query(
            `SELECT code, resource, action, description FROM tb_cpanel_permissions
             WHERE code = :code LIMIT 1`,
            { code }
          );
          if (permRows?.length) {
            list.push({
              ...permRows[0],
              accessLevel: rule.makerRole === roleCode ? 'approval_required' : 'direct',
              approverRoleCode: rule.makerRole === roleCode ? rule.checkerRole : null,
            });
            hasCodes.add(code);
          }
        }
      }
    }
  }

  return list;
}

export function clearGrantCache() {
  grantCache.clear();
}
