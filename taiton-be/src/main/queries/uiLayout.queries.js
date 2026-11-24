const { pool } = require('../../resources/connection');

const uiLayoutQueries = {
  /**
   * Retrieve all active public web pages
   */
  async getWebPages() {
    const [rows] = await pool.query(
      `SELECT id, page as name, route, status, created_at
       FROM tb_config_routes
       WHERE type = 'web' AND status = 'active'
       ORDER BY id ASC`
    );
    return rows;
  },

  /**
   * Retrieve page by id or slug/route
   */
  async getPageByIdOrRoute(identifier) {
    if (!identifier) return null;
    const isNum = !isNaN(identifier) && Number(identifier) > 0;
    let rows;
    if (isNum) {
      [rows] = await pool.query(
        `SELECT id, page as name, route, status FROM tb_config_routes WHERE id = ? LIMIT 1`,
        [Number(identifier)]
      );
    } else {
      const cleanSlug = String(identifier).trim().toLowerCase();
      const targetRoute = cleanSlug === 'home' || cleanSlug === 'index' ? '/' : (cleanSlug.startsWith('/') ? cleanSlug : `/${cleanSlug}`);
      [rows] = await pool.query(
        `SELECT id, page as name, route, status FROM tb_config_routes 
         WHERE (type = 'web' AND (route = ? OR LOWER(page) LIKE ?)) OR id = ? LIMIT 1`,
        [targetRoute, `%${cleanSlug}%`, isNum ? Number(identifier) : 0]
      );
    }
    return rows[0] || null;
  },

  /**
   * Retrieve all components for a specific page route
   */
  async getComponentsByPageRouteId(pageRouteId) {
    const [rows] = await pool.query(
      `SELECT id, component_key, label, page_route_id, status, created_at
       FROM tb_ui_components
       WHERE page_route_id = ? AND status = 'active'
       ORDER BY id ASC`,
      [Number(pageRouteId)]
    );
    return rows;
  },

  /**
   * Retrieve component by ID
   */
  async getComponentById(componentId) {
    const [rows] = await pool.query(
      `SELECT id, component_key, label, page_route_id, status
       FROM tb_ui_components
       WHERE id = ? LIMIT 1`,
      [Number(componentId)]
    );
    return rows[0] || null;
  },

  /**
   * Retrieve all layouts/templates for a specific component
   */
  async getLayoutsByComponentId(componentId) {
    const [rows] = await pool.query(
      `SELECT id, component_id, template_key, label, schema_json, status, created_at
       FROM tb_ui_templates
       WHERE component_id = ? AND status = 'active'
       ORDER BY id ASC`,
      [Number(componentId)]
    );
    return rows;
  },

  /**
   * Retrieve a layout template by component ID and template_key or template_id
   */
  async getLayoutTemplate(componentId, templateIdentifier) {
    if (!templateIdentifier) return null;
    const isNum = !isNaN(templateIdentifier) && Number(templateIdentifier) > 0;
    let rows;
    if (isNum) {
      [rows] = await pool.query(
        `SELECT id, component_id, template_key, label, schema_json, status FROM tb_ui_templates WHERE id = ? AND component_id = ? LIMIT 1`,
        [Number(templateIdentifier), Number(componentId)]
      );
    } else {
      [rows] = await pool.query(
        `SELECT id, component_id, template_key, label, schema_json, status FROM tb_ui_templates WHERE component_id = ? AND template_key = ? LIMIT 1`,
        [Number(componentId), String(templateIdentifier)]
      );
    }
    return rows[0] || null;
  },

  /**
   * Retrieve current configuration (both draft and live) for a page component
   */
  async getComponentConfig(orgCode, pageRouteId, componentId) {
    const [pcRows] = await pool.query(
      `SELECT pc.*, t.template_key as active_template_key, t.label as active_template_label
       FROM tb_ui_page_components pc
       LEFT JOIN tb_ui_templates t ON pc.active_template_id = t.id
       WHERE pc.org_code = ? AND pc.page_route_id = ? AND pc.component_id = ?
       LIMIT 1`,
      [orgCode, Number(pageRouteId), Number(componentId)]
    );

    const pageComponent = pcRows[0] || null;
    if (!pageComponent) {
      return {
        pageComponent: null,
        draftContent: null,
        liveContent: null,
      };
    }

    const [contentRows] = await pool.query(
      `SELECT c.*, t.template_key
       FROM tb_ui_component_content c
       LEFT JOIN tb_ui_templates t ON c.template_id = t.id
       WHERE c.page_component_id = ?
       ORDER BY c.id DESC`,
      [pageComponent.id]
    );

    const draft = contentRows.find((r) => r.status === 'draft') || null;
    const live = contentRows.find((r) => r.status === 'live') || null;

    return {
      pageComponent,
      draftContent: draft,
      liveContent: live,
    };
  },

  /**
   * Upsert component configuration as Draft or Pending Approval
   */
  async saveDraftConfig({ orgCode, pageRouteId, componentId, templateId, contentJson, status = 'draft', userId, componentLabel = '' }) {
    const targetStatus = status === 'pending_approval' ? 'pending_approval' : (status === 'approved' || status === 'ready_to_live') ? 'approved' : 'draft';

    // 1. Ensure or update tb_ui_page_components
    const [existingPc] = await pool.query(
      `SELECT id, active_template_id, status FROM tb_ui_page_components 
       WHERE org_code = ? AND page_route_id = ? AND component_id = ? LIMIT 1`,
      [orgCode, Number(pageRouteId), Number(componentId)]
    );

    let pageComponentId;
    if (existingPc.length === 0) {
      const [insPc] = await pool.query(
        `INSERT INTO tb_ui_page_components (org_code, page_route_id, component_id, active_template_id, status)
         VALUES (?, ?, ?, ?, ?)`,
        [orgCode, Number(pageRouteId), Number(componentId), Number(templateId), targetStatus]
      );
      pageComponentId = insPc.insertId;
    } else {
      pageComponentId = existingPc[0].id;
      // Do not demote an already live page component slot to draft, keep it live for the public site
      const newPcStatus = (existingPc[0].status === 'live' && targetStatus !== 'live')
        ? existingPc[0].status
        : targetStatus;
      await pool.query(
        `UPDATE tb_ui_page_components SET active_template_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(templateId), newPcStatus, pageComponentId]
      );
    }

    // 2. Check if a non-live record exists in tb_ui_component_content
    const [existingNonLive] = await pool.query(
      `SELECT id FROM tb_ui_component_content WHERE page_component_id = ? AND status IN ('draft', 'pending_approval', 'approved') LIMIT 1`,
      [pageComponentId]
    );

    const jsonString = typeof contentJson === 'string' ? contentJson : JSON.stringify(contentJson);

    let contentId;
    if (existingNonLive.length > 0) {
      contentId = existingNonLive[0].id;
      await pool.query(
        `UPDATE tb_ui_component_content 
         SET template_id = ?, content_json = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [Number(templateId), jsonString, targetStatus, userId ? Number(userId) : null, contentId]
      );
    } else {
      const [insContent] = await pool.query(
        `INSERT INTO tb_ui_component_content (org_code, page_component_id, template_id, content_json, status, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orgCode, pageComponentId, Number(templateId), jsonString, targetStatus, userId ? Number(userId) : null]
      );
      contentId = insContent.insertId;
    }

    // 3. If pending_approval, register in tb_org_approvals for Checker action
    if (targetStatus === 'pending_approval') {
      try {
        const itemTitle = `UI Layout: ${componentLabel || 'Component'} (Page #${pageRouteId})`;
        await pool.query(`
          INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
          VALUES (?, 'tb_ui_component_content', 'ui_layout', ?, ?, ?, 'Organization Admin', CONCAT('Submitted UI Layout configuration for "', ?, '" for review'), 'pending')
          ON DUPLICATE KEY UPDATE approval_status = 'pending', message = VALUES(message), actioned_at = NULL
        `, [orgCode, itemTitle, contentId, userId || 0, componentLabel || 'Component']);
      } catch (appErr) {
        console.warn('[UiLayoutQueries] Error inserting into tb_org_approvals:', appErr.message);
      }
    }

    return { pageComponentId, contentId, status: targetStatus };
  },

  /**
   * Publish component configuration to Live
   */
  async publishConfig({ orgCode, pageRouteId, componentId, templateId, contentJson, userId }) {
    // 1. Ensure or update tb_ui_page_components to live
    const [existingPc] = await pool.query(
      `SELECT id FROM tb_ui_page_components 
       WHERE org_code = ? AND page_route_id = ? AND component_id = ? LIMIT 1`,
      [orgCode, Number(pageRouteId), Number(componentId)]
    );

    let pageComponentId;
    if (existingPc.length === 0) {
      const [insPc] = await pool.query(
        `INSERT INTO tb_ui_page_components (org_code, page_route_id, component_id, active_template_id, status)
         VALUES (?, ?, ?, ?, 'live')`,
        [orgCode, Number(pageRouteId), Number(componentId), Number(templateId)]
      );
      pageComponentId = insPc.insertId;
    } else {
      pageComponentId = existingPc[0].id;
      await pool.query(
        `UPDATE tb_ui_page_components SET active_template_id = ?, status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(templateId), pageComponentId]
      );
    }

    const jsonString = typeof contentJson === 'string' ? contentJson : JSON.stringify(contentJson);

    // 2. Archive any previous live content
    await pool.query(
      `UPDATE tb_ui_component_content SET status = 'archived' WHERE page_component_id = ? AND status = 'live'`,
      [pageComponentId]
    );

    // 3. If a draft existed, update it to live, or insert new live record
    const [existingDraft] = await pool.query(
      `SELECT id FROM tb_ui_component_content WHERE page_component_id = ? AND status = 'draft' LIMIT 1`,
      [pageComponentId]
    );

    let contentId;
    if (existingDraft.length > 0) {
      contentId = existingDraft[0].id;
      await pool.query(
        `UPDATE tb_ui_component_content 
         SET template_id = ?, content_json = ?, status = 'live', updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [Number(templateId), jsonString, userId ? Number(userId) : null, contentId]
      );
    } else {
      const [insContent] = await pool.query(
        `INSERT INTO tb_ui_component_content (org_code, page_component_id, template_id, content_json, status, updated_by)
         VALUES (?, ?, ?, ?, 'live', ?)`,
        [orgCode, pageComponentId, Number(templateId), jsonString, userId ? Number(userId) : null]
      );
      contentId = insContent.insertId;
    }

    return { pageComponentId, contentId };
  },

  /**
   * Retrieve published component configurations for a page (Public Web UI)
   */
  async getPublishedPageConfig(orgCode, pageRouteId) {
    const [rows] = await pool.query(
      `SELECT 
         c.id as component_id,
         c.component_key,
         c.label as component_label,
         t.id as template_id,
         t.template_key as layout_id,
         t.label as layout_label,
         cnt.content_json,
         cnt.content_version,
         cnt.updated_at
       FROM tb_ui_components c
       JOIN tb_ui_page_components pc 
         ON c.id = pc.component_id AND pc.org_code = ? AND pc.status != 'inactive'
       JOIN tb_ui_component_content cnt 
         ON cnt.page_component_id = pc.id AND cnt.status = 'live'
       JOIN tb_ui_templates t 
         ON cnt.template_id = t.id
       WHERE c.page_route_id = ? AND c.status = 'active'
       ORDER BY pc.sort_order ASC, c.id ASC`,
      [orgCode, Number(pageRouteId)]
    );
    return rows;
  },
};

module.exports = uiLayoutQueries;

