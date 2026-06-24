import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as dashboardService from '../services/dashboard.service.js';
import * as hostingMetricsService from '../services/hostingMetrics.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', requireAuth, async (req, res) => {
  try {
    const summary = await dashboardService.getSummary({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      roleCode: req.auth.role,
    });
    res.json({
      organizationId: req.auth.organizationId,
      role: req.auth.role,
      summary,
    });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

dashboardRouter.get('/hosting-metrics', requireAuth, (req, res) => {
  res.json(hostingMetricsService.getMetrics());
});
