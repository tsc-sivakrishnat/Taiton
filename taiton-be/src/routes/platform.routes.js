import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import * as platformService from '../services/platform.service.js';

export const platformRouter = Router();

platformRouter.use(requireAuth, requirePlatformAdmin);

platformRouter.get('/organizations', async (_req, res) => {
  try {
    const organizations = await platformService.listOrganizations();
    res.json({ organizations });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.post('/organizations', async (req, res) => {
  try {
    const org = await platformService.createOrganization({
      code: req.body?.code,
      name: req.body?.name,
      callerAuth: req.auth,
    });
    res.status(201).json({ organization: org });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/roles', async (_req, res) => {
  try {
    const roles = await platformService.listRolesCatalogue();
    res.json({ roles });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.post('/roles', async (req, res) => {
  try {
    const role = await platformService.upsertRole({
      code: req.body?.code,
      name: req.body?.name,
      description: req.body?.description,
      priority: req.body?.priority,
      scope: req.body?.scope,
      callerAuth: req.auth,
    });
    res.json({ role });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/organizations/:orgId/nav', async (req, res) => {
  try {
    const items = await platformService.listNavItems({
      organizationId: Number(req.params.orgId),
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/nav-icons', async (_req, res) => {
  try {
    const icons = await platformService.listNavIcons();
    res.json({ icons });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/organizations/:orgId/roles', async (req, res) => {
  try {
    const roles = await platformService.listOrgRoles({
      organizationId: Number(req.params.orgId),
    });
    res.json({ roles });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.post('/organizations/:orgId/roles', async (req, res) => {
  try {
    const role = await platformService.createOrgRole({
      organizationId: Number(req.params.orgId),
      code: req.body?.code,
      name: req.body?.name,
      description: req.body?.description,
      priority: req.body?.priority,
      callerAuth: req.auth,
    });
    res.status(201).json({ role });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.delete('/organizations/:orgId/roles/:roleCode', async (req, res) => {
  try {
    await platformService.deleteOrgRole({
      organizationId: Number(req.params.orgId),
      roleCode: req.params.roleCode,
      callerAuth: req.auth,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/organizations/:orgId/assignable-roles', async (req, res) => {
  try {
    const roles = await platformService.listOrganizationAssignableRoles(
      Number(req.params.orgId),
    );
    res.json({ roles });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.delete('/organizations/:orgId/nav/:navId', async (req, res) => {
  try {
    await platformService.deleteNavItem({
      organizationId: Number(req.params.orgId),
      navId: Number(req.params.navId),
      callerAuth: req.auth,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.post('/organizations/:orgId/nav', async (req, res) => {
  try {
    const item = await platformService.upsertNavItem({
      organizationId: Number(req.params.orgId),
      id: req.body?.id,
      label: req.body?.label,
      icon: req.body?.icon,
      route: req.body?.route,
      position: req.body?.position,
      sortOrder: req.body?.sortOrder,
      rolesCsv: req.body?.rolesCsv,
      isActive: req.body?.isActive,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/organizations/:orgId/roles/priority-one', async (req, res) => {
  try {
    const roles = await platformService.listPriorityOneRoles({
      organizationId: Number(req.params.orgId),
    });
    res.json({ roles });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.post('/organizations/:orgId/members', async (req, res) => {
  try {
    const user = await platformService.createOrganizationMember({
      organizationId: Number(req.params.orgId),
      email: req.body?.email,
      fullName: req.body?.fullName,
      mobile: req.body?.mobile,
      roleCode: req.body?.roleCode,
      callerAuth: req.auth,
    });
    res.status(201).json({ user });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.get('/organizations/:orgId/org-admins', async (req, res) => {
  try {
    const admins = await platformService.listOrgAdmins({
      organizationId: Number(req.params.orgId),
      callerAuth: req.auth,
    });
    res.json({ admins });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.post('/organizations/:orgId/org-admin', async (req, res) => {
  try {
    const user = await platformService.createOrgAdminUser({
      organizationId: Number(req.params.orgId),
      email: req.body?.email,
      fullName: req.body?.fullName,
      mobile: req.body?.mobile,
      callerAuth: req.auth,
    });
    res.status(201).json({ user });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.patch('/organizations/:orgId/org-admins/:userId', async (req, res) => {
  try {
    const user = await platformService.updateOrgAdminUser({
      organizationId: Number(req.params.orgId),
      userId: Number(req.params.userId),
      email: req.body?.email,
      fullName: req.body?.fullName,
      mobile: req.body?.mobile,
      callerAuth: req.auth,
    });
    res.json({ user });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

platformRouter.delete('/organizations/:orgId/org-admins/:userId', async (req, res) => {
  try {
    await platformService.deactivateOrgAdminUser({
      organizationId: Number(req.params.orgId),
      userId: Number(req.params.userId),
      callerAuth: req.auth,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});
