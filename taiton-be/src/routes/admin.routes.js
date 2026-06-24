import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireActorRegistrar } from '../middleware/requireActorRegistrar.js';
import { requireAccountsActorsView } from '../middleware/requireAccountsActorsView.js';
import * as actorRegistrationService from '../services/actorRegistration.service.js';

export const adminRouter = Router();

adminRouter.get('/roles', requireAuth, requireActorRegistrar, async (req, res) => {
  try {
    const roles = await actorRegistrationService.listRolesForRegistrar(
      req.auth.role,
      req.auth.organizationId,
    );
    res.json({ roles });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

adminRouter.get('/actors/export', requireAuth, requireAccountsActorsView, async (req, res) => {
  try {
    const search = req.query.q;
    const csv = await actorRegistrationService.exportActorsCsv({
      organizationId: req.auth.organizationId,
      search,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="accounts-export.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

adminRouter.get('/actors', requireAuth, requireAccountsActorsView, async (req, res) => {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;
    const search = req.query.q;
    const data = await actorRegistrationService.listActorsByOrg({
      organizationId: req.auth.organizationId,
      limit,
      offset,
      search,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

adminRouter.post('/actors', requireAuth, requireActorRegistrar, async (req, res) => {
  try {
    const actor = await actorRegistrationService.registerActor({
      organizationId: req.auth.organizationId,
      callerRole: req.auth.role,
      callerUserId: req.auth.userId,
      email: req.body?.email,
      mobile: req.body?.mobile,
      fullName: req.body?.fullName,
      roleCode: req.body?.role,
    });
    res.status(201).json({ actor });
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

adminRouter.delete('/actors/:userId', requireAuth, requireActorRegistrar, async (req, res) => {
  try {
    await actorRegistrationService.deleteActor({
      organizationId: req.auth.organizationId,
      userId: Number(req.params.userId),
      callerRole: req.auth.role,
      callerUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});
