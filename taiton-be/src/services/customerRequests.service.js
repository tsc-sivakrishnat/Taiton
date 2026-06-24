import { pool } from '../config/db.js';
import { assertPermission, getPermissionGrant } from './permissions.service.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { writeAudit } from './audit.service.js';

const REQUEST_TYPES = new Set(['inquiry', 'contact', 'quotation']);
const STATUSES = new Set(['new', 'in_review', 'responded', 'closed']);

export async function listCustomerRequests({
  organizationId,
  roleCode,
  limit = 20,
  offset = 0,
  status,
  requestType,
}) {
  const readGrant = await getPermissionGrant(roleCode, PERMISSIONS.CUSTOMER_REQUESTS_READ);
  if (!readGrant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  const off = Math.max(0, Number(offset) || 0);
  let where = 'org_id = :organizationId';
  const params = { organizationId, limit: lim, offset: off };
  if (status && STATUSES.has(status)) {
    where += ' AND status = :status';
    params.status = status;
  }
  if (requestType && REQUEST_TYPES.has(requestType)) {
    where += ' AND request_type = :requestType';
    params.requestType = requestType;
  }
  const [rows] = await pool.query(
    `SELECT id, request_type AS requestType, customer_name AS customerName, email, phone,
            subject, message, status, assigned_user_id AS assignedUserId,
            created_at AS createdAt, updated_at AS updatedAt
     FROM tb_csd_customer_requests WHERE ${where}
     ORDER BY id DESC LIMIT :limit OFFSET :offset`,
    params,
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tb_csd_customer_requests WHERE ${where}`,
    params,
  );
  return { items: rows, total: Number(countRow?.total ?? 0), limit: lim, offset: off };
}

export async function createCustomerRequest({
  organizationId,
  requestType,
  customerName,
  email,
  phone,
  subject,
  message,
  callerAuth,
}) {
  const manageGrant = await getPermissionGrant(callerAuth.role, PERMISSIONS.CUSTOMER_REQUESTS_MANAGE);
  const readGrant = await getPermissionGrant(callerAuth.role, PERMISSIONS.CUSTOMER_REQUESTS_READ);
  if (!manageGrant.allowed && !readGrant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }
  const type = String(requestType ?? 'inquiry').trim();
  if (!REQUEST_TYPES.has(type)) {
    const err = new Error('Invalid request type');
    err.status = 400;
    throw err;
  }
  const [result] = await pool.query(
    `INSERT INTO tb_csd_customer_requests
      (org_id, request_type, customer_name, email, phone, subject, message, status)
     VALUES (:organizationId, :requestType, :customerName, :email, :phone, :subject, :message, 'new')`,
    {
      organizationId,
      requestType: type,
      customerName: String(customerName ?? '').trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      subject: String(subject ?? '').trim(),
      message: String(message ?? '').trim(),
    },
  );
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'customer_request.create',
    resourceType: 'customer_request',
    resourceId: result.insertId,
  });
  return { id: result.insertId };
}

export async function updateCustomerRequestStatus({
  organizationId,
  id,
  status,
  assignedUserId,
  callerAuth,
}) {
  await assertPermission(callerAuth.role, PERMISSIONS.CUSTOMER_REQUESTS_MANAGE);
  if (!STATUSES.has(status)) {
    const err = new Error('Invalid status');
    err.status = 400;
    throw err;
  }
  await pool.query(
    `UPDATE tb_csd_customer_requests SET status = :status,
      assigned_user_id = COALESCE(:assignedUserId, assigned_user_id)
     WHERE id = :id AND org_id = :organizationId`,
    {
      id,
      organizationId,
      status,
      assignedUserId: assignedUserId ?? null,
    },
  );
  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'customer_request.update',
    resourceType: 'customer_request',
    resourceId: id,
    detail: { status },
  });
  return { id, status };
}
