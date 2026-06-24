import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as notificationsService from '../services/notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const items = await notificationsService.listForUser({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      roleCode: req.auth.role,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

notificationsRouter.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const ok = await notificationsService.markRead({
      id,
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      roleCode: req.auth.role,
    });
    if (!ok) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

notificationsRouter.post('/read-all', requireAuth, async (req, res) => {
  try {
    const updated = await notificationsService.markAllRead({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      roleCode: req.auth.role,
    });
    res.json({ updated });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});
