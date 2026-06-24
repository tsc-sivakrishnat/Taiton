import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as contentService from '../services/content.service.js';

export const contentRouter = Router();

contentRouter.get('/pending', requireAuth, async (req, res) => {
  try {
    const data = await contentService.listPendingContent({
      organizationId: req.auth.organizationId,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.post('/approve/:id', requireAuth, async (req, res) => {
  try {
    const item = await contentService.approveContent({
      organizationId: req.auth.organizationId,
      id: Number(req.params.id),
      approve: req.body?.approve !== false,
      rejectionNote: req.body?.rejectionNote,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.get('/:contentType', requireAuth, async (req, res) => {
  try {
    const data = await contentService.listContent({
      organizationId: req.auth.organizationId,
      roleCode: req.auth.role,
      contentType: req.params.contentType,
      limit: req.query.limit,
      offset: req.query.offset,
      status: req.query.status,
    });
    res.json(data);
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.post('/:contentType', requireAuth, async (req, res) => {
  try {
    const item = await contentService.createContent({
      organizationId: req.auth.organizationId,
      contentType: req.params.contentType,
      title: req.body?.title,
      summary: req.body?.summary,
      payload: req.body?.payload,
      callerAuth: req.auth,
    });
    res.status(201).json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.post('/:contentType/:id/approve', requireAuth, async (req, res) => {
  try {
    const item = await contentService.approveContent({
      organizationId: req.auth.organizationId,
      id: Number(req.params.id),
      approve: req.body?.approve !== false,
      rejectionNote: req.body?.rejectionNote,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});
