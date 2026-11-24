const uiLayoutService = require('../services/uiLayout.service');
const uiLayoutQueries = require('../queries/uiLayout.queries');
const { logAudit } = require('../utils/auditLogger');

function getOrgCode(req) {
  const explicit =
    req.headers?.['x-org-code'] ||
    req.query?.org_code ||
    req.query?.orgCode ||
    req.body?.org_code ||
    req.body?.orgCode;

  if (explicit) return explicit;

  const userOrg = req.user?.org_code || req.user?.orgCode;
  // If the user is a platform admin with 'techtrole', default target tenant is 'taiton'
  if (!userOrg || userOrg === 'techtrole') {
    return 'taiton';
  }
  return userOrg;
}

function getUserId(req) {
  return req.user?.id || 0;
}

class UiLayoutController {
  // GET /cpanel-api/ui-layouts/pages
  async getPages(req, res) {
    try {
      const pages = await uiLayoutService.getPages();
      return res.status(200).json({
        success: true,
        pages,
      });
    } catch (error) {
      console.error('[UiLayoutController.getPages] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve available pages',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/ui-layouts/pages/:pageId/components
  async getComponentsByPage(req, res) {
    try {
      const { pageId } = req.params;
      const data = await uiLayoutService.getComponentsByPage(pageId);
      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error('[UiLayoutController.getComponentsByPage] Error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Failed to retrieve page components',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/ui-layouts/components/:componentId/layouts
  async getComponentLayouts(req, res) {
    try {
      const { componentId } = req.params;
      const data = await uiLayoutService.getComponentLayouts(componentId);
      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error('[UiLayoutController.getComponentLayouts] Error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Failed to retrieve component layouts',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/ui-layouts/pages/:pageId/components/:componentId/config
  async getComponentConfig(req, res) {
    try {
      const { pageId, componentId } = req.params;
      const orgCode = getOrgCode(req);
      const data = await uiLayoutService.getComponentConfig(orgCode, pageId, componentId);
      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error('[UiLayoutController.getComponentConfig] Error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Failed to retrieve component configuration',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/ui-layouts/pages/:pageId/components/:componentId/config
  async saveDraft(req, res) {
    try {
      const { pageId, componentId } = req.params;
      const { layoutId, configuration, status } = req.body;
      const orgCode = getOrgCode(req);
      const userId = getUserId(req);

      if (!layoutId) {
        return res.status(400).json({
          success: false,
          message: 'layoutId is required',
        });
      }

      // Check if user explicitly wants 'draft'
      let targetStatus = status || 'save';

      if (targetStatus !== 'draft') {
        const { evaluateApprovalRuleAndStatus } = require('./content.controller');
        const page = await uiLayoutQueries.getPageByIdOrRoute(pageId);
        const comp = await uiLayoutQueries.getComponentById(componentId);
        const compTitle = `UI Layout: ${comp ? comp.label : componentId} (${page ? page.name : `Page #${pageId}`})`;

        // Evaluate if there are maker approval rules for this role on UI Layouts
        const evaluatedStatus = await evaluateApprovalRuleAndStatus({
          orgCode,
          type: 'ui_layout',
          title: compTitle,
          insertId: 0,
          tableName: 'tb_ui_component_content',
          req,
        });

        // If rule exists for maker: 'pending_approval'
        // If no rule matches (e.g. Org Admin / authorized): 'ready_to_live'
        targetStatus = evaluatedStatus || 'ready_to_live';
      }

      const result = await uiLayoutService.saveDraftConfig({
        orgCode,
        pageId,
        componentId,
        layoutId,
        configuration,
        status: targetStatus,
        userId,
      });

      // Update record_id in tb_org_approvals if one was created
      if (targetStatus === 'pending_approval' && result.contentId) {
        try {
          const { pool } = require('../../resources/connection');
          await pool.query(
            `UPDATE tb_org_approvals SET record_id = ? WHERE table_name = 'tb_ui_component_content' AND (record_id = 0 OR record_id IS NULL) AND org_code = ?`,
            [result.contentId, orgCode]
          );
        } catch (e) { }
      }

      await logAudit({
        orgCode,
        tableName: 'tb_ui_component_content',
        recordId: result.contentId,
        action: targetStatus === 'pending_approval' ? 'submit_approval' : targetStatus === 'ready_to_live' ? 'save_ready' : 'save_draft',
        maker: req.user?.fullName || req.user?.email || 'User',
        message: `${targetStatus === 'pending_approval' ? 'Submitted for approval' : targetStatus === 'ready_to_live' ? 'Saved ready for release' : 'Saved draft'} for component #${componentId} (Layout: ${layoutId}, status: ${result.status})`,
        newVal: configuration,
        createdBy: userId,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[UiLayoutController.saveDraft] Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to save component configuration',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/ui-layouts/pages/:pageId/components/:componentId/publish
  async publish(req, res) {
    try {
      const { pageId, componentId } = req.params;
      const { layoutId, configuration } = req.body;
      const orgCode = getOrgCode(req);
      const userId = getUserId(req);

      if (!layoutId) {
        return res.status(400).json({
          success: false,
          message: 'layoutId is required',
        });
      }

      const result = await uiLayoutService.publishConfig({
        orgCode,
        pageId,
        componentId,
        layoutId,
        configuration,
        userId,
      });

      await logAudit({
        orgCode,
        tableName: 'tb_ui_component_content',
        recordId: result.contentId,
        action: 'publish',
        maker: req.user?.fullName || req.user?.email || 'User',
        message: `Published configuration for component #${componentId} (Layout: ${layoutId}) to live`,
        newVal: configuration,
        createdBy: userId,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[UiLayoutController.publish] Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to publish component configuration',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/public/ui-layouts/page/:pageSlug
  // (Also accessible via /api/public/ui-layouts/page/:pageSlug)
  async getPublishedPageConfig(req, res) {
    try {
      const pageSlug = req.params.pageSlug || req.query.page || 'home';
      const orgCode = getOrgCode(req);
      const data = await uiLayoutService.getPublishedPageConfig(orgCode, pageSlug);
      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error('[UiLayoutController.getPublishedPageConfig] Error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Failed to retrieve published page configuration',
        error: error.message,
      });
    }
  }
}

module.exports = new UiLayoutController();
