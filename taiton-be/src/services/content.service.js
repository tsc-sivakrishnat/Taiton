import { pool } from '../config/db.js';
import { CONTENT_TYPES } from '../constants/permissions.js';
import { getPermissionGrant } from './permissions.service.js';
import { writeAudit } from './audit.service.js';
import {
  contentTypeToResource,
  findActiveApprovalRule,
  canApproveContentItem,
} from './approvalWorkflow.service.js';
import { createRoleNotification } from './notifications.service.js';
import { hashPassword } from '../utils/password.js';
import { rethrowAsClientError } from '../utils/mapDbError.js';
import { queries } from '../db/queries.js';

const CONTENT_TYPE_SET = new Set(['product', 'seo', 'ui_element']);
const STATUSES = new Set(['draft', 'pending_approval', 'live', 'rejected']);

const TYPE_LABELS = {
  product: 'Product',
  seo: 'SEO',
  ui_element: 'UI element',
  '/app/org/users': 'User registration',
  '/app/org/approval-rules': 'Approval rule configuration',
};

function permForType(contentType) {
  const map = CONTENT_TYPES[contentType];
  if (!map) return null;
  return map;
}

async function resolveCreateStatus({ organizationId, contentType, callerRole }) {
  const resource = contentTypeToResource(contentType);
  const isPlatformOperator = callerRole === 'sys_admin' || callerRole === 'super_admin';
  const orgRule = !isPlatformOperator ? await findActiveApprovalRule({
    organizationId,
    resource,
    makerRole: callerRole,
  }) : null;

  if (orgRule) {
    return { status: 'pending_approval', checkerRole: orgRule.checkerRole };
  }

  const perms = permForType(contentType);
  const grant = await getPermissionGrant(callerRole, perms.write, organizationId);
  const publishGrant = await getPermissionGrant(callerRole, perms.publish, organizationId);

  if (grant.accessLevel === 'direct' && publishGrant.allowed && publishGrant.accessLevel === 'direct') {
    return { status: 'live', checkerRole: null };
  }
  if (grant.accessLevel === 'direct' && publishGrant.accessLevel === 'approval_required') {
    return {
      status: 'pending_approval',
      checkerRole: publishGrant.approverRoleCode ?? null,
    };
  }
  return { status: 'draft', checkerRole: null };
}

export async function listContent({
  organizationId,
  roleCode,
  contentType,
  limit = 20,
  offset = 0,
  status,
}) {
  const perms = permForType(contentType);
  if (!perms) {
    const err = new Error('Invalid content type');
    err.status = 400;
    throw err;
  }
  const readGrant = await getPermissionGrant(roleCode, perms.write, organizationId);
  if (!readGrant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  const off = Math.max(0, Number(offset) || 0);
  let where = 'ci.org_id = :organizationId AND ci.content_type = :contentType';
  const params = { organizationId, contentType, limit: lim, offset: off };
  if (status && STATUSES.has(status)) {
    where += ' AND ci.status = :status';
    params.status = status;
  }
  const [rows] = await pool.query(
    `SELECT ci.id, ci.content_type AS contentType, ci.title, ci.summary, ci.payload_json AS payloadJson,
            ci.status, ci.created_by AS createdBy, u.role AS createdByRole,
            ci.submitted_at AS submittedAt, ci.approved_by AS approvedBy, ci.approved_at AS approvedAt,
            ci.rejection_note AS rejectionNote, ci.created_at AS createdAt, ci.updated_at AS updatedAt
     FROM tb_csd_content_items ci
     INNER JOIN tb_cpanel_users u ON u.id = ci.created_by
     WHERE ${where}
     ORDER BY ci.id DESC LIMIT :limit OFFSET :offset`,
    params,
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tb_csd_content_items ci WHERE ${where}`,
    params,
  );
  return {
    items: rows.map((r) => ({
      ...r,
      payload: r.payloadJson ? JSON.parse(r.payloadJson) : null,
    })),
    total: Number(countRow?.total ?? 0),
    limit: lim,
    offset: off,
  };
}

export async function createContent({
  organizationId,
  contentType,
  title,
  summary,
  payload,
  callerAuth,
}) {
  const perms = permForType(contentType);
  if (!CONTENT_TYPE_SET.has(contentType)) {
    const err = new Error('Invalid content type');
    err.status = 400;
    throw err;
  }
  const grant = await getPermissionGrant(callerAuth.role, perms.write, organizationId);
  if (!grant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const titleTrim = String(title ?? '').trim();
  const { status, checkerRole } = await resolveCreateStatus({
    organizationId,
    contentType,
    callerRole: callerAuth.role,
  });
  const submittedAt = status === 'pending_approval' ? new Date() : null;

  const [result] = await pool.query(
    `INSERT INTO tb_csd_content_items
      (org_id, content_type, title, summary, payload_json, status, created_by, submitted_at)
     VALUES (:organizationId, :contentType, :title, :summary, :payloadJson, :status, :createdBy, :submittedAt)`,
    {
      organizationId,
      contentType,
      title: titleTrim,
      summary: summary?.trim() || null,
      payloadJson: payload != null ? JSON.stringify(payload) : null,
      status,
      createdBy: callerAuth.userId,
      submittedAt,
    },
  );

  const typeLabel = TYPE_LABELS[contentType] ?? 'Item';

  if (status === 'pending_approval' && checkerRole) {
    await createRoleNotification({
      organizationId,
      rolesCsv: checkerRole,
      title: `${typeLabel} awaiting approval`,
      body: `"${titleTrim}" was submitted by ${callerAuth.role}. Open Approvals to review.`,
      severity: 'warning',
    });
  } else if (status === 'live') {
    await createRoleNotification({
      organizationId,
      userId: callerAuth.userId,
      title: `${typeLabel} published`,
      body: `"${titleTrim}" is now live.`,
      severity: 'success',
    });
  }

  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'content.create',
    resourceType: contentType,
    resourceId: result.insertId,
    detail: { status, title: titleTrim, checkerRole },
  });

  return {
    id: result.insertId,
    status,
    checkerRole,
    message:
      status === 'pending_approval'
        ? `Submitted for approval. ${checkerRole ?? 'Checker'} will be notified.`
        : status === 'live'
          ? 'Published live.'
          : 'Saved as draft.',
  };
}

export async function approveContent({
  organizationId,
  id,
  approve,
  rejectionNote,
  callerAuth,
}) {
  const [[item]] = await pool.query(
    `SELECT content_type AS contentType, status, title, created_by AS createdBy
     FROM tb_csd_content_items
     WHERE id = :id AND org_id = :organizationId`,
    { id, organizationId },
  );
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }
  const perms = permForType(item.contentType);
  const allowed = await canApproveContentItem({
    organizationId,
    contentType: item.contentType,
    createdByUserId: item.createdBy,
    callerRole: callerAuth.role,
    publishPermissionCode: perms?.publish ?? null,
    getPermissionGrant,
  });
  if (!allowed) {
    const err = new Error('You are not the checker for this submission');
    err.status = 403;
    throw err;
  }
  if (item.status !== 'pending_approval') {
    const err = new Error('Item is not pending approval');
    err.status = 400;
    throw err;
  }

  if (item.contentType === '/app/org/users' && approve) {
    try {
      const [[contentItem]] = await pool.query(
        `SELECT payload_json AS payloadJson FROM tb_csd_content_items WHERE id = :id`,
        { id }
      );
      const payload = JSON.parse(contentItem?.payloadJson || '{}');
      const emailNorm = String(payload.email ?? '').trim().toLowerCase();
      const name = String(payload.fullName ?? '').trim();
      const role = String(payload.role ?? '').trim();
      const mobileDigits = String(payload.mobile ?? '').replace(/\D/g, '').slice(0, 10);

      const [orgRows] = await pool.query(queries.orgCodeByOrganizationId, {
        organizationId,
      });
      const orgRow = orgRows?.[0];
      if (!orgRow?.code) {
        throw new Error('Organization not found');
      }

      const passwordHash = await hashPassword(mobileDigits);
      const [insertRes] = await pool.query(queries.userInsert, {
        orgCode: orgRow.code,
        email: emailNorm,
        passwordHash,
        fullName: name,
        mobile: mobileDigits,
        role,
      });

      await writeAudit({
        organizationId,
        actorUserId: item.createdBy,
        actorRole: 'system',
        action: 'user.register',
        resourceType: 'user',
        resourceId: insertRes.insertId,
        detail: { email: emailNorm, role, approvedBy: callerAuth.userId },
      });
    } catch (e) {
      rethrowAsClientError(e);
    }
  }

  const newStatus = approve ? 'live' : 'rejected';
  await pool.query(
    `UPDATE tb_csd_content_items SET status = :newStatus, approved_by = :approvedBy,
      approved_at = UTC_TIMESTAMP(), rejection_note = :rejectionNote
     WHERE id = :id AND org_id = :organizationId`,
    {
      id,
      organizationId,
      newStatus,
      approvedBy: callerAuth.userId,
      rejectionNote: approve ? null : rejectionNote || 'Rejected',
    },
  );

  const typeLabel = TYPE_LABELS[item.contentType] ?? 'Item';
  await createRoleNotification({
    organizationId,
    userId: item.createdBy,
    title: approve ? `${typeLabel} approved` : `${typeLabel} rejected`,
    body: approve
      ? `"${item.title}" was approved by ${callerAuth.role} and is now live.`
      : `"${item.title}" was rejected by ${callerAuth.role}.`,
    severity: approve ? 'success' : 'error',
  });

  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: approve ? 'content.approve' : 'content.reject',
    resourceType: item.contentType,
    resourceId: id,
  });

  return { id, status: newStatus };
}

export async function listPendingContent({ organizationId }) {
  const [rows] = await pool.query(
    `SELECT ci.id, ci.content_type AS contentType, ci.title, ci.summary, ci.payload_json AS payloadJson, ci.status, ci.created_by AS createdBy,
            u.role AS createdByRole
     FROM tb_csd_content_items ci
     LEFT JOIN tb_cpanel_users u ON u.id = ci.created_by
     WHERE ci.org_id = :organizationId AND ci.status = 'pending_approval'
     ORDER BY ci.created_at DESC`,
    { organizationId }
  );
  return { items: rows };
}
