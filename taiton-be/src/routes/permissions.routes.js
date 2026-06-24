import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listMyPermissions } from '../services/permissions.service.js';
import { listAudit } from '../services/audit.service.js';
import { assertPermission } from '../services/permissions.service.js';
import { PERMISSIONS } from '../constants/permissions.js';

export const permissionsRouter = Router();

permissionsRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const permissions = await listMyPermissions(req.auth.role, req.auth.organizationId);
    res.json({ permissions, role: req.auth.role });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

permissionsRouter.get('/audit', requireAuth, async (req, res) => {
  try {
    await assertPermission(req.auth.role, PERMISSIONS.ORG_AUDIT_VIEW);
    const data = await listAudit({
      organizationId: req.auth.organizationId,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(data);
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});
