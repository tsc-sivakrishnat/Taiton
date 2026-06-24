import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { requireBrandingEditor } from '../middleware/requireBrandingEditor.js';
import * as brandingService from '../services/branding.service.js';
import * as brandingLogoService from '../services/brandingLogo.service.js';
import * as orgAdminService from '../services/orgAdmin.service.js';
import { pool } from '../config/db.js';

export const orgRouter = Router();

const brandingLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const t = String(file.mimetype || '').toLowerCase();
    if (t.startsWith('image/')) return cb(null, true);
    cb(new Error('File must be an image'));
  },
});

orgRouter.get('/branding', requireAuth, async (req, res) => {
  try {
    const branding = await brandingService.getBranding(req.auth.organizationId);
    res.json({ branding });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.post(
  '/branding/logo',
  requireAuth,
  requireBrandingEditor,
  (req, res, next) => {
    brandingLogoUpload.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image too large (max 2 MB).' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    });
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Missing file (field name: file).' });
      }
      const slotRaw = String(req.body?.slot ?? 'wide').toLowerCase();
      const slot = slotRaw === 'collapsed' ? 'collapsed' : 'wide';
      const branding = await brandingLogoService.saveOrgBrandingLogoFromBuffer({
        organizationId: req.auth.organizationId,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        slot,
      });
      res.json({ branding });
    } catch (e) {
      const status = e.status ?? 500;
      res.status(status).json({ error: e.message ?? 'Server error' });
    }
  },
);

orgRouter.patch('/theme', requireAuth, requireBrandingEditor, async (req, res) => {
  try {
    const branding = await brandingService.updateOrgTheme({
      organizationId: req.auth.organizationId,
      theme: req.body?.theme ?? req.body,
    });
    res.json({ branding });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.patch('/branding', requireAuth, requireBrandingEditor, async (req, res) => {
  try {
    const branding = await brandingService.updateBranding({
      organizationId: req.auth.organizationId,
      appName: req.body?.appName,
      logoUrl: req.body?.logoUrl,
      logoUrlCollapsed: req.body?.logoUrlCollapsed,
      logoProfile: req.body?.logoProfile,
    });
    res.json({ branding });
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.post('/appearance/reset', requireAuth, requireBrandingEditor, async (req, res) => {
  try {
    const branding = await brandingService.resetOrgAppearanceToDefaults(req.auth.organizationId);
    res.json({ branding });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.get('/roles', requireAuth, async (req, res) => {
  try {
    const roles = await orgAdminService.listOrgRoleOptions({
      organizationId: req.auth.organizationId,
    });
    res.json({ roles });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.get('/config', requireAuth, async (req, res) => {
  try {
    const items = await orgAdminService.listOrgConfigKeys({
      organizationId: req.auth.organizationId,
      callerRole: req.auth.role,
    });
    res.json({ items });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.put('/config/:key', requireAuth, async (req, res) => {
  try {
    const item = await orgAdminService.setOrgConfigKey({
      organizationId: req.auth.organizationId,
      configKey: req.params.key,
      configValue: req.body?.value,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.get('/navigation', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, label, route FROM tb_cpanel_nav_items
       WHERE org_id = :organizationId AND is_active = 1
       ORDER BY label ASC`,
      { organizationId: req.auth.organizationId }
    );
    const staticNavs = [
      { id: 'static-org-users', label: 'Onboarding User to Roles', route: '/app/org/users' },
      { id: 'static-org-rules', label: 'Onboarding Rules to Roles', route: '/app/org/approval-rules' },
      { id: 'static-products', label: 'Onboarding Products', route: '/app/products' },
      { id: 'static-seo', label: 'SEO Management', route: '/app/seo' },
      { id: 'static-ui', label: 'UI Elements', route: '/app/ui-elements' },
      { id: 'static-careers', label: 'Careers', route: '/app/careers' },
      { id: 'static-catalogs', label: 'Catalogs', route: '/app/catalogs' },
      { id: 'static-events', label: 'Events & achievements', route: '/app/events' },
      { id: 'static-web-responses', label: 'Web Responses', route: '/app/web-responses' },
    ];
    const combined = [...rows];
    for (const item of staticNavs) {
      if (!combined.some(r => r.route === item.route)) {
        combined.push(item);
      }
    }
    combined.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    res.json({ items: combined });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.get('/approval-rules', requireAuth, async (req, res) => {
  try {
    const rules = await orgAdminService.listApprovalRules({
      organizationId: req.auth.organizationId,
      callerRole: req.auth.role,
    });
    res.json({ rules });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.post('/approval-rules', requireAuth, async (req, res) => {
  try {
    const rule = await orgAdminService.upsertApprovalRule({
      organizationId: req.auth.organizationId,
      id: req.body?.id,
      resource: req.body?.resource,
      makerRole: req.body?.makerRole,
      checkerRole: req.body?.checkerRole,
      isActive: req.body?.isActive,
      callerAuth: req.auth,
    });
    res.json({ rule });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

orgRouter.delete('/approval-rules/:ruleId', requireAuth, async (req, res) => {
  try {
    const result = await orgAdminService.deleteApprovalRule({
      organizationId: req.auth.organizationId,
      ruleId: req.params.ruleId,
      callerAuth: req.auth,
    });
    res.json(result);
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});
