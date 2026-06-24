import fs from 'fs';
import multer from 'multer';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSupportStaff } from '../middleware/requireSupportStaff.js';
import * as supportService from '../services/support.service.js';

export const supportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 5 },
});

supportRouter.get('/tickets', requireAuth, async (req, res) => {
  try {
    const scope = req.query.scope === 'org' ? 'org' : 'mine';
    const items = await supportService.listTickets({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      role: req.auth.role,
      scope,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

supportRouter.get('/tickets/:ticketId', requireAuth, async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ error: 'Invalid ticket id' });
    }
    const ticket = await supportService.getTicketDetail({
      ticketId,
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      role: req.auth.role,
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ ticket });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

supportRouter.post(
  '/tickets',
  requireAuth,
  upload.array('attachments', 5),
  async (req, res) => {
    try {
      const ticket = await supportService.createTicket({
        organizationId: req.auth.organizationId,
        reporterUserId: req.auth.userId,
        role: req.auth.role,
        body: req.body,
        files: req.files,
      });
      res.status(201).json({ ticket });
    } catch (e) {
      const status = e.status && Number.isFinite(e.status) ? e.status : 500;
      res.status(status).json({ error: e.message ?? 'Server error' });
    }
  },
);

supportRouter.patch(
  '/tickets/:ticketId/status',
  requireAuth,
  requireSupportStaff,
  async (req, res) => {
    try {
      const ticketId = Number(req.params.ticketId);
      if (!Number.isFinite(ticketId)) {
        return res.status(400).json({ error: 'Invalid ticket id' });
      }
      const ticket = await supportService.updateTicketStatus({
        ticketId,
        organizationId: req.auth.organizationId,
        status: req.body?.status,
        actorRole: req.auth.role,
        actorUserId: req.auth.userId,
      });
      res.json({ ticket });
    } catch (e) {
      const status = e.status && Number.isFinite(e.status) ? e.status : 500;
      res.status(status).json({ error: e.message ?? 'Server error' });
    }
  },
);

supportRouter.get(
  '/tickets/:ticketId/attachments/:attachmentId',
  requireAuth,
  async (req, res) => {
    try {
      const ticketId = Number(req.params.ticketId);
      const attachmentId = Number(req.params.attachmentId);
      if (!Number.isFinite(ticketId) || !Number.isFinite(attachmentId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      const row = await supportService.getAttachmentFileRow({
        ticketId,
        attachmentId,
        organizationId: req.auth.organizationId,
        userId: req.auth.userId,
        role: req.auth.role,
      });
      if (!row) {
        return res.status(404).json({ error: 'Not found' });
      }
      const abs = supportService.resolveAttachmentAbsolutePath(row.stored_path);
      if (!abs) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      await fs.promises.access(abs, fs.constants.R_OK);
      res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
      const safe = encodeURIComponent(row.original_name || 'download').replace(/'/g, '%27');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${safe}`,
      );
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'File missing' });
      }
      res.status(500).json({ error: e.message ?? 'Server error' });
    }
  },
);

supportRouter.get('/tickets/:ticketId/decision/:token', async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const token = String(req.params.token || '').trim();
    const action = String(req.query.action || '').toLowerCase();
    if (!Number.isFinite(ticketId) || !token) {
      return res.status(400).send('Invalid link.');
    }
    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).send('Invalid action.');
    }
    const result = await supportService.applyEmailDecision({ ticketId, token, action });
    const label =
      result.decision === 'accept'
        ? 'Accepted'
        : result.decision === 'decline'
          ? 'Declined'
          : 'Pending';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Support ticket decision</title>
        </head>
        <body style="margin:0;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#f8fafc;color:#0f172a">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 10px 26px rgba(15,23,42,.06);overflow:hidden">
            <div style="padding:14px 16px;background:#0f172a;color:#f8fafc">
              <div style="font-size:12px;opacity:.9;letter-spacing:.08em;text-transform:uppercase">Enterprise CPanel · Support</div>
              <div style="font-size:18px;font-weight:800;margin-top:6px">Ticket #${ticketId}</div>
            </div>
            <div style="padding:16px">
              <div style="font-size:16px;font-weight:800;margin-bottom:6px">${label}</div>
              <div style="color:#64748b;font-size:13px;margin-bottom:14px">
                ${result.changed ? 'Your decision has been recorded.' : 'This link was already used (or is invalid).'}
              </div>
              <div style="display:inline-block;padding:10px 12px;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;color:#0f172a;font-weight:700">
                ${label}
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (e) {
    return res.status(500).send('Server error.');
  }
});
