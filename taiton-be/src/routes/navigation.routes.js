import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as navigationService from '../services/navigation.service.js';

export const navigationRouter = Router();

navigationRouter.get('/', requireAuth, async (req, res) => {
  try {
    const items = await navigationService.listNavForOrgAndRole({
      organizationId: req.auth.organizationId,
      roleCode: req.auth.role,
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});
