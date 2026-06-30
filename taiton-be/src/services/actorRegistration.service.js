import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';
import { hashPassword } from '../utils/password.js';
import { isPlatformRole } from './permissions.service.js';
import { writeAudit } from './audit.service.js';
import { rethrowAsClientError } from '../utils/mapDbError.js';
import { findActiveApprovalRule } from './approvalWorkflow.service.js';
import { createRoleNotification } from './notifications.service.js';

function normalizeMobileDigits(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  const digits = s.replace(/\D/g, '');
  return digits;
}

export async function listRolesForRegistrar(_callerRole, organizationId) {
  let rows = [];
  if (organizationId) {
    try {
      const [orgRows] = await pool.query(
        `SELECT code, name, description FROM tb_cpanel_org_roles
         WHERE org_id = :organizationId AND code NOT IN ('sys_admin','super_admin','org_admin')
         ORDER BY priority, name`,
        { organizationId },
      );
      rows = orgRows ?? [];
    } catch {
      rows = [];
    }
  }
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    description: r.description ?? null,
  }));
}

export async function listActorsByOrg({ organizationId, limit, offset, search: searchRaw }) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 10));
  const off = Math.max(0, Number(offset) || 0);
  const search = String(searchRaw ?? '').trim();

  // 1. Fetch pending and rejected content items for '/app/org/users'
  const [ciRows] = await pool.query(
    `SELECT id, payload_json AS payloadJson, status
     FROM tb_csd_content_items
     WHERE org_id = :organizationId
       AND content_type = '/app/org/users'
       AND status IN ('pending_approval', 'rejected')
     ORDER BY id DESC`,
    { organizationId }
  );

  // 2. Fetch all org roles to map roleCode to roleName
  const [rolesRows] = await pool.query(
    `SELECT code, name FROM tb_cpanel_org_roles WHERE org_id = :organizationId`,
    { organizationId }
  );
  const roleMap = new Map((rolesRows ?? []).map((r) => [r.code, r.name]));

  const pendingActors = ciRows.map((r) => {
    let payload = {};
    try {
      payload = JSON.parse(r.payloadJson || '{}');
    } catch {}
    const roleCode = payload.role || '';
    const rName = roleMap.get(roleCode) || roleCode;
    return {
      id: `pending-${r.id}`,
      email: payload.email || '',
      fullName: payload.fullName || '',
      mobile: payload.mobile || '',
      roleCode,
      roleName: rName,
      isActive: false,
      status: r.status, // 'pending_approval' or 'rejected'
    };
  });

  const searchLower = search.toLowerCase();
  const filteredPending = searchLower
    ? pendingActors.filter(
        (a) =>
          a.email.toLowerCase().includes(searchLower) ||
          a.fullName.toLowerCase().includes(searchLower) ||
          a.mobile.includes(searchLower)
      )
    : pendingActors;

  // 3. Fetch registered users matching search
  const [userRows] = await pool.query(
    `SELECT
      u.id,
      u.email,
      u.full_name AS fullName,
      u.mobile,
      u.role AS roleCode,
      r.name AS roleName,
      u.is_active AS isActive
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    LEFT JOIN tb_cpanel_org_roles r ON r.org_id = o.id AND r.code = u.role
    WHERE o.id = :organizationId
      AND u.role NOT IN ('sys_admin', 'super_admin')
      AND (
        TRIM(IFNULL(:search, '')) = ''
        OR u.full_name LIKE CONCAT('%', :search, '%')
        OR u.email LIKE CONCAT('%', :search, '%')
        OR IFNULL(u.mobile, '') LIKE CONCAT('%', :search, '%')
      )
    ORDER BY u.id DESC`,
    { organizationId, search }
  );

  const registeredActors = userRows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    mobile: r.mobile ?? '',
    roleCode: r.roleCode,
    roleName: r.roleName ?? r.roleCode,
    isActive: Number(r.isActive) === 1,
    status: Number(r.isActive) === 1 ? 'active' : 'inactive',
  }));

  // Combine lists with pending/rejected items at the top
  const allActors = [...filteredPending, ...registeredActors];
  const total = allActors.length;
  const paginated = allActors.slice(off, off + lim);

  return {
    items: paginated,
    total,
    limit: lim,
    offset: off,
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** CSV for all rows matching search (same filter as list), max 10000 rows. */
export async function exportActorsCsv({ organizationId, search: searchRaw }) {
  const search = String(searchRaw ?? '').trim();

  // 1. Fetch pending and rejected content items for '/app/org/users'
  const [ciRows] = await pool.query(
    `SELECT id, payload_json AS payloadJson, status
     FROM tb_csd_content_items
     WHERE org_id = :organizationId
       AND content_type = '/app/org/users'
       AND status IN ('pending_approval', 'rejected')
     ORDER BY id DESC`,
    { organizationId }
  );

  // 2. Fetch all org roles to map roleCode to roleName
  const [rolesRows] = await pool.query(
    `SELECT code, name FROM tb_cpanel_org_roles WHERE org_id = :organizationId`,
    { organizationId }
  );
  const roleMap = new Map((rolesRows ?? []).map((r) => [r.code, r.name]));

  const pendingActors = ciRows.map((r) => {
    let payload = {};
    try {
      payload = JSON.parse(r.payloadJson || '{}');
    } catch {}
    const roleCode = payload.role || '';
    const rName = roleMap.get(roleCode) || roleCode;
    return {
      id: `pending-${r.id}`,
      email: payload.email || '',
      fullName: payload.fullName || '',
      mobile: payload.mobile || '',
      roleCode,
      roleName: rName,
      isActive: false,
      status: r.status === 'pending_approval' ? 'Awaiting approval' : 'Rejected',
    };
  });

  const searchLower = search.toLowerCase();
  const filteredPending = searchLower
    ? pendingActors.filter(
        (a) =>
          a.email.toLowerCase().includes(searchLower) ||
          a.fullName.toLowerCase().includes(searchLower) ||
          a.mobile.includes(searchLower)
      )
    : pendingActors;

  // 3. Fetch registered users matching search
  const [userRows] = await pool.query(
    `SELECT
      u.id,
      u.email,
      u.full_name AS fullName,
      u.mobile,
      u.role AS roleCode,
      r.name AS roleName,
      u.is_active AS isActive
    FROM tb_cpanel_users u
    INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
    LEFT JOIN tb_cpanel_org_roles r ON r.org_id = o.id AND r.code = u.role
    WHERE o.id = :organizationId
      AND u.role NOT IN ('sys_admin', 'super_admin')
      AND (
        TRIM(IFNULL(:search, '')) = ''
        OR u.full_name LIKE CONCAT('%', :search, '%')
        OR u.email LIKE CONCAT('%', :search, '%')
        OR IFNULL(u.mobile, '') LIKE CONCAT('%', :search, '%')
      )
    ORDER BY u.id DESC`,
    { organizationId, search }
  );

  const registeredActors = userRows.map((r) => ({
    id: String(r.id),
    email: r.email,
    fullName: r.fullName,
    mobile: r.mobile ?? '',
    roleCode: r.roleCode,
    roleName: r.roleName ?? r.roleCode,
    isActive: Number(r.isActive) === 1,
    status: Number(r.isActive) === 1 ? 'Active' : 'Inactive',
  }));

  const allActors = [...filteredPending, ...registeredActors];

  const header = ['S.No', 'User ID', 'Name', 'Email', 'Mobile', 'Role', 'Status'];
  const lines = [header.map(csvEscape).join(',')];
  allActors.forEach((r, i) => {
    lines.push(
      [
        i + 1,
        r.id,
        r.fullName ?? '',
        r.email ?? '',
        r.mobile ?? '',
        r.roleName,
        r.status,
      ]
        .map(csvEscape)
        .join(','),
    );
  });
  return lines.join('\r\n');
}

export async function registerActor({
  organizationId,
  callerRole,
  callerUserId,
  email,
  mobile,
  fullName,
  roleCode,
}) {
  const emailNorm = String(email ?? '').trim().toLowerCase();
  const name = String(fullName ?? '').trim();
  const role = String(roleCode ?? '').trim();
  const mobileDigits = normalizeMobileDigits(mobile);

  if (!emailNorm || !mobileDigits || !name || !role) {
    const err = new Error('Email, mobile number, full name, and role are required');
    err.status = 400;
    throw err;
  }
  if (mobileDigits.length !== 10) {
    const err = new Error('Mobile number must be exactly 10 digits');
    err.status = 400;
    throw err;
  }
  const platformRoles = new Set(['sys_admin', 'super_admin', 'org_admin']);
  if (platformRoles.has(role) && !isPlatformRole(callerRole)) {
    const err = new Error('Only a platform administrator may assign this role');
    err.status = 403;
    throw err;
  }
  if (role === 'org_admin' && !isPlatformRole(callerRole)) {
    const err = new Error('Only a platform administrator may create org_admin users');
    err.status = 403;
    throw err;
  }
  if (!isPlatformRole(callerRole) && (role === 'sys_admin' || role === 'super_admin')) {
    const err = new Error('Cannot assign platform roles');
    err.status = 403;
    throw err;
  }

  const globalOnlyRoles = new Set(['sys_admin', 'super_admin']);
  if (!globalOnlyRoles.has(role)) {
    const [roleRows] = await pool.query(queries.orgRoleExistsByCode, {
      organizationId,
      code: role,
    });
    if (!roleRows?.length) {
      const err = new Error('Role is not defined for this organization');
      err.status = 400;
      throw err;
    }
  }

  const [orgRows] = await pool.query(queries.orgCodeByOrganizationId, {
    organizationId,
  });
  const orgRow = orgRows?.[0];
  if (!orgRow?.code) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }

  const [existingRows] = await pool.query(queries.userEmailExistsInOrg, {
    organizationId,
    email: emailNorm,
  });
  if (existingRows?.length) {
    const err = new Error('This email is already in this organization.');
    err.status = 409;
    throw err;
  }

  const [existingMobileRows] = await pool.query(queries.userMobileExistsInOrg, {
    organizationId,
    mobile: mobileDigits,
  });
  if (existingMobileRows?.length) {
    const err = new Error('This mobile number is already registered in this organization.');
    err.status = 409;
    throw err;
  }

  // Intercept if there is an active approval rule for "/app/org/users"
  const isPlatformOperator = callerRole === 'sys_admin' || callerRole === 'super_admin';
  const orgRule = !isPlatformOperator ? await findActiveApprovalRule({
    organizationId,
    resource: '/app/org/users',
    makerRole: callerRole,
  }) : null;

  if (orgRule) {
    const title = `Register User: ${emailNorm}`;
    const summary = `Role: ${role}`;
    const payload = {
      email: emailNorm,
      mobile: mobileDigits,
      fullName: name,
      role: role
    };

    await pool.query(
      `INSERT INTO tb_csd_content_items
        (org_id, content_type, title, summary, payload_json, status, created_by, submitted_at)
       VALUES (:organizationId, '/app/org/users', :title, :summary, :payloadJson, 'pending_approval', :createdBy, UTC_TIMESTAMP())`,
      {
        organizationId,
        title,
        summary,
        payloadJson: JSON.stringify(payload),
        createdBy: callerUserId,
      }
    );

    // Create notification for checkerRole
    await createRoleNotification({
      organizationId,
      rolesCsv: orgRule.checkerRole,
      title: `User registration awaiting approval`,
      body: `"${emailNorm}" was submitted for registration. Submitted by * ${callerRole.replace('_', ' ')} and Approved by * ${orgRule.checkerRole.replace('_', ' ')}`,
      severity: 'warning',
    });

    return {
      status: 'pending_approval',
      message: `Submitted for approval. ${orgRule.checkerRole} will be notified.`,
    };
  }

  const passwordHash = await hashPassword(mobileDigits);
  let result;
  try {
    [result] = await pool.query(queries.userInsert, {
      orgCode: orgRow.code,
      email: emailNorm,
      passwordHash,
      fullName: name,
      mobile: mobileDigits,
      role,
    });
  } catch (e) {
    rethrowAsClientError(e);
  }

  await writeAudit({
    organizationId,
    actorUserId: callerUserId ?? null,
    actorRole: callerRole,
    action: 'user.register',
    resourceType: 'user',
    resourceId: result.insertId,
    detail: { email: emailNorm, role },
  });

  return {
    id: result.insertId,
    email: emailNorm,
    fullName: name,
    mobile: mobileDigits,
    role,
    orgCode: orgRow.code,
  };
}

export async function deleteActor({
  organizationId,
  userId,
  callerRole,
  callerUserId,
}) {
  const idStr = String(userId);
  if (idStr.startsWith('pending-')) {
    const contentId = Number(idStr.replace('pending-', ''));
    const [result] = await pool.query(
      `DELETE FROM tb_csd_content_items WHERE id = :id AND org_id = :organizationId AND content_type = '/app/org/users'`,
      { id: contentId, organizationId }
    );
    if (!result.affectedRows) {
      const err = new Error('Pending user registration not found');
      err.status = 404;
      throw err;
    }
    return { ok: true };
  }


  const id = Number(userId);
  if (!Number.isFinite(id)) {
    const err = new Error('Invalid user id');
    err.status = 400;
    throw err;
  }
  const [[user]] = await pool.query(
    `SELECT u.id, u.email, u.full_name AS fullName, u.mobile, u.role, u.is_active AS isActive
     FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE o.id = :organizationId AND u.id = :userId
       AND u.role NOT IN ('sys_admin', 'super_admin')
     LIMIT 1`,
    { organizationId, userId: id },
  );
  if (!user?.id) {
    const err = new Error('User not found in this organization');
    err.status = 404;
    throw err;
  }
  if (user.role === 'org_admin' && !isPlatformRole(callerRole)) {
    const err = new Error('Only a platform administrator may remove org_admin users');
    err.status = 403;
    throw err;
  }
  await pool.query(`DELETE FROM tb_cpanel_users WHERE id = :userId`, { userId: id });
  await writeAudit({
    organizationId,
    actorUserId: callerUserId ?? null,
    actorRole: callerRole,
    action: 'user.delete',
    resourceType: 'user',
    resourceId: id,
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
