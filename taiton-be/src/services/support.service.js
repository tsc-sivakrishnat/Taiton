import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';
import {
  sendMail,
  getDevTeamInbox,
  getPublicAppUrl,
} from './mail.service.js';

const REQUEST_TYPES = new Set(['issue', 'bug', 'enhancement']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const STATUSES = new Set([
  'raised',
  'acknowledged',
  'in_progress',
  'completed',
  'live',
]);

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 200;

function isSupportStaff(role) {
  return role === 'org_admin' || role === 'super_admin';
}

let approvalColumnsEnsured = false;

async function ensureApprovalColumns() {
  if (approvalColumnsEnsured) return;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tb_csd_support_tickets'
       AND COLUMN_NAME = 'approval_token_sha256'`,
  );
  if (Number(rows[0]?.c) > 0) {
    approvalColumnsEnsured = true;
    return;
  }
  try {
    await pool.query(`
      ALTER TABLE tb_csd_support_tickets
        ADD COLUMN approval_token_sha256 CHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hex of email approval token',
        ADD COLUMN approval_decision ENUM('accept','decline') NULL DEFAULT NULL,
        ADD COLUMN approval_decided_at DATETIME NULL DEFAULT NULL
    `);
  } catch (e) {
    const hint =
      'Runonce SQL is in cpanel-be/database/migration_add_support_approval_columns.sql (ALTER TABLE tb_csd_support_tickets …)';
    const err = new Error(`Could not add approval columns: ${e.message ?? e}. ${hint}`);
    err.status = 503;
    err.cause = e;
    throw err;
  }
  approvalColumnsEnsured = true;
}

let attachmentsTableEnsured = false;

async function ensureAttachmentsTable() {
  if (attachmentsTableEnsured) return;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tb_csd_support_ticket_attachments'`,
  );
  if (Number(rows[0]?.c) > 0) {
    attachmentsTableEnsured = true;
    return;
  }
  try {
    await pool.query(queries.supportAttachmentsEnsureTable);
  } catch (e) {
    const hint =
      'cpanel-be/database/migration_support_ticket_attachments.sql';
    const err = new Error(`Could not create attachments table: ${e.message ?? e}. Run SQL from ${hint}`);
    err.status = 503;
    err.cause = e;
    throw err;
  }
  attachmentsTableEnsured = true;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function mapTicketRow(r) {
  return {
    id: r.id,
    organizationId: r.org_id,
    reporterUserId: r.reporter_user_id,
    requestType: r.request_type,
    title: r.title,
    description: r.description,
    priority: r.priority,
    status: r.status,
    trackingEmails: r.tracking_emails,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    reporterName: r.reporter_name,
    reporterEmail: r.reporter_email,
    orgName: r.org_name ?? undefined,
  };
}

function parseTrackingEmails(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const parts = raw.split(/[,;\s]+/).map((s) => s.trim().toLowerCase());
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    if (!p || !emailRe.test(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= 8) break;
  }
  return out;
}

function safeBaseName(name) {
  const base = path.basename(String(name || 'file')).replace(/[/\\]/g, '_');
  return base.replace(/\.\./g, '_').slice(0, 180) || 'file';
}

function uploadsRoot() {
  return path.join(process.cwd(), 'uploads');
}

export async function listTickets({
  organizationId,
  userId,
  role,
  scope,
  limit,
  offset,
}) {
  const staff = isSupportStaff(role);
  const scopeAll = staff && scope === 'org' ? 1 : 0;
  const lim = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(limit) || DEFAULT_LIMIT),
  );
  const off = Math.max(0, Number(offset) || 0);
  const [rows] = await pool.query(queries.supportTicketsList, {
    organizationId,
    userId,
    scopeAll,
    limit: lim,
    offset: off,
  });
  return rows.map(mapTicketRow);
}

export async function getTicketDetail({
  ticketId,
  organizationId,
  userId,
  role,
}) {
  const staff = isSupportStaff(role);
  const scopeAll = staff ? 1 : 0;
  const [rows] = await pool.query(queries.supportTicketById, {
    ticketId,
    organizationId,
    userId,
    scopeAll,
  });
  if (!rows.length) return null;
  const ticket = mapTicketRow(rows[0]);
  const [atts] = await pool.query(queries.supportAttachmentsByTicket, {
    ticketId,
  });
  ticket.attachments = atts.map((a) => ({
    id: a.id,
    originalName: a.original_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    createdAt: a.created_at,
  }));
  return ticket;
}

async function notifyTicketCreated({
  orgName,
  ticketId,
  title,
  requestType,
  priority,
  description,
  reporterEmail,
  reporterName,
  trackingEmails,
  decisionLinkAccept,
  decisionLinkDecline,
}) {
  const dev = getDevTeamInbox();
  const toSet = new Set([dev, reporterEmail, ...trackingEmails].filter(Boolean));
  const toList = [...toSet];
  const subject = `[${orgName}] Support #${ticketId}: ${title}`;
  const portal = getPublicAppUrl();
  const linkLine = portal ? `Portal: ${portal}\n` : '';
  const text = [
    `A new ${requestType} was raised in ${orgName}.`,
    '',
    `Ticket #${ticketId}`,
    `Title: ${title}`,
    `Priority: ${priority}`,
    `Reporter: ${reporterName} <${reporterEmail}>`,
    trackingEmails.length
      ? `Tracking CC: ${trackingEmails.join(', ')}`
      : '',
    '',
    'Description:',
    description,
    '',
    linkLine,
    decisionLinkAccept ? `Accept: ${decisionLinkAccept}` : '',
    decisionLinkDecline ? `Decline: ${decisionLinkDecline}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const btn = (href, label, bg) =>
    href
      ? `<a href="${esc(href)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:${bg};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;margin-right:10px">${esc(label)}</a>`
      : '';
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;color:#0f172a">
      <div style="padding:14px 16px;background:#0f172a;color:#f8fafc;border-radius:14px 14px 0 0">
        <div style="font-size:12px;opacity:.9;letter-spacing:.08em;text-transform:uppercase">Enterprise CPanel · Support</div>
        <div style="font-size:18px;font-weight:800;margin-top:6px">Ticket #${ticketId}: ${esc(title)}</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:16px;border-radius:0 0 14px 14px;background:#ffffff">
        <p style="margin:0 0 10px"><strong>Org:</strong> ${esc(orgName)}<br/>
          <strong>Type:</strong> ${esc(requestType)} · <strong>Priority:</strong> ${esc(priority)}<br/>
          <strong>Reporter:</strong> ${esc(reporterName)} &lt;${esc(reporterEmail)}&gt;
        </p>
        ${trackingEmails.length ? `<p style="margin:0 0 10px"><strong>Tracking:</strong> ${esc(trackingEmails.join(', '))}</p>` : ''}
        <div style="background:#f1f5f9;border:1px solid #e2e8f0;padding:12px;border-radius:12px;white-space:pre-wrap">${esc(description)}</div>
        <div style="margin-top:14px">
          ${btn(decisionLinkAccept, 'Accept', '#16a34a')}
          ${btn(decisionLinkDecline, 'Decline', '#dc2626')}
        </div>
        ${portal ? `<p style="margin:14px 0 0"><a href="${esc(portal)}" style="color:#2563eb;font-weight:700;text-decoration:none">Open portal</a></p>` : ''}
        <p style="margin:10px 0 0;font-size:12px;color:#64748b">If you already decided, the buttons will show the current status.</p>
      </div>
    </div>
  `;
  const mailResult = await sendMail({
    to: toList.join(', '),
    subject,
    text,
    html,
  });
  if (mailResult.skipped) {
    console.warn(
      '[support submit] email skipped: set RESEND_API_KEY + MAIL_FROM on Render, or SMTP_HOST + MAIL_FROM locally.',
    );
  }
}

async function notifyStatusChange({
  orgName,
  ticketId,
  title,
  status,
  reporterEmail,
  reporterName,
  trackingEmails,
}) {
  const dev = getDevTeamInbox();
  const toSet = new Set([dev, reporterEmail, ...trackingEmails].filter(Boolean));
  const subject = `[${orgName}] Ticket #${ticketId} → ${status.replace(/_/g, ' ')}`;
  const text = [
    `Ticket #${ticketId} in ${orgName} is now: ${status}.`,
    `Title: ${title}`,
    `Reporter: ${reporterName} <${reporterEmail}>`,
    '',
    trackingEmails.length ? `Tracking: ${trackingEmails.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const html = `<p>Ticket <strong>#${ticketId}</strong> in ${esc(orgName)} is now <strong>${esc(status)}</strong>.</p>
    <p>${esc(title)}</p>`;
  const mailResult = await sendMail({
    to: [...toSet].join(', '),
    subject,
    text,
    html,
  });
  if (mailResult.skipped) {
    console.warn(
      '[support] status email skipped: set RESEND_API_KEY + MAIL_FROM or SMTP + MAIL_FROM',
    );
  }
}

export async function createTicket({
  organizationId,
  reporterUserId,
  role,
  body,
  files,
}) {
  console.log('[support submit] start', {
    organizationId,
    reporterUserId,
    attachmentCount: Array.isArray(files) ? files.length : 0,
  });
  const title = String(body?.title ?? '').trim();
  if (!title || title.length > 220) {
    const err = new Error('Title is required (max 220 characters)');
    err.status = 400;
    throw err;
  }
  const requestType = String(body?.requestType ?? 'issue').toLowerCase();
  if (!REQUEST_TYPES.has(requestType)) {
    const err = new Error('Invalid request type');
    err.status = 400;
    throw err;
  }
  const priority = String(body?.priority ?? 'medium').toLowerCase();
  if (!PRIORITIES.has(priority)) {
    const err = new Error('Invalid priority');
    err.status = 400;
    throw err;
  }
  const description = String(body?.description ?? '').trim();
  if (!description) {
    const err = new Error('Description is required');
    err.status = 400;
    throw err;
  }
  const trackingEmails = parseTrackingEmails(body?.trackingEmails ?? '');
  const trackingCsv = trackingEmails.length ? trackingEmails.join(',') : null;

  const [who] = await pool.query(
    `SELECT u.full_name, u.email, o.name AS org_name
     FROM tb_cpanel_users u
     INNER JOIN tb_cpanel_organizations o ON o.code = u.org_code
     WHERE u.id = :userId AND o.id = :organizationId
     LIMIT 1`,
    { userId: reporterUserId, organizationId },
  );
  if (!who.length) {
    const err = new Error('User or organization not found');
    err.status = 400;
    throw err;
  }
  const reporterNameResolved = who[0].full_name;
  const reporterEmailResolved = who[0].email;
  const orgNameResolved = who[0].org_name;

  await ensureApprovalColumns();
  await ensureAttachmentsTable();

  const conn = await pool.getConnection();
  let ticketId;
  let decisionToken;
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(queries.supportTicketInsert, {
      organizationId,
      reporterUserId,
      requestType,
      title,
      description,
      priority,
      trackingEmails: trackingCsv,
    });
    ticketId = ins.insertId;

    decisionToken = crypto.randomBytes(18).toString('hex');
    const tokenSha256 = sha256Hex(decisionToken);
    await conn.query(queries.supportTicketSetApprovalToken, { ticketId, tokenSha256 });

    const relDir = path.join('support', String(organizationId), String(ticketId));
    const absDir = path.join(uploadsRoot(), relDir);
    await fs.mkdir(absDir, { recursive: true });

    for (const f of files ?? []) {
      const rand = crypto.randomBytes(8).toString('hex');
      const base = safeBaseName(f.originalname);
      const storedName = `${rand}-${base}`;
      const storedPath = path.join(relDir, storedName).replace(/\\/g, '/');
      const absPath = path.join(uploadsRoot(), storedPath);
      const buf = f.buffer;
      const byteLen = buf?.length ?? 0;
      await fs.writeFile(absPath, buf);
      await conn.query(queries.supportAttachmentInsert, {
        ticketId,
        originalName: base.slice(0, 255),
        storedPath,
        mimeType: String(f.mimetype || 'application/octet-stream').slice(0, 120),
        sizeBytes: Math.min(byteLen, 0xffffffff),
      });
    }
    await conn.commit();
    console.log('[support submit] saved', {
      ticketId,
      organizationId,
      attachmentCount: (files ?? []).length,
    });
  } catch (e) {
    await conn.rollback();
    console.error('[support submit] database error', e);
    throw e;
  } finally {
    conn.release();
  }

  notifyTicketCreated({
    orgName: orgNameResolved,
    ticketId,
    title,
    requestType,
    priority,
    description,
    reporterEmail: reporterEmailResolved,
    reporterName: reporterNameResolved,
    trackingEmails,
    decisionLinkAccept: decisionToken
      ? `${getPublicAppUrl()}/api/support/tickets/${ticketId}/decision/${decisionToken}?action=accept`
      : '',
    decisionLinkDecline: decisionToken
      ? `${getPublicAppUrl()}/api/support/tickets/${ticketId}/decision/${decisionToken}?action=decline`
      : '',
  }).catch((err) => {
    console.error('[support submit] notify email failed', err);
  });

  console.log('[support submit] done', { ticketId, organizationId });

  return getTicketDetail({
    ticketId,
    organizationId,
    userId: reporterUserId,
    role,
  });
}

export async function applyEmailDecision({ ticketId, token, action }) {
  await ensureApprovalColumns();
  const decision = String(action || '').toLowerCase() === 'accept' ? 'accept' : 'decline';
  const tokenSha256 = sha256Hex(token);
  const [upd] = await pool.query(queries.supportTicketApplyApproval, {
    ticketId,
    tokenSha256,
    decision,
  });
  const changed = upd.affectedRows > 0;
  if (changed && decision === 'accept') {
    const [tRows] = await pool.query(
      `SELECT org_id FROM tb_csd_support_tickets WHERE id = :ticketId LIMIT 1`,
      { ticketId },
    );
    const organizationId = tRows?.[0]?.org_id;
    if (organizationId) {
      await pool.query(queries.supportTicketUpdateStatus, {
        ticketId,
        organizationId,
        status: 'acknowledged',
      });
    }
  }
  const [rows] = await pool.query(queries.supportTicketGetApproval, { ticketId });
  return { changed, decision: rows?.[0]?.decision ?? null, decidedAt: rows?.[0]?.decided_at ?? null };
}

export async function updateTicketStatus({
  ticketId,
  organizationId,
  status,
  actorRole,
  actorUserId,
}) {
  if (!isSupportStaff(actorRole)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const st = String(status ?? '').toLowerCase();
  if (!STATUSES.has(st)) {
    const err = new Error('Invalid status');
    err.status = 400;
    throw err;
  }
  const [prevRows] = await pool.query(queries.supportTicketById, {
    ticketId,
    organizationId,
    userId: 0,
    scopeAll: 1,
  });
  if (!prevRows.length) {
    const err = new Error('Ticket not found');
    err.status = 404;
    throw err;
  }
  const prev = prevRows[0];
  if (prev.status === st) {
    const ticket = mapTicketRow(prev);
    const [atts] = await pool.query(queries.supportAttachmentsByTicket, {
      ticketId,
    });
    ticket.attachments = atts.map((a) => ({
      id: a.id,
      originalName: a.original_name,
      mimeType: a.mime_type,
      sizeBytes: a.size_bytes,
      createdAt: a.created_at,
    }));
    return ticket;
  }

  await pool.query(queries.supportTicketUpdateStatus, {
    ticketId,
    organizationId,
    status: st,
  });

  const trackingEmails = parseTrackingEmails(prev.tracking_emails ?? '');
  notifyStatusChange({
    orgName: prev.org_name,
    ticketId,
    title: prev.title,
    status: st,
    reporterEmail: prev.reporter_email,
    reporterName: prev.reporter_name,
    trackingEmails,
  }).catch(() => {});

  return getTicketDetail({
    ticketId,
    organizationId,
    userId: actorUserId,
    role: actorRole,
  });
}

export async function getAttachmentFileRow({
  ticketId,
  attachmentId,
  organizationId,
  userId,
  role,
}) {
  const staff = isSupportStaff(role);
  const scopeAll = staff ? 1 : 0;
  const [rows] = await pool.query(queries.supportAttachmentRowForDownload, {
    ticketId,
    attachmentId,
    organizationId,
    userId,
    scopeAll,
  });
  if (!rows.length) return null;
  return rows[0];
}

export function resolveAttachmentAbsolutePath(storedPath) {
  const normalized = String(storedPath || '').replace(/\\/g, '/');
  if (normalized.includes('..') || !normalized.startsWith('support/')) {
    return null;
  }
  return path.join(uploadsRoot(), ...normalized.split('/'));
}
