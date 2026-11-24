const fs = require('fs');
const path = require('path');
const { pool, prodPool, prodDbName } = require('../../resources/connection');
const { logAudit } = require('../utils/auditLogger');

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeSqlJson(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

function ensureValidJsonOrNull(val, asArray = false) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      if (asArray) {
        return JSON.stringify(trimmed.split(',').map((s) => s.trim()).filter(Boolean));
      }
      return JSON.stringify(trimmed);
    }
  }
  if (typeof val === 'number') {
    return asArray ? JSON.stringify([val]) : String(val);
  }
  return JSON.stringify(val);
}

class ReleaseSyncService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../../../backups');
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
      } catch (e) {
        console.error('[ReleaseSyncService] Failed to create backup directory:', e.message);
      }
    }
  }

  // Fetch all items with status 'ready_to_live', 'approved', or deactivated items still live in production
  async getReadyToLiveItems(orgCode) {
    const cleanOrg = String(orgCode || '').trim();
    const isAll = !cleanOrg || cleanOrg.toLowerCase() === 'all';
    const orgWhere = isAll ? '' : 'AND org_code = ?';
    const orgWhereC = isAll ? '' : 'AND c.org_code = ?';
    const orgWhereP = isAll ? '' : 'AND p.org_code = ?';
    const orgWhereCnt = isAll ? '' : 'AND cnt.org_code = ?';
    const params = isAll ? [] : [cleanOrg];
    const syncStatuses = "('ready_to_live', 'approved', 'inactive', 'deleted', 'archived')";

    // 1. Categories
    const [categories] = await pool.query(
      `SELECT id, org_code, category as name, category as summary, 'category' as type, status, view, updated_at, content_version
       FROM tb_pdt_categories 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    // 2. Subcategories (Joined with categories on cat_id)
    const [subcategories] = await pool.query(
      `SELECT sc.id, c.org_code, sc.sub_category as name, sc.sub_category as summary, 'subcategory' as type, sc.status, sc.updated_at, sc.content_version
       FROM tb_pdt_sub_categories sc
       JOIN tb_pdt_categories c ON sc.cat_id = c.id
       WHERE sc.status IN ${syncStatuses} ${orgWhereC}`,
      params
    );

    // 3. Products
    const [products] = await pool.query(
      `SELECT id, org_code, product as name, pdt_code as summary, 'product' as type, status, updated_at, content_version
       FROM tb_pdt_products 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    // 4. Variants (Joined with products on pdt_id)
    const [variants] = await pool.query(
      `SELECT v.id, p.org_code, v.name as name, v.var_code as summary, 'variant' as type, v.status, v.updated_at, v.content_version
       FROM tb_pdt_variants v
       JOIN tb_pdt_products p ON v.pdt_id = p.id
       WHERE v.status IN ${syncStatuses} ${orgWhereP}`,
      params
    );

    // 5. Blogs
    const [blogs] = await pool.query(
      `SELECT id, org_code, title as name, description as summary, 'blog' as type, status, updated_at, content_version
       FROM tb_web_blogs 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    // 6. Careers
    const [careers] = await pool.query(
      `SELECT id, org_code, title as name, department as summary, 'career' as type, status, updated_at, content_version
       FROM tb_web_careers 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    // 7. Catalogs
    const [catalogs] = await pool.query(
      `SELECT id, org_code, name, category as summary, 'catalog' as type, status, updated_at, content_version
       FROM tb_web_catalogs 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    // 8. SEO
    const [seo] = await pool.query(
      `SELECT id, org_code, title as name, description as summary, 'seo' as type, status, updated_at, content_version
       FROM tb_web_seo 
       WHERE (status = 'ready_to_live' OR status = 'approved') ${orgWhere}`,
      params
    );

    // 9. UI Elements / Web Feed
    const [uiElements] = await pool.query(
      `SELECT id, org_code, title as name, summary, 'ui_element' as type, status, created_at as updated_at, content_version
       FROM tb_web_feed 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    // 10. UI Layout Configurations
    const [uiLayouts] = await pool.query(
      `SELECT 
         cnt.id,
         cnt.org_code,
         CONCAT(COALESCE(r.page, 'Page'), ' - ', COALESCE(c.label, 'Component')) as name,
         CONCAT('Layout: ', COALESCE(t.label, t.template_key, 'Template')) as summary,
         'ui_layout' as type,
         cnt.status,
         cnt.updated_at,
         cnt.content_version
       FROM tb_ui_component_content cnt
       JOIN tb_ui_page_components pc ON cnt.page_component_id = pc.id
       JOIN tb_ui_components c ON pc.component_id = c.id
       LEFT JOIN tb_config_routes r ON c.page_route_id = r.id
       LEFT JOIN tb_ui_templates t ON cnt.template_id = t.id
       WHERE (cnt.status = 'ready_to_live' OR cnt.status = 'approved') ${orgWhereCnt}`,
      params
    );

    // 11. Explore Spaces
    const [spaces] = await pool.query(
      `SELECT id, org_code, title as name, description as summary, 'space' as type, status, view, updated_at, content_version
       FROM tb_web_spaces 
       WHERE status IN ${syncStatuses} ${orgWhere}`,
      params
    );

    const rawList = [
      ...categories,
      ...subcategories,
      ...products,
      ...variants,
      ...blogs,
      ...careers,
      ...catalogs,
      ...seo,
      ...uiElements,
      ...uiLayouts,
      ...spaces,
    ];

    // Determine operation type (CREATE vs UPDATE vs DELETE) by checking target production DB
    const deactivatedStatuses = new Set(['inactive', 'deleted', 'archived']);
    const resolvedItems = await Promise.all(
      rawList.map(async (item) => {
        const isDeactivating = deactivatedStatuses.has(String(item.status || '').toLowerCase());
        let opType = 'CREATE';
        try {
          const targetTable = this.getTargetTableName(item.type);
          if (targetTable) {
            const hasStatusCol = targetTable !== 'tb_web_seo';
            const [existRows] = await prodPool.query(
              hasStatusCol
                ? `SELECT id, status FROM ${targetTable} WHERE id = ? LIMIT 1`
                : `SELECT id FROM ${targetTable} WHERE id = ? LIMIT 1`,
              [item.id]
            );
            if (existRows.length > 0) {
              if (isDeactivating) {
                if (String(existRows[0].status || '').toLowerCase() !== 'live') {
                  return null;
                }
                opType = 'DELETE';
              } else {
                opType = 'UPDATE';
              }
            } else if (isDeactivating) {
              return null;
            }
          }
        } catch (e) {
          if (isDeactivating) return null;
        }
        return {
          ...item,
          operationType: opType,
        };
      })
    );

    const allItems = resolvedItems.filter(Boolean);
    const byType = (t) => allItems.filter((i) => i.type === t);

    return {
      total: allItems.length,
      categories: byType('category'),
      subcategories: byType('subcategory'),
      products: byType('product'),
      variants: byType('variant'),
      blogs: byType('blog'),
      careers: byType('career'),
      catalogs: byType('catalog'),
      seo: byType('seo'),
      uiElements: byType('ui_element'),
      uiLayouts: byType('ui_layout'),
      spaces: byType('space'),
      allItems,
    };
  }

  getTargetTableName(type) {
    const map = {
      category: 'tb_pdt_categories',
      subcategory: 'tb_pdt_sub_categories',
      product: 'tb_pdt_products',
      product_info: 'tb_pdt_product_info',
      variant: 'tb_pdt_variants',
      blog: 'tb_web_blogs',
      blog_content: 'tb_web_blog_content',
      career: 'tb_web_careers',
      catalog: 'tb_web_catalogs',
      seo: 'tb_web_seo',
      ui_element: 'tb_web_feed',
      ui_layout: 'tb_ui_component_content',
      ui: 'tb_web_feed',
      feed: 'tb_web_feed',
      space: 'tb_web_spaces',
      spaces: 'tb_web_spaces',
      explore_space: 'tb_web_spaces',
    };
    return map[type] || null;
  }

  // Create snapshot backup files of taiton_cpanel data before sync
  async createSchemaBackups(orgCode) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `snapshot_${orgCode || 'all'}_${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupFileName);

    const cleanOrg = String(orgCode || '').trim();
    const isAll = !cleanOrg || cleanOrg.toLowerCase() === 'all';
    const orgWhere = isAll ? '' : 'WHERE org_code = ?';
    const orgWhereC = isAll ? '' : 'WHERE c.org_code = ?';
    const orgWhereP = isAll ? '' : 'WHERE p.org_code = ?';
    const orgWhereB = isAll ? '' : 'WHERE b.org_code = ?';
    const params = isAll ? [] : [cleanOrg];

    const tablesToDump = [
      { name: 'tb_pdt_categories', query: `SELECT * FROM tb_pdt_categories ${orgWhere}` },
      { name: 'tb_pdt_sub_categories', query: `SELECT sc.* FROM tb_pdt_sub_categories sc JOIN tb_pdt_categories c ON sc.cat_id = c.id ${orgWhereC}` },
      { name: 'tb_pdt_products', query: `SELECT * FROM tb_pdt_products ${orgWhere}` },
      { name: 'tb_pdt_product_info', query: `SELECT pi.* FROM tb_pdt_product_info pi JOIN tb_pdt_products p ON pi.pdt_id = p.id ${orgWhereP}` },
      { name: 'tb_pdt_variants', query: `SELECT v.* FROM tb_pdt_variants v JOIN tb_pdt_products p ON v.pdt_id = p.id ${orgWhereP}` },
      { name: 'tb_web_blogs', query: `SELECT * FROM tb_web_blogs ${orgWhere}` },
      { name: 'tb_web_blog_content', query: `SELECT bc.* FROM tb_web_blog_content bc JOIN tb_web_blogs b ON bc.blog_id = b.id ${orgWhereB}` },
      { name: 'tb_web_careers', query: `SELECT * FROM tb_web_careers ${orgWhere}` },
      { name: 'tb_web_catalogs', query: `SELECT * FROM tb_web_catalogs ${orgWhere}` },
      { name: 'tb_web_seo', query: `SELECT * FROM tb_web_seo ${orgWhere}` },
      { name: 'tb_web_feed', query: `SELECT * FROM tb_web_feed ${orgWhere}` },
      { name: 'tb_web_spaces', query: `SELECT * FROM tb_web_spaces ${orgWhere}` },
      { name: 'tb_web_space_hotspots', query: `SELECT h.* FROM tb_web_space_hotspots h JOIN tb_web_spaces s ON h.space_id = s.id ${isAll ? '' : 'WHERE s.org_code = ?'}` },
    ];

    const snapshotData = { orgCode: cleanOrg, timestamp, tables: {} };
    for (const item of tablesToDump) {
      try {
        const [rows] = await pool.query(item.query, params);
        snapshotData.tables[item.name] = rows;
      } catch (err) {
        snapshotData.tables[item.name] = [];
      }
    }

    try {
      fs.writeFileSync(backupPath, JSON.stringify(snapshotData, null, 2), 'utf8');
    } catch (e) {
      console.error('[ReleaseSyncService] Failed writing backup file:', e.message);
    }
    return { success: true, backupFileName, backupPath };
  }

  // Execute Go-For-Live release (Transactional Outbox Pattern & Two-Phase Publish)
  async executeGoLiveRelease({
    orgCode,
    userId = 0,
    userName = 'Organization Admin',
    releaseNote = '',
    selectedItemKeys = [],
  }) {
    const cleanOrg = String(orgCode).trim();
    const readyItems = await this.getReadyToLiveItems(cleanOrg);
    const itemMap = new Set(selectedItemKeys.map((k) => String(k).trim()));

    // 1. Generate pre-release snapshot file
    const backupResult = await this.createSchemaBackups(cleanOrg);

    // 2. Initialize Release Batch (Status: PREPARING)
    const batchUuid = generateUuid();
    const releaseVersion = `REL-${cleanOrg.toUpperCase()}-${Date.now()}`;
    const [batchRes] = await pool.execute(
      `INSERT INTO tb_cpanel_release_batches 
       (batch_uuid, org_code, release_version, status, total_items, release_note, backup_snapshot_path, created_by, created_by_name)
       VALUES (?, ?, ?, 'PREPARING', ?, ?, ?, ?, ?)`,
      [
        batchUuid,
        cleanOrg,
        releaseVersion,
        readyItems.allItems.length,
        releaseNote || `Production Release by ${userName}`,
        backupResult.backupFileName || backupResult.backupPath || '',
        userId,
        userName,
      ]
    );
    const batchId = batchRes.insertId;

    // 3. Populate Release Batch Items & Transition to SYNCING
    await pool.execute(`UPDATE tb_cpanel_release_batches SET status = 'SYNCING' WHERE id = ?`, [batchId]);

    let syncedCount = 0;
    const syncedBreakdown = {
      category: 0,
      subcategory: 0,
      product: 0,
      variant: 0,
      blog: 0,
      career: 0,
      catalog: 0,
      seo: 0,
      ui_element: 0,
      ui_layout: 0,
      space: 0,
    };

    // 4. Safe Atomic Sync into Target Production DB (web_schema) + Undo Log Capture
    try {
      for (const item of readyItems.allItems) {
        const key = `${item.type}:${item.id}`;
        const isSelected = selectedItemKeys.length === 0 || itemMap.has(key) || itemMap.has(String(item.id));

        if (!isSelected) continue;

        const tableName = this.getTargetTableName(item.type);
        if (!tableName) continue;

        // Fetch full source row from taiton_cpanel
        const [sourceRows] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [item.id]);
        if (sourceRows.length === 0) continue;
        const sourceRow = sourceRows[0];

        // Capture previous state in target web_schema (Undo Log)
        let previousState = null;
        let operationType = 'CREATE';
        try {
          const [prodRows] = await prodPool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [item.id]);
          if (prodRows.length > 0) {
            previousState = JSON.stringify(prodRows[0]);
            operationType = 'UPDATE';
          }
        } catch (pErr) { }

        // Record into sync_revert_logs
        await pool.execute(
          `INSERT INTO sync_revert_logs (batch_id, table_name, record_id, previous_state, previous_status, previous_is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [batchId, tableName, item.id, previousState, sourceRow.status || 'ready_to_live']
        );

        // Record in release_batch_items
        const isDeactivatingItem = ['inactive', 'deleted', 'archived'].includes(String(sourceRow.status || '').toLowerCase());
        const batchOpType = isDeactivatingItem ? 'DELETE' : operationType;
        await pool.execute(
          `INSERT INTO tb_cpanel_release_batch_items 
           (batch_id, content_type, table_name, record_id, title, operation_type, source_version, payload_json, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            batchId,
            item.type,
            tableName,
            item.id,
            item.name || item.title || `${item.type} #${item.id}`,
            batchOpType,
            sourceRow.content_version || 1,
            JSON.stringify(sourceRow),
          ]
        );

        // Upsert into target web_schema (throws immediately if query/constraint fails)
        await this.upsertToProduction(item.type, tableName, sourceRow, cleanOrg);

        // Preserve deactivated statuses in cPanel so inactive/deleted records remain marked inactive
        if (!isDeactivatingItem) {
          await pool.execute(
            `UPDATE ${tableName} SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [item.id]
          );
        }

        // Mark batch item as applied
        await pool.execute(
          `UPDATE tb_cpanel_release_batch_items SET status = 'applied' WHERE batch_id = ? AND record_id = ? AND table_name = ?`,
          [batchId, item.id, tableName]
        );

        syncedCount++;
        if (syncedBreakdown[item.type] !== undefined) {
          syncedBreakdown[item.type]++;
        }
      }

      // 5. Finalize Batch as COMMITTED
      await pool.execute(
        `UPDATE tb_cpanel_release_batches 
         SET status = 'COMMITTED', total_items = ?, synced_breakdown = ?, committed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [syncedCount, JSON.stringify(syncedBreakdown), batchId]
      );

      // Also update legacy table for backward compatibility
      try {
        await pool.execute(
          `INSERT INTO tb_sync_releases (org_code, release_version, released_by, released_by_name, synced_counts, backup_snapshot_path, status)
           VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
          [cleanOrg, releaseVersion, userId, userName, JSON.stringify(syncedBreakdown), backupResult.backupFileName || '']
        );
      } catch (e) { }

      // 6. Record Audit Trail
      await logAudit({
        orgCode: cleanOrg,
        tableName: 'tb_cpanel_release_batches',
        recordId: batchId,
        action: 'approval',
        maker: userName,
        message: `Executed Production Website Release ${releaseVersion} (${syncedCount} items published live)`,
        createdBy: userId,
        newVal: { batchUuid, releaseVersion, syncedBreakdown, totalItems: syncedCount },
      });

      return {
        success: true,
        batchId,
        batchUuid,
        releaseVersion,
        syncedCount,
        syncedBreakdown,
        backupFile: backupResult.backupFileName,
      };
    } catch (syncErr) {
      console.error(`[ReleaseSyncService] Go Live submission failed on batch #${batchId}:`, syncErr.message);

      // AUTOMATIC ROLLBACK: Revert any items that were modified during this failed batch
      try {
        await prodPool.query('SET FOREIGN_KEY_CHECKS = 0');
      } catch (e) { }

      try {
        const [partialLogs] = await pool.execute(
          `SELECT * FROM sync_revert_logs WHERE batch_id = ? ORDER BY id DESC`,
          [batchId]
        );

        for (const log of partialLogs) {
          try {
            if (!log.previous_state) {
              // Delete newly inserted row from web_schema
              await prodPool.query(`DELETE FROM ${log.table_name} WHERE id = ?`, [log.record_id]);
              if (log.table_name === 'tb_pdt_products') {
                await prodPool.query(`DELETE FROM tb_pdt_product_info WHERE pdt_id = ?`, [log.record_id]);
              } else if (log.table_name === 'tb_web_blogs') {
                await prodPool.query(`DELETE FROM tb_web_blog_content WHERE blog_id = ?`, [log.record_id]);
              } else if (log.table_name === 'tb_web_spaces') {
                await prodPool.query(`DELETE FROM tb_web_space_hotspots WHERE space_id = ?`, [log.record_id]);
              } else if (log.table_name === 'tb_ui_component_content') {
                // Restore previous archived content in web_schema if available
                try {
                  const [cntRows] = await pool.query('SELECT page_component_id FROM tb_ui_component_content WHERE id = ?', [log.record_id]);
                  if (cntRows.length > 0) {
                    await prodPool.query(
                      `UPDATE tb_ui_component_content SET status = 'live', synced_at = CURRENT_TIMESTAMP 
                       WHERE page_component_id = ? AND status = 'archived' ORDER BY id DESC LIMIT 1`,
                      [cntRows[0].page_component_id]
                    );
                  }
                } catch (e) {
                  console.warn('[ReleaseSyncService] Error restoring previous web_schema UI layout content:', e.message);
                }
              }
            } else {
              // Restore previous snapshot state into web_schema
              const prev = typeof log.previous_state === 'string' ? JSON.parse(log.previous_state) : log.previous_state;
              await this.restorePreviousState(log.table_name, log.record_id, prev);
            }

            // Determine correct revert status for cPanel table
            let revertStatus = log.previous_status || 'ready_to_live';
            if (log.table_name === 'tb_ui_component_content' || log.table_name === 'tb_ui_page_components') {
              revertStatus = (revertStatus === 'ready_to_live' || !revertStatus) ? 'approved' : revertStatus;
            } else if (log.table_name === 'tb_board_users') {
              revertStatus = 'active';
            }

            // Reset status in taiton_cpanel back to revertStatus
            await pool.execute(
              `UPDATE ${log.table_name} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [revertStatus, log.record_id]
            );

            if (log.table_name === 'tb_ui_component_content') {
              try {
                const [cntRows] = await pool.query('SELECT page_component_id FROM tb_ui_component_content WHERE id = ?', [log.record_id]);
                if (cntRows.length > 0) {
                  const pcId = cntRows[0].page_component_id;
                  const [liveOther] = await pool.query("SELECT id FROM tb_ui_component_content WHERE page_component_id = ? AND status = 'live' AND id != ?", [pcId, log.record_id]);
                  const pcStatus = liveOther.length > 0 ? 'live' : 'approved';
                  await pool.execute(
                    `UPDATE tb_ui_page_components SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [pcStatus, pcId]
                  );
                }
              } catch (pcErr) {
                console.warn('[ReleaseSyncService] Error reverting tb_ui_page_components status:', pcErr.message);
              }
            }
          } catch (rErr) {
            console.error(`[ReleaseSyncService] Rollback error for ${log.table_name} #${log.record_id}:`, rErr.message);
          }
        }
      } catch (revertErr) {
        console.error('[ReleaseSyncService] Critical error during partial rollback:', revertErr.message);
      }

      try {
        await prodPool.query('SET FOREIGN_KEY_CHECKS = 1');
      } catch (e) { }

      // Mark batch as FAILED
      await pool.execute(
        `UPDATE tb_cpanel_release_batches 
         SET status = 'FAILED', release_note = ? 
         WHERE id = ?`,
        [`Failed: ${syncErr.message}`, batchId]
      );

      // Record Audit Log for failure
      try {
        await logAudit({
          orgCode: cleanOrg,
          tableName: 'tb_cpanel_release_batches',
          recordId: batchId,
          action: 'rejection',
          maker: userName,
          message: `Production Website Release FAILED: ${syncErr.message}`,
          createdBy: userId,
          newVal: { batchUuid, releaseVersion, error: syncErr.message },
        });
      } catch (aErr) { }

      // Stop entire submission and throw failure error
      throw new Error(`Go to Live is failed: ${syncErr.message || 'Database release error.'}`);
    }
  }

  async ensureCategoryInProduction(catId, orgCode) {
    if (!catId) return;
    try {
      const [exists] = await prodPool.query(`SELECT id FROM tb_pdt_categories WHERE id = ?`, [catId]);
      if (exists.length === 0) {
        const [sourceRows] = await pool.query(`SELECT * FROM tb_pdt_categories WHERE id = ?`, [catId]);
        if (sourceRows.length > 0) {
          const row = sourceRows[0];
          await this.upsertToProduction('category', 'tb_pdt_categories', row, row.org_code || orgCode);
        }
      }
    } catch (e) { }
  }

  async ensureSubcategoryInProduction(subId, orgCode) {
    if (!subId) return;
    try {
      const [exists] = await prodPool.query(`SELECT id FROM tb_pdt_sub_categories WHERE id = ?`, [subId]);
      if (exists.length === 0) {
        const [sourceRows] = await pool.query(`SELECT * FROM tb_pdt_sub_categories WHERE id = ?`, [subId]);
        if (sourceRows.length > 0) {
          const row = sourceRows[0];
          if (row.cat_id) {
            await this.ensureCategoryInProduction(row.cat_id, orgCode);
          }
          await this.upsertToProduction('subcategory', 'tb_pdt_sub_categories', row, orgCode);
        }
      }
    } catch (e) { }
  }

  async ensureProductInProduction(pdtId, orgCode) {
    if (!pdtId) return;
    try {
      const [exists] = await prodPool.query(`SELECT id FROM tb_pdt_products WHERE id = ?`, [pdtId]);
      if (exists.length === 0) {
        const [sourceRows] = await pool.query(`SELECT * FROM tb_pdt_products WHERE id = ?`, [pdtId]);
        if (sourceRows.length > 0) {
          const row = sourceRows[0];
          await this.upsertToProduction('product', 'tb_pdt_products', row, row.org_code || orgCode);
        }
      }
    } catch (e) { }
  }

  // Upsert a record safely and idempotently into web_schema
  async upsertToProduction(type, tableName, row, orgCode) {
    try {
      try {
        await prodPool.query('SET FOREIGN_KEY_CHECKS = 0');
      } catch (e) { }

      const recordOrg = row.org_code || orgCode;
      const rowStatus = String(row.status || '').toLowerCase();
      const isDeactivated = rowStatus === 'inactive' || rowStatus === 'deleted' || rowStatus === 'archived';
      const isHidden = String(row.view || '').toLowerCase() === 'hide';
      const prodStatus = (isDeactivated || isHidden) ? 'archived' : 'live';
      const spaceProdStatus = isDeactivated ? 'archived' : 'live';

      if (tableName === 'tb_pdt_categories') {
        const catType = (row.type === 'sub category' || row.type === 'sc') ? 'sc' : (row.type === 'sub sub category' || row.type === 's2c') ? 's2c' : 'cat';
        const catDesc = row.description !== undefined && row.description !== null ? String(row.description) : null;

        await prodPool.query(
          `INSERT INTO tb_pdt_categories (id, org_code, type, parent_id, category, description, img, banner_img, catalog_id, url_slug, sort_order, status, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             org_code = VALUES(org_code),
             type = VALUES(type),
             parent_id = VALUES(parent_id),
             category = VALUES(category),
             description = VALUES(description),
             img = VALUES(img),
             banner_img = VALUES(banner_img),
             catalog_id = VALUES(catalog_id),
             url_slug = VALUES(url_slug),
             sort_order = VALUES(sort_order),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [row.id, recordOrg, catType, row.parent_id || 0, row.category, catDesc, row.img || null, row.banner_img || null, row.catalog_id || null, row.url_slug || null, row.sort_order || row.id, prodStatus, row.content_version || 1]
        );
      } else if (tableName === 'tb_pdt_sub_categories') {
        if (row.cat_id) {
          await this.ensureCategoryInProduction(row.cat_id, orgCode);
        }

        await prodPool.query(
          `INSERT INTO tb_pdt_sub_categories (id, cat_id, sub_category, img, status, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             cat_id = VALUES(cat_id),
             sub_category = VALUES(sub_category),
             img = VALUES(img),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [row.id, row.cat_id, row.sub_category, row.img || null, prodStatus, row.content_version || 1]
        );
      } else if (tableName === 'tb_pdt_products') {
        if (row.parent_id) {
          await this.ensureCategoryInProduction(row.parent_id, orgCode);
        }
        if (row.sub_id) {
          await this.ensureSubcategoryInProduction(row.sub_id, orgCode);
        }

        await prodPool.query(
          `INSERT INTO tb_pdt_products (id, org_code, parent_id, sub_id, pdt_code, product, primary_img, brand, default_colour, colours, url_slug, sort_order, status, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             org_code = VALUES(org_code),
             parent_id = VALUES(parent_id),
             sub_id = VALUES(sub_id),
             pdt_code = VALUES(pdt_code),
             product = VALUES(product),
             primary_img = VALUES(primary_img),
             brand = VALUES(brand),
             default_colour = VALUES(default_colour),
             colours = VALUES(colours),
             url_slug = VALUES(url_slug),
             sort_order = VALUES(sort_order),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [
            row.id,
            orgCode,
            row.parent_id || 0,
            row.sub_id || null,
            row.pdt_code,
            row.product,
            safeSqlJson(row.primary_img),
            row.brand || null,
            row.default_colour || null,
            safeSqlJson(row.colours),
            row.url_slug || null,
            row.sort_order || row.id,
            prodStatus,
            row.content_version || 1,
          ]
        );

        // Also sync product info if exists
        const [infoRows] = await pool.query(`SELECT * FROM tb_pdt_product_info WHERE pdt_id = ?`, [row.id]);
        if (infoRows.length > 0) {
          const info = infoRows[0];
          await prodPool.query(
            `INSERT INTO tb_pdt_product_info (id, pdt_id, \`desc\`, price, features, specs, addl_features, pdt_imgs, acces, variants, accs, related_pdts, brand, default_colour, colours, kits, content_version, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE 
               \`desc\` = VALUES(\`desc\`),
               price = VALUES(price),
               features = VALUES(features),
               specs = VALUES(specs),
               addl_features = VALUES(addl_features),
               pdt_imgs = VALUES(pdt_imgs),
               acces = VALUES(acces),
               variants = VALUES(variants),
               accs = VALUES(accs),
               related_pdts = VALUES(related_pdts),
               brand = VALUES(brand),
               default_colour = VALUES(default_colour),
               colours = VALUES(colours),
               kits = VALUES(kits),
               content_version = VALUES(content_version),
               synced_at = CURRENT_TIMESTAMP`,
            [
              info.id,
              info.pdt_id,
              info.desc || null,
              info.price || 0,
              ensureValidJsonOrNull(info.features),
              ensureValidJsonOrNull(info.specs),
              ensureValidJsonOrNull(info.addl_features),
              ensureValidJsonOrNull(info.pdt_imgs, true),
              info.acces || null,
              ensureValidJsonOrNull(info.variants, true),
              ensureValidJsonOrNull(info.accs || info.acces, true),
              ensureValidJsonOrNull(info.related_pdts, true),
              info.brand || row.brand || null,
              info.default_colour || row.default_colour || null,
              safeSqlJson(info.colours || row.colours),
              safeSqlJson(info.kits),
              info.content_version || 1,
            ]
          );
        }
      } else if (tableName === 'tb_pdt_variants') {
        if (row.pdt_id) {
          await this.ensureProductInProduction(row.pdt_id, orgCode);
        }

        await prodPool.query(
          `INSERT INTO tb_pdt_variants (id, pdt_id, var_code, name, colour, price, discount, sku, primary_img, imgs, url_slug, sort_order, status, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             pdt_id = VALUES(pdt_id),
             var_code = VALUES(var_code),
             name = VALUES(name),
             colour = VALUES(colour),
             price = VALUES(price),
             discount = VALUES(discount),
             sku = VALUES(sku),
             primary_img = VALUES(primary_img),
             imgs = VALUES(imgs),
             url_slug = VALUES(url_slug),
             sort_order = VALUES(sort_order),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [
            row.id,
            row.pdt_id,
            row.var_code,
            row.name,
            row.colour || null,
            row.price || 0,
            row.discount || 0,
            row.sku || '',
            safeSqlJson(row.primary_img),
            safeSqlJson(row.imgs),
            row.url_slug || null,
            row.sort_order || row.id,
            prodStatus,
            row.content_version || 1,
          ]
        );
      } else if (tableName === 'tb_web_blogs') {
        await prodPool.query(
          `INSERT INTO tb_web_blogs (id, org_code, highlighter, title, description, written_by, status, content_version, created_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             highlighter = VALUES(highlighter),
             title = VALUES(title),
             description = VALUES(description),
             written_by = VALUES(written_by),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [row.id, orgCode, row.highlighter || null, row.title, row.description || null, row.written_by || null, prodStatus, row.content_version || 1, row.created_at || new Date()]
        );

        // Also sync blog content if exists
        const [bcRows] = await pool.query(`SELECT * FROM tb_web_blog_content WHERE blog_id = ?`, [row.id]);
        if (bcRows.length > 0) {
          const bc = bcRows[0];
          await prodPool.query(
            `INSERT INTO tb_web_blog_content (id, blog_id, primary_image, post_content, related_links, related_posts, content_version, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE 
               primary_image = VALUES(primary_image),
               post_content = VALUES(post_content),
               related_links = VALUES(related_links),
               related_posts = VALUES(related_posts),
               content_version = VALUES(content_version),
               synced_at = CURRENT_TIMESTAMP`,
            [
              bc.id,
              bc.blog_id,
              safeSqlJson(bc.primary_image),
              safeSqlJson(bc.post_content),
              safeSqlJson(bc.related_links),
              safeSqlJson(bc.related_posts),
              bc.content_version || 1,
            ]
          );
        }
      } else if (tableName === 'tb_web_careers') {
        await prodPool.query(
          `INSERT INTO tb_web_careers (id, org_code, title, department, location, employment_type, description, requirements, apply_link, status, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             title = VALUES(title),
             department = VALUES(department),
             location = VALUES(location),
             employment_type = VALUES(employment_type),
             description = VALUES(description),
             requirements = VALUES(requirements),
             apply_link = VALUES(apply_link),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [
            row.id,
            orgCode,
            row.title,
            row.department || null,
            row.location || null,
            row.employment_type || null,
            safeSqlJson(row.description),
            safeSqlJson(row.requirements),
            row.apply_link || null,
            prodStatus,
            row.content_version || 1,
          ]
        );
      } else if (tableName === 'tb_web_catalogs') {
        await prodPool.query(
          `INSERT INTO tb_web_catalogs (id, org_code, name, category, file_url, thumbnail_img, publish_year, product_page_thumbnail, page_name, image_1, image_2, page_groups, status, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name),
             category = VALUES(category),
             file_url = VALUES(file_url),
             thumbnail_img = VALUES(thumbnail_img),
             publish_year = VALUES(publish_year),
             product_page_thumbnail = VALUES(product_page_thumbnail),
             page_name = VALUES(page_name),
             image_1 = VALUES(image_1),
             image_2 = VALUES(image_2),
             page_groups = VALUES(page_groups),
             status = VALUES(status),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [
            row.id,
            orgCode,
            row.name,
            row.category || null,
            row.file_url,
            safeSqlJson(row.thumbnail_img),
            row.publish_year || null,
            safeSqlJson(row.product_page_thumbnail),
            row.page_name || null,
            safeSqlJson(row.image_1),
            safeSqlJson(row.image_2),
            safeSqlJson(row.page_groups),
            prodStatus,
            row.content_version || 1,
          ]
        );
      } else if (tableName === 'tb_web_seo') {
        await prodPool.query(
          `INSERT INTO tb_web_seo (id, org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, content_version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             title = VALUES(title),
             description = VALUES(description),
             focus_keywords = VALUES(focus_keywords),
             keywords = VALUES(keywords),
             img = VALUES(img),
             img_alt = VALUES(img_alt),
             related_products = VALUES(related_products),
             content_version = VALUES(content_version),
             synced_at = CURRENT_TIMESTAMP`,
          [
            row.id,
            orgCode,
            row.route_id || 1,
            row.route_ext || null,
            row.title,
            safeSqlJson(row.description),
            safeSqlJson(row.focus_keywords),
            safeSqlJson(row.keywords),
            safeSqlJson(row.img),
            row.img_alt || null,
            safeSqlJson(row.related_products),
            row.content_version || 1,
          ]
        );
      } else if (tableName === 'tb_web_feed') {
        await prodPool.query(
          `INSERT INTO tb_web_feed (id, org_code, feed_type, ref_table, ref_id, title, summary, img, status, content_version, created_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             feed_type = VALUES(feed_type),
             ref_table = VALUES(ref_table),
             ref_id = VALUES(ref_id),
             title = VALUES(title),
             summary = VALUES(summary),
             img = VALUES(img),
             status = VALUES(status),
             content_version = VALUES(content_version),
             published_at = CURRENT_TIMESTAMP`,
          [row.id, orgCode, row.feed_type || 'announcement', row.ref_table || 'tb_ui_element', row.ref_id || 0, row.title, safeSqlJson(row.summary), safeSqlJson(row.img), prodStatus, row.content_version || 1, row.created_at || new Date()]
        );
      } else if (tableName === 'tb_ui_component_content' || type === 'ui_layout') {
        const [contentRows] = await pool.query(
          `SELECT cnt.*, pc.page_route_id, pc.component_id, pc.active_template_id, c.component_key, c.label as comp_label, t.template_key, t.label as tmpl_label, t.schema_json
           FROM tb_ui_component_content cnt
           JOIN tb_ui_page_components pc ON cnt.page_component_id = pc.id
           JOIN tb_ui_components c ON pc.component_id = c.id
           LEFT JOIN tb_ui_templates t ON cnt.template_id = t.id
           WHERE cnt.id = ?`,
          [row.id]
        );

        if (contentRows.length > 0) {
          const item = contentRows[0];
          const schemaStr = item.schema_json ? (typeof item.schema_json === 'object' ? JSON.stringify(item.schema_json) : item.schema_json) : null;
          await prodPool.query(
            `INSERT INTO tb_ui_templates (id, component_id, template_key, label, schema_json, status, synced_at)
             VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE component_id = VALUES(component_id), template_key = VALUES(template_key), label = VALUES(label), schema_json = VALUES(schema_json), synced_at = CURRENT_TIMESTAMP`,
            [item.template_id, item.component_id, item.template_key, item.tmpl_label, schemaStr]
          );

          await prodPool.query(
            `INSERT INTO tb_ui_components (id, component_key, label, page_route_id, status, synced_at)
             VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE component_key = VALUES(component_key), label = VALUES(label), page_route_id = VALUES(page_route_id), synced_at = CURRENT_TIMESTAMP`,
            [item.component_id, item.component_key, item.comp_label, item.page_route_id]
          );

          const [existPc] = await prodPool.query(
            `SELECT id FROM tb_ui_page_components WHERE org_code = ? AND page_route_id = ? AND component_id = ? LIMIT 1`,
            [recordOrg, item.page_route_id, item.component_id]
          );
          let prodPcId;
          if (existPc.length === 0) {
            const [insPc] = await prodPool.query(
              `INSERT INTO tb_ui_page_components (id, org_code, page_route_id, component_id, active_template_id, sort_order, status, content_version, synced_at)
               VALUES (?, ?, ?, ?, ?, 0, 'live', ?, CURRENT_TIMESTAMP)`,
              [item.page_component_id, recordOrg, item.page_route_id, item.component_id, item.template_id, item.content_version || 1]
            );
            prodPcId = insPc.insertId || item.page_component_id;
          } else {
            prodPcId = existPc[0].id;
            await prodPool.query(
              `UPDATE tb_ui_page_components SET active_template_id = ?, status = 'live', synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [item.template_id, prodPcId]
            );
          }

          await prodPool.query(
            `UPDATE tb_ui_component_content SET status = 'archived' WHERE page_component_id = ? AND status = 'live'`,
            [prodPcId]
          );

          const contentStr = typeof item.content_json === 'object' ? JSON.stringify(item.content_json) : item.content_json;
          await prodPool.query(
            `INSERT INTO tb_ui_component_content (id, org_code, page_component_id, template_id, content_json, content_version, status, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, 'live', CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE org_code = VALUES(org_code), page_component_id = VALUES(page_component_id), template_id = VALUES(template_id), content_json = VALUES(content_json), status = 'live', synced_at = CURRENT_TIMESTAMP`,
            [item.id, recordOrg, prodPcId, item.template_id, contentStr, item.content_version || 1]
          );

          await pool.query(
            `UPDATE tb_ui_component_content SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [item.id]
          );
          await pool.query(
            `UPDATE tb_ui_page_components SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [item.page_component_id]
          );
        }
      } else if (tableName === 'tb_web_spaces' || type === 'space' || type === 'spaces' || type === 'explore_space') {
        await prodPool.query(
          `INSERT INTO tb_web_spaces (id, org_code, title, description, image_url, status, view, sort_order, content_version, created_by, created_by_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE 
             org_code = VALUES(org_code),
             title = VALUES(title),
             description = VALUES(description),
             image_url = VALUES(image_url),
             status = VALUES(status),
             view = VALUES(view),
             sort_order = VALUES(sort_order),
             content_version = VALUES(content_version),
             created_by = VALUES(created_by),
             created_by_name = VALUES(created_by_name),
             updated_at = CURRENT_TIMESTAMP`,
          [
            row.id,
            recordOrg,
            row.title,
            safeSqlJson(row.description),
            row.image_url,
            spaceProdStatus,
            row.view || 'view',
            row.sort_order || 0,
            row.content_version || 1,
            row.created_by || 0,
            row.created_by_name || null,
            row.created_at || new Date(),
          ]
        );

        // Also sync all hotspots for this space
        const [sourceHotspots] = await pool.query(
          `SELECT * FROM tb_web_space_hotspots WHERE space_id = ?`,
          [row.id]
        );

        await prodPool.query(`DELETE FROM tb_web_space_hotspots WHERE space_id = ?`, [row.id]);
        for (const h of sourceHotspots) {
          await prodPool.query(
            `INSERT INTO tb_web_space_hotspots (id, space_id, product_id, product_code, x_pos, y_pos, label, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              h.id,
              h.space_id,
              h.product_id || null,
              h.product_code || null,
              h.x_pos || 0,
              h.y_pos || 0,
              h.label || null,
              h.sort_order || 0,
              h.created_at || new Date(),
            ]
          );
        }
      }
    } catch (upsertErr) {
      console.error(`[ReleaseSyncService.upsertToProduction] Failed upserting to ${tableName}:`, upsertErr.message);
      throw upsertErr;
    }
  }

  // Rollback the last release for an organization (Point-in-Time Undo Log Recovery)
  async rollbackLastRelease({ orgCode, userId = 0, userName = 'Organization Admin', batchId = null }) {
    const cleanOrg = String(orgCode || '').trim();

    let targetBatch = null;
    if (batchId) {
      const [bRows] = await pool.query(`SELECT * FROM tb_cpanel_release_batches WHERE id = ?`, [batchId]);
      if (bRows.length > 0) targetBatch = bRows[0];
    }

    if (!targetBatch) {
      const isAll = !cleanOrg || cleanOrg.toLowerCase() === 'all';
      const query = isAll
        ? `SELECT * FROM tb_cpanel_release_batches WHERE status = 'COMMITTED' ORDER BY id DESC LIMIT 1`
        : `SELECT * FROM tb_cpanel_release_batches WHERE org_code = ? AND status = 'COMMITTED' ORDER BY id DESC LIMIT 1`;
      const params = isAll ? [] : [cleanOrg];
      const [rows] = await pool.query(query, params);
      if (rows.length > 0) targetBatch = rows[0];
    }

    if (!targetBatch) {
      throw new Error('No committed releases found to revert');
    }

    // 1. Mark batch as REVERTING
    await pool.execute(`UPDATE tb_cpanel_release_batches SET status = 'REVERTING' WHERE id = ?`, [targetBatch.id]);

    // 2. Fetch Undo Logs for this batch in reverse order (LIFO)
    const [undoLogs] = await pool.execute(
      `SELECT * FROM sync_revert_logs WHERE batch_id = ? ORDER BY id DESC`,
      [targetBatch.id]
    );

    let restoredCount = 0;
    const revertedActions = [];

    try {
      try {
        await prodPool.query('SET FOREIGN_KEY_CHECKS = 0');
      } catch (e) { }

      for (const log of undoLogs) {
        if (!log.previous_state) {
          // Record was newly inserted/created during Go Live -> DELETE from web_schema
          await prodPool.query(`DELETE FROM ${log.table_name} WHERE id = ?`, [log.record_id]);
          if (log.table_name === 'tb_pdt_products') {
            await prodPool.query(`DELETE FROM tb_pdt_product_info WHERE pdt_id = ?`, [log.record_id]);
          } else if (log.table_name === 'tb_web_blogs') {
            await prodPool.query(`DELETE FROM tb_web_blog_content WHERE blog_id = ?`, [log.record_id]);
          } else if (log.table_name === 'tb_web_spaces') {
            await prodPool.query(`DELETE FROM tb_web_space_hotspots WHERE space_id = ?`, [log.record_id]);
          } else if (log.table_name === 'tb_ui_component_content') {
            // Restore previous archived content in web_schema if available
            try {
              const [cntRows] = await pool.query('SELECT page_component_id FROM tb_ui_component_content WHERE id = ?', [log.record_id]);
              if (cntRows.length > 0) {
                await prodPool.query(
                  `UPDATE tb_ui_component_content SET status = 'live', synced_at = CURRENT_TIMESTAMP 
                   WHERE page_component_id = ? AND status = 'archived' ORDER BY id DESC LIMIT 1`,
                  [cntRows[0].page_component_id]
                );
              }
            } catch (e) {
              console.warn('[ReleaseSyncService] Error restoring previous web_schema UI layout content:', e.message);
            }
          }
        } else {
          // Record was updated during Go Live -> RESTORE all previous field values in web_schema
          const prev = typeof log.previous_state === 'string' ? JSON.parse(log.previous_state) : log.previous_state;
          await this.restorePreviousState(log.table_name, log.record_id, prev);
        }

        // Determine correct revert status for cPanel table
        let revertStatus = log.previous_status || 'ready_to_live';
        if (log.table_name === 'tb_ui_component_content' || log.table_name === 'tb_ui_page_components') {
          revertStatus = (revertStatus === 'ready_to_live' || !revertStatus) ? 'approved' : revertStatus;
        } else if (log.table_name === 'tb_board_users') {
          revertStatus = 'active';
        }

        // Reset status in taiton_cpanel back to revertStatus
        await pool.execute(
          `UPDATE ${log.table_name} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [revertStatus, log.record_id]
        );

        if (log.table_name === 'tb_ui_component_content') {
          try {
            const [cntRows] = await pool.query('SELECT page_component_id FROM tb_ui_component_content WHERE id = ?', [log.record_id]);
            if (cntRows.length > 0) {
              const pcId = cntRows[0].page_component_id;
              const [liveOther] = await pool.query("SELECT id FROM tb_ui_component_content WHERE page_component_id = ? AND status = 'live' AND id != ?", [pcId, log.record_id]);
              const pcStatus = liveOther.length > 0 ? 'live' : 'approved';
              await pool.execute(
                `UPDATE tb_ui_page_components SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [pcStatus, pcId]
              );
            }
          } catch (pcErr) {
            console.warn('[ReleaseSyncService] Error reverting tb_ui_page_components status:', pcErr.message);
          }
        }

        revertedActions.push(log);
        restoredCount++;
      }

      try {
        await prodPool.query('SET FOREIGN_KEY_CHECKS = 1');
      } catch (e) { }

      // 3. Mark batch as REVERTED
      await pool.execute(
        `UPDATE tb_cpanel_release_batches 
         SET status = 'REVERTED', reverted_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [targetBatch.id]
      );

      // Also update legacy table
      try {
        await pool.execute(
          `UPDATE tb_sync_releases SET status = 'reverted' WHERE release_version = ?`,
          [targetBatch.release_version]
        );
      } catch (e) { }

      // 4. Record Audit Log
      await logAudit({
        orgCode: cleanOrg,
        tableName: 'tb_cpanel_release_batches',
        recordId: targetBatch.id,
        action: 'deactivate',
        maker: userName,
        message: `Reverted Production Website Release ${targetBatch.release_version} (${restoredCount} items deleted/restored to ready_to_live state)`,
        createdBy: userId,
        newVal: { batchId: targetBatch.id, releaseVersion: targetBatch.release_version, restoredCount },
      });

      return {
        success: true,
        revertedBatchId: targetBatch.id,
        revertedReleaseVersion: targetBatch.release_version,
        restoredCount,
        message: `Successfully reverted release ${targetBatch.release_version} (${restoredCount} items deleted/restored to ready_to_live state)`,
      };
    } catch (revertErr) {
      console.error(`[ReleaseSyncService] Revert failed on batch #${targetBatch.id}:`, revertErr.message);

      // Restore batch back to COMMITTED state in case of any failure
      try {
        await pool.execute(
          `UPDATE tb_cpanel_release_batches SET status = 'COMMITTED' WHERE id = ?`,
          [targetBatch.id]
        );
      } catch (e) { }

      // Stop entire revert and throw failure error
      throw new Error(`Revert is failed: ${revertErr.message || 'Database revert error.'}`);
    }
  }

  // Restore snapshot data back to production
  async restorePreviousState(tableName, recordId, prev) {
    try {
      if (tableName === 'tb_pdt_categories') {
        const catType = (prev.type === 'sub category' || prev.type === 'sc') ? 'sc' : (prev.type === 'sub sub category' || prev.type === 's2c') ? 's2c' : 'cat';
        const prevDesc = prev.description !== undefined && prev.description !== null ? String(prev.description) : null;
        await prodPool.query(
          `UPDATE tb_pdt_categories SET org_code = ?, type = ?, parent_id = ?, category = ?, description = ?, img = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, catType, prev.parent_id || 0, prev.category, prevDesc, prev.img || null, prev.status || 'live', prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_pdt_sub_categories') {
        await prodPool.query(
          `UPDATE tb_pdt_sub_categories SET cat_id = ?, sub_category = ?, img = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.cat_id, prev.sub_category, prev.img || null, prev.status || 'live', prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_pdt_products') {
        await prodPool.query(
          `UPDATE tb_pdt_products SET org_code = ?, parent_id = ?, sub_id = ?, pdt_code = ?, product = ?, primary_img = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, prev.parent_id || 0, prev.sub_id || null, prev.pdt_code, prev.product, prev.primary_img || null, prev.status || 'live', prev.content_version || 1, recordId]
        );

        if (prev._product_info) {
          const info = prev._product_info;
          await prodPool.query(
            `UPDATE tb_pdt_product_info SET \`desc\` = ?, price = ?, features = ?, specs = ?, addl_features = ?, pdt_imgs = ?, acces = ?, variants = ?, accs = ?, related_pdts = ?, content_version = ? WHERE pdt_id = ?`,
            [
              info.desc || null,
              info.price || 0,
              ensureValidJsonOrNull(info.features),
              ensureValidJsonOrNull(info.specs),
              ensureValidJsonOrNull(info.addl_features),
              ensureValidJsonOrNull(info.pdt_imgs, true),
              info.acces || null,
              ensureValidJsonOrNull(info.variants, true),
              ensureValidJsonOrNull(info.accs || info.acces, true),
              ensureValidJsonOrNull(info.related_pdts, true),
              info.content_version || 1,
              recordId,
            ]
          );
        }
      } else if (tableName === 'tb_pdt_variants') {
        await prodPool.query(
          `UPDATE tb_pdt_variants SET pdt_id = ?, var_code = ?, name = ?, colour = ?, price = ?, sku = ?, primary_img = ?, imgs = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.pdt_id, prev.var_code, prev.name, prev.colour || null, prev.price || 0, prev.sku || '', safeSqlJson(prev.primary_img), safeSqlJson(prev.imgs), prev.status || 'live', prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_web_blogs') {
        await prodPool.query(
          `UPDATE tb_web_blogs SET org_code = ?, title = ?, description = ?, written_by = ?, highlighter = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, prev.title, safeSqlJson(prev.description), prev.written_by || null, prev.highlighter || null, prev.status || 'live', prev.content_version || 1, recordId]
        );

        if (prev._blog_content) {
          const bc = prev._blog_content;
          await prodPool.query(
            `UPDATE tb_web_blog_content SET primary_image = ?, post_content = ?, related_links = ?, related_posts = ?, content_version = ? WHERE blog_id = ?`,
            [safeSqlJson(bc.primary_image), safeSqlJson(bc.post_content), safeSqlJson(bc.related_links), safeSqlJson(bc.related_posts), bc.content_version || 1, recordId]
          );
        }
      } else if (tableName === 'tb_web_careers') {
        await prodPool.query(
          `UPDATE tb_web_careers SET org_code = ?, title = ?, department = ?, location = ?, employment_type = ?, description = ?, requirements = ?, apply_link = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, prev.title, prev.department || null, prev.location || null, prev.employment_type || null, safeSqlJson(prev.description), safeSqlJson(prev.requirements), prev.apply_link || null, prev.status || 'live', prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_web_catalogs') {
        await prodPool.query(
          `UPDATE tb_web_catalogs SET org_code = ?, name = ?, category = ?, file_url = ?, thumbnail_img = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, prev.name, prev.category || null, prev.file_url, safeSqlJson(prev.thumbnail_img), prev.status || 'live', prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_web_seo') {
        await prodPool.query(
          `UPDATE tb_web_seo SET org_code = ?, route_id = ?, route_ext = ?, title = ?, description = ?, focus_keywords = ?, keywords = ?, img = ?, img_alt = ?, related_products = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, prev.route_id || 1, prev.route_ext || null, prev.title, safeSqlJson(prev.description), safeSqlJson(prev.focus_keywords), safeSqlJson(prev.keywords), safeSqlJson(prev.img), prev.img_alt || null, safeSqlJson(prev.related_products), prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_web_feed') {
        await prodPool.query(
          `UPDATE tb_web_feed SET org_code = ?, feed_type = ?, ref_table = ?, ref_id = ?, title = ?, summary = ?, img = ?, status = ?, content_version = ? WHERE id = ?`,
          [prev.org_code, prev.feed_type || 'announcement', prev.ref_table || 'tb_ui_element', prev.ref_id || 0, prev.title, safeSqlJson(prev.summary), safeSqlJson(prev.img), prev.status || 'live', prev.content_version || 1, recordId]
        );
      } else if (tableName === 'tb_web_spaces') {
        await prodPool.query(
          `UPDATE tb_web_spaces SET org_code = ?, title = ?, description = ?, image_url = ?, status = ?, view = ?, sort_order = ?, content_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [prev.org_code, prev.title, safeSqlJson(prev.description), prev.image_url, prev.status || 'live', prev.view || 'view', prev.sort_order || 0, prev.content_version || 1, recordId]
        );
      }
    } catch (e) {
      console.error(`[ReleaseSyncService.restorePreviousState] Failed restoring ${tableName} #${recordId}:`, e.message);
    }
  }

  // Get full release history
  async getReleaseHistory(orgCode) {
    const cleanOrg = String(orgCode || '').trim();
    const isAll = !cleanOrg || cleanOrg.toLowerCase() === 'all';
    const query = isAll
      ? `SELECT * FROM tb_cpanel_release_batches ORDER BY id DESC LIMIT 50`
      : `SELECT * FROM tb_cpanel_release_batches WHERE org_code = ? ORDER BY id DESC LIMIT 50`;
    const params = isAll ? [] : [cleanOrg];
    const [rows] = await pool.query(query, params);

    return rows.map((r) => {
      let breakdown = {};
      try {
        breakdown = typeof r.synced_breakdown === 'string' ? JSON.parse(r.synced_breakdown) : (r.synced_breakdown || {});
      } catch (e) { }

      return {
        id: r.id,
        batchUuid: r.batch_uuid,
        orgCode: r.org_code,
        releaseVersion: r.release_version,
        status: r.status,
        totalItems: r.total_items,
        syncedBreakdown: breakdown,
        createdBy: r.created_by,
        createdByName: r.created_by_name || 'Organization Admin',
        releaseNote: r.release_note,
        createdAt: r.created_at,
        committedAt: r.committed_at,
        revertedAt: r.reverted_at,
      };
    });
  }

  // Get live status & health indicator
  async getLiveStatus(orgCode) {
    const cleanOrg = String(orgCode || '').trim();
    const isAll = !cleanOrg || cleanOrg.toLowerCase() === 'all';
    const query = isAll
      ? `SELECT * FROM tb_cpanel_release_batches WHERE status = 'COMMITTED' ORDER BY id DESC LIMIT 1`
      : `SELECT * FROM tb_cpanel_release_batches WHERE org_code = ? AND status = 'COMMITTED' ORDER BY id DESC LIMIT 1`;
    const params = isAll ? [] : [cleanOrg];
    const [latest] = await pool.query(query, params);

    let activeBatch = latest[0] || null;

    let prodDbOnline = true;
    let prodItemCount = 0;
    try {
      const [pRows] = await prodPool.query(`SELECT COUNT(*) as count FROM tb_pdt_products WHERE status = 'live'`);
      prodItemCount = pRows[0]?.count || 0;
    } catch (e) {
      prodDbOnline = false;
    }

    return {
      activeReleaseVersion: activeBatch?.release_version || 'None (Initial State)',
      lastReleasedAt: activeBatch?.committed_at || activeBatch?.created_at || null,
      lastReleasedBy: activeBatch?.created_by_name || 'Organization Admin',
      productionDatabase: prodDbName,
      prodDbOnline,
      totalLiveProducts: prodItemCount,
    };
  }
}

module.exports = new ReleaseSyncService();
