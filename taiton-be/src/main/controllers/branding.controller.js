const { pool } = require('../../resources/connection');

class BrandingController {
  // Helper to load branding for org
  async loadBrandingForOrg(orgCode) {
    const cleanOrg = orgCode ? String(orgCode).trim() : 'taiton';
    try {
      const [rows] = await pool.execute(
        `SELECT org_code, org_name, ui_prefs FROM tb_board_organizations WHERE LOWER(org_code) = LOWER(?) LIMIT 1`,
        [cleanOrg]
      );
      if (rows.length === 0) {
        return {
          appName: cleanOrg.toUpperCase(),
          logoUrl: '',
          logoUrlCollapsed: '',
          logoProfile: 'horizontal',
          primaryColor: '#3b82f6',
        };
      }
      const org = rows[0];
      let prefs = {};
      if (org.ui_prefs) {
        try {
          prefs = typeof org.ui_prefs === 'string' ? JSON.parse(org.ui_prefs) : org.ui_prefs;
        } catch (e) {}
      }
      const branding = prefs.branding || prefs || {};
      return {
        appName: branding.appName || org.org_name || cleanOrg.toUpperCase(),
        logoUrl: branding.logoUrl || '',
        logoUrlCollapsed: branding.logoUrlCollapsed || '',
        logoProfile: branding.logoProfile || 'horizontal',
        primaryColor: branding.primaryColor || '#3b82f6',
        theme: branding.theme || null,
      };
    } catch (err) {
      console.error('[loadBrandingForOrg] Error:', err.message);
      return {
        appName: 'Taiton Hardware',
        logoUrl: '',
        logoUrlCollapsed: '',
        logoProfile: 'horizontal',
        primaryColor: '#3b82f6',
      };
    }
  }

  // GET /cpanel-api/public/branding
  async getPublicBranding(req, res) {
    try {
      const orgCode = req.query.org_code || 'taiton';
      const branding = await this.loadBrandingForOrg(orgCode);
      return res.status(200).json({ success: true, branding });
    } catch (err) {
      console.error('[BrandingController.getPublicBranding] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /cpanel-api/org/branding
  async getOrgBranding(req, res) {
    try {
      const orgCode = req.query.org_code || req.user?.org_code || 'taiton';
      const branding = await this.loadBrandingForOrg(orgCode);
      return res.status(200).json({ success: true, branding });
    } catch (err) {
      console.error('[BrandingController.getOrgBranding] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /cpanel-api/org/branding/logo
  async uploadLogo(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const orgCode = req.user?.org_code || req.query.org_code || 'taiton';
      const slot = req.body?.slot === 'collapsed' ? 'collapsed' : 'wide';
      const relativePath = `/uploads/branding/${file.filename}`;

      // Fetch existing branding
      const currentBranding = await this.loadBrandingForOrg(orgCode);
      const updatedBranding = {
        ...currentBranding,
        [slot === 'collapsed' ? 'logoUrlCollapsed' : 'logoUrl']: relativePath,
      };

      // Save to database tb_board_organizations.ui_prefs
      const [existingRows] = await pool.execute(
        `SELECT ui_prefs FROM tb_board_organizations WHERE LOWER(org_code) = LOWER(?) LIMIT 1`,
        [orgCode]
      );
      let prefs = {};
      if (existingRows.length > 0 && existingRows[0].ui_prefs) {
        try {
          prefs = typeof existingRows[0].ui_prefs === 'string' ? JSON.parse(existingRows[0].ui_prefs) : existingRows[0].ui_prefs;
        } catch (e) {}
      }
      prefs.branding = updatedBranding;

      await pool.execute(
        `UPDATE tb_board_organizations SET ui_prefs = ? WHERE LOWER(org_code) = LOWER(?)`,
        [JSON.stringify(prefs), orgCode]
      );

      return res.status(200).json({
        success: true,
        message: 'Logo uploaded successfully',
        branding: updatedBranding,
      });
    } catch (err) {
      console.error('[BrandingController.uploadLogo] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PATCH /cpanel-api/org/branding
  async updateOrgBranding(req, res) {
    try {
      const orgCode = req.user?.org_code || req.query.org_code || 'taiton';
      const { appName, logoUrl, logoUrlCollapsed, logoProfile, primaryColor, theme } = req.body || {};

      const currentBranding = await this.loadBrandingForOrg(orgCode);
      const updatedBranding = {
        ...currentBranding,
        ...(appName !== undefined && { appName: String(appName).trim() }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(logoUrlCollapsed !== undefined && { logoUrlCollapsed }),
        ...(logoProfile !== undefined && { logoProfile }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(theme !== undefined && { theme }),
      };

      const [existingRows] = await pool.execute(
        `SELECT ui_prefs FROM tb_board_organizations WHERE LOWER(org_code) = LOWER(?) LIMIT 1`,
        [orgCode]
      );
      let prefs = {};
      if (existingRows.length > 0 && existingRows[0].ui_prefs) {
        try {
          prefs = typeof existingRows[0].ui_prefs === 'string' ? JSON.parse(existingRows[0].ui_prefs) : existingRows[0].ui_prefs;
        } catch (e) {}
      }
      prefs.branding = updatedBranding;

      await pool.execute(
        `UPDATE tb_board_organizations SET ui_prefs = ? WHERE LOWER(org_code) = LOWER(?)`,
        [JSON.stringify(prefs), orgCode]
      );

      return res.status(200).json({
        success: true,
        message: 'Branding updated successfully',
        branding: updatedBranding,
      });
    } catch (err) {
      console.error('[BrandingController.updateOrgBranding] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new BrandingController();
