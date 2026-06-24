import { pool } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import { normalizeRolesCsv } from '../utils/roleCsv.js';
import { rethrowAsClientError } from '../utils/mapDbError.js';
import { writeAudit } from './audit.service.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { assertPermission } from './permissions.service.js';

function normalizeCode(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

export async function listOrganizations() {
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active AS isActive, created_at AS createdAt
     FROM tb_cpanel_organizations ORDER BY name`,
  );
  return rows;
}

export async function createOrganization({ code, name, callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_ORGS);
  const orgCode = normalizeCode(code);
  const orgName = String(name ?? '').trim();
  if (!orgCode || !orgName) {
    const err = new Error('Organization code and name are required');
    err.status = 400;
    throw err;
  }
  const [existing] = await pool.query(
    `SELECT id FROM tb_cpanel_organizations WHERE code = :code LIMIT 1`,
    { code: orgCode },
  );
  if (existing?.length) {
    const err = new Error('Organization code already exists');
    err.status = 409;
    throw err;
  }
  const [result] = await pool.query(
    `INSERT INTO tb_cpanel_organizations (code, name, is_active) VALUES (:code, :name, 1)`,
    { code: orgCode, name: orgName },
  );
  const orgId = result.insertId;
  await seedDefaultNavForOrg(orgId);
  await seedDefaultOrgRoles(orgId);
  await writeAudit({
    organizationId: null,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'organization.create',
    resourceType: 'organization',
    resourceId: orgId,
    detail: { code: orgCode, name: orgName },
  });
  return { id: orgId, code: orgCode, name: orgName, isActive: true };
}

async function seedDefaultOrgRoles(orgId) {
  const defaults = [
    ['org_admin', 'Organization Admin', 1],
    ['super_employee', 'Super Employee', 2],
    ['employee', 'Employee', 3],
    ['employee_2', 'Employee 2', 4],
    ['member', 'Member', 5],
  ];
  for (const [code, name, priority] of defaults) {
    try {
      await pool.query(
        `INSERT INTO tb_cpanel_org_roles (org_id, code, name, priority) VALUES (:orgId, :code, :name, :priority)`,
        { orgId, code, name, priority },
      );
    } catch {
      /* table may not exist yet */
    }
  }
}

async function seedDefaultNavForOrg(orgId) {
  /** Seed all 18 navigation items for all platform and tenant roles to enable dynamic sidebars. */
  const items = [
    // Dashboard & Profile visible to all roles
    ['Dashboard', 'LayoutDashboard', '/app/dashboard', 'top', 1, 'sys_admin,super_admin,org_admin,super_employee,employee,employee_2,member'],
    ['Profile', 'User', '/app/profile', 'bottom', 100, 'sys_admin,super_admin,org_admin,super_employee,employee,employee_2,member'],
    
    // Platform Operator routes
    ['Onboarding Organization', 'Building2', '/app/onboarding/organizations', 'top', 2, 'sys_admin,super_admin'],
    ['Onboarding Roles', 'Shield', '/app/onboarding/roles', 'top', 3, 'sys_admin,super_admin'],
    ['Onboarding Members', 'UserPlus', '/app/onboarding/members', 'top', 4, 'sys_admin,super_admin'],
    ['Onboarding Nav Items', 'Menu', '/app/onboarding/nav', 'top', 5, 'sys_admin,super_admin'],
    
    // Org Admin routes
    ['Onboarding User to Roles', 'Users', '/app/org/users', 'top', 6, 'org_admin'],
    ['Onboarding Rules to Roles', 'GitBranch', '/app/org/approval-rules', 'top', 7, 'org_admin'],
    ['Role Specific Audit Tracking', 'ScrollText', '/app/org/audit', 'top', 8, 'org_admin'],
    ['Approvals', 'CheckCircle', '/app/org/approvals', 'top', 9, 'org_admin'],
    ['Settings', 'Settings', '/app/settings', 'bottom', 101, 'org_admin'],

    // Super Employee / Employee routes
    ['Onboarding Products', 'Package', '/app/products', 'top', 10, 'super_employee,employee,employee_2'],
    ['SEO Management', 'Search', '/app/seo', 'top', 11, 'super_employee'],
    ['UI Elements', 'Layout', '/app/ui-elements', 'top', 12, 'super_employee'],
    ['Careers', 'Briefcase', '/app/careers', 'top', 13, 'super_employee'],
    ['Catalogs', 'Layout', '/app/catalogs', 'top', 14, 'super_employee'],
    ['Events & achievements', 'Briefcase', '/app/events', 'top', 15, 'super_employee'],
    ['Web Responses', 'Inbox', '/app/web-responses', 'top', 16, 'org_admin,super_employee,employee,employee_2,member'],
  ];
  for (const [label, icon, route, position, sortOrder, rolesCsv] of items) {
    await pool.query(
      `INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, position, sort_order, is_active, roles_csv)
       VALUES (:orgId, :label, :icon, :route, :position, :sortOrder, 1, :rolesCsv)`,
      { orgId, label, icon, route, position, sortOrder, rolesCsv },
    );
  }
}

/** Platform operator roles (not stored in tb_cpanel_org_roles). */
const PLATFORM_ROLE_CATALOGUE = [
  { code: 'sys_admin', name: 'System Admin', description: 'Platform operator', priority: 0, scope: 'platform' },
  { code: 'super_admin', name: 'Super Admin', description: 'Platform operator', priority: 1, scope: 'platform' },
];

export async function listRolesCatalogue() {
  return PLATFORM_ROLE_CATALOGUE;
}

export async function listPriorityOneRoles({ organizationId }) {
  if (!organizationId) return [];
  const orgRoles = await listOrgRoles({ organizationId });
  const p1 = orgRoles.filter((r) => Number(r.priority) === 1);
  return p1.length ? p1 : orgRoles.slice(0, 1);
}

export async function upsertRole({ callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_ROLES);
  const err = new Error('Global role catalogue was removed; manage roles per organization.');
  err.status = 410;
  throw err;
}

export async function listNavItems({ organizationId }) {
  const [rows] = await pool.query(
    `SELECT id, org_id AS orgId, label, icon, route, position, sort_order AS sortOrder,
            is_active AS isActive, roles_csv AS rolesCsv
     FROM tb_cpanel_nav_items WHERE org_id = :organizationId ORDER BY sort_order, id`,
    { organizationId },
  );
  return rows;
}

export async function upsertNavItem({
  organizationId,
  id,
  label,
  icon,
  route,
  position,
  sortOrder,
  rolesCsv,
  isActive,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_NAV);
  const [existing] = await pool.query(
    `SELECT id FROM tb_cpanel_nav_items
     WHERE org_id = :organizationId AND TRIM(LOWER(label)) = TRIM(LOWER(:label))
       ${id ? 'AND id <> :id' : ''} LIMIT 1`,
    { organizationId, label, id: id ?? null },
  );
  if (existing?.length) {
    const err = new Error('A navigation item with this menu label already exists.');
    err.status = 409;
    throw err;
  }
  const rolesCsvNorm = normalizeRolesCsv(rolesCsv);
  const routeNorm = String(route ?? '').trim();
  if (id) {
    await pool.query(
      `UPDATE tb_cpanel_nav_items SET label = :label, icon = :icon, route = :route,
        position = :position, sort_order = :sortOrder, roles_csv = :rolesCsv, is_active = :isActive
       WHERE id = :id AND org_id = :organizationId`,
      {
        id,
        organizationId,
        label,
        icon: icon || 'Circle',
        route: routeNorm,
        position: position === 'bottom' ? 'bottom' : 'top',
        sortOrder: Number(sortOrder) || 0,
        rolesCsv: rolesCsvNorm,
        isActive: isActive === false ? 0 : 1,
      },
    );
    return { id };
  }
  const [result] = await pool.query(
    `INSERT INTO tb_cpanel_nav_items (org_id, label, icon, route, position, sort_order, is_active, roles_csv)
     VALUES (:organizationId, :label, :icon, :route, :position, :sortOrder, 1, :rolesCsv)`,
    {
      organizationId,
      label,
      icon: icon || 'Circle',
      route: routeNorm,
      position: position === 'bottom' ? 'bottom' : 'top',
      sortOrder: Number(sortOrder) || 0,
      rolesCsv: rolesCsvNorm,
    },
  );
  return { id: result.insertId };
}

export async function deleteNavItem({ organizationId, navId, callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_NAV);
  const [[item]] = await pool.query(
    `SELECT id, label, route, roles_csv AS rolesCsv, position, sort_order AS sortOrder
     FROM tb_cpanel_nav_items WHERE id = :navId AND org_id = :organizationId LIMIT 1`,
    { navId, organizationId },
  );
  const [result] = await pool.query(
    `DELETE FROM tb_cpanel_nav_items WHERE id = :navId AND org_id = :organizationId`,
    { navId, organizationId },
  );
  if (!result.affectedRows) {
    const err = new Error('Nav item not found');
    err.status = 404;
    throw err;
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'nav.delete',
    resourceType: 'nav_item',
    resourceId: navId,
    detail: item
      ? {
          label: item.label,
          route: item.route,
          rolesCsv: item.rolesCsv,
          position: item.position,
          sortOrder: item.sortOrder,
        }
      : { navId },
  });
  return { ok: true };
}

export async function listNavIcons() {
  try {
    const [rows] = await pool.query(
      `SELECT code, label, sort_order AS sortOrder FROM tb_cpanel_nav_icons ORDER BY sort_order, label`,
    );
    return rows;
  } catch {
    return [];
  }
}

export async function listOrgRoles({ organizationId }) {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, description, priority, created_at AS createdAt
       FROM tb_cpanel_org_roles WHERE org_id = :organizationId ORDER BY priority, name`,
      { organizationId },
    );
    return rows;
  } catch (e) {
    if (!String(e?.message ?? '').includes("doesn't exist")) throw e;
    return [];
  }
}

export async function createOrgRole({
  organizationId,
  code,
  name,
  description,
  priority,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_ROLES);
  const roleCode = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  const roleName = String(name ?? '').trim();
  if (!roleCode || !roleName) {
    const err = new Error('Role code and name are required');
    err.status = 400;
    throw err;
  }
  if (['sys_admin', 'super_admin'].includes(roleCode)) {
    const err = new Error('Cannot create platform roles on an organization');
    err.status = 403;
    throw err;
  }
  const [existingPriority] = await pool.query(
    `SELECT id FROM tb_cpanel_org_roles WHERE org_id = :organizationId AND priority = :priority LIMIT 1`,
    { organizationId, priority: Number(priority) },
  );
  if (existingPriority?.length) {
    const err = new Error('A role with this rank already exists in this organization');
    err.status = 409;
    throw err;
  }
  try {
    await pool.query(
      `INSERT INTO tb_cpanel_org_roles (org_id, code, name, description, priority)
       VALUES (:organizationId, :code, :name, :description, :priority)`,
      {
        organizationId,
        code: roleCode,
        name: roleName,
        description: description ?? null,
        priority: Number(priority) || 100,
      },
    );
  } catch (e) {
    if (String(e?.message ?? '').includes('Duplicate')) {
      const err = new Error('Role code already exists for this organization');
      err.status = 409;
      throw err;
    }
    throw e;
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'org_role.create',
    resourceType: 'org_role',
    resourceId: roleCode,
  });
  return { code: roleCode, name: roleName };
}

export async function deleteOrgRole({ organizationId, roleCode, callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_ROLES);
  const code = String(roleCode ?? '').trim();
  const [[roleRow]] = await pool.query(
    `SELECT code, name, description, priority FROM tb_cpanel_org_roles
     WHERE org_id = :organizationId AND code = :code LIMIT 1`,
    { organizationId, code },
  );
  const [[org]] = await pool.query(
    `SELECT code FROM tb_cpanel_organizations WHERE id = :organizationId`,
    { organizationId },
  );

  // Cascade delete users assigned to this role
  if (org?.code) {
    await pool.query(
      `DELETE FROM tb_cpanel_users WHERE org_code = :orgCode AND role = :code`,
      { orgCode: org.code, code },
    );
  }

  // Remove role visibility from navigation items
  const [navItems] = await pool.query(
    `SELECT id, roles_csv AS rolesCsv FROM tb_cpanel_nav_items WHERE org_id = :organizationId`,
    { organizationId },
  );
  for (const item of navItems) {
    if (item.rolesCsv) {
      const parts = item.rolesCsv.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.includes(code)) {
        const nextParts = parts.filter((p) => p !== code);
        const nextCsv = nextParts.length ? nextParts.join(',') : null;
        await pool.query(
          `UPDATE tb_cpanel_nav_items SET roles_csv = :nextCsv WHERE id = :id`,
          { nextCsv, id: item.id },
        );
      }
    }
  }

  const [result] = await pool.query(
    `DELETE FROM tb_cpanel_org_roles WHERE org_id = :organizationId AND code = :code`,
    { organizationId, code },
  );
  if (!result.affectedRows) {
    const err = new Error('Role not found for this organization');
    err.status = 404;
    throw err;
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'org_role.delete',
    resourceType: 'org_role',
    resourceId: code,
    detail: roleRow
      ? {
          code: roleRow.code,
          name: roleRow.name,
          description: roleRow.description,
          priority: roleRow.priority,
        }
      : { code },
  });
  return { ok: true };
}

/** Roles assignable to users in an organization (excludes platform operators). */
export async function listOrganizationAssignableRoles(organizationId) {
  const orgRoles = await listOrgRoles({ organizationId });
  return orgRoles.map((r) => ({
    code: r.code,
    name: r.name,
    description: r.description,
    priority: r.priority,
  }));
}

/** Platform admin only: create org_admin user for an organization */
export async function createOrgAdminUser({
  organizationId,
  email,
  fullName,
  mobile,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_USERS_ORG_ADMIN);
  const role = 'org_admin';
  const emailNorm = String(email ?? '').trim().toLowerCase();
  const name = String(fullName ?? '').trim();
  const mobileDigits = String(mobile ?? '').replace(/\D/g, '');
  if (!emailNorm || !name || mobileDigits.length !== 10) {
    const err = new Error('Email, full name, and mobile (exactly 10 digits) are required');
    err.status = 400;
    throw err;
  }
  const [[org]] = await pool.query(
    `SELECT code FROM tb_cpanel_organizations WHERE id = :organizationId AND is_active = 1`,
    { organizationId },
  );
  if (!org?.code) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }
  const [existing] = await pool.query(
    `SELECT u.id FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.email = :email LIMIT 1`,
    { organizationId, email: emailNorm },
  );
  if (existing?.length) {
    const err = new Error('This email is already in this organization.');
    err.status = 409;
    throw err;
  }
  const [existingMobile] = await pool.query(
    `SELECT u.id FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.mobile = :mobile LIMIT 1`,
    { organizationId, mobile: mobileDigits },
  );
  if (existingMobile?.length) {
    const err = new Error('This mobile number is already registered in this organization.');
    err.status = 409;
    throw err;
  }
  const passwordHash = await hashPassword(mobileDigits);
  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO tb_cpanel_users (org_code, email, password_hash, full_name, mobile, role, is_active)
       VALUES (:orgCode, :email, :passwordHash, :fullName, :mobile, :role, 1)`,
      {
        orgCode: org.code,
        email: emailNorm,
        passwordHash,
        fullName: name,
        mobile: mobileDigits,
        role,
      },
    );
  } catch (e) {
    rethrowAsClientError(e);
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'user.create_org_admin',
    resourceType: 'user',
    resourceId: result.insertId,
    detail: { email: emailNorm, role },
  });
  return {
    id: result.insertId,
    email: emailNorm,
    fullName: name,
    role,
    orgCode: org.code,
  };
}

export async function listOrgAdmins({ organizationId, callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_USERS_ORG_ADMIN);
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.full_name AS fullName, u.mobile, u.is_active AS isActive
     FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.role = 'org_admin' AND u.is_active = 1
     ORDER BY u.id DESC`,
    { organizationId },
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    mobile: r.mobile ?? '',
    isActive: Number(r.isActive) === 1,
  }));
}

export async function updateOrgAdminUser({
  organizationId,
  userId,
  email,
  fullName,
  mobile,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_USERS_ORG_ADMIN);
  const emailNorm = String(email ?? '').trim().toLowerCase();
  const name = String(fullName ?? '').trim();
  const mobileDigits = String(mobile ?? '').replace(/\D/g, '');
  if (!emailNorm || !name || mobileDigits.length !== 10) {
    const err = new Error('Email, full name, and mobile (exactly 10 digits) are required');
    err.status = 400;
    throw err;
  }
  const [[user]] = await pool.query(
    `SELECT u.id, u.email FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.id = :userId AND u.role = 'org_admin' AND u.is_active = 1
     LIMIT 1`,
    { organizationId, userId },
  );
  if (!user?.id) {
    const err = new Error('Organization admin not found');
    err.status = 404;
    throw err;
  }
  const [dup] = await pool.query(
    `SELECT u.id FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.email = :email AND u.id <> :userId LIMIT 1`,
    { organizationId, email: emailNorm, userId },
  );
  if (dup?.length) {
    const err = new Error('This email is already in this organization.');
    err.status = 409;
    throw err;
  }
  const [dupMobile] = await pool.query(
    `SELECT u.id FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.mobile = :mobile AND u.id <> :userId LIMIT 1`,
    { organizationId, mobile: mobileDigits, userId },
  );
  if (dupMobile?.length) {
    const err = new Error('This mobile number is already registered in this organization.');
    err.status = 409;
    throw err;
  }
  const passwordHash = await hashPassword(mobileDigits);
  try {
    await pool.query(
      `UPDATE tb_cpanel_users
       SET email = :email, full_name = :fullName, mobile = :mobile, password_hash = :passwordHash
       WHERE id = :userId`,
      { userId, email: emailNorm, fullName: name, mobile: mobileDigits, passwordHash },
    );
  } catch (e) {
    rethrowAsClientError(e);
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'user.update_org_admin',
    resourceType: 'user',
    resourceId: userId,
    detail: { email: emailNorm },
  });
  return { id: userId, email: emailNorm, fullName: name, mobile: mobileDigits, role: 'org_admin' };
}

export async function deactivateOrgAdminUser({ organizationId, userId, callerAuth }) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_USERS_ORG_ADMIN);
  const [[user]] = await pool.query(
    `SELECT u.id, u.email, u.full_name AS fullName, u.mobile, u.role, u.is_active AS isActive
     FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.id = :userId AND u.role = 'org_admin'
     LIMIT 1`,
    { organizationId, userId },
  );
  if (!user?.id) {
    const err = new Error('Organization admin not found');
    err.status = 404;
    throw err;
  }
  await pool.query(`DELETE FROM tb_cpanel_users WHERE id = :userId`, { userId });
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'user.deactivate_org_admin',
    resourceType: 'user',
    resourceId: userId,
    detail: {
      email: user.email,
      fullName: user.fullName,
      mobile: user.mobile,
      role: user.role,
      wasActive: Number(user.isActive) === 1,
    },
  });
  return { ok: true };
}

/** Create a user in an org with a specific role (platform admin; priority-1 / super_admin, etc.). */
export async function createOrganizationMember({
  organizationId,
  email,
  fullName,
  mobile,
  roleCode,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.PLATFORM_USERS_ORG_ADMIN);
  const role = String(roleCode ?? '').trim();
  if (!role || role === 'org_admin') {
    const err = new Error('Use org_admin endpoint for org_admin role');
    err.status = 400;
    throw err;
  }
  if (role === 'sys_admin') {
    const err = new Error('Cannot create sys_admin via this endpoint');
    err.status = 403;
    throw err;
  }
  const emailNorm = String(email ?? '').trim().toLowerCase();
  const name = String(fullName ?? '').trim();
  const mobileDigits = String(mobile ?? '').replace(/\D/g, '');
  if (!emailNorm || !name || mobileDigits.length !== 10) {
    const err = new Error('Email, full name, and mobile (exactly 10 digits) are required');
    err.status = 400;
    throw err;
  }
  const orgRoles = await listOrgRoles({ organizationId });
  const allowed = orgRoles.length
    ? orgRoles.map((r) => r.code)
    : (await listOrganizationAssignableRoles(organizationId)).map((r) => r.code);
  if (!allowed.includes(role)) {
    const err = new Error('Role is not defined for this organization');
    err.status = 400;
    throw err;
  }
  const [[org]] = await pool.query(
    `SELECT code FROM tb_cpanel_organizations WHERE id = :organizationId AND is_active = 1`,
    { organizationId },
  );
  if (!org?.code) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }
  const [existing] = await pool.query(
    `SELECT u.id FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.email = :email LIMIT 1`,
    { organizationId, email: emailNorm },
  );
  if (existing?.length) {
    const err = new Error('This email is already in this organization.');
    err.status = 409;
    throw err;
  }
  const [existingMobile] = await pool.query(
    `SELECT u.id FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.mobile = :mobile LIMIT 1`,
    { organizationId, mobile: mobileDigits },
  );
  if (existingMobile?.length) {
    const err = new Error('This mobile number is already registered in this organization.');
    err.status = 409;
    throw err;
  }
  const passwordHash = await hashPassword(mobileDigits);
  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO tb_cpanel_users (org_code, email, password_hash, full_name, mobile, role, is_active)
       VALUES (:orgCode, :email, :passwordHash, :fullName, :mobile, :role, 1)`,
      {
        orgCode: org.code,
        email: emailNorm,
        passwordHash,
        fullName: name,
        mobile: mobileDigits,
        role,
      },
    );
  } catch (e) {
    rethrowAsClientError(e);
  }
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'user.create_member',
    resourceType: 'user',
    resourceId: result.insertId,
    detail: { email: emailNorm, role },
  });
  return {
    id: result.insertId,
    email: emailNorm,
    fullName: name,
    role,
    orgCode: org.code,
  };
}
