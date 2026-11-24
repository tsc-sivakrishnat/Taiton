const uiLayoutQueries = require('../queries/uiLayout.queries');

class UiLayoutService {
  /**
   * Get all available pages for UI Layout management
   */
  async getPages() {
    const pages = await uiLayoutQueries.getWebPages();
    return pages.map((p) => ({
      id: p.id,
      name: p.name,
      route: p.route,
      status: p.status,
    }));
  }

  /**
   * Get components belonging to a specific page
   */
  async getComponentsByPage(pageId) {
    const page = await uiLayoutQueries.getPageByIdOrRoute(pageId);
    if (!page) {
      throw new Error(`Page not found with identifier: ${pageId}`);
    }

    const components = await uiLayoutQueries.getComponentsByPageRouteId(page.id);
    // Exclude static components (5-pillar bar and solutions) from dynamic UI layout management
    const manageableComponents = components.filter((c) => {
      const k = String(c.component_key || c.label || '').toLowerCase();
      return !k.includes('pillar') && !k.includes('solution');
    });

    return {
      page: {
        id: page.id,
        name: page.name,
        route: page.route,
      },
      components: manageableComponents.map((c) => ({
        id: c.id,
        componentKey: c.component_key,
        name: c.label,
        pageRouteId: c.page_route_id,
        status: c.status,
      })),
    };
  }

  /**
   * Get available layouts for a component
   */
  async getComponentLayouts(componentId) {
    const component = await uiLayoutQueries.getComponentById(componentId);
    if (!component) {
      throw new Error(`Component not found with ID: ${componentId}`);
    }

    const layouts = await uiLayoutQueries.getLayoutsByComponentId(component.id);
    return {
      component: {
        id: component.id,
        componentKey: component.component_key,
        name: component.label,
      },
      layouts: layouts.map((l) => {
        let schema = {};
        try {
          schema = typeof l.schema_json === 'string' ? JSON.parse(l.schema_json) : (l.schema_json || {});
        } catch {
          schema = {};
        }
        return {
          id: l.id,
          layoutId: l.template_key,
          name: l.label,
          schema,
          status: l.status,
        };
      }),
    };
  }

  /**
   * Get configuration for a page component (draft and live)
   */
  async getComponentConfig(orgCode, pageId, componentId) {
    const cleanOrg = orgCode || 'taiton';
    const page = await uiLayoutQueries.getPageByIdOrRoute(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const component = await uiLayoutQueries.getComponentById(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    const layouts = await uiLayoutQueries.getLayoutsByComponentId(component.id);
    const { pageComponent, draftContent, liveContent } = await uiLayoutQueries.getComponentConfig(
      cleanOrg,
      page.id,
      component.id
    );

    let parsedDraftJson = null;
    let parsedLiveJson = null;

    if (draftContent && draftContent.content_json) {
      try {
        parsedDraftJson = typeof draftContent.content_json === 'string'
          ? JSON.parse(draftContent.content_json)
          : draftContent.content_json;
      } catch (e) {
        console.error('[UiLayoutService] Draft JSON parse error:', e.message);
      }
    }

    if (liveContent && liveContent.content_json) {
      try {
        parsedLiveJson = typeof liveContent.content_json === 'string'
          ? JSON.parse(liveContent.content_json)
          : liveContent.content_json;
      } catch (e) {
        console.error('[UiLayoutService] Live JSON parse error:', e.message);
      }
    }

    // Determine currently active layout
    const activeLayoutId = pageComponent?.active_template_key || (layouts.length > 0 ? layouts[0].template_key : '');

    return {
      page: {
        id: page.id,
        name: page.name,
        route: page.route,
      },
      component: {
        id: component.id,
        componentKey: component.component_key,
        name: component.label,
      },
      availableLayouts: layouts.map((l) => ({
        id: l.id,
        layoutId: l.template_key,
        name: l.label,
      })),
      activeLayoutId,
      status: pageComponent?.status || 'unconfigured',
      draftConfiguration: parsedDraftJson,
      liveConfiguration: parsedLiveJson,
      currentConfiguration: parsedDraftJson || parsedLiveJson || null,
      updatedAt: pageComponent?.updated_at || null,
    };
  }

  /**
   * Save configuration (Draft, Pending Approval, or Live)
   */
  async saveDraftConfig({ orgCode, pageId, componentId, layoutId, configuration, status = 'draft', userId }) {
    const cleanOrg = orgCode || 'taiton';
    const page = await uiLayoutQueries.getPageByIdOrRoute(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const component = await uiLayoutQueries.getComponentById(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    const template = await uiLayoutQueries.getLayoutTemplate(component.id, layoutId);
    if (!template) {
      throw new Error(`Layout/template not found: ${layoutId} for component ${component.label}`);
    }

    if (!configuration || typeof configuration !== 'object') {
      throw new Error('Configuration data must be a valid JSON object');
    }

    // If status is live, trigger direct publish workflow
    if (status === 'live') {
      return this.publishConfig({
        orgCode: cleanOrg,
        pageId,
        componentId,
        layoutId,
        configuration,
        userId,
      });
    }

    const result = await uiLayoutQueries.saveDraftConfig({
      orgCode: cleanOrg,
      pageRouteId: page.id,
      componentId: component.id,
      templateId: template.id,
      contentJson: configuration,
      status,
      userId,
      componentLabel: component.label,
    });

    const statusMsg = status === 'pending_approval'
      ? 'submitted for review and approval'
      : status === 'approved'
      ? 'approved for release'
      : 'saved as draft';

    return {
      success: true,
      status: result.status,
      message: `Component configuration ${statusMsg} successfully`,
      ...result,
    };
  }

  /**
   * Publish component configuration directly to live
   */
  async publishConfig({ orgCode, pageId, componentId, layoutId, configuration, userId }) {
    const cleanOrg = orgCode || 'taiton';
    const page = await uiLayoutQueries.getPageByIdOrRoute(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const component = await uiLayoutQueries.getComponentById(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    const template = await uiLayoutQueries.getLayoutTemplate(component.id, layoutId);
    if (!template) {
      throw new Error(`Layout/template not found: ${layoutId} for component ${component.label}`);
    }

    if (!configuration || typeof configuration !== 'object') {
      throw new Error('Configuration data must be a valid JSON object');
    }

    const result = await uiLayoutQueries.publishConfig({
      orgCode: cleanOrg,
      pageRouteId: page.id,
      componentId: component.id,
      templateId: template.id,
      contentJson: configuration,
      userId,
    });

    // Also synchronize live component, template, and content to u418448115_web_schema (target production DB for Web UI)
    try {
      const { prodPool } = require('../../resources/connection');
      if (prodPool) {
        // Ensure template exists in web_schema
        const schemaStr = template.schema_json
          ? (typeof template.schema_json === 'object' ? JSON.stringify(template.schema_json) : template.schema_json)
          : null;
        await prodPool.query(
          `INSERT INTO tb_ui_templates (id, component_id, template_key, label, schema_json, status, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE component_id = VALUES(component_id), template_key = VALUES(template_key), label = VALUES(label), schema_json = VALUES(schema_json), status = VALUES(status), synced_at = NOW()`,
          [template.id, template.component_id, template.template_key, template.label, schemaStr, template.status || 'active']
        );

        // Ensure component exists in web_schema
        await prodPool.query(
          `INSERT INTO tb_ui_components (id, component_key, label, page_route_id, status, synced_at)
           VALUES (?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE component_key = VALUES(component_key), label = VALUES(label), page_route_id = VALUES(page_route_id), status = VALUES(status), synced_at = NOW()`,
          [component.id, component.component_key, component.label, component.page_route_id, component.status || 'active']
        );

        // Update / Insert page component in web_schema
        const [existingProdPc] = await prodPool.query(
          `SELECT id FROM tb_ui_page_components WHERE org_code = ? AND page_route_id = ? AND component_id = ? LIMIT 1`,
          [cleanOrg, Number(page.id), Number(component.id)]
        );
        let prodPcId;
        if (existingProdPc.length === 0) {
          const [insPc] = await prodPool.query(
            `INSERT INTO tb_ui_page_components (id, org_code, page_route_id, component_id, active_template_id, sort_order, status, content_version, synced_at)
             VALUES (?, ?, ?, ?, ?, 0, 'live', 1, NOW())`,
            [result.pageComponentId, cleanOrg, Number(page.id), Number(component.id), Number(template.id)]
          );
          prodPcId = insPc.insertId || result.pageComponentId;
        } else {
          prodPcId = existingProdPc[0].id;
          await prodPool.query(
            `UPDATE tb_ui_page_components SET active_template_id = ?, status = 'live', synced_at = NOW() WHERE id = ?`,
            [Number(template.id), prodPcId]
          );
        }

        // Archive previous live records in web_schema
        await prodPool.query(
          `UPDATE tb_ui_component_content SET status = 'archived' WHERE page_component_id = ? AND status = 'live'`,
          [prodPcId]
        );

        // Upsert new live content in web_schema
        const jsonStr = typeof configuration === 'string' ? configuration : JSON.stringify(configuration);
        await prodPool.query(
          `INSERT INTO tb_ui_component_content (id, org_code, page_component_id, template_id, content_json, content_version, status, synced_at)
           VALUES (?, ?, ?, ?, ?, 1, 'live', NOW())
           ON DUPLICATE KEY UPDATE org_code = VALUES(org_code), page_component_id = VALUES(page_component_id), template_id = VALUES(template_id), content_json = VALUES(content_json), status = 'live', synced_at = NOW()`,
          [result.contentId, cleanOrg, prodPcId, Number(template.id), jsonStr]
        );
      }
    } catch (prodErr) {
      console.warn('[UiLayoutService] Could not sync published layout to web_schema:', prodErr.message);
    }

    return {
      success: true,
      status: 'live',
      message: 'Component configuration published successfully',
      ...result,
    };
  }

  /**
   * Get published configurations for a page (Public Web UI)
   */
  async getPublishedPageConfig(orgCode, pageSlug) {
    const cleanOrg = orgCode || 'taiton';
    const slug = pageSlug || 'home';
    const page = await uiLayoutQueries.getPageByIdOrRoute(slug);
    if (!page) {
      throw new Error(`Page not found for slug: ${slug}`);
    }

    const rows = await uiLayoutQueries.getPublishedPageConfig(cleanOrg, page.id);

    const components = {};
    for (const r of rows) {
      let parsed = null;
      try {
        parsed = typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json;
      } catch (e) {
        console.error(`[UiLayoutService] Error parsing content_json for ${r.component_key}:`, e.message);
      }

      components[r.component_key] = {
        componentId: r.component_key,
        componentKey: r.component_key,
        componentName: r.component_label,
        layoutId: r.layout_id,
        layoutName: r.layout_label,
        configuration: parsed,
        contentVersion: r.content_version,
        updatedAt: r.updated_at,
      };
    }

    return {
      page: {
        id: page.id,
        name: page.name,
        route: page.route,
      },
      components,
    };
  }
}

module.exports = new UiLayoutService();

