const path = require('path');
const fs = require('fs');
const { pool } = require('../../resources/connection');
const contentService = require('../services/content.service');
const spacesController = require('./spaces.controller');
const { logAudit } = require('../utils/auditLogger');

const jwt = require('jsonwebtoken');

function extractUserFromReq(req) {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
      const decoded = jwt.verify(token, secret);
      if (decoded) return decoded;
    } catch {
      try {
        const decoded = jwt.decode(token);
        if (decoded) return decoded;
      } catch { }
    }
  }
  return null;
}

async function getUserFullName(req) {
  const user = extractUserFromReq(req);
  const userEmail = user?.email;
  const userId = user?.id;

  if (userEmail || userId) {
    try {
      const [uRows] = await pool.execute(
        'SELECT full_name FROM tb_board_users WHERE LOWER(email) = LOWER(?) OR id = ? LIMIT 1',
        [String(userEmail || ''), Number(userId) || 0]
      );
      if (uRows.length > 0 && uRows[0].full_name) {
        return uRows[0].full_name;
      }
    } catch (e) {
      console.error('[getUserFullName] Error querying tb_board_users:', e.message);
    }
  }

  return user?.fullName || user?.full_name || user?.displayName || user?.email || 'User';
}

async function checkPendingApprovalLock(tableName, id) {
  if (!tableName || !id) return false;
  try {
    const [rows] = await pool.execute(`SELECT status FROM ${tableName} WHERE id = ?`, [id]);
    if (rows.length > 0 && rows[0].status === 'pending_approval') {
      return true;
    }
  } catch (e) { }
  return false;
}
function safeJsonParse(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '[object Object]') return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function normalizeRole(r) {
  const s = String(r || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (s === 'org_admin' || s === 'organization_admin') return 'organization_admin';
  if (s === 'super_admin' || s === 'sys_admin' || s === 'system_admin') return 'super_admin';
  if (s === 'super_employee') return 'super_employee';
  if (s === 'employee' || s === 'employee_2') return 'employee';
  return s;
}

async function evaluateApprovalRuleAndStatus({ orgCode, type, title, insertId, tableName, req, skipNotification = false }) {
  try {
    const user = extractUserFromReq(req);
    const userRole = user?.role || user?.roleCode || user?.role_code || 'organization_admin';
    const userId = user?.id || 0;
    const userName = await getUserFullName(req);

    const normUserRole = normalizeRole(userRole);
    const rawUserRole = String(userRole || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const contentTypeClean = String(type || '').toLowerCase();

    // Fetch all active rules for this orgCode
    const [ruleRows] = await pool.execute(
      `SELECT r.*, cr.route as route_path, cr.page as route_name FROM tb_org_rules r
       LEFT JOIN tb_config_routes cr ON r.route_id = cr.id
       WHERE LOWER(r.org_code) = LOWER(?) AND r.status = 'active'
       ORDER BY r.id DESC`,
      [orgCode]
    );

    const matchingResourceRules = ruleRows.filter((rule) => {
      const routeStr = String(rule.route_path || '').toLowerCase();
      const routeName = String(rule.route_name || '').toLowerCase();

      if (contentTypeClean === 'career' || contentTypeClean === 'careers' || tableName === 'tb_web_careers') {
        return routeStr.includes('career') || routeName.includes('career') || routeStr.includes('job') || routeName.includes('job') || rule.route_id === 14;
      }
      if (contentTypeClean === 'catalog' || contentTypeClean === 'catalogs' || tableName === 'tb_web_catalogs') {
        return routeStr.includes('catalog') || routeName.includes('catalog') || rule.route_id === 13;
      }
      if (contentTypeClean === 'blog' || contentTypeClean === 'blogs' || tableName === 'tb_web_blogs') {
        return routeStr.includes('blog') || routeName.includes('blog') || rule.route_id === 12;
      }
      if (contentTypeClean === 'seo' || contentTypeClean === 'seo_page' || contentTypeClean === 'seo_pages' || contentTypeClean === 'seopage' || tableName === 'tb_web_seo') {
        return routeStr.includes('seo') || routeName.includes('seo') || rule.route_id === 18 || rule.route_id === 15;
      }
      if (contentTypeClean === 'user' || contentTypeClean === 'member' || contentTypeClean === 'account' || tableName === 'tb_board_users') {
        return routeStr.includes('user') || routeName.includes('user') || routeStr.includes('account') || routeName.includes('account') || routeStr.includes('member') || rule.route_id === 16 || rule.route_id === 17;
      }
      if (contentTypeClean === 'product' || contentTypeClean === 'category' || contentTypeClean === 'subcategory' || contentTypeClean === 'variant' || tableName.startsWith('tb_pdt_')) {
        return routeStr.includes('product') || routeName.includes('product') || routeStr.includes('pdt') || rule.route_id === 7;
      }
      if (contentTypeClean === 'ui_element' || contentTypeClean === 'ui' || contentTypeClean === 'uielements' || contentTypeClean === 'ui-elements' || tableName === 'tb_web_feed' || tableName === 'tb_web_uielements' || tableName === 'tb_ui_elements') {
        return routeStr.includes('ui') || routeName.includes('ui') || routeStr.includes('element') || routeName.includes('element') || rule.route_id === 22;
      }
      if (contentTypeClean === 'space' || contentTypeClean === 'spaces' || contentTypeClean === 'explore_spaces' || contentTypeClean === 'explore_space' || tableName === 'tb_web_spaces') {
        return routeStr.includes('space') || routeName.includes('space') || rule.route_id === 34;
      }
      if (contentTypeClean === 'ui_layout' || contentTypeClean === 'ui-layout' || contentTypeClean === 'ui_layouts' || contentTypeClean === 'layout' || tableName === 'tb_ui_component_content') {
        return routeStr.includes('ui-layout') || routeStr.includes('uilayout') || routeStr.includes('layout') || routeName.includes('layout') || rule.route_id === 35;
      }
      return false;
    });

    let hasMatchingMakerRule = false;
    let allCheckerRoles = [];

    for (const rule of matchingResourceRules) {
      let makerRoles = [];
      try {
        makerRoles = typeof rule.maker_role_ids === 'string'
          ? JSON.parse(rule.maker_role_ids)
          : (rule.maker_role_ids || []);
      } catch (e) {
        makerRoles = typeof rule.maker_role_ids === 'string' ? rule.maker_role_ids.split(',').map(s => s.trim()) : [];
      }
      const normMakerRoles = makerRoles.map(normalizeRole);
      const rawMakerRoles = makerRoles.map(m => String(m || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));

      if (
        normMakerRoles.includes('*') ||
        normMakerRoles.includes('all') ||
        normMakerRoles.includes(normUserRole) ||
        rawMakerRoles.includes(rawUserRole)
      ) {
        hasMatchingMakerRule = true;
        let checkers = [];
        try {
          checkers = typeof rule.check_role_ids === 'string'
            ? JSON.parse(rule.check_role_ids)
            : (rule.check_role_ids || []);
        } catch (e) {
          checkers = typeof rule.check_role_ids === 'string' ? rule.check_role_ids.split(',').map(s => s.trim()) : [];
        }
        allCheckerRoles.push(...checkers);
      }
    }

    const defaultApprovedStatus = (contentTypeClean === 'user' || tableName === 'tb_board_users') ? 'active' : 'ready_to_live';

    if (!hasMatchingMakerRule) {
      return defaultApprovedStatus;
    }

    const pendingStatus = 'pending_approval';

    await pool.execute(
      `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orgCode, tableName, type, title, insertId, userId, userName, `Submitted ${type} "${title}" for approval`]
    );

    if (!skipNotification && allCheckerRoles.length > 0) {
      try {
        const rawCheckers = allCheckerRoles.map(r => String(r || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
        const normCheckers = allCheckerRoles.map(normalizeRole);
        const allCheckerTerms = Array.from(new Set([...rawCheckers, ...normCheckers]));
        const placeholders = allCheckerTerms.map(() => '?').join(',');

        const [checkerUsers] = await pool.execute(
          `SELECT id FROM tb_board_users 
           WHERE LOWER(org_code) = LOWER(?) 
           AND LOWER(role) IN (${placeholders})`,
          [orgCode, ...allCheckerTerms]
        );

        const notifMsg = `Approval required: ${userName} (${userRole}) submitted ${type} "${title}" for approval.`;

        for (const u of checkerUsers) {
          if (Number(u.id) !== Number(userId)) {
            await pool.execute(
              `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
              [orgCode, userId, u.id, notifMsg]
            );
          }
        }
      } catch (nErr) {
        console.error('[evaluateApprovalRuleAndStatus] Notification error:', nErr.message);
      }
    }

    return pendingStatus;
  } catch (e) {
    console.error('[evaluateApprovalRuleForContent] Error:', e.message);
    return (type === 'user' || tableName === 'tb_board_users') ? 'active' : 'ready_to_live';
  }
}

class ContentController {
  // GET /cpanel-api/content/:type
  async getContentByType(req, res) {
    try {
      const { type } = req.params;
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || req.body?.org_code || user?.org_code || req.user?.org_code || null;
      const currentUser = await getUserFullName(req);
      const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
      const limit = Math.max(1, Number(req.query.limit) || 10);
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const cleanType = String(type || '').toLowerCase();

      if (cleanType === 'spaces' || cleanType === 'space' || cleanType === 'explore_spaces' || cleanType === 'explore_space') {
        return spacesController.getSpaces(req, res);
      }

      if (cleanType === 'blogs' || cleanType === 'blog') {
        const blogs = await contentService.getBlogs(orgCode);
        const items = blogs.map((r) => ({
          id: r.id,
          orgCode: r.org_code || orgCode,
          type: 'blog',
          title: r.title,
          summary: r.description || r.title,
          status: r.status,
          view: 'view',
          payload: {
            blog_id: `blog-${r.id}`,
            highlighter: r.highlighter,
            title: r.title,
            description: r.description,
            written_by: r.written_by,
            author_name: r.written_by || currentUser || 'Admin',
            featured_image: r.primary_image,
            primary_image: r.primary_image,
            post_content: r.post_content,
            status: r.status,
            ...r,
          },
          createdBy: r.written_by || currentUser || 'Admin',
          created_by_name: r.written_by || currentUser || 'Admin',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        return res.status(200).json({ success: true, type, data: items, items, total: items.length });
      }

      if (cleanType === 'careers' || cleanType === 'career') {
        const careers = await contentService.getCareers(orgCode);
        const items = careers.map((r) => ({
          id: r.id,
          orgCode: r.org_code || orgCode,
          type: 'career',
          title: r.title,
          summary: r.description || r.title,
          status: r.status,
          view: 'view',
          payload: {
            job_id: `job-${r.id}`,
            department: r.department,
            location: r.location,
            employment_type: r.employment_type,
            description: r.description,
            requirements: r.requirements,
            apply_link: r.apply_link,
            status: r.status,
            ...r,
          },
          createdBy: r.created_by_name || r.createdBy || r.maker || currentUser || 'User',
          created_by_name: r.created_by_name || r.createdBy || r.maker || currentUser || 'User',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        return res.status(200).json({ success: true, type, data: items, items, total: items.length });
      }

      if (cleanType === 'catalogs' || cleanType === 'catalog') {
        const catalogs = await contentService.getCatalogs(orgCode);
        const items = catalogs.map((r) => ({
          id: r.id,
          orgCode: r.org_code || orgCode,
          type: 'catalog',
          title: r.name,
          summary: r.category || r.name,
          status: r.status,
          view: 'view',
          payload: {
            catalog_id: `cat-${r.id}`,
            name: r.name,
            catalog_name: r.name,
            category: r.category,
            file_url: r.file_url,
            thumbnail_img: r.thumbnail_img,
            status: r.status,
            ...r,
          },
          createdBy: r.created_by_name || r.createdBy || r.maker || currentUser || 'User',
          created_by_name: r.created_by_name || r.createdBy || r.maker || currentUser || 'User',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        return res.status(200).json({ success: true, type, data: items, items, total: items.length });
      }

      const statusParam = req.query.status ? String(req.query.status).trim().toLowerCase() : '';

      // Catalog Content Types -> Direct Queries on tb_pdt_* primary tables
      if (type === 'category' || cleanType === 'cat' || cleanType === 'sc' || cleanType === 's2c' || cleanType === 'subcategory' || cleanType === 'subcategories' || cleanType === 'subsubcategory' || cleanType === 'subsubcategories') {
        let catTypeParam = String(req.query.cat_type || req.query.level || '').trim().toLowerCase();
        if (!catTypeParam) {
          if (cleanType === 'cat') catTypeParam = 'cat';
          else if (cleanType === 'sc' || cleanType === 'subcategory' || cleanType === 'subcategories') catTypeParam = 'sc';
          else if (cleanType === 's2c' || cleanType === 'subsubcategory' || cleanType === 'subsubcategories') catTypeParam = 's2c';
        }
        let sql = `SELECT c.id, c.sort_order, c.org_code, c.type, c.parent_id, c.category, c.description, c.img, c.banner_img, c.catalog_id, c.status, c.view, c.created_at, c.updated_at, p.category AS parent_category_name, p.parent_id AS parent_parent_id FROM tb_pdt_categories c LEFT JOIN tb_pdt_categories p ON c.parent_id = p.id WHERE LOWER(c.status) != 'deleted'`;
        const params = [];

        if (orgCode) {
          sql += ` AND LOWER(c.org_code) = LOWER(?)`;
          params.push(orgCode);
        }

        if (catTypeParam === 'cat' || catTypeParam === 'category') {
          sql += ` AND (LOWER(c.type) = 'cat' OR LOWER(c.type) = 'category' OR c.parent_id = 0 OR c.parent_id IS NULL)`;
        } else if (catTypeParam === 'sc' || catTypeParam === 'sub category' || catTypeParam === 'subcategory' || catTypeParam === 'sub_category') {
          sql += ` AND (LOWER(c.type) = 'sc' OR LOWER(c.type) = 'sub category' OR (c.parent_id != 0 AND (p.parent_id = 0 OR p.parent_id IS NULL)))`;
        } else if (catTypeParam === 's2c' || catTypeParam === 'sub sub category' || catTypeParam === 'subsubcategory' || catTypeParam === 'sub_sub_category') {
          sql += ` AND (LOWER(c.type) = 's2c' OR LOWER(c.type) = 'sub sub category' OR (c.parent_id != 0 AND p.parent_id != 0 AND p.parent_id IS NOT NULL))`;
        }

        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          sql += ` AND LOWER(c.status) = ?`;
          params.push(statusParam);
        }
        if (q) {
          sql += ` AND (LOWER(c.category) LIKE ? OR LOWER(p.category) LIKE ?)`;
          params.push(`%${q}%`, `%${q}%`);
        }
        sql += ` ORDER BY c.sort_order ASC, c.id ASC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await pool.execute(sql, params);

        let countSql = `SELECT COUNT(*) as total FROM tb_pdt_categories c LEFT JOIN tb_pdt_categories p ON c.parent_id = p.id WHERE LOWER(c.status) != 'deleted'`;
        const countParams = [];

        if (orgCode) {
          countSql += ` AND LOWER(c.org_code) = LOWER(?)`;
          countParams.push(orgCode);
        }

        if (catTypeParam === 'cat' || catTypeParam === 'category') {
          countSql += ` AND (LOWER(c.type) = 'cat' OR LOWER(c.type) = 'category' OR c.parent_id = 0 OR c.parent_id IS NULL)`;
        } else if (catTypeParam === 'sc' || catTypeParam === 'sub category' || catTypeParam === 'subcategory' || catTypeParam === 'sub_category') {
          countSql += ` AND (LOWER(c.type) = 'sc' OR LOWER(c.type) = 'sub category' OR (c.parent_id != 0 AND (p.parent_id = 0 OR p.parent_id IS NULL)))`;
        } else if (catTypeParam === 's2c' || catTypeParam === 'sub sub category' || catTypeParam === 'subsubcategory' || catTypeParam === 'sub_sub_category') {
          countSql += ` AND (LOWER(c.type) = 's2c' OR LOWER(c.type) = 'sub sub category' OR (c.parent_id != 0 AND p.parent_id != 0 AND p.parent_id IS NOT NULL))`;
        }

        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          countSql += ` AND LOWER(c.status) = ?`;
          countParams.push(statusParam);
        }
        if (q) {
          countSql += ` AND (LOWER(c.category) LIKE ? OR LOWER(p.category) LIKE ?)`;
          countParams.push(`%${q}%`, `%${q}%`);
        }
        const [countRows] = await pool.execute(countSql, countParams);
        const total = countRows[0]?.total || rows.length;

        const items = rows.map((r) => {
          const rawType = String(r.type || '').toLowerCase();
          let normalizedType = 'cat';
          let displayId = `cat_${r.id}`;

          if (rawType === 's2c' || rawType === 'sub sub category' || (r.parent_id > 0 && r.parent_parent_id > 0)) {
            normalizedType = 's2c';
            displayId = `s2c_${r.id}`;
          } else if (rawType === 'sc' || rawType === 'sub category' || r.parent_id > 0) {
            normalizedType = 'sc';
            displayId = `sc_${r.id}`;
          }

          return {
            id: r.id,
            sort_order: r.sort_order || r.id,
            orgCode: r.org_code,
            type: 'category',
            title: r.category,
            summary: r.description || r.category,
            status: r.status,
            view: r.view || 'view',
            payload: {
              cat_id: String(r.id),
              sub_cat_id: String(r.id),
              display_id: displayId,
              type: normalizedType,
              raw_type: r.type,
              parent_id: r.parent_id || 0,
              parent_parent_id: r.parent_parent_id || 0,
              category_name: r.category,
              parent_category_name: r.parent_category_name || null,
              description: r.description || '',
              category_image: r.img,
              subcategory_image: r.img,
              img: r.img,
              banner_img: r.banner_img || null,
              catalog_id: r.catalog_id || null,
              sort_order: r.sort_order || r.id,
              view: r.view || 'view'
            },
            createdBy: currentUser || 'Organization Admin',
            created_by_name: currentUser || 'Organization Admin',
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        });

        return res.status(200).json({ success: true, type, items, data: items, total });
      }

      if (type === 'subcategory') {
        let sql = `SELECT c.id, c.sort_order, c.org_code, c.type, c.parent_id, c.category AS sub_category, c.description, c.img, c.status, c.view, c.created_at, c.updated_at, p.category AS parent_category FROM tb_pdt_categories c LEFT JOIN tb_pdt_categories p ON c.parent_id = p.id WHERE LOWER(c.status) != 'deleted' AND (c.type = 'sub category' OR c.parent_id != 0)`;
        const params = [];
        if (orgCode) {
          sql += ` AND LOWER(c.org_code) = LOWER(?)`;
          params.push(orgCode);
        }
        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          sql += ` AND LOWER(c.status) = ?`;
          params.push(statusParam);
        }
        if (q) {
          sql += ` AND (LOWER(c.category) LIKE ? OR LOWER(p.category) LIKE ?)`;
          params.push(`%${q}%`, `%${q}%`);
        }
        sql += ` ORDER BY c.sort_order ASC, c.id ASC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await pool.execute(sql, params);

        const items = rows.map((r) => ({
          id: r.id,
          sort_order: r.sort_order || r.id,
          orgCode: r.org_code || orgCode,
          type: 'subcategory',
          title: r.sub_category,
          summary: r.description || r.sub_category,
          status: r.status,
          view: r.view || 'view',
          payload: {
            sub_cat_id: String(r.id),
            parent_cat_id: r.parent_id,
            parent_category: r.parent_category,
            subcategory_image: r.img,
            sort_order: r.sort_order || r.id,
            view: r.view || 'view'
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

        return res.status(200).json({ success: true, type, items, data: items, total: items.length });
      }

      if (type === 'product') {
        let sql = `SELECT p.id, p.sort_order, p.org_code, p.parent_id, p.pdt_code, p.product, p.primary_img, p.brand, p.default_colour, p.colours, p.status, p.created_at, p.updated_at, info.desc, info.features, info.specs, info.pdt_imgs, info.variants, info.kits FROM tb_pdt_products p LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id WHERE LOWER(p.status) != 'deleted'`;
        const params = [];
        if (orgCode) {
          sql += ` AND LOWER(p.org_code) = LOWER(?)`;
          params.push(orgCode);
        }
        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          sql += ` AND LOWER(p.status) = ?`;
          params.push(statusParam);
        }
        if (q) {
          sql += ` AND (LOWER(p.product) LIKE ? OR LOWER(p.pdt_code) LIKE ?)`;
          params.push(`%${q}%`, `%${q}%`);
        }
        sql += ` ORDER BY p.sort_order ASC, p.id ASC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await pool.execute(sql, params);

        let countSql = `SELECT COUNT(*) as total FROM tb_pdt_products p WHERE LOWER(p.status) != 'deleted'`;
        const countParams = [];
        if (orgCode) {
          countSql += ` AND LOWER(p.org_code) = LOWER(?)`;
          countParams.push(orgCode);
        }
        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          countSql += ` AND LOWER(p.status) = ?`;
          countParams.push(statusParam);
        }
        if (q) {
          countSql += ` AND (LOWER(p.product) LIKE ? OR LOWER(p.pdt_code) LIKE ?)`;
          countParams.push(`%${q}%`, `%${q}%`);
        }
        const [countRows] = await pool.execute(countSql, countParams);
        const total = countRows[0]?.total || rows.length;

        const items = rows.map((r) => ({
          id: r.id,
          sort_order: r.sort_order || r.id,
          orgCode: r.org_code,
          type: 'product',
          title: r.product,
          summary: r.desc || r.product,
          status: r.status,
          view: 'view',
          payload: {
            prd_id: String(r.id),
            sort_order: r.sort_order || r.id,
            parent_id: r.parent_id,
            cat_id: r.parent_id,
            sub_cat_id: r.parent_id,
            productCode: r.pdt_code,
            product_image: r.primary_img,
            productDescription: r.desc,
            product_features: safeJsonParse(r.features, null),
            product_specifications: safeJsonParse(r.specs, null),
            other_images: safeJsonParse(r.pdt_imgs, []),
            variants: safeJsonParse(r.variants, []),
            brand: r.brand || '',
            default_colour: r.default_colour || '',
            colours: safeJsonParse(r.colours, []),
            kits: safeJsonParse(r.kits, []),
            view: 'view'
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

        return res.status(200).json({ success: true, type, items, data: items, total });
      }

      if (type === 'variant') {
        let sql = `SELECT v.id, v.sort_order, v.org_code, v.pdt_id, v.var_code, v.name, v.colour, v.price, v.discount, v.discount_type, v.sku, v.primary_img, v.imgs, v.status, v.created_at, v.updated_at FROM tb_pdt_variants v LEFT JOIN tb_pdt_products p ON v.pdt_id = p.id WHERE LOWER(v.status) != 'deleted'`;
        const params = [];
        if (orgCode) {
          sql += ` AND (LOWER(v.org_code) = LOWER(?) OR (v.org_code IS NULL AND LOWER(p.org_code) = LOWER(?)))`;
          params.push(orgCode, orgCode);
        }
        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          sql += ` AND LOWER(v.status) = ?`;
          params.push(statusParam);
        }
        if (q) {
          sql += ` AND (LOWER(v.name) LIKE ? OR LOWER(v.sku) LIKE ? OR LOWER(v.var_code) LIKE ?)`;
          params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        sql += ` ORDER BY v.sort_order ASC, v.id ASC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await pool.execute(sql, params);

        let countSql = `SELECT COUNT(*) as total FROM tb_pdt_variants v LEFT JOIN tb_pdt_products p ON v.pdt_id = p.id WHERE LOWER(v.status) != 'deleted'`;
        const countParams = [];
        if (orgCode) {
          countSql += ` AND (LOWER(v.org_code) = LOWER(?) OR (v.org_code IS NULL AND LOWER(p.org_code) = LOWER(?)))`;
          countParams.push(orgCode, orgCode);
        }
        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          countSql += ` AND LOWER(v.status) = ?`;
          countParams.push(statusParam);
        }
        if (q) {
          countSql += ` AND (LOWER(v.name) LIKE ? OR LOWER(v.sku) LIKE ? OR LOWER(v.var_code) LIKE ?)`;
          countParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        const [countRows] = await pool.execute(countSql, countParams);
        const total = countRows[0]?.total || rows.length;

        const items = rows.map((r) => ({
          id: r.id,
          sort_order: r.sort_order || r.id,
          orgCode: r.org_code || orgCode,
          type: 'variant',
          title: r.name,
          summary: r.name,
          status: r.status,
          view: 'view',
          payload: {
            variant_id: String(r.id),
            sort_order: r.sort_order || r.id,
            product_id: r.pdt_id,
            variantCode: r.var_code,
            variant_code: r.var_code,
            var_code: r.var_code,
            sku: r.sku,
            price: r.price,
            discount: Number(r.discount) || 0,
            discount_type: r.discount_type || 'percentage',
            colour: r.colour,
            color_finish: r.colour,
            primary_img: r.primary_img,
            image_url: r.primary_img,
            variant_image: r.primary_img,
            img: r.primary_img,
            other_images: safeJsonParse(r.imgs, []),
            imgs: safeJsonParse(r.imgs, []),
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

        return res.status(200).json({ success: true, type, items, data: items, total });
      }

      if (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') {
        let queryStr = `SELECT id, org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, canonical_url, og_title, og_description, schema_type, status, view, is_page_seo, created_at, updated_at FROM tb_web_seo WHERE (LOWER(org_code) = LOWER(?) OR ? = '') AND status != 'archived' AND status != 'deleted' AND (is_page_seo = 1 OR (route_ext NOT LIKE 'blog-%' AND route_ext NOT LIKE 'post-%' AND route_ext NOT LIKE 'career-%' AND route_ext NOT LIKE 'job-%' AND route_ext NOT LIKE 'catalog-%' AND route_ext NOT LIKE 'cat-%' AND route_ext NOT LIKE 'subcat-%' AND route_ext NOT LIKE 'prd-%' AND route_ext NOT REGEXP '^[0-9]+$'))`;
        const params = [orgCode, orgCode];

        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          queryStr += ` AND LOWER(status) = ?`;
          params.push(statusParam);
        }

        if (q) {
          queryStr += ` AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(focus_keywords) LIKE ? OR LOWER(route_ext) LIKE ?)`;
          const term = `%${q}%`;
          params.push(term, term, term, term);
        }

        queryStr += ` ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await pool.execute(queryStr, params);

        let countQuery = `SELECT COUNT(*) as total FROM tb_web_seo WHERE (LOWER(org_code) = LOWER(?) OR ? = '') AND status != 'archived' AND status != 'deleted' AND (is_page_seo = 1 OR (route_ext NOT LIKE 'blog-%' AND route_ext NOT LIKE 'post-%' AND route_ext NOT LIKE 'career-%' AND route_ext NOT LIKE 'job-%' AND route_ext NOT LIKE 'catalog-%' AND route_ext NOT LIKE 'cat-%' AND route_ext NOT LIKE 'subcat-%' AND route_ext NOT LIKE 'prd-%' AND route_ext NOT REGEXP '^[0-9]+$'))`;
        const countParams = [orgCode, orgCode];
        if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
          countQuery += ` AND LOWER(status) = ?`;
          countParams.push(statusParam);
        }
        if (q) {
          countQuery += ` AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(focus_keywords) LIKE ? OR LOWER(route_ext) LIKE ?)`;
          const term = `%${q}%`;
          countParams.push(term, term, term, term);
        }
        const [countRows] = await pool.execute(countQuery, countParams);
        const total = countRows[0]?.total || rows.length;

        const items = rows.map((r) => ({
          id: r.id,
          orgCode: r.org_code,
          type: 'seo_page',
          title: r.title,
          summary: r.description,
          status: r.status,
          view: r.view || 'view',
          payload: {
            page_name: r.title,
            seo_meta_title: r.title,
            seo_meta_description: r.description,
            focus_keyword: r.focus_keywords,
            secondary_keywords: r.keywords,
            featured_image: r.img,
            og_image: r.img,
            image_alt_text: r.img_alt,
            related_products: r.related_products,
            robots_tag: r.robot,
            url_slug: r.route_ext,
            page_url: r.route_ext,
            canonical_url: r.canonical_url || null,
            og_title: r.og_title || r.title || null,
            og_description: r.og_description || r.description || null,
            schema_type: r.schema_type || null,
            status: r.status,
            view: r.view || 'view',
          },
          createdBy: currentUser || 'User',
          created_by_name: currentUser || 'User',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

        return res.status(200).json({
          success: true,
          type,
          items,
          data: items,
          total,
        });
      }

      // Web Feed (Fallback for ui_element, feed, announcement, etc.)
      let queryStr = `SELECT id, org_code, feed_type, ref_table, ref_id, title, summary, img, published_at, status, created_at FROM tb_web_feed WHERE LOWER(org_code) = LOWER(?) AND status != 'archived' AND status != 'deleted'`;
      const params = [orgCode];

      if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
        queryStr += ` AND LOWER(status) = ?`;
        params.push(statusParam);
      }

      if (q) {
        queryStr += ` AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)`;
        const term = `%${q}%`;
        params.push(term, term);
      }

      queryStr += ` ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;

      const [rows] = await pool.execute(queryStr, params);

      let countQuery = `SELECT COUNT(*) as total FROM tb_web_feed WHERE LOWER(org_code) = LOWER(?) AND status != 'archived' AND status != 'deleted'`;
      const countParams = [orgCode];
      if (statusParam && statusParam !== 'all' && statusParam !== 'any') {
        countQuery += ` AND LOWER(status) = ?`;
        countParams.push(statusParam);
      }
      if (q) {
        countQuery += ` AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)`;
        const term = `%${q}%`;
        countParams.push(term, term);
      }
      const [countRows] = await pool.execute(countQuery, countParams);
      const total = countRows[0]?.total || rows.length;

      const items = rows.map((r) => ({
        id: r.id,
        orgCode: r.org_code,
        type: cleanType || r.feed_type || 'feed',
        title: r.title,
        summary: r.summary,
        status: r.status,
        view: 'view',
        payload: {
          feed_type: r.feed_type,
          ref_table: r.ref_table,
          ref_id: r.ref_id,
          img: r.img,
          ...r,
        },
        createdBy: r.maker || currentUser || 'User',
        created_by_name: r.maker || currentUser || 'User',
        createdAt: r.created_at,
        updatedAt: r.created_at,
      }));

      return res.status(200).json({
        success: true,
        type,
        items,
        data: items,
        total,
      });
    } catch (error) {
      console.error('[ContentController.getContentByType] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch content',
        error: error.message,
      });
    }
  }

  // POST/PUT /content/reorder
  async reorderContent(req, res) {
    try {
      const { type } = req.body;
      const rawType = String(type || req.params?.type || '').toLowerCase();
      const items = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.orders) ? req.body.orders : []);

      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'No items provided for reordering' });
      }

      let tableName = '';
      if (['category', 'categories', 'cat', 'sc', 's2c', 'subcategory', 'subcategories', 'sub_category', 'subsubcategory', 'subsubcategories', 'sub_sub_category'].includes(rawType)) {
        tableName = 'tb_pdt_categories';
      } else if (rawType === 'product' || rawType === 'products') {
        tableName = 'tb_pdt_products';
      } else if (rawType === 'variant' || rawType === 'variants') {
        tableName = 'tb_pdt_variants';
      } else {
        return res.status(400).json({ success: false, message: `Unsupported content type for reordering: ${type}` });
      }

      const updates = items.map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          return {
            id: Number(item.id),
            sort_order: item.sort_order !== undefined ? Number(item.sort_order) : (index + 1)
          };
        }
        return {
          id: Number(item),
          sort_order: index + 1
        };
      }).filter(u => !isNaN(u.id) && u.id > 0);

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid item data provided for reordering' });
      }

      for (const u of updates) {
        await pool.execute(
          `UPDATE ${tableName} 
           SET sort_order = ?, 
               status = CASE WHEN status IN ('deleted', 'inactive', 'archived') THEN status ELSE 'ready_to_live' END, 
               content_version = COALESCE(content_version, 1) + 1,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [u.sort_order, u.id]
        );
      }

      const [allRows] = await pool.execute(
        `SELECT id, sort_order FROM ${tableName} ORDER BY sort_order ASC, id ASC`
      );
      for (let i = 0; i < allRows.length; i++) {
        const seqOrder = i + 1;
        const row = allRows[i];
        if (row.sort_order !== seqOrder) {
          await pool.execute(
            `UPDATE ${tableName} 
             SET sort_order = ?, 
                 status = CASE WHEN status IN ('deleted', 'inactive', 'archived') THEN status ELSE 'ready_to_live' END, 
                 content_version = COALESCE(content_version, 1) + 1,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [seqOrder, row.id]
          );
        }
      }

      const currentUser = await getUserFullName(req);
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || user?.org_code || 'taiton';

      await logAudit({
        orgCode,
        tableName,
        recordId: updates[0]?.id || 0,
        action: 'update',
        maker: currentUser,
        message: `Reordered ${updates.length} items in ${tableName}`,
        newVal: { reorderedCount: updates.length, updates },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully updated order for ${updates.length} items`,
        data: updates
      });
    } catch (error) {
      console.error('[ContentController.reorderContent] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update order',
        error: error.message
      });
    }
  }

  // GET /cpanel-api/content/:type/:id
  async getContentDetail(req, res) {
    try {
      const { type, id } = req.params;
      const cleanIdStr = String(id || '').trim();
      const isNum = /^\d+$/.test(cleanIdStr);
      const numId = isNum ? Number(cleanIdStr) : 0;
      const cleanType = String(type || '').toLowerCase();
      const user = extractUserFromReq(req);
      const currentUser = await getUserFullName(req);
      const orgCode = req.query.org_code || req.body?.org_code || user?.org_code || req.user?.org_code || null;

      if (cleanType === 'spaces' || cleanType === 'space' || cleanType === 'explore_spaces' || cleanType === 'explore_space') {
        return spacesController.getSpaceById(req, res);
      }

      if (cleanType === 'blogs' || cleanType === 'blog') {
        const blog = await contentService.getBlogById(numId, orgCode);
        if (!blog) return res.status(404).json({ success: false, message: `Blog #${id} not found` });

        let s = {};
        try {
          let seoSql = `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'blog%' OR route_ext LIKE 'post%')))`;
          const seoParams = [`blog-${blog.id}`, String(blog.id), blog.title];
          if (orgCode) {
            seoSql += ` AND LOWER(org_code) = LOWER(?)`;
            seoParams.push(orgCode);
          }
          seoSql += ` ORDER BY id DESC LIMIT 1`;
          const [seoRows] = await pool.execute(seoSql, seoParams);
          s = seoRows[0] || {};
        } catch (e) { }

        let parsedPostContent = {};
        if (blog.post_content) {
          try {
            if (typeof blog.post_content === 'string' && blog.post_content.trim().startsWith('{')) {
              parsedPostContent = JSON.parse(blog.post_content);
            } else {
              parsedPostContent = { blog_content: blog.post_content };
            }
          } catch (e) {
            parsedPostContent = { blog_content: blog.post_content };
          }
        }

        const payload = {
          blog_id: `blog-${blog.id}`,
          title: blog.title,
          description: blog.description,
          author_name: blog.written_by || 'Riya Shah',
          featured_image: blog.primary_image || null,
          blog_category: blog.highlighter || 'Design Trends',
          seo_meta_title: s.title || blog.title,
          seo_meta_description: s.description || blog.description,
          focus_keyword: s.focus_keywords || null,
          secondary_keywords: s.keywords || null,
          image_alt_text: s.img_alt || null,
          robots_tag: s.robot || 'index, follow',
          related_products: s.related_products || null,
          ...blog,
          ...parsedPostContent
        };

        const item = {
          id: blog.id,
          orgCode: blog.org_code || orgCode,
          type: 'blog',
          title: blog.title,
          summary: blog.description || blog.title,
          status: blog.status,
          payload,
          createdBy: blog.written_by || currentUser || 'Admin',
          created_by_name: blog.written_by || currentUser || 'Admin',
        };
        return res.status(200).json({ success: true, item, data: item });
      }

      if (cleanType === 'careers' || cleanType === 'career') {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_careers WHERE id = ? AND org_code = ?`, [numId, orgCode]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: `Career #${id} not found` });
        const r = rows[0];

        let s = {};
        try {
          const [seoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'career%' OR route_ext LIKE 'job%'))) AND LOWER(org_code) = LOWER(?) ORDER BY id DESC LIMIT 1`,
            [`career-${r.id}`, String(r.id), r.title, orgCode]
          );
          s = seoRows[0] || {};
        } catch (e) { }

        let parsedReq = [];
        if (r.requirements) {
          try {
            parsedReq = typeof r.requirements === 'string' && r.requirements.trim().startsWith('[')
              ? JSON.parse(r.requirements)
              : [r.requirements];
          } catch (e) {
            parsedReq = [r.requirements];
          }
        }

        const payload = {
          job_id: `job-${r.id}`,
          title: r.title,
          department: r.department,
          location: r.location,
          employment_type: r.employment_type,
          experience: r.experience || null,
          salary_range: r.salary_range || null,
          description: r.description,
          requirements: parsedReq,
          apply_email: r.apply_link || 'careers@taiton.in',
          seo_meta_title: s.title || r.title,
          seo_meta_description: s.description || r.description,
          focus_keyword: s.focus_keywords || null,
          secondary_keywords: s.keywords || null,
          canonical_url: s.canonical_url || null,
          robots_tag: s.robot || 'index, follow',
          og_title: s.og_title || s.title || null,
          og_description: s.og_description || s.description || null,
          og_image: s.og_image || null,
          ...r
        };
        payload.requirements = parsedReq;

        const item = {
          id: r.id,
          orgCode: r.org_code,
          type: 'career',
          title: r.title,
          summary: r.description || r.title,
          status: r.status,
          payload,
          createdBy: r.created_by_name || r.createdBy || currentUser || 'Admin',
          created_by_name: r.created_by_name || r.createdBy || currentUser || 'Admin',
        };
        return res.status(200).json({ success: true, item, data: item });
      }

      if (cleanType === 'catalogs' || cleanType === 'catalog') {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_catalogs WHERE id = ? AND org_code = ?`, [numId, orgCode]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: `Catalog #${id} not found` });
        const r = rows[0];

        let s = {};
        try {
          const [seoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'catalog%' OR route_ext LIKE 'cat%'))) AND LOWER(org_code) = LOWER(?) ORDER BY id DESC LIMIT 1`,
            [`catalog-${r.id}`, String(r.id), r.name, orgCode]
          );
          s = seoRows[0] || {};
        } catch (e) { }

        const payload = {
          catalog_id: `cat-${r.id}`,
          catalog_name: r.name,
          category: r.category,
          edition: r.edition || '2026 Edition',
          page_count: r.page_count || '120 Pages',
          updated_badge: r.updated_badge || 'Updated 2026',
          file_url: r.file_url,
          thumbnail_img: r.thumbnail_img,
          image_alt_text: s.img_alt || null,
          summary: r.summary || r.category || r.name,
          seo_meta_title: s.title || r.name,
          seo_meta_description: s.description || r.summary || r.name,
          focus_keyword: s.focus_keywords || null,
          secondary_keywords: s.keywords || null,
          canonical_url: s.canonical_url || null,
          robots_tag: s.robot || 'index, follow',
          og_title: s.og_title || s.title || null,
          og_description: s.og_description || s.description || null,
          og_image: s.og_image || r.thumbnail_img || null,
          page_groups: safeJsonParse(r.page_groups, []),
          ...r,
        };

        const item = {
          id: r.id,
          orgCode: r.org_code,
          type: 'catalog',
          title: r.name,
          summary: r.category || r.name,
          status: r.status,
          payload,
          createdBy: r.created_by_name || r.createdBy || currentUser || 'Admin',
          created_by_name: r.created_by_name || r.createdBy || currentUser || 'Admin',
        };
        return res.status(200).json({ success: true, item, data: item });
      }

      if (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') {
        const [rows] = await pool.execute(
          `SELECT * FROM tb_web_seo WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? = '')`,
          [numId, orgCode, orgCode]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: `SEO configuration #${id} not found` });
        const r = rows[0];

        const payload = {
          page_name: r.title,
          seo_meta_title: r.title,
          seo_meta_description: r.description,
          focus_keyword: r.focus_keywords,
          secondary_keywords: r.keywords,
          featured_image: r.img,
          og_image: r.img,
          image_alt_text: r.img_alt,
          related_products: r.related_products,
          robots_tag: r.robot,
          url_slug: r.route_ext,
          page_url: r.route_ext,
          canonical_url: r.canonical_url || null,
          og_title: r.og_title || r.title || null,
          og_description: r.og_description || r.description || null,
          schema_type: r.schema_type || null,
          status: r.status,
          view: r.view || 'view',
          ...r,
        };

        const item = {
          id: r.id,
          orgCode: r.org_code,
          type: 'seo_page',
          title: r.title,
          summary: r.description,
          status: r.status,
          view: r.view || 'view',
          payload,
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
        return res.status(200).json({ success: true, item, data: item });
      }

      if (cleanType === 'category') {
        const [rows] = await pool.execute(
          `SELECT c.id, c.org_code, c.type, c.parent_id, c.category, c.description, c.img, c.banner_img, c.catalog_id, c.url_slug, c.status, c.view, c.created_at, c.updated_at, p.category AS parent_category_name FROM tb_pdt_categories c LEFT JOIN tb_pdt_categories p ON c.parent_id = p.id WHERE (c.id = ? OR LOWER(c.category) = LOWER(?)) AND c.status != 'deleted'`,
          [numId, cleanIdStr]
        );
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: `Category #${id} not found` });
        }
        const r = rows[0];

        let s = {};
        try {
          const [seoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'category%' OR route_ext LIKE 'cat%'))) AND LOWER(org_code) = LOWER(?) ORDER BY id DESC LIMIT 1`,
            [`cat-${r.id}`, String(r.id), r.category, r.org_code]
          );
          s = seoRows[0] || {};
        } catch (e) { }

        const item = {
          id: r.id,
          orgCode: r.org_code,
          type: 'category',
          title: r.category,
          summary: r.description || r.category,
          status: r.status,
          view: r.view || 'view',
          payload: {
            cat_id: String(r.id),
            type: r.type || 'category',
            parent_id: r.parent_id || 0,
            category_name: r.category,
            parent_category_name: r.parent_category_name || null,
            description: r.description || '',
            category_image: r.img,
            banner_img: r.banner_img || null,
            catalog_id: r.catalog_id || null,
            url_slug: r.url_slug || '',
            image_alt_text: s.img_alt || null,
            seo_meta_title: s.title || null,
            seo_meta_description: s.description || null,
            focus_keyword: s.focus_keywords || null,
            secondary_keywords: s.keywords || null,
            robot: s.robot || 'index, follow',
            related_products: s.related_products || null,
            view: r.view || 'view'
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
        };
        return res.status(200).json({ success: true, item, data: item });
      }

      if (type === 'subcategory') {
        const [rows] = await pool.execute(
          `SELECT c.id, c.org_code, c.type, c.parent_id, c.category as sub_category, c.description, c.img, c.url_slug, c.status, c.view, c.created_at, c.updated_at, p.category as main_category FROM tb_pdt_categories c LEFT JOIN tb_pdt_categories p ON c.parent_id = p.id WHERE (c.id = ? OR LOWER(c.category) = LOWER(?)) AND c.status != 'deleted'`,
          [numId, cleanIdStr]
        );
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: `Subcategory #${id} not found` });
        }
        const r = rows[0];

        let s = {};
        try {
          const [seoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'subcategory%' OR route_ext LIKE 'subcat%'))) ORDER BY id DESC LIMIT 1`,
            [`subcat-${r.id}`, String(r.id), r.sub_category]
          );
          s = seoRows[0] || {};
        } catch (e) { }

        const item = {
          id: r.id,
          orgCode: r.org_code,
          type: 'subcategory',
          title: r.sub_category,
          summary: r.description || r.sub_category,
          status: r.status,
          view: r.view || 'view',
          payload: {
            sub_cat_id: String(r.id),
            parent_cat_id: r.parent_id,
            main_category: r.main_category,
            subcategory_image: r.img,
            img: r.img,
            url_slug: r.url_slug || '',
            image_alt_text: s.img_alt || null,
            seo_meta_title: s.title || null,
            seo_meta_description: s.description || null,
            focus_keyword: s.focus_keywords || null,
            secondary_keywords: s.keywords || null,
            robot: s.robot || 'index, follow',
            related_products: s.related_products || null,
            view: r.view || 'view'
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
        };
        return res.status(200).json({ success: true, item, data: item });
      }

      if (type === 'product') {
        const [rows] = await pool.execute(
          `SELECT p.id, p.org_code, p.parent_id, p.pdt_code, p.product, p.primary_img, p.brand, p.default_colour, p.colours, p.url_slug, p.status, info.desc, info.features, info.specs, info.pdt_imgs, info.variants, info.kits FROM tb_pdt_products p LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id WHERE (p.id = ? OR LOWER(p.product) = LOWER(?) OR LOWER(p.pdt_code) = LOWER(?)) AND p.status != 'deleted'`,
          [numId, cleanIdStr, cleanIdStr]
        );
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: `Product #${id} not found` });
        }
        const r = rows[0];

        let s = {};
        try {
          const [seoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'product%' OR route_ext LIKE 'prd%'))) AND LOWER(org_code) = LOWER(?) ORDER BY id DESC LIMIT 1`,
            [`prd-${r.id}`, String(r.id), r.product, r.org_code]
          );
          s = seoRows[0] || {};
        } catch (e) { }

        const item = {
          id: r.id,
          orgCode: r.org_code,
          type: 'product',
          title: r.product,
          summary: r.desc || r.product,
          status: r.status,
          payload: {
            prd_id: String(r.id),
            parent_id: r.parent_id,
            cat_id: r.parent_id,
            sub_cat_id: r.parent_id,
            productCode: r.pdt_code,
            product_image: r.primary_img,
            brand: r.brand || '',
            default_colour: r.default_colour || '',
            colours: safeJsonParse(r.colours, []),
            kits: safeJsonParse(r.kits, []),
            url_slug: r.url_slug || '',
            productDescription: r.desc,
            product_features: safeJsonParse(r.features, null),
            product_specifications: safeJsonParse(r.specs, null),
            other_images: safeJsonParse(r.pdt_imgs, []),
            variants: safeJsonParse(r.variants, []),
            image_alt_text: s.img_alt || null,
            seo_meta_title: s.title || null,
            seo_meta_description: s.description || null,
            focus_keyword: s.focus_keywords || null,
            secondary_keywords: s.keywords || null,
            robot: s.robot || 'index, follow'
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
        };
        return res.status(200).json({ success: true, item });
      }

      if (type === 'variant') {
        const [rows] = await pool.execute(
          `SELECT v.id, v.pdt_id, v.var_code, v.name, v.colour, v.price, v.discount, v.discount_type, v.sku, v.primary_img, v.imgs, v.url_slug, v.status FROM tb_pdt_variants v WHERE v.id = ? AND v.status != 'deleted'`,
          [id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: `Variant #${id} not found` });
        const r = rows[0];

        const item = {
          id: r.id,
          orgCode: orgCode,
          type: 'variant',
          title: r.name,
          summary: r.name,
          status: r.status,
          payload: {
            variant_id: String(r.id),
            product_id: r.pdt_id,
            variantCode: r.var_code,
            variant_code: r.var_code,
            var_code: r.var_code,
            sku: r.sku,
            price: r.price,
            discount: Number(r.discount) || 0,
            discount_type: r.discount_type || 'percentage',
            colour: r.colour,
            color_finish: r.colour,
            url_slug: r.url_slug || '',
            variant_slug: r.url_slug || '',
            primary_img: r.primary_img,
            image_url: r.primary_img,
            variant_image: r.primary_img,
            img: r.primary_img,
            other_images: safeJsonParse(r.imgs, []),
            imgs: safeJsonParse(r.imgs, []),
          },
          createdBy: currentUser || 'Organization Admin',
          created_by_name: currentUser || 'Organization Admin',
        };
        return res.status(200).json({ success: true, item });
      }

      let feedSql = `SELECT id, org_code, feed_type, ref_table, ref_id, title, summary, img, status, created_at FROM tb_web_feed WHERE id = ?`;
      const feedParams = [numId || id];
      if (orgCode) {
        feedSql += ` AND LOWER(org_code) = LOWER(?)`;
        feedParams.push(orgCode);
      }
      const [rows] = await pool.execute(feedSql, feedParams);
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `${type} with ID ${id} not found`,
        });
      }
      const r = rows[0];
      const item = {
        id: r.id,
        orgCode: r.org_code,
        type: cleanType || r.feed_type || 'feed',
        title: r.title,
        summary: r.summary,
        status: r.status,
        view: 'view',
        payload: { feed_type: r.feed_type, ref_table: r.ref_table, ref_id: r.ref_id, img: r.img },
        createdBy: r.maker || currentUser || 'Organization Admin',
        created_by_name: r.maker || currentUser || 'Organization Admin',
      };
      return res.status(200).json({ success: true, item, data: item });
    } catch (error) {
      console.error('[ContentController.getContentDetail] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch content detail',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/content/:type
  async createContent(req, res) {
    try {
      const { type } = req.params;
      let insertId = 0;
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || req.query.org_code || user?.org_code || req.user?.org_code || null;
      const title = req.body.title || req.body.name || req.body.page_name || 'Untitled';
      const summary = req.body.summary || req.body.description || null;
      const status = req.body.status || 'draft';
      const payload = req.body.payload || req.body;
      const view = req.body.view || payload?.view || 'view';
      const currentUser = await getUserFullName(req);

      const cleanType = String(type || '').toLowerCase();

      if (cleanType === 'spaces' || cleanType === 'space' || cleanType === 'explore_spaces' || cleanType === 'explore_space') {
        return spacesController.createSpace(req, res);
      }

      if (cleanType === 'blogs' || cleanType === 'blog') {
        const fullPayloadJson = typeof payload === 'object' ? JSON.stringify(payload) : (payload?.blog_content || payload?.post_content || null);
        const blogData = {
          highlighter: payload?.highlighter || payload?.blog_category || null,
          title,
          description: summary || payload?.seo_meta_description || payload?.description || null,
          written_by: payload?.author_name || payload?.written_by || currentUser,
          status,
          primary_image: payload?.featured_image || payload?.primary_image || null,
          post_content: fullPayloadJson,
        };
        const created = await contentService.createBlog(orgCode, blogData);
        insertId = created.id;

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgUrl = payload?.featured_image || payload?.primary_image || null;
          const imgAlt = payload?.image_alt_text || null;
          const relPdts = payload?.related_products || null;
          const robotTag = payload?.robots_tag || payload?.robot || 'index, follow';

          const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
          const routeId = rRows[0]?.id || 1;

          await pool.execute(
            `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, status, content_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
             ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), img=VALUES(img), img_alt=VALUES(img_alt), related_products=VALUES(related_products), robot=VALUES(robot)`,
            [orgCode, routeId, `blog-${insertId}`, seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag]
          );
        } catch (seoErr) {
          console.error('[ContentController.createContent] Warning - tb_web_seo insert failed for blog:', seoErr.message);
        }

      } else if (cleanType === 'careers' || cleanType === 'career') {
        const careerData = {
          title,
          department: payload?.department || null,
          location: payload?.location || null,
          employment_type: payload?.employment_type || null,
          description: payload?.description || summary || null,
          requirements: Array.isArray(payload?.requirements) ? JSON.stringify(payload.requirements) : (payload?.requirements || null),
          apply_link: payload?.apply_email || payload?.apply_link || null,
          status,
        };
        const created = await contentService.createCareer(orgCode, careerData);
        insertId = created.id;

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const robotTag = payload?.robots_tag || payload?.robot || 'index, follow';

          const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
          const routeId = rRows[0]?.id || 1;

          await pool.execute(
            `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, robot, status, content_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
             ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), robot=VALUES(robot)`,
            [orgCode, routeId, `career-${insertId}`, seoTitle, seoDesc, focusKw, secKw, robotTag]
          );
        } catch (seoErr) {
          console.error('[ContentController.createContent] Warning - tb_web_seo insert failed for career:', seoErr.message);
        }

      } else if (cleanType === 'catalogs' || cleanType === 'catalog') {
        const catalogData = {
          name: title || payload?.catalog_name || payload?.name || 'Untitled Catalog',
          category: payload?.category || payload?.catalog_category || null,
          file_url: payload?.file_url || payload?.pdf_url || '#',
          thumbnail_img: payload?.thumbnail_img || payload?.thumbnail || payload?.cover_image || null,
          publish_year: payload?.publish_year || null,
          product_page_thumbnail: payload?.product_page_thumbnail || null,
          page_name: payload?.page_name || payload?.label || null,
          image_1: payload?.image_1 || null,
          image_2: payload?.image_2 || null,
          page_groups: payload?.page_groups || null,
          status,
        };
        const created = await contentService.createCatalog(orgCode, catalogData);
        insertId = created.id;

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgUrl = payload?.thumbnail_img || payload?.thumbnail || payload?.cover_image || null;
          const imgAlt = payload?.image_alt_text || null;
          const robotTag = payload?.robots_tag || payload?.robot || 'index, follow';

          const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
          const routeId = rRows[0]?.id || 1;

          await pool.execute(
            `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, robot, status, content_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
             ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), img=VALUES(img), img_alt=VALUES(img_alt), robot=VALUES(robot)`,
            [orgCode, routeId, `catalog-${insertId}`, seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, robotTag]
          );
        } catch (seoErr) {
          console.error('[ContentController.createContent] Warning - tb_web_seo insert failed for catalog:', seoErr.message);
        }
      } else if (cleanType === 'category' || cleanType === 'subcategory' || cleanType === 'cat' || cleanType === 'sc' || cleanType === 's2c') {
        const imgUrl = payload?.category_image || payload?.subcategory_image || payload?.img || null;
        const bannerImg = payload?.banner_img || payload?.banner_image || null;
        const catalogId = payload?.catalog_id ? Number(payload.catalog_id) : null;
        const parentId = Number(payload?.parent_id || payload?.parent_cat_id || 0);
        const descText = payload?.description || summary || '';
        const urlSlug = payload?.url_slug || payload?.urlSlug || payload?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        let levelPrefix = 'cat';
        let itemType = 'cat';
        const rawChoice = String(payload?.type || cleanType).toLowerCase();

        if (cleanType === 's2c' || rawChoice === 's2c' || rawChoice === 'sub sub category' || rawChoice === 'subsubcategory') {
          levelPrefix = 's2c';
          itemType = 's2c';
        } else if (cleanType === 'sc' || cleanType === 'subcategory' || rawChoice === 'sc' || rawChoice === 'sub category' || rawChoice === 'subcategory') {
          levelPrefix = 'sc';
          itemType = 'sc';
        } else if (parentId > 0) {
          try {
            const [pRows] = await pool.execute('SELECT parent_id FROM tb_pdt_categories WHERE id = ?', [parentId]);
            if (pRows[0] && pRows[0].parent_id > 0) {
              levelPrefix = 's2c';
              itemType = 's2c';
            } else {
              levelPrefix = 'sc';
              itemType = 'sc';
            }
          } catch (e) {
            levelPrefix = 'sc';
            itemType = 'sc';
          }
        }

        const [orderRows] = await pool.execute(
          'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM tb_pdt_categories'
        );
        const sortOrder = orderRows[0]?.next_order || 1;

        const [result] = await pool.execute(
          `INSERT INTO tb_pdt_categories (org_code, type, parent_id, category, description, img, banner_img, catalog_id, url_slug, sort_order, status, view, content_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [orgCode, itemType, parentId, title, descText, imgUrl, bannerImg, catalogId, urlSlug, sortOrder, status, view || 'view']
        );
        insertId = result.insertId;

        try {
          const { prodPool } = require('../../resources/connection');
          if (prodPool) {
            await prodPool.execute(
              `INSERT INTO tb_pdt_categories (id, org_code, type, parent_id, category, description, img, banner_img, catalog_id, url_slug, sort_order, status, content_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order)`,
              [insertId, orgCode, itemType, parentId, title, descText, imgUrl, bannerImg, catalogId, urlSlug, sortOrder, status]
            );
          }
        } catch (pErr) { }

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgAlt = payload?.image_alt_text || null;
          const relPdts = payload?.related_products || null;
          const robotTag = payload?.robot || 'index, follow';

          const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
          const routeId = rRows[0]?.id || 1;

          await pool.execute(
            `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, status, content_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
             ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), img=VALUES(img), img_alt=VALUES(img_alt), related_products=VALUES(related_products), robot=VALUES(robot)`,
            [orgCode, routeId, `cat-${insertId}`, seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag]
          );
        } catch (seoErr) {
          console.error('[ContentController.createContent] Warning - tb_web_seo insert failed:', seoErr.message);
        }

        await logAudit({
          orgCode,
          tableName: 'tb_pdt_categories',
          recordId: insertId,
          action: 'insert',
          maker: currentUser,
          message: `Created category "${title}"`,
          newVal: { ...payload, view },
        });

      } else if (type === 'product') {
        const parentId = Number(payload?.parent_id || payload?.sub_sub_cat_id || payload?.sub_cat_id || payload?.cat_id) || 1;
        const pdtCode = String(payload?.productCode || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const primaryImg = payload?.product_image || null;
        const brand = payload?.brand || payload?.product_brand || null;
        const defaultColour = payload?.default_colour || payload?.primary_colour || null;
        const coloursStr = payload?.colours ? (typeof payload.colours === 'object' ? JSON.stringify(payload.colours) : String(payload.colours)) : null;
        const kitsStr = payload?.kits ? (typeof payload.kits === 'object' ? JSON.stringify(payload.kits) : String(payload.kits)) : null;
        const urlSlug = payload?.url_slug || payload?.urlSlug || payload?.slug || pdtCode.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const [orderRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM tb_pdt_products');
        const sortOrder = orderRows[0]?.next_order || 1;

        const [result] = await pool.execute(
          `INSERT INTO tb_pdt_products (org_code, parent_id, pdt_code, product, primary_img, brand, default_colour, colours, url_slug, sort_order, status, content_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [orgCode, parentId, pdtCode, title, primaryImg, brand, defaultColour, coloursStr, urlSlug, sortOrder, status]
        );
        insertId = result.insertId;

        const pdtDesc = payload?.productDescription || summary || title;
        const featuresStr = payload?.product_features ? JSON.stringify(payload.product_features) : null;
        const specsStr = payload?.product_specifications ? JSON.stringify(payload.product_specifications) : null;
        const addlFeaturesStr = payload?.addl_features ? JSON.stringify(payload.addl_features) : null;
        const pdtImgsStr = payload?.other_images ? JSON.stringify(payload.other_images) : null;
        const variantsStr = payload?.variants ? JSON.stringify(payload.variants) : null;
        const accesStr = payload?.acces ? (typeof payload.acces === 'object' ? JSON.stringify(payload.acces) : String(payload.acces)) : null;
        const relatedPdtsStr = payload?.related_pdts || payload?.related_products ? (typeof (payload.related_pdts || payload.related_products) === 'object' ? JSON.stringify(payload.related_pdts || payload.related_products) : String(payload.related_pdts || payload.related_products)) : null;

        await pool.execute(
          `INSERT INTO tb_pdt_product_info (pdt_id, \`desc\`, features, specs, addl_features, pdt_imgs, variants, acces, related_pdts, brand, default_colour, colours, kits, content_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [insertId, pdtDesc, featuresStr, specsStr, addlFeaturesStr, pdtImgsStr, variantsStr, accesStr, relatedPdtsStr, brand, defaultColour, coloursStr, kitsStr]
        );

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgAlt = payload?.image_alt_text || null;
          const relPdts = payload?.related_products || null;
          const robotTag = payload?.robot || 'index, follow';

          const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
          const routeId = rRows[0]?.id || 1;

          await pool.execute(
            `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, status, content_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)`,
            [orgCode, routeId, String(insertId), seoTitle, seoDesc, focusKw, secKw, primaryImg, imgAlt, relPdts, robotTag]
          );
        } catch (seoErr) {
          console.error('[ContentController.createContent] Warning - tb_web_seo insert failed for product:', seoErr.message);
        }

        await logAudit({
          orgCode,
          tableName: 'tb_pdt_products',
          recordId: insertId,
          action: 'insert',
          maker: currentUser,
          message: `Created product "${title}"`,
          newVal: { ...payload, view },
        });

      } else if (type === 'variant') {
        const pdtId = Number(payload?.product_id) || 1;
        const varCode = String(payload?.variantCode || payload?.variant_code || payload?.var_code || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const sku = String(payload?.sku || varCode);
        const price = Number(payload?.price) || 0;
        const discount = Number(payload?.discount) || 0;
        const discountType = payload?.discount_type || 'percentage';
        const colour = payload?.colour || payload?.color_finish || payload?.color || null;
        const primaryImg = payload?.primary_img || payload?.image_url || payload?.variant_image || payload?.img || null;
        const imgsStr = (payload?.other_images || payload?.imgs) ? JSON.stringify(payload.other_images || payload.imgs) : null;
        const urlSlug = payload?.url_slug || payload?.variant_slug || payload?.variantSlug || payload?.slug || varCode.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const [orderRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM tb_pdt_variants');
        const sortOrder = orderRows[0]?.next_order || 1;

        try {
          const [result] = await pool.execute(
            `INSERT INTO tb_pdt_variants (org_code, pdt_id, var_code, name, colour, price, discount, discount_type, sku, primary_img, imgs, url_slug, sort_order, status, content_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [orgCode, pdtId, varCode, title, colour, price, discount, discountType, sku, primaryImg, imgsStr, urlSlug, sortOrder, status]
          );
          insertId = result.insertId;
        } catch (dbErr) {
          if (dbErr.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: `Constraint Failure: Variant Code "${varCode}" or SKU "${sku}" already exists in the system.` });
          }
          throw dbErr;
        }

        await logAudit({
          orgCode,
          tableName: 'tb_pdt_variants',
          recordId: insertId,
          action: 'insert',
          maker: currentUser,
          message: `Created variant "${title}"`,
          newVal: { ...payload, view },
        });

      } else if (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') {
        const seoTitle = payload?.seo_meta_title || title || 'Untitled Page';
        const seoDesc = payload?.seo_meta_description || summary || null;
        const focusKw = payload?.focus_keyword || null;
        const secKw = payload?.secondary_keywords || null;
        const imgUrl = payload?.featured_image || payload?.og_image || payload?.img || null;
        const imgAlt = payload?.image_alt_text || null;
        const relPdts = payload?.related_products || null;
        const robotTag = payload?.robots_tag || payload?.robot || 'index, follow';
        const routeExt = payload?.url_slug || payload?.page_url || payload?.route_ext || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const canonicalUrl = payload?.canonical_url || null;
        const ogTitle = payload?.og_title || seoTitle;
        const ogDesc = payload?.og_description || seoDesc;
        const schemaType = payload?.schema_type || null;

        const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
        const routeId = rRows[0]?.id || 1;

        const [result] = await pool.execute(
          `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, canonical_url, og_title, og_description, schema_type, status, view, is_page_seo, content_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
          [orgCode, routeId, routeExt, seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag, canonicalUrl, ogTitle, ogDesc, schemaType, status, view || 'view']
        );
        insertId = result.insertId;

        await logAudit({
          orgCode,
          tableName: 'tb_web_seo',
          recordId: insertId,
          action: 'insert',
          maker: currentUser,
          message: `Created SEO Page "${seoTitle}"`,
          newVal: { ...payload, view },
        });

      } else {
        const [result] = await pool.execute(
          `INSERT INTO tb_web_feed (org_code, feed_type, ref_table, ref_id, title, summary, img, status) VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
          [orgCode, cleanType || 'announcement', `tb_${cleanType}`, title, summary, payload?.img || payload?.image || null, status]
        );
        insertId = result.insertId;
      }

      const targetTable =
        cleanType === 'category' ? 'tb_pdt_categories' :
          cleanType === 'subcategory' ? 'tb_pdt_sub_categories' :
            cleanType === 'product' ? 'tb_pdt_products' :
              cleanType === 'variant' ? 'tb_pdt_variants' :
                (cleanType === 'blogs' || cleanType === 'blog') ? 'tb_web_blogs' :
                  (cleanType === 'careers' || cleanType === 'career') ? 'tb_web_careers' :
                    (cleanType === 'catalogs' || cleanType === 'catalog') ? 'tb_web_catalogs' :
                      (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') ? 'tb_web_seo' :
                        (cleanType === 'ui_element' || cleanType === 'ui' || cleanType === 'uielements' || cleanType === 'ui-elements') ? 'tb_web_feed' :
                          `tb_cpanel_${cleanType}`;

      const calculatedStatus = await evaluateApprovalRuleAndStatus({ orgCode, type: cleanType, title, insertId, tableName: targetTable, req });

      if (calculatedStatus !== status) {
        if (cleanType === 'category') {
          await pool.execute(`UPDATE tb_pdt_categories SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'subcategory') {
          await pool.execute(`UPDATE tb_pdt_sub_categories SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'product') {
          await pool.execute(`UPDATE tb_pdt_products SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'variant') {
          await pool.execute(`UPDATE tb_pdt_variants SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'blogs' || cleanType === 'blog') {
          await pool.execute(`UPDATE tb_web_blogs SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'careers' || cleanType === 'career') {
          await pool.execute(`UPDATE tb_web_careers SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'catalogs' || cleanType === 'catalog') {
          await pool.execute(`UPDATE tb_web_catalogs SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else if (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') {
          await pool.execute(`UPDATE tb_web_seo SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        } else {
          await pool.execute(`UPDATE tb_web_feed SET status = ? WHERE id = ?`, [calculatedStatus, insertId]);
        }
      }

      const item = {
        id: insertId,
        orgCode,
        type,
        title,
        summary,
        status: calculatedStatus,
        view,
        payload,
        createdBy: currentUser,
        created_by_name: currentUser,
      };

      return res.status(201).json({
        success: true,
        message: `${type} saved successfully`,
        item,
        data: item,
      });
    } catch (error) {
      console.error('[ContentController.createContent] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create content',
        error: error.message,
      });
    }
  }

  // PUT /cpanel-api/content/:type/:id
  async updateContent(req, res) {
    try {
      const { type, id } = req.params;
      const cleanType = String(type || '').toLowerCase();

      if (cleanType === 'spaces' || cleanType === 'space' || cleanType === 'explore_spaces' || cleanType === 'explore_space') {
        return spacesController.updateSpace(req, res);
      }

      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || req.query.org_code || user?.org_code || req.user?.org_code || null;
      const title = req.body.title || req.body.name || 'Untitled';
      const summary = req.body.summary || null;
      const requestedStatus = String(req.body.status || '').toLowerCase();
      const isDeactivating = ['inactive', 'deleted', 'archived'].includes(requestedStatus);
      let status = req.body.status || 'draft';
      const payload = req.body.payload || req.body;
      const currentUser = await getUserFullName(req);

      const targetTable =
        cleanType === 'category' ? 'tb_pdt_categories' :
          cleanType === 'subcategory' ? 'tb_pdt_sub_categories' :
            cleanType === 'product' ? 'tb_pdt_products' :
              cleanType === 'variant' ? 'tb_pdt_variants' :
                (cleanType === 'blogs' || cleanType === 'blog') ? 'tb_web_blogs' :
                  (cleanType === 'careers' || cleanType === 'career') ? 'tb_web_careers' :
                    (cleanType === 'catalogs' || cleanType === 'catalog') ? 'tb_web_catalogs' :
                      (cleanType === 'seo') ? 'tb_web_seo' :
                        (cleanType === 'ui_element' || cleanType === 'ui' || cleanType === 'uielements' || cleanType === 'ui-elements') ? 'tb_web_feed' :
                          `tb_cpanel_${cleanType}`;

      const isLocked = await checkPendingApprovalLock(targetTable, id);
      if (isLocked) {
        return res.status(400).json({
          success: false,
          error: 'Record Locked',
          message: 'This record is currently pending approval and cannot be modified until it is reviewed by a checker.',
        });
      }

      const calculatedStatus = await evaluateApprovalRuleAndStatus({
        orgCode,
        type: cleanType,
        title,
        insertId: Number(id),
        tableName: targetTable,
        req,
      });
      // Preserve explicit deactivation status when no checker approval is pending
      status = (isDeactivating && calculatedStatus !== 'pending_approval')
        ? requestedStatus
        : calculatedStatus;

      if (cleanType === 'blogs' || cleanType === 'blog') {
        let oldVal = null;
        try {
          const [oldRows] = await pool.execute(`SELECT * FROM tb_web_blogs WHERE id = ?`, [id]);
          if (oldRows.length > 0) oldVal = oldRows[0];
        } catch (e) { }

        await pool.execute(
          `UPDATE tb_web_blogs SET title = ?, description = ?, written_by = ?, highlighter = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [title, summary || payload?.seo_meta_description || payload?.description || null, payload?.author_name || null, payload?.blog_category || null, status, id]
        );

        const fullPayloadJson = typeof payload === 'object' ? JSON.stringify(payload) : (payload?.blog_content || payload?.post_content || null);
        await pool.execute(
          `INSERT INTO tb_web_blog_content (blog_id, primary_image, post_content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE primary_image=VALUES(primary_image), post_content=VALUES(post_content)`,
          [id, payload?.featured_image || payload?.primary_image || null, fullPayloadJson]
        );

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgUrl = payload?.featured_image || payload?.primary_image || null;
          const imgAlt = payload?.image_alt_text || null;
          const relPdts = payload?.related_products || null;
          const robotTag = payload?.robots_tag || payload?.robot || 'index, follow';

          const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
          const routeId = rRows[0]?.id || 1;

          await pool.execute(
            `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, status, content_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
             ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), img=VALUES(img), img_alt=VALUES(img_alt), related_products=VALUES(related_products), robot=VALUES(robot)`,
            [orgCode, routeId, `blog-${id}`, seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag]
          );
        } catch (seoErr) { }

        await logAudit({
          orgCode,
          tableName: 'tb_web_blogs',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated blog ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });

      } else if (cleanType === 'careers' || cleanType === 'career') {
        let oldVal = null;
        try {
          const [oldRows] = await pool.execute(`SELECT * FROM tb_web_careers WHERE id = ?`, [id]);
          if (oldRows.length > 0) oldVal = oldRows[0];
        } catch (e) { }
        await pool.execute(
          `UPDATE tb_web_careers SET title = ?, department = ?, location = ?, employment_type = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [title, payload.department || null, payload.location || null, payload.employment_type || null, summary || payload.description || null, status, id]
        );
        await logAudit({
          orgCode,
          tableName: 'tb_web_careers',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated career ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });

      } else if (cleanType === 'catalogs' || cleanType === 'catalog') {
        let oldVal = null;
        try {
          const [oldRows] = await pool.execute(`SELECT * FROM tb_web_catalogs WHERE id = ?`, [id]);
          if (oldRows.length > 0) oldVal = oldRows[0];
        } catch (e) { }
        const pageGroupsStr = payload?.page_groups ? (typeof payload.page_groups === 'object' ? JSON.stringify(payload.page_groups) : String(payload.page_groups)) : (oldVal?.page_groups || null);
        await pool.execute(
          `UPDATE tb_web_catalogs SET name = ?, category = ?, file_url = ?, thumbnail_img = ?, publish_year = ?, product_page_thumbnail = ?, page_name = ?, image_1 = ?, image_2 = ?, page_groups = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [
            title,
            payload.category || null,
            payload.file_url || '#',
            payload.thumbnail_img || null,
            payload.publish_year || null,
            payload.product_page_thumbnail || null,
            payload.page_name || payload.label || null,
            payload.image_1 || null,
            payload.image_2 || null,
            pageGroupsStr,
            status,
            id
          ]
        );
        await logAudit({
          orgCode,
          tableName: 'tb_web_catalogs',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated catalog ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });

      } else if (cleanType === 'category' || cleanType === 'subcategory') {
        let oldVal = null;
        try {
          const [oldCatRows] = await pool.execute(`SELECT * FROM tb_pdt_categories WHERE id = ?`, [id]);
          const [oldSeoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR title = ?) ORDER BY id DESC LIMIT 1`,
            [`cat-${id}`, String(id), title]
          );
          if (oldCatRows.length > 0) {
            oldVal = { ...oldCatRows[0], seo: oldSeoRows[0] || null };
          }
        } catch (e) { }

        const imgUrl = payload?.category_image || payload?.subcategory_image || payload?.img || null;
        const bannerImg = payload?.banner_img || payload?.banner_image || null;
        const catalogId = payload?.catalog_id ? Number(payload.catalog_id) : null;
        const itemType = payload?.type || (cleanType === 'subcategory' ? 'sub category' : 'category');
        const parentId = Number(payload?.parent_id || payload?.parent_cat_id || 0);
        const descText = payload?.description || summary || '';
        const nextView = payload?.view || req.body?.view || oldVal?.view || 'view';
        const urlSlug = payload?.url_slug !== undefined ? payload.url_slug : (oldVal?.url_slug || null);

        await pool.execute(
          `UPDATE tb_pdt_categories SET category = ?, type = ?, parent_id = ?, description = ?, img = ?, banner_img = ?, catalog_id = ?, url_slug = ?, status = ?, view = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [title, itemType, parentId, descText, imgUrl, bannerImg, catalogId, urlSlug, status, nextView, id]
        );

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgAlt = payload?.image_alt_text || null;
          const relPdts = payload?.related_products || null;
          const robotTag = payload?.robot || 'index, follow';

          const [uRes] = await pool.execute(
            `UPDATE tb_web_seo SET title = ?, description = ?, focus_keywords = ?, keywords = ?, img = ?, img_alt = ?, related_products = ?, robot = ? WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'category%' OR route_ext LIKE 'cat%'))) AND LOWER(org_code) = LOWER(?)`,
            [seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag, `cat-${id}`, String(id), title, orgCode]
          );

          if (uRes.affectedRows === 0) {
            const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
            const routeId = rRows[0]?.id || 1;
            await pool.execute(
              `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, status, content_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
               ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), img=VALUES(img), img_alt=VALUES(img_alt), related_products=VALUES(related_products), robot=VALUES(robot)`,
              [orgCode, routeId, `cat-${id}`, seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag]
            );
          }
        } catch (seoErr) {
          console.error('[ContentController.updateContent] Warning - tb_web_seo update failed:', seoErr.message);
        }

        await logAudit({
          orgCode,
          tableName: 'tb_pdt_categories',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated category ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });

      } else if (type === 'product') {
        let oldVal = null;
        try {
          const [oldPdtRows] = await pool.execute(
            `SELECT p.*, info.desc, info.features, info.specs, info.pdt_imgs, info.variants, info.kits FROM tb_pdt_products p LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id WHERE p.id = ?`,
            [id]
          );
          const [oldSeoRows] = await pool.execute(
            `SELECT * FROM tb_web_seo WHERE (route_ext = ? OR route_ext = ? OR title = ?) ORDER BY id DESC LIMIT 1`,
            [`prd-${id}`, String(id), title]
          );
          if (oldPdtRows.length > 0) {
            oldVal = { ...oldPdtRows[0], seo: oldSeoRows[0] || null };
          }
        } catch (e) { }

        const parentId = Number(payload?.parent_id || payload?.sub_sub_cat_id || payload?.sub_cat_id || payload?.cat_id) || 1;
        const pdtCode = String(payload?.productCode || id);
        const primaryImg = payload?.product_image || null;
        const brand = payload?.brand || payload?.product_brand || null;
        const defaultColour = payload?.default_colour || payload?.primary_colour || null;
        const coloursStr = payload?.colours ? (typeof payload.colours === 'object' ? JSON.stringify(payload.colours) : String(payload.colours)) : null;
        const kitsStr = payload?.kits ? (typeof payload.kits === 'object' ? JSON.stringify(payload.kits) : String(payload.kits)) : null;
        const urlSlug = payload?.url_slug !== undefined ? payload.url_slug : (oldVal?.url_slug || null);

        await pool.execute(
          `UPDATE tb_pdt_products SET parent_id = ?, pdt_code = ?, product = ?, primary_img = ?, brand = ?, default_colour = ?, colours = ?, url_slug = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [parentId, pdtCode, title, primaryImg, brand, defaultColour, coloursStr, urlSlug, status, id]
        );

        const pdtDesc = payload?.productDescription || summary || title;
        const featuresStr = payload?.product_features ? JSON.stringify(payload.product_features) : null;
        const specsStr = payload?.product_specifications ? JSON.stringify(payload.product_specifications) : null;
        const addlFeaturesStr = payload?.addl_features ? JSON.stringify(payload.addl_features) : null;
        const pdtImgsStr = payload?.other_images ? JSON.stringify(payload.other_images) : null;
        const variantsStr = payload?.variants ? JSON.stringify(payload.variants) : null;
        const accesStr = payload?.acces ? (typeof payload.acces === 'object' ? JSON.stringify(payload.acces) : String(payload.acces)) : null;
        const relatedPdtsStr = payload?.related_pdts || payload?.related_products ? (typeof (payload.related_pdts || payload.related_products) === 'object' ? JSON.stringify(payload.related_pdts || payload.related_products) : String(payload.related_pdts || payload.related_products)) : null;

        await pool.execute(
          `UPDATE tb_pdt_product_info SET \`desc\` = ?, features = ?, specs = ?, addl_features = ?, pdt_imgs = ?, variants = ?, acces = ?, related_pdts = ?, brand = ?, default_colour = ?, colours = ?, kits = ? WHERE pdt_id = ?`,
          [pdtDesc, featuresStr, specsStr, addlFeaturesStr, pdtImgsStr, variantsStr, accesStr, relatedPdtsStr, brand, defaultColour, coloursStr, kitsStr, id]
        );

        try {
          const seoTitle = payload?.seo_meta_title || title;
          const seoDesc = payload?.seo_meta_description || summary || title;
          const focusKw = payload?.focus_keyword || null;
          const secKw = payload?.secondary_keywords || null;
          const imgAlt = payload?.image_alt_text || null;
          const relPdts = payload?.related_products || null;
          const robotTag = payload?.robot || 'index, follow';

          const [uRes] = await pool.execute(
            `UPDATE tb_web_seo SET title = ?, description = ?, focus_keywords = ?, keywords = ?, img = ?, img_alt = ?, related_products = ?, robot = ? WHERE (route_ext = ? OR route_ext = ? OR (LOWER(title) = LOWER(?) AND (route_ext LIKE 'product%' OR route_ext LIKE 'prd%'))) AND LOWER(org_code) = LOWER(?)`,
            [seoTitle, seoDesc, focusKw, secKw, primaryImg, imgAlt, relPdts, robotTag, `prd-${id}`, String(id), title, orgCode]
          );

          if (uRes.affectedRows === 0) {
            const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
            const routeId = rRows[0]?.id || 1;
            await pool.execute(
              `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, img_alt, related_products, robot, status, content_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
               ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), focus_keywords=VALUES(focus_keywords), keywords=VALUES(keywords), img=VALUES(img), img_alt=VALUES(img_alt), related_products=VALUES(related_products), robot=VALUES(robot)`,
              [orgCode, routeId, `prd-${id}`, seoTitle, seoDesc, focusKw, secKw, primaryImg, imgAlt, relPdts, robotTag]
            );
          }
        } catch (seoErr) {
          console.error('[ContentController.updateContent] Warning - tb_web_seo update failed for product:', seoErr.message);
        }

        await logAudit({
          orgCode,
          tableName: 'tb_pdt_products',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated product ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });

      } else if (type === 'variant') {
        let oldVal = null;
        try {
          const [oldVarRows] = await pool.execute(`SELECT * FROM tb_pdt_variants WHERE id = ?`, [id]);
          if (oldVarRows.length > 0) oldVal = oldVarRows[0];
        } catch (e) { }

        const pdtId = Number(payload?.product_id) || 1;
        const varCode = String(payload?.variantCode || payload?.variant_code || payload?.var_code || id);
        const sku = String(payload?.sku || varCode);
        const price = Number(payload?.price) || 0;
        const discount = Number(payload?.discount) || 0;
        const discountType = payload?.discount_type || 'percentage';
        const colour = payload?.colour || payload?.color_finish || payload?.color || null;
        const primaryImg = payload?.primary_img || payload?.image_url || payload?.variant_image || payload?.img || null;
        const imgsStr = (payload?.other_images || payload?.imgs) ? JSON.stringify(payload.other_images || payload.imgs) : null;
        const urlSlug = payload?.url_slug !== undefined ? (payload.url_slug || payload.variant_slug || payload.variantSlug) : (oldVal?.url_slug || null);

        try {
          await pool.execute(
            `UPDATE tb_pdt_variants SET org_code = ?, pdt_id = ?, var_code = ?, name = ?, colour = ?, price = ?, discount = ?, discount_type = ?, sku = ?, primary_img = ?, imgs = ?, url_slug = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [orgCode, pdtId, varCode, title, colour, price, discount, discountType, sku, primaryImg, imgsStr, urlSlug, status, id]
          );
        } catch (dbErr) {
          if (dbErr.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: `Constraint Failure: Variant Code "${varCode}" or SKU "${sku}" belongs to another variant.` });
          }
          throw dbErr;
        }

        await logAudit({
          orgCode,
          tableName: 'tb_pdt_variants',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated variant ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });

      } else if (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') {
        let oldVal = null;
        try {
          const [oldSeoRows] = await pool.execute(`SELECT * FROM tb_web_seo WHERE id = ?`, [id]);
          if (oldSeoRows.length > 0) oldVal = oldSeoRows[0];
        } catch (e) { }

        const seoTitle = payload?.seo_meta_title || title || 'Untitled Page';
        const seoDesc = payload?.seo_meta_description || summary || null;
        const focusKw = payload?.focus_keyword || null;
        const secKw = payload?.secondary_keywords || null;
        const imgUrl = payload?.featured_image || payload?.og_image || payload?.img || null;
        const imgAlt = payload?.image_alt_text || null;
        const relPdts = payload?.related_products || null;
        const robotTag = payload?.robots_tag || payload?.robot || 'index, follow';
        const routeExt = payload?.url_slug || payload?.page_url || payload?.route_ext || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const canonicalUrl = payload?.canonical_url || null;
        const ogTitle = payload?.og_title || seoTitle;
        const ogDesc = payload?.og_description || seoDesc;
        const schemaType = payload?.schema_type || null;

        await pool.execute(
          `UPDATE tb_web_seo SET title = ?, description = ?, focus_keywords = ?, keywords = ?, img = ?, img_alt = ?, related_products = ?, robot = ?, route_ext = ?, canonical_url = ?, og_title = ?, og_description = ?, schema_type = ?, status = ?, view = ?, is_page_seo = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [seoTitle, seoDesc, focusKw, secKw, imgUrl, imgAlt, relPdts, robotTag, routeExt, canonicalUrl, ogTitle, ogDesc, schemaType, status, payload?.view || 'view', id]
        );

        await logAudit({
          orgCode,
          tableName: 'tb_web_seo',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated SEO page ID #${id} "${seoTitle}"`,
          oldVal,
          newVal: payload,
        });

      } else {
        let oldVal = null;
        try {
          const [oldItemRows] = await pool.execute(
            `SELECT * FROM tb_web_feed WHERE id = ?`,
            [id]
          );
          if (oldItemRows.length > 0) oldVal = oldItemRows[0];
        } catch (e) { }

        await pool.execute(
          `UPDATE tb_web_feed SET title = ?, summary = ?, status = ? WHERE id = ?`,
          [title, summary, status, id]
        );

        await logAudit({
          orgCode,
          tableName: 'tb_web_feed',
          recordId: id,
          action: 'update',
          maker: currentUser,
          message: `Updated ${type} ID #${id} "${title}"`,
          oldVal,
          newVal: payload,
        });
      }

      const item = {
        id: Number(id),
        orgCode,
        type,
        title,
        summary,
        status,
        payload,
        createdBy: currentUser,
        created_by_name: currentUser,
      };

      return res.status(200).json({
        success: true,
        message: `${type} updated successfully`,
        item,
        data: item,
      });
    } catch (error) {
      console.error('[ContentController.updateContent] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update content',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/content/:type/:id
  async deleteContent(req, res) {
    try {
      const { type, id } = req.params;
      const cleanType = String(type || '').toLowerCase();

      if (cleanType === 'spaces' || cleanType === 'space' || cleanType === 'explore_spaces' || cleanType === 'explore_space') {
        return spacesController.deleteSpace(req, res);
      }

      const currentUser = await getUserFullName(req);
      let oldVal = null;

      if (cleanType === 'category') {
        const [rows] = await pool.execute(`SELECT * FROM tb_pdt_categories WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_pdt_categories SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'subcategory') {
        const [rows] = await pool.execute(`SELECT * FROM tb_pdt_sub_categories WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_pdt_sub_categories SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'product') {
        const [rows] = await pool.execute(`SELECT * FROM tb_pdt_products WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_pdt_products SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'variant') {
        const [rows] = await pool.execute(`SELECT * FROM tb_pdt_variants WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_pdt_variants SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'blogs' || cleanType === 'blog') {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_blogs WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_web_blogs SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'careers' || cleanType === 'career') {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_careers WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_web_careers SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'catalogs' || cleanType === 'catalog') {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_catalogs WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_web_catalogs SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else if (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_seo WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(`UPDATE tb_web_seo SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
      } else {
        const [rows] = await pool.execute(`SELECT * FROM tb_web_feed WHERE id = ?`, [id]);
        if (rows.length > 0) oldVal = rows[0];
        await pool.execute(
          `UPDATE tb_web_feed SET status = 'archived' WHERE id = ?`,
          [id]
        );
      }

      await logAudit({
        orgCode: req.user?.org_code || req.query?.org_code,
        tableName: cleanType === 'category' ? 'tb_pdt_categories' : cleanType === 'subcategory' ? 'tb_pdt_sub_categories' : cleanType === 'product' ? 'tb_pdt_products' : (cleanType === 'blogs' || cleanType === 'blog') ? 'tb_web_blogs' : (cleanType === 'careers' || cleanType === 'career') ? 'tb_web_careers' : (cleanType === 'catalogs' || cleanType === 'catalog') ? 'tb_web_catalogs' : (cleanType === 'seo' || cleanType === 'seo_page' || cleanType === 'seo_pages' || cleanType === 'seopage') ? 'tb_web_seo' : 'tb_web_feed',
        recordId: id,
        action: 'delete',
        maker: currentUser,
        message: `Soft-deleted ${type} ID #${id} (status: deleted)`,
        oldVal,
      });

      return res.status(200).json({
        success: true,
        message: `${type} deleted successfully`,
      });
    } catch (error) {
      console.error('[ContentController.deleteContent] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete content',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/content/upload-image
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided',
        });
      }

      const host = req.get('host') || 'localhost:8788';
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      return res.status(200).json({
        success: true,
        url: fileUrl,
        file_url: fileUrl,
        filename: req.file.filename,
        message: 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('[ContentController.uploadImage] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Image upload failed',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/content/products/export-template
  async exportProductsTemplate(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.query?.org_code || user?.org_code || 'taiton';
      const templatePath = path.join(__dirname, '../../../../Onboard Products.xlsx');
      const { buildOnboardProductsExcel } = require('../utils/generateOnboardProductsExcel');

      // Fetch dynamic database categories, products, catalogs, brands, and colours for dropdown generation
      let cats = [];
      let pdts = [];
      let catls = [];
      let brands = [];
      let colours = [];

      try {
        const [cRows] = await pool.execute(
          `SELECT id, type, parent_id, category FROM tb_pdt_categories WHERE LOWER(org_code) = LOWER(?) AND LOWER(status) != 'deleted' ORDER BY id ASC`,
          [orgCode]
        );
        cats = cRows || [];
      } catch (cErr) {
        console.warn('[exportProductsTemplate] Warning fetching categories for template dropdowns:', cErr.message);
      }

      try {
        const [pRows] = await pool.execute(
          `SELECT id, pdt_code, product FROM tb_pdt_products WHERE LOWER(org_code) = LOWER(?) AND LOWER(status) != 'deleted' ORDER BY id ASC`,
          [orgCode]
        );
        pdts = pRows || [];
      } catch (pErr) {
        console.warn('[exportProductsTemplate] Warning fetching products for template dropdowns:', pErr.message);
      }

      try {
        const [catlRows] = await pool.execute(
          `SELECT id, catalog_id, name FROM tb_web_catalogs WHERE LOWER(status) != 'deleted' ORDER BY id ASC`
        );
        catls = catlRows || [];
      } catch (catlErr) {
        console.warn('[exportProductsTemplate] Warning fetching catalogs for template dropdowns:', catlErr.message);
      }

      try {
        const [bRows] = await pool.execute(
          `SELECT id, name FROM tb_pdt_commons_brands WHERE LOWER(status) != 'deleted' ORDER BY name ASC`
        );
        brands = bRows || [];
      } catch (bErr) {
        console.warn('[exportProductsTemplate] Warning fetching brands for template dropdowns:', bErr.message);
      }

      try {
        const [colRows] = await pool.execute(
          `SELECT id, name FROM tb_pdt_commons_colors WHERE LOWER(status) != 'deleted' ORDER BY name ASC`
        );
        colours = colRows || [];
      } catch (colErr) {
        console.warn('[exportProductsTemplate] Warning fetching colours for template dropdowns:', colErr.message);
      }

      await buildOnboardProductsExcel(templatePath, {
        categories: cats,
        products: pdts,
        catalogs: catls,
        brands,
        colours
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Onboard Products.xlsx"');
      return res.sendFile(templatePath);
    } catch (error) {
      console.error('[ContentController.exportProductsTemplate] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to download products seeding template',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/content/products/bulk-upload
  async bulkUploadProducts(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.body?.org_code || req.query?.org_code || user?.org_code || req.user?.org_code || 'taiton';
      const files = req.files || [];
      const excelFile = files.find((f) => f.fieldname === 'excelFile' || f.originalname.endsWith('.xlsx') || f.originalname.endsWith('.xls'));

      if (!excelFile) {
        return res.status(400).json({
          success: false,
          message: 'No Excel file provided for bulk upload',
        });
      }

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelFile.path);

      let totalCount = 0;
      let successCount = 0;
      let failedCount = 0;
      const report = [];

      // Helper to annotate row in Excel worksheet with status column
      function annotateRowStatus(sheet, rowNumber, isSuccess, messageStr) {
        if (!sheet) return;
        const row = sheet.getRow(rowNumber);

        // Find or create header for status column on row 1
        const headerRow = sheet.getRow(1);
        let statusColIdx = 0;
        headerRow.eachCell((cell, colNum) => {
          if (String(cell.value || '').includes('Upload Status')) statusColIdx = colNum;
        });
        if (!statusColIdx) {
          statusColIdx = Math.max(headerRow.cellCount || 0, 1) + 1;
          const statusHeaderCell = headerRow.getCell(statusColIdx);
          statusHeaderCell.value = 'Upload Status / Error Message';
          statusHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D97706' } }; // Amber Header
          statusHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
          statusHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        if (isSuccess) {
          const cell = row.getCell(statusColIdx);
          cell.value = 'SUCCESS: Processed successfully';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }; // Light Green
          cell.font = { color: { argb: '15803D' }, bold: true };
        } else {
          // Fill ENTIRE row cells in red background for clear visual identification of errors
          const colCount = Math.max(row.cellCount || 0, statusColIdx);
          for (let col = 1; col <= colCount; col++) {
            const rCell = row.getCell(col);
            rCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }; // Light Red
            if (col !== statusColIdx) {
              rCell.font = { color: { argb: '991B1B' } };
            }
          }
          const cell = row.getCell(statusColIdx);
          cell.value = `FAILED: ${messageStr}`;
          cell.font = { color: { argb: 'B91C1C' }, bold: true };
        }
      }

      // Helper to convert sheet row to object by headers
      function parseSheet(sheetName) {
        const sheet = workbook.getWorksheet(sheetName);
        if (!sheet) return { rows: [], sheet: null };
        const headers = [];
        const rows = [];
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell((cell, colNumber) => {
              headers[colNumber] = String(cell.value || '').trim();
            });
          } else {
            const rowData = {};
            row.eachCell((cell, colNumber) => {
              const h = headers[colNumber];
              if (h) {
                let val = cell.value;
                if (val && typeof val === 'object' && val.result !== undefined) val = val.result;
                rowData[h] = val;
              }
            });
            const hasData = Object.values(rowData).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
            if (hasData) {
              rows.push({ rowNumber, data: rowData });
            }
          }
        });
        return { rows, sheet };
      }

      const uploadsDir = path.join(__dirname, '../../../public/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Build lookup map for any uploaded image files in req.files
      const imageMap = new Map();
      files.forEach((f) => {
        if (f !== excelFile) {
          const origLower = String(f.originalname || '').toLowerCase().trim();
          const baseLower = path.basename(origLower);
          const publicUrl = `/uploads/${f.filename}`;
          imageMap.set(origLower, publicUrl);
          imageMap.set(baseLower, publicUrl);
        }
      });

      // Helper to resolve an image cell string to a usable public path
      function resolveImage(imgVal) {
        if (!imgVal || typeof imgVal !== 'string') return null;
        const clean = imgVal.trim();
        if (!clean) return null;
        if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/uploads/')) {
          return clean;
        }
        const base = path.basename(clean).toLowerCase();
        if (imageMap.has(base)) return imageMap.get(base);
        if (imageMap.has(clean.toLowerCase())) return imageMap.get(clean.toLowerCase());
        // Check if file with this exact filename exists directly in public/uploads directory
        if (fs.existsSync(path.join(uploadsDir, clean))) {
          return `/uploads/${clean}`;
        }
        return `/uploads/${clean}`;
      }

      function resolveMultipleImages(imgVal) {
        if (!imgVal) return null;
        const list = String(imgVal)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length === 0) return null;
        const resolved = list.map(resolveImage).filter(Boolean);
        return resolved.length > 0 ? JSON.stringify(resolved) : null;
      }

      // Fetch fallback route ID for SEO records
      let defaultRouteId = 1;
      try {
        const [rRows] = await pool.execute('SELECT id FROM tb_config_routes ORDER BY id ASC LIMIT 1');
        if (rRows.length > 0) defaultRouteId = rRows[0].id;
      } catch (rErr) { }

      // 1. Process Single Categories Sheet (Handles Category, Sub Category, & Sub Sub Category in 1 sheet)
      const { rows: catRows, sheet: catSheet } = parseSheet('categories');
      const categoryMap = new Map();

      for (const { rowNumber, data } of catRows) {
        totalCount++;
        try {
          const excelCatId = data['Category ID'];
          const parentRef = data['Parent Category ID'] ?? data['Parent ID'];
          const name = data['Category Name'] || data['Name'];
          const desc = data['Category Description'] || data['Description'] || '';
          const rawImg = data['Category Image Name'] || data['Image Name'] || null;
          const img = resolveImage(rawImg);
          const rawBannerImg = data['Banner Image'] || data['Banner Image Name (.webp / .jpg /.png)'] || data['Banner Image Name'] || null;
          const bannerImg = resolveImage(rawBannerImg);

          let catalogId = null;
          const rawCatalog = String(data['Catalog ID'] || data['Catalog'] || '').trim();
          if (rawCatalog && rawCatalog !== '0' && !rawCatalog.toLowerCase().includes('none')) {
            const catMatch = rawCatalog.match(/^(\d+)/);
            catalogId = catMatch ? Number(catMatch[1]) : (Number(rawCatalog) || null);
          }

          if (!name) continue;

          let resolvedParentId = 0;
          let computedType = 'cat';
          const parentStr = String(parentRef || '').trim();

          if (parentStr && parentStr !== '0' && parentStr !== 'null' && parentStr !== 'undefined' && !parentStr.startsWith('0') && !/no\s*parent/i.test(parentStr)) {
            let idPart = parentStr;
            const sepIdx = parentStr.indexOf(' - ');
            if (sepIdx > -1) {
              idPart = parentStr.substring(0, sepIdx).trim();
            }

            // Check A: Local Excel Map by Category ID (e.g. 1, 2, cat_1)
            if (categoryMap.has(idPart)) {
              const parentInfo = categoryMap.get(idPart);
              resolvedParentId = parentInfo.dbId;
              const parentType = String(parentInfo.type || '').toLowerCase();
              computedType = (parentType === 'cat' || parentType === 'category') ? 'sc' : 's2c';
            } else if (categoryMap.has(parentStr)) {
              const parentInfo = categoryMap.get(parentStr);
              resolvedParentId = parentInfo.dbId;
              const parentType = String(parentInfo.type || '').toLowerCase();
              computedType = (parentType === 'cat' || parentType === 'category') ? 'sc' : 's2c';
            } else {
              // Check B: Database lookup by numeric Category ID or display ID (cat_1, sc_2)
              const cleanDbId = Number(idPart.replace(/^(cat|sc|s2c)_/i, '')) || 0;
              if (cleanDbId > 0) {
                const [dbRows] = await pool.execute(
                  `SELECT id, type, parent_id FROM tb_pdt_categories WHERE id = ? AND LOWER(org_code) = LOWER(?) AND LOWER(status) != 'deleted'`,
                  [cleanDbId, orgCode]
                );
                if (dbRows.length > 0) {
                  const dbParent = dbRows[0];
                  resolvedParentId = dbParent.id;
                  const dbParentType = String(dbParent.type || '').toLowerCase();
                  computedType = (dbParentType === 'cat' || dbParentType === 'category' || dbParent.parent_id === 0) ? 'sc' : 's2c';
                }
              }
              // Check C: Match by category name
              if (!resolvedParentId) {
                const catNameOnly = sepIdx > -1 ? parentStr.substring(sepIdx + 3).trim() : parentStr;
                const [dbRows] = await pool.execute(
                  `SELECT id, type, parent_id FROM tb_pdt_categories WHERE LOWER(category) = LOWER(?) AND LOWER(org_code) = LOWER(?) AND LOWER(status) != 'deleted' LIMIT 1`,
                  [catNameOnly, orgCode]
                );
                if (dbRows.length > 0) {
                  const dbParent = dbRows[0];
                  resolvedParentId = dbParent.id;
                  const dbParentType = String(dbParent.type || '').toLowerCase();
                  computedType = (dbParentType === 'cat' || dbParentType === 'category' || dbParent.parent_id === 0) ? 'sc' : 's2c';
                }
              }
            }
          }

          const [existing] = await pool.execute(
            `SELECT id FROM tb_pdt_categories WHERE LOWER(org_code) = LOWER(?) AND LOWER(category) = LOWER(?) AND parent_id = ? AND LOWER(status) != 'deleted'`,
            [orgCode, name, resolvedParentId]
          );

          let dbCatId = 0;
          if (existing.length > 0) {
            dbCatId = existing[0].id;
            await pool.execute(
              `UPDATE tb_pdt_categories SET type = ?, description = ?, img = COALESCE(?, img), banner_img = COALESCE(?, banner_img), catalog_id = COALESCE(?, catalog_id) WHERE id = ?`,
              [computedType, desc, img, bannerImg, catalogId, dbCatId]
            );
          } else {
            const [ins] = await pool.execute(
              `INSERT INTO tb_pdt_categories (org_code, type, parent_id, category, description, img, banner_img, catalog_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready_to_live')`,
              [orgCode, computedType, resolvedParentId, name, desc, img, bannerImg, catalogId]
            );
            dbCatId = ins.insertId;
          }

          const catStatus = await evaluateApprovalRuleAndStatus({
            orgCode,
            type: computedType === 'sc' ? 'subcategory' : computedType === 's2c' ? 'subcategory' : 'category',
            title: name,
            insertId: dbCatId,
            tableName: 'tb_pdt_categories',
            req,
            skipNotification: true,
          });
          if (catStatus !== 'ready_to_live' && catStatus !== 'live') {
            await pool.execute(`UPDATE tb_pdt_categories SET status = ? WHERE id = ?`, [catStatus, dbCatId]);
          }

          // Category SEO metadata
          const catSeoTitle = data['SEO Meta Title'] || name;
          const catSeoDesc = data['SEO Meta Description'] || desc || name;
          const catFocusKw = data['Focus Keyword'] || null;
          const catSecKw = data['Secondary Keywords ( , seperated )'] || null;
          const catRobots = data['Robots(inder / no index)'] || 'index, follow';
          if (catSeoTitle || catFocusKw) {
            try {
              await pool.execute(
                `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, robot, status, content_version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
                 ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), focus_keywords = VALUES(focus_keywords), keywords = VALUES(keywords), img = VALUES(img), robot = VALUES(robot)`,
                [orgCode, defaultRouteId, `cat-${dbCatId}`, catSeoTitle, catSeoDesc, catFocusKw, catSecKw, img, catRobots]
              );
            } catch (seoErr) { }
          }

          const catRecord = { dbId: dbCatId, type: computedType };
          if (excelCatId) categoryMap.set(String(excelCatId), catRecord);
          categoryMap.set(`cat_${dbCatId}`, catRecord);
          categoryMap.set(`sc_${dbCatId}`, catRecord);
          categoryMap.set(`s2c_${dbCatId}`, catRecord);

          annotateRowStatus(catSheet, rowNumber, true, 'Processed successfully');
          successCount++;
        } catch (err) {
          failedCount++;
          console.error('[BulkUpload Category Row Error]:', err);
          annotateRowStatus(catSheet, rowNumber, false, err.message);
          report.push({ sheet: 'categories', rowNum: rowNumber, status: 'failed', reason: err.message });
        }
      }

      // 2. Process Products
      const { rows: pdtRows, sheet: pdtSheet } = parseSheet('products');
      const pdtIdMap = new Map();
      for (const { rowNumber, data } of pdtRows) {
        totalCount++;
        try {
          const origPdtId = data['Product ID'];
          const name = data['Product Name'];
          const code = data['Product Code'] || `PDT-${Date.now()}`;
          const desc = data['Product Description'] || '';
          const price = Number(data['Price']) || 0;
          const rawMainImg = data['Product Main Image Name (.webp / .jpg /.png)'] || null;
          const mainImg = resolveImage(rawMainImg);
          const otherImgs = resolveMultipleImages(data['Product Other Image Names (.webp / .jpg /.png)']);
          const brand = data['Product Brand'] || data['Brand'] || null;
          const defaultColour = data['Default Colour'] || data['Primary Colour'] || null;
          const rawColours = data['Colours (comma separated)'] || data['Colours'] || null;
          const coloursArr = rawColours ? String(rawColours).split(',').map(c => c.trim()).filter(Boolean) : null;
          const coloursStr = coloursArr ? JSON.stringify(coloursArr) : null;
          const parentRef = data['Parent Category ID'] || data['Parent ID'] || data['Sub Sub Category ID'] || data['Sub Category ID'] || data['Category ID'];
          const accessoriesStr = data['Accessories (comma separated Product IDs or Codes)'] || data['Accessories'] || null;
          const relatedPdtsStr = data['Related Products'] || null;

          let resolvedParentId = 0;
          if (parentRef) {
            const pRefStr = String(parentRef).trim();
            let idPart = pRefStr;
            const sepIdx = pRefStr.indexOf(' - ');
            if (sepIdx > -1) {
              idPart = pRefStr.substring(0, sepIdx).trim();
            }

            if (categoryMap.has(idPart)) {
              resolvedParentId = categoryMap.get(idPart).dbId;
            } else if (categoryMap.has(pRefStr)) {
              resolvedParentId = categoryMap.get(pRefStr).dbId;
            } else {
              const cleanNum = Number(idPart.replace(/^(cat|sc|s2c)_/i, '')) || 0;
              if (cleanNum > 0) {
                const [dbCats] = await pool.execute(
                  `SELECT id FROM tb_pdt_categories WHERE LOWER(org_code) = LOWER(?) AND id = ? AND LOWER(status) != 'deleted' LIMIT 1`,
                  [orgCode, cleanNum]
                );
                if (dbCats.length > 0) {
                  resolvedParentId = dbCats[0].id;
                }
              }
              if (!resolvedParentId) {
                const nameOnly = sepIdx > -1 ? pRefStr.substring(sepIdx + 3).trim() : pRefStr;
                const [dbCats] = await pool.execute(
                  `SELECT id FROM tb_pdt_categories WHERE LOWER(org_code) = LOWER(?) AND LOWER(category) = LOWER(?) AND LOWER(status) != 'deleted' LIMIT 1`,
                  [orgCode, nameOnly]
                );
                if (dbCats.length > 0) {
                  resolvedParentId = dbCats[0].id;
                }
              }
            }
          }

          if (parentRef && !resolvedParentId) {
            throw new Error(`Parent Category "${parentRef}" was not found in database or categories sheet. Please specify a valid Parent Category ID.`);
          }

          if (name) {
            // Match product STRICTLY by Product Code (pdt_code), allowing identical product names across different categories
            const [existing] = await pool.execute(
              `SELECT id FROM tb_pdt_products WHERE LOWER(org_code) = LOWER(?) AND LOWER(pdt_code) = LOWER(?) AND LOWER(status) != 'deleted'`,
              [orgCode, code]
            );
            let pdtId = 0;
            if (existing.length > 0) {
              pdtId = existing[0].id;
              await pool.execute(
                `UPDATE tb_pdt_products SET parent_id = COALESCE(?, parent_id), product = ?, primary_img = COALESCE(?, primary_img), brand = COALESCE(?, brand), default_colour = COALESCE(?, default_colour), colours = COALESCE(?, colours) WHERE id = ?`,
                [resolvedParentId || 0, name, mainImg, brand, defaultColour, coloursStr, pdtId]
              );
            } else {
              const [ins] = await pool.execute(
                `INSERT INTO tb_pdt_products (org_code, parent_id, pdt_code, product, primary_img, brand, default_colour, colours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready_to_live')`,
                [orgCode, resolvedParentId || 0, code, name, mainImg, brand, defaultColour, coloursStr]
              );
              pdtId = ins.insertId;
            }
            if (origPdtId) pdtIdMap.set(String(origPdtId), pdtId);

            const pdtStatus = await evaluateApprovalRuleAndStatus({
              orgCode,
              type: 'product',
              title: name,
              insertId: pdtId,
              tableName: 'tb_pdt_products',
              req,
              skipNotification: true,
            });
            if (pdtStatus !== 'ready_to_live' && pdtStatus !== 'live') {
              await pool.execute(`UPDATE tb_pdt_products SET status = ? WHERE id = ?`, [pdtStatus, pdtId]);
            }

            // Insert / Update Product Info with Images, Accessories & Related Products
            const [infoExist] = await pool.execute(`SELECT id FROM tb_pdt_product_info WHERE pdt_id = ?`, [pdtId]);
            if (infoExist.length > 0) {
              await pool.execute(
                `UPDATE tb_pdt_product_info SET \`desc\` = ?, price = ?, pdt_imgs = COALESCE(?, pdt_imgs), acces = COALESCE(?, acces), related_pdts = COALESCE(?, related_pdts), brand = COALESCE(?, brand), default_colour = COALESCE(?, default_colour), colours = COALESCE(?, colours) WHERE pdt_id = ?`,
                [desc, price, otherImgs, accessoriesStr, relatedPdtsStr, brand, defaultColour, coloursStr, pdtId]
              );
            } else {
              await pool.execute(
                `INSERT INTO tb_pdt_product_info (pdt_id, \`desc\`, price, pdt_imgs, acces, related_pdts, brand, default_colour, colours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pdtId, desc, price, otherImgs, accessoriesStr, relatedPdtsStr, brand, defaultColour, coloursStr]
              );
            }

            // Product SEO metadata
            const pdtSeoTitle = data['SEO Meta Title'] || name;
            const pdtSeoDesc = data['SEO Meta Description'] || desc || name;
            const pdtFocusKw = data['Focus Keyword'] || null;
            const pdtSecKw = data['Secondary Keywords ( , seperated )'] || null;
            const pdtRobots = data['Robots(inder / no index)'] || 'index, follow';
            if (pdtSeoTitle || pdtFocusKw) {
              try {
                await pool.execute(
                  `INSERT INTO tb_web_seo (org_code, route_id, route_ext, title, description, focus_keywords, keywords, img, robot, status, content_version)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 1)
                   ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), focus_keywords = VALUES(focus_keywords), keywords = VALUES(keywords), img = VALUES(img), robot = VALUES(robot)`,
                  [orgCode, defaultRouteId, String(pdtId), pdtSeoTitle, pdtSeoDesc, pdtFocusKw, pdtSecKw, mainImg, pdtRobots]
                );
              } catch (pSeoErr) { }
            }

            if (origPdtId) pdtIdMap.set(String(origPdtId), pdtId);
            if (code) pdtIdMap.set(String(code), pdtId);
            annotateRowStatus(pdtSheet, rowNumber, true, 'Processed successfully');
            successCount++;
          }
        } catch (err) {
          failedCount++;
          annotateRowStatus(pdtSheet, rowNumber, false, err.message);
          report.push({ sheet: 'products', rowNum: rowNumber, status: 'failed', reason: err.message });
        }
      }

      // Helper function to resolve Product ID from reference string (e.g. "501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)", "501", code, or name)
      async function resolveProductId(pRef) {
        if (!pRef) return 0;
        const pRefStr = String(pRef).trim();
        let idPart = pRefStr;
        const sepIdx = pRefStr.indexOf(' - ');
        if (sepIdx > -1) {
          idPart = pRefStr.substring(0, sepIdx).trim();
        }
        if (pdtIdMap.has(idPart)) return pdtIdMap.get(idPart);
        if (pdtIdMap.has(pRefStr)) return pdtIdMap.get(pRefStr);
        if (pdtIdMap.has(idPart.toLowerCase())) return pdtIdMap.get(idPart.toLowerCase());

        const cleanNum = Number(idPart) || 0;
        if (cleanNum > 0) {
          const [dbPdts] = await pool.execute(
            `SELECT id FROM tb_pdt_products WHERE LOWER(org_code) = LOWER(?) AND id = ? AND LOWER(status) != 'deleted' LIMIT 1`,
            [orgCode, cleanNum]
          );
          if (dbPdts.length > 0) return dbPdts[0].id;
        }

        const codeMatch = pRefStr.match(/\(([^)]+)\)$/)?.[1] || pRefStr;
        const namePart = sepIdx > -1 ? pRefStr.substring(sepIdx + 3).replace(/\s*\([^)]+\)$/, '').trim() : pRefStr;
        const [dbPdts] = await pool.execute(
          `SELECT id FROM tb_pdt_products WHERE LOWER(org_code) = LOWER(?) AND (LOWER(pdt_code) = LOWER(?) OR LOWER(pdt_code) = LOWER(?) OR LOWER(product) = LOWER(?)) AND LOWER(status) != 'deleted' LIMIT 1`,
          [orgCode, pRefStr.toLowerCase(), codeMatch.toLowerCase(), namePart.toLowerCase()]
        );
        if (dbPdts.length > 0) return dbPdts[0].id;

        return 0;
      }

      // 3. Process Type Bullets Sheet (Features / Specs / Additional)
      const { rows: bulletRows } = parseSheet('Type Bullets');
      for (const { data } of bulletRows) {
        try {
          const pRef = data['Product ID'];
          const pdtId = await resolveProductId(pRef);
          if (!pdtId) continue;
          const rawType = String(data['Type (Feaute / Specification / Additional )'] || data['Type'] || '').toLowerCase();
          const bulletsStr = data['Bullets'] || '';
          const label = data['Label'] || 'Features';
          const bulletsArr = String(bulletsStr).split(',').map((s) => s.trim()).filter(Boolean);
          const payload = { type: 'points', title: label, data: bulletsArr };

          if (rawType.includes('spec')) {
            await pool.execute(`UPDATE tb_pdt_product_info SET specs = ? WHERE pdt_id = ?`, [JSON.stringify(payload), pdtId]);
          } else if (rawType.includes('add')) {
            await pool.execute(`UPDATE tb_pdt_product_info SET addl_features = ? WHERE pdt_id = ?`, [JSON.stringify(payload), pdtId]);
          } else {
            await pool.execute(`UPDATE tb_pdt_product_info SET features = ? WHERE pdt_id = ?`, [JSON.stringify(payload), pdtId]);
          }
        } catch (bErr) { }
      }

      // 4. Process Type KeyVal Sheet
      const { rows: keyValRows } = parseSheet('Type KeyVal');
      const keyValGroups = new Map();
      for (const { data } of keyValRows) {
        try {
          const pRef = data['Product ID'];
          const pdtId = await resolveProductId(pRef);
          if (!pdtId) continue;
          const rawType = String(data['Type (Feaute / Specification / Additional )'] || data['Type'] || '').toLowerCase();
          const k = String(data['Feature Key'] || data['Key'] || '').trim();
          const v = String(data['Feature Value'] || data['Value'] || '').trim();
          if (!k) continue;

          let field = 'specs';
          if (rawType.includes('feat') || rawType.includes('feaute')) field = 'features';
          else if (rawType.includes('add')) field = 'addl_features';

          const groupKey = `${pdtId}___${field}`;
          if (!keyValGroups.has(groupKey)) keyValGroups.set(groupKey, { pdtId, field, items: [] });
          keyValGroups.get(groupKey).items.push({ key: k, val: v });
        } catch (kvErr) { }
      }
      for (const { pdtId, field, items } of keyValGroups.values()) {
        try {
          const payload = { type: 'key_values', data: items };
          await pool.execute(`UPDATE tb_pdt_product_info SET ${field} = ? WHERE pdt_id = ?`, [JSON.stringify(payload), pdtId]);
        } catch (kvUpErr) { }
      }

      // 5. Process Type Table Sheet
      const { rows: tableRows } = parseSheet('Type Table');
      for (const { data } of tableRows) {
        try {
          const pRef = data['Product ID'];
          const pdtId = await resolveProductId(pRef);
          if (!pdtId) continue;
          const rawType = String(data['Type (Feaute / Specification / Additional )'] || data['Type'] || '').toLowerCase();
          const colHeaders = String(data['Column Header (Top Headers with comma seperated)'] || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const rowHeaders = String(data['ROW Headers ( Left Side Headers with comma seperated )'] || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const rowFlow = String(data['ROW Flow (comma sepearated - all data continuesly)'] || '')
            .split(',')
            .map((s) => s.trim());

          const numCols = Math.max(colHeaders.length, 1);
          const rows = [];
          for (let i = 0; i < rowFlow.length; i += numCols) {
            rows.push(rowFlow.slice(i, i + numCols));
          }
          const payload = {
            type: 'table',
            headerPos: 'top',
            data: {
              headers: colHeaders,
              rowHeaders,
              rows,
            },
          };
          let field = 'addl_features';
          if (rawType.includes('spec')) field = 'specs';
          else if (rawType.includes('feat') || rawType.includes('feaute')) field = 'features';
          await pool.execute(`UPDATE tb_pdt_product_info SET ${field} = ? WHERE pdt_id = ?`, [JSON.stringify(payload), pdtId]);
        } catch (tbErr) { }
      }

      // 6. Process Variants
      const { rows: varRows, sheet: varSheet } = parseSheet('varients');
      for (const { rowNumber, data } of varRows) {
        totalCount++;
        try {
          const origPdtId = data['Product ID'] || data['Product Code'];
          const pdtId = await resolveProductId(origPdtId);
          const varName = data['Varient Name'];
          const varCode = data['Varient Code'] || `VAR-${Date.now()}`;
          const sku = data['SKU'] || varCode;
          const price = Number(data['Price']) || 0;
          const discount = Number(data['Discount']) || 0;
          const colour = data['Colour / Finish Name'] || null;
          const rawPrimaryImg = data['Varient Primary Image Name'] || null;
          const primaryImg = resolveImage(rawPrimaryImg);
          const otherVarImgs = resolveMultipleImages(data['Varient Other Image Names  ( comma Seperated)']);

          if (!varName) {
            failedCount++;
            annotateRowStatus(varSheet, rowNumber, false, 'Variant Name is required');
            report.push({ sheet: 'varients', rowNum: rowNumber, status: 'failed', reason: 'Variant Name is required' });
            continue;
          }

          if (!pdtId) {
            failedCount++;
            const errMsg = `Product ID "${origPdtId}" could not be resolved to a product in database or Excel sheet`;
            annotateRowStatus(varSheet, rowNumber, false, errMsg);
            report.push({ sheet: 'varients', rowNum: rowNumber, status: 'failed', reason: errMsg });
            continue;
          }

          const [existing] = await pool.execute(
            `SELECT id FROM tb_pdt_variants WHERE LOWER(var_code) = LOWER(?) OR LOWER(sku) = LOWER(?)`,
            [varCode, sku]
          );

          let varId = 0;
          if (existing.length > 0) {
            varId = existing[0].id;
            await pool.execute(
              `UPDATE tb_pdt_variants SET org_code = ?, pdt_id = ?, var_code = ?, name = ?, colour = ?, price = ?, discount = ?, sku = ?, primary_img = COALESCE(?, primary_img), imgs = COALESCE(?, imgs), status = 'ready_to_live', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [orgCode, pdtId, varCode, varName, colour, price, discount, sku, primaryImg, otherVarImgs, varId]
            );
          } else {
            const [ins] = await pool.execute(
              `INSERT INTO tb_pdt_variants (org_code, pdt_id, var_code, name, colour, price, discount, sku, primary_img, imgs, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready_to_live')`,
              [orgCode, pdtId, varCode, varName, colour, price, discount, sku, primaryImg, otherVarImgs]
            );
            varId = ins.insertId;
          }

          const varStatus = await evaluateApprovalRuleAndStatus({
            orgCode,
            type: 'variant',
            title: varName,
            insertId: varId,
            tableName: 'tb_pdt_variants',
            req,
            skipNotification: true,
          });
          if (varStatus !== 'ready_to_live' && varStatus !== 'live') {
            await pool.execute(`UPDATE tb_pdt_variants SET status = ? WHERE id = ?`, [varStatus, varId]);
          }

          annotateRowStatus(varSheet, rowNumber, true, 'Processed successfully');
          successCount++;
        } catch (err) {
          failedCount++;
          const reasonStr = err.code === 'ER_DUP_ENTRY'
            ? `Duplicate entry error: Variant Code "${data['Varient Code']}" or SKU "${data['SKU']}" already exists (${err.message})`
            : err.message;
          annotateRowStatus(varSheet, rowNumber, false, reasonStr);
          report.push({ sheet: 'varients', rowNum: rowNumber, status: 'failed', reason: reasonStr });
        }
      }

      // Generate & save annotated Error Report Excel workbook
      const reportFilename = `bulk-upload-report-${Date.now()}.xlsx`;
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const reportPath = path.join(uploadsDir, reportFilename);
      const publicReportUrl = `/uploads/${reportFilename}`;
      // Adjust column widths across all worksheets to fit header & cell content
      try {
        workbook.worksheets.forEach((ws) => {
          ws.columns.forEach((col) => {
            let maxLen = 0;
            col.eachCell({ includeEmpty: true }, (cell) => {
              const valStr = String(cell.value || '');
              if (valStr.length > maxLen) {
                maxLen = valStr.length;
              }
            });
            col.width = Math.max(maxLen + 5, 18);
          });
        });
      } catch (wResizeErr) { }

      try {
        await workbook.xlsx.writeFile(reportPath);
      } catch (wErr) {
        console.error('[bulkUploadProducts] Warning - Error writing report Excel:', wErr.message);
      }

      // Clean up uploaded temp file
      try { fs.unlinkSync(excelFile.path); } catch (e) { }

      // Dispatch single consolidated notification to Submitter & Checkers (one notification is enough)
      const submitterUserId = user?.id || req.user?.id || 0;
      const notificationMsg = `Bulk upload processed: ${successCount} succeeded, ${failedCount} failed. Download report: ${publicReportUrl}`;

      try {
        const submitterName = await getUserFullName(req);
        if (submitterUserId > 0) {
          await pool.execute(
            `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
            [orgCode, submitterUserId, submitterUserId, notificationMsg]
          );
        } else {
          await pool.execute(
            `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, 0, 0, ?)`,
            [orgCode, notificationMsg]
          );
        }

        // Dispatch a single notification to checkers / approvers
        const [checkers] = await pool.execute(
          `SELECT id FROM tb_board_users 
           WHERE LOWER(org_code) = LOWER(?) 
           AND id != ? 
           AND status = 'active'
           AND (LOWER(role) LIKE '%admin%' OR LOWER(role) LIKE '%checker%')`,
          [orgCode, submitterUserId]
        );
        for (const chk of checkers) {
          await pool.execute(
            `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
            [orgCode, submitterUserId || 0, chk.id, `Bulk upload batch submitted by ${submitterName}: ${successCount} succeeded, ${failedCount} failed. Download report: ${publicReportUrl}`]
          );
        }
      } catch (nErr) {
        console.error('[bulkUploadProducts] Notification dispatch error:', nErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `Bulk upload completed: ${successCount} succeeded, ${failedCount} failed`,
        stats: {
          total: totalCount,
          success: successCount,
          failed: failedCount,
        },
        reportDownloadUrl: publicReportUrl,
        report,
      });
    } catch (error) {
      console.error('[ContentController.bulkUploadProducts] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Product bulk upload processing failed',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/content/pending
  async getPendingApprovals(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || req.body?.org_code || user?.org_code || req.user?.org_code || null;

      const tablesToSync = [
        { name: 'tb_pdt_categories', type: 'category', titleCol: 'category' },
        { name: 'tb_pdt_sub_categories', type: 'subcategory', titleCol: 'sub_category' },
        { name: 'tb_pdt_products', type: 'product', titleCol: 'product' },
        { name: 'tb_pdt_variants', type: 'variant', titleCol: 'variant_name' },
        { name: 'tb_web_spaces', type: 'explore_space', titleCol: 'title' },
      ];

      if (orgCode) {
        for (const t of tablesToSync) {
          try {
            await pool.query(`
              INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
              SELECT 
                COALESCE(src.org_code, ?),
                ?,
                ?,
                COALESCE(src.${t.titleCol}, CONCAT(?, ' #', src.id)),
                src.id,
                0,
                'Organization Admin',
                CONCAT('Submitted ', ?, ' "', COALESCE(src.${t.titleCol}, CONCAT(?, ' #', src.id)), '" for approval'),
                'pending'
              FROM ${t.name} src
              WHERE LOWER(src.org_code) = LOWER(?) AND src.status = 'pending_approval'
                AND NOT EXISTS (
                  SELECT 1 FROM tb_org_approvals a 
                  WHERE a.table_name = ? AND a.record_id = src.id AND a.approval_status = 'pending'
                )
            `, [orgCode, t.name, t.type, t.type, t.type, t.type, orgCode, t.name]);
          } catch (sErr) { }
        }

        // Sync pending UI layouts
        try {
          await pool.query(`
            INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
            SELECT 
              COALESCE(cnt.org_code, ?),
              'tb_ui_component_content',
              'ui_layout',
              CONCAT('UI Layout: ', COALESCE(c.label, 'Component')),
              cnt.id,
              COALESCE(cnt.updated_by, 0),
              'Organization Admin',
              CONCAT('Submitted UI Layout for "', COALESCE(c.label, 'Component'), '" for approval'),
              'pending'
            FROM tb_ui_component_content cnt
            JOIN tb_ui_page_components pc ON cnt.page_component_id = pc.id
            JOIN tb_ui_components c ON pc.component_id = c.id
            WHERE LOWER(cnt.org_code) = LOWER(?) AND cnt.status = 'pending_approval'
              AND NOT EXISTS (
                SELECT 1 FROM tb_org_approvals a 
                WHERE a.table_name = 'tb_ui_component_content' AND a.record_id = cnt.id AND a.approval_status = 'pending'
              )
          `, [orgCode, orgCode]);
        } catch (uiAppErr) { }
      }

      let appSql = `SELECT * FROM tb_org_approvals WHERE approval_status = 'pending'`;
      const appParams = [];
      if (orgCode) {
        appSql += ` AND LOWER(org_code) = LOWER(?)`;
        appParams.push(orgCode);
      }
      appSql += ` ORDER BY id DESC`;

      const [rows] = await pool.execute(appSql, appParams);

      // Fetch active rules for checking role checker permissions
      const normUserRole = normalizeRole(user?.role || user?.roleCode || req.user?.role || 'employee');
      const rawUserRole = String(user?.role || user?.roleCode || req.user?.role || '').toLowerCase().trim();
      const isAdminUser = ['super_admin', 'sys_admin'].includes(normUserRole);

      let ruleRows = [];
      if (orgCode) {
        try {
          const [rRes] = await pool.execute(
            `SELECT r.*, cr.route as route_path, cr.page as route_name FROM tb_org_rules r
             LEFT JOIN tb_config_routes cr ON r.route_id = cr.id
             WHERE LOWER(r.org_code) = LOWER(?) AND r.status = 'active'`,
            [orgCode]
          );
          ruleRows = rRes || [];
        } catch (e) { }
      }

      const items = [];
      for (const r of rows) {
        const itemType = String(r.type || r.table_name || '').toLowerCase();
        const matchingRules = ruleRows.filter((rule) => {
          const rPath = String(rule.route_path || '').toLowerCase();
          const rName = String(rule.route_name || '').toLowerCase();

          if (itemType.includes('career') || itemType.includes('job') || r.table_name === 'tb_web_careers') {
            return rPath.includes('career') || rName.includes('career') || rPath.includes('job') || rName.includes('job') || rule.route_id === 14;
          }
          if (itemType.includes('catalog') || r.table_name === 'tb_web_catalogs') {
            return rPath.includes('catalog') || rName.includes('catalog') || rule.route_id === 13;
          }
          if (itemType.includes('blog') || r.table_name === 'tb_web_blogs') {
            return rPath.includes('blog') || rName.includes('blog') || rule.route_id === 12;
          }
          if (itemType.includes('seo') || r.table_name === 'tb_web_seo') {
            return rPath.includes('seo') || rName.includes('seo') || rule.route_id === 18;
          }
          if (itemType.includes('user') || itemType.includes('member') || itemType.includes('account') || r.table_name === 'tb_board_users') {
            return rPath.includes('user') || rName.includes('user') || rPath.includes('account') || rName.includes('account') || rPath.includes('member') || rule.route_id === 16 || rule.route_id === 17;
          }
          if (itemType.includes('product') || itemType.includes('category') || itemType.includes('subcategory') || itemType.includes('variant') || r.table_name.startsWith('tb_pdt_')) {
            return rPath.includes('product') || rName.includes('product') || rPath.includes('pdt') || rule.route_id === 7;
          }
          if (itemType.includes('ui') || itemType.includes('element') || r.table_name === 'tb_web_feed' || r.table_name === 'tb_web_uielements' || r.table_name === 'tb_ui_elements') {
            return rPath.includes('ui') || rName.includes('ui') || rPath.includes('element') || rName.includes('element') || rule.route_id === 22;
          }
          return false;
        });

        let isAuthorizedChecker = isAdminUser;
        if (!isAuthorizedChecker) {
          if (matchingRules.length > 0) {
            for (const rule of matchingRules) {
              let checkers = [];
              try {
                checkers = typeof rule.check_role_ids === 'string'
                  ? JSON.parse(rule.check_role_ids)
                  : (rule.check_role_ids || []);
              } catch (e) {
                checkers = typeof rule.check_role_ids === 'string' ? rule.check_role_ids.split(',').map(s => s.trim()) : [];
              }
              const normCheckers = checkers.map(normalizeRole);
              const rawCheckers = checkers.map(x => String(x || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));

              if (
                normCheckers.includes('*') ||
                normCheckers.includes('all') ||
                normCheckers.includes(normUserRole) ||
                rawCheckers.includes(rawUserRole) ||
                normCheckers.includes(rawUserRole) ||
                rawCheckers.includes(normUserRole)
              ) {
                isAuthorizedChecker = true;
                break;
              }
            }
          } else {
            // Check if user is a designated checker for ANY rule in this organization
            isAuthorizedChecker = ruleRows.some((rule) => {
              let ch = [];
              try {
                ch = typeof rule.check_role_ids === 'string' ? JSON.parse(rule.check_role_ids) : (rule.check_role_ids || []);
              } catch (e) {
                ch = typeof rule.check_role_ids === 'string' ? rule.check_role_ids.split(',').map(s => s.trim()) : [];
              }
              const nCh = ch.map(normalizeRole);
              const rCh = ch.map(x => String(x || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
              return nCh.includes(normUserRole) || rCh.includes(rawUserRole) || nCh.includes('*') || nCh.includes('all');
            });
          }
        }

        if (isAuthorizedChecker) {
          items.push(r);
        }
      }

      // Collect IDs by table to batch-fetch details in parallel instead of N+1 individual queries
      const catIds = [];
      const subCatIds = [];
      const pdtIds = [];
      const varIds = [];
      const userIds = [];
      const feedIds = [];

      for (const r of items) {
        const recId = Number(r.record_id);
        if (!recId) continue;
        if (r.table_name === 'tb_pdt_categories') catIds.push(recId);
        else if (r.table_name === 'tb_pdt_sub_categories') subCatIds.push(recId);
        else if (r.table_name === 'tb_pdt_products') pdtIds.push(recId);
        else if (r.table_name === 'tb_pdt_variants') varIds.push(recId);
        else if (r.table_name === 'tb_board_users') userIds.push(recId);
        else feedIds.push(recId);
      }

      const detailsMap = {
        tb_pdt_categories: {},
        tb_pdt_sub_categories: {},
        tb_pdt_products: {},
        tb_pdt_variants: {},
        tb_board_users: {},
        tb_web_feed: {},
      };

      await Promise.all([
        catIds.length ? pool.query(`SELECT * FROM tb_pdt_categories WHERE id IN (?)`, [catIds]).then(([r]) => r.forEach(x => { detailsMap.tb_pdt_categories[x.id] = x; })).catch(() => { }) : null,
        subCatIds.length ? pool.query(`SELECT sc.*, c.category as parent_category FROM tb_pdt_sub_categories sc LEFT JOIN tb_pdt_categories c ON sc.cat_id = c.id WHERE sc.id IN (?)`, [subCatIds]).then(([r]) => r.forEach(x => { detailsMap.tb_pdt_sub_categories[x.id] = x; })).catch(() => { }) : null,
        pdtIds.length ? pool.query(`SELECT p.*, c.category as parent_category, info.desc, info.features, info.specs FROM tb_pdt_products p LEFT JOIN tb_pdt_categories c ON p.parent_id = c.id LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id WHERE p.id IN (?)`, [pdtIds]).then(([r]) => r.forEach(x => { detailsMap.tb_pdt_products[x.id] = x; })).catch(() => { }) : null,
        varIds.length ? pool.query(`SELECT v.*, p.product as parent_product FROM tb_pdt_variants v LEFT JOIN tb_pdt_products p ON v.pdt_id = p.id WHERE v.id IN (?)`, [varIds]).then(([r]) => r.forEach(x => { detailsMap.tb_pdt_variants[x.id] = x; })).catch(() => { }) : null,
        userIds.length ? pool.query(`SELECT id, full_name, email, mobile, role, org_code, status FROM tb_board_users WHERE id IN (?)`, [userIds]).then(([r]) => r.forEach(x => { detailsMap.tb_board_users[x.id] = x; })).catch(() => { }) : null,
        feedIds.length ? pool.query(`SELECT * FROM tb_web_feed WHERE id IN (?)`, [feedIds]).then(([r]) => r.forEach(x => { detailsMap.tb_web_feed[x.id] = x; })).catch(() => { }) : null,
      ]);

      const finalItems = items.map((r) => {
        const detailPayload = detailsMap[r.table_name]?.[r.record_id] || {};
        return {
          id: r.id,
          recordId: r.record_id,
          type: r.type || (r.table_name === 'tb_board_users' ? 'user' : 'content'),
          contentType: r.type || (r.table_name === 'tb_board_users' ? 'user' : 'content'),
          title: r.title || detailPayload.full_name || detailPayload.category || detailPayload.sub_category || detailPayload.product || detailPayload.name || 'Untitled',
          tableName: r.table_name,
          maker: r.maker_name || 'Maker User',
          createdByRole: 'organization_admin',
          message: r.message,
          status: 'pending_approval',
          approval_status: r.approval_status,
          payload: detailPayload,
          createdAt: r.created_at,
          created_at: r.created_at,
        };
      });

      return res.status(200).json({
        success: true,
        items: finalItems,
        data: finalItems,
        total: finalItems.length,
      });
    } catch (error) {
      console.error('[ContentController.getPendingApprovals] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending approvals',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/content/:type/:id/approve or /cpanel-api/content/pending/:id/approve
  async approveContent(req, res) {
    try {
      const { type, id } = req.params;
      const orgCode = req.body.org_code || req.user?.org_code;
      const checkerId = req.user?.id || 0;
      const checkerName = await getUserFullName(req);

      const approveVal = req.body.approve;
      const actionStr = String(req.body.action || req.body.status || '').toLowerCase();

      let isApproved = true;
      if (typeof approveVal === 'boolean') {
        isApproved = approveVal;
      } else if (actionStr) {
        isApproved = (actionStr === 'approved' || actionStr === 'approve');
      }

      const newStatus = isApproved ? 'ready_to_live' : 'rejected';
      const approvalStatus = isApproved ? 'approved' : 'rejected';

      const [apprRows] = await pool.execute(
        `SELECT * FROM tb_org_approvals WHERE (id = ? OR record_id = ?) AND approval_status = 'pending' ORDER BY id DESC LIMIT 1`,
        [id, id]
      );

      let makerId = 0;
      let targetTable = type === 'category' ? 'tb_pdt_categories' : type === 'subcategory' ? 'tb_pdt_sub_categories' : type === 'product' ? 'tb_pdt_products' : type === 'variant' ? 'tb_pdt_variants' : 'tb_web_feed';
      let targetRecordId = id;
      let itemTitle = 'Item';

      if (apprRows.length > 0) {
        const appr = apprRows[0];
        makerId = appr.maker;
        targetTable = appr.table_name;
        targetRecordId = appr.record_id;
        itemTitle = appr.title || itemTitle;

        await pool.execute(
          `UPDATE tb_org_approvals SET approval_status = ?, checker = ?, actioned_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [approvalStatus, checkerId, appr.id]
        );
      }

      const finalStatus = (targetTable === 'tb_board_users' || type === 'user')
        ? (isApproved ? 'active' : 'rejected')
        : newStatus;

      if (targetTable === 'tb_board_users' || type === 'user') {
        await pool.execute(
          `UPDATE tb_board_users SET status = ?, isActive = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [finalStatus, isApproved ? 1 : 0, targetRecordId]
        );
      } else if (targetTable === 'tb_pdt_categories' || type === 'category') {
        await pool.execute(`UPDATE tb_pdt_categories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_pdt_sub_categories' || type === 'subcategory') {
        await pool.execute(`UPDATE tb_pdt_sub_categories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_pdt_products' || type === 'product') {
        await pool.execute(`UPDATE tb_pdt_products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_pdt_variants' || type === 'variant') {
        await pool.execute(`UPDATE tb_pdt_variants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_web_blogs' || type === 'blog' || type === 'blogs') {
        await pool.execute(`UPDATE tb_web_blogs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_web_careers' || type === 'career' || type === 'careers') {
        await pool.execute(`UPDATE tb_web_careers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_web_catalogs' || type === 'catalog' || type === 'catalogs') {
        await pool.execute(`UPDATE tb_web_catalogs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_web_spaces' || type === 'space' || type === 'spaces' || type === 'explore_space') {
        await pool.execute(`UPDATE tb_web_spaces SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_web_seo' || type === 'seo' || type === 'seo_page') {
        await pool.execute(`UPDATE tb_web_seo SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, targetRecordId]);
      } else if (targetTable === 'tb_ui_component_content' || type === 'ui_layout' || type === 'ui-layout') {
        const approvedTargetStatus = isApproved ? 'approved' : 'draft';
        await pool.execute(`UPDATE tb_ui_component_content SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [approvedTargetStatus, targetRecordId]);
        const [contentRows] = await pool.execute(`SELECT page_component_id FROM tb_ui_component_content WHERE id = ?`, [targetRecordId]);
        if (contentRows.length > 0) {
          const pcId = contentRows[0].page_component_id;
          await pool.execute(`UPDATE tb_ui_page_components SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [approvedTargetStatus, pcId]);
        }
      } else {
        await pool.execute(`UPDATE tb_web_feed SET status = ? WHERE id = ?`, [newStatus, targetRecordId]);
      }

      if (makerId > 0) {
        try {
          await pool.execute(
            `INSERT INTO tb_org_notifications (org_code, sent_by, sent_to, message) VALUES (?, ?, ?, ?)`,
            [orgCode, checkerId, makerId, `Your item "${itemTitle}" has been ${approvalStatus} by ${checkerName}. Status updated to ${finalStatus}.`]
          );
        } catch (e) { }
      }

      await logAudit({
        orgCode,
        tableName: targetTable,
        recordId: targetRecordId,
        action: isApproved ? 'approval' : 'rejection',
        maker: checkerName,
        message: `${isApproved ? 'Approved' : 'Rejected'} ${type || 'content'} ID #${targetRecordId} (status: ${finalStatus})`,
      });

      return res.status(200).json({
        success: true,
        message: `Content item #${targetRecordId} has been ${approvalStatus} successfully`,
        status: finalStatus,
      });
    } catch (error) {
      console.error('[ContentController.approveContent] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to approve content',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/blogs
  async getBlogs(req, res) {
    try {
      const orgCode = req.query.org_code || 'techtrole';
      const blogs = await contentService.getBlogs(orgCode);
      return res.status(200).json({
        success: true,
        data: blogs,
        items: blogs,
        total: blogs.length,
      });
    } catch (error) {
      console.error('[ContentController.getBlogs] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch blogs',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/blogs
  async createBlog(req, res) {
    try {
      const orgCode = req.body.org_code || req.query.org_code || 'techtrole';
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Blog title is required',
        });
      }

      const blog = await contentService.createBlog(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Blog post created successfully',
        data: blog,
      });
    } catch (error) {
      console.error('[ContentController.createBlog] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create blog post',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/careers
  async getCareers(req, res) {
    try {
      const orgCode = req.query.org_code || 'techtrole';
      const careers = await contentService.getCareers(orgCode);
      return res.status(200).json({
        success: true,
        data: careers,
        items: careers,
        total: careers.length,
      });
    } catch (error) {
      console.error('[ContentController.getCareers] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch career listings',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/careers
  async createCareer(req, res) {
    try {
      const orgCode = req.body.org_code || req.query.org_code || 'techtrole';
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Career position title is required',
        });
      }

      const career = await contentService.createCareer(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Career listing created successfully',
        data: career,
      });
    } catch (error) {
      console.error('[ContentController.createCareer] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create career listing',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/catalogs
  async getCatalogs(req, res) {
    try {
      const orgCode = req.query.org_code || 'techtrole';
      const catalogs = await contentService.getCatalogs(orgCode);
      return res.status(200).json({
        success: true,
        data: catalogs,
        items: catalogs,
        total: catalogs.length,
      });
    } catch (error) {
      console.error('[ContentController.getCatalogs] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch catalog files',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/catalogs
  async createCatalog(req, res) {
    try {
      const orgCode = req.body.org_code || req.query.org_code || 'techtrole';
      const { name, file_url } = req.body;
      if (!name || !file_url) {
        return res.status(400).json({
          success: false,
          message: 'Catalog name and file_url are required',
        });
      }

      const catalog = await contentService.createCatalog(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Catalog entry created successfully',
        data: catalog,
      });
    } catch (error) {
      console.error('[ContentController.createCatalog] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create catalog entry',
        error: error.message,
      });
    }
  }

  // ==========================================
  // Commons Methods: Colors & Kits
  // ==========================================

  async getCommonsColors(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || user?.org_code || 'taiton';
      const [rows] = await pool.execute(
        'SELECT id, org_code, name, image_url, hex_code, created_at, updated_at FROM tb_pdt_commons_colors WHERE LOWER(org_code) = LOWER(?) ORDER BY name ASC',
        [orgCode]
      );
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error('[ContentController.getCommonsColors] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch commons colors', error: error.message });
    }
  }

  async createCommonsColor(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || user?.org_code || 'taiton';
      const { name, image_url, hex_code } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Color name is required' });
      }
      const [result] = await pool.execute(
        'INSERT INTO tb_pdt_commons_colors (org_code, name, image_url, hex_code) VALUES (?, ?, ?, ?)',
        [orgCode, name.trim(), image_url || null, hex_code || null]
      );
      return res.status(201).json({
        success: true,
        id: result.insertId,
        data: { id: result.insertId, org_code: orgCode, name: name.trim(), image_url: image_url || null, hex_code: hex_code || null },
        message: 'Color created successfully in Commons'
      });
    } catch (error) {
      console.error('[ContentController.createCommonsColor] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create commons color', error: error.message });
    }
  }

  async updateCommonsColor(req, res) {
    try {
      const { id } = req.params;
      const { name, image_url, hex_code } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Color name is required' });
      }
      await pool.execute(
        'UPDATE tb_pdt_commons_colors SET name = ?, image_url = ?, hex_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name.trim(), image_url || null, hex_code || null, id]
      );
      return res.status(200).json({ success: true, message: 'Commons color updated successfully' });
    } catch (error) {
      console.error('[ContentController.updateCommonsColor] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update commons color', error: error.message });
    }
  }

  async deleteCommonsColor(req, res) {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM tb_pdt_commons_colors WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Commons color deleted successfully' });
    } catch (error) {
      console.error('[ContentController.deleteCommonsColor] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete commons color', error: error.message });
    }
  }

  async getCommonsKits(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.query.org_code || user?.org_code || 'taiton';
      const [rows] = await pool.execute(
        'SELECT id, org_code, name, image_url, description, created_at, updated_at FROM tb_pdt_commons_kits WHERE LOWER(org_code) = LOWER(?) ORDER BY name ASC',
        [orgCode]
      );
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error('[ContentController.getCommonsKits] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch commons kits', error: error.message });
    }
  }

  async createCommonsKit(req, res) {
    try {
      const user = extractUserFromReq(req);
      const orgCode = req.body.org_code || user?.org_code || 'taiton';
      const { name, image_url, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Kit name is required' });
      }
      const [result] = await pool.execute(
        'INSERT INTO tb_pdt_commons_kits (org_code, name, image_url, description) VALUES (?, ?, ?, ?)',
        [orgCode, name.trim(), image_url || null, description || null]
      );
      return res.status(201).json({
        success: true,
        id: result.insertId,
        data: { id: result.insertId, org_code: orgCode, name: name.trim(), image_url: image_url || null, description: description || null },
        message: 'Kit created successfully in Commons'
      });
    } catch (error) {
      console.error('[ContentController.createCommonsKit] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create commons kit', error: error.message });
    }
  }

  async updateCommonsKit(req, res) {
    try {
      const { id } = req.params;
      const { name, image_url, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Kit name is required' });
      }
      await pool.execute(
        'UPDATE tb_pdt_commons_kits SET name = ?, image_url = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name.trim(), image_url || null, description || null, id]
      );
      return res.status(200).json({ success: true, message: 'Commons kit updated successfully' });
    } catch (error) {
      console.error('[ContentController.updateCommonsKit] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update commons kit', error: error.message });
    }
  }

  async deleteCommonsKit(req, res) {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM tb_pdt_commons_kits WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Commons kit deleted successfully' });
    } catch (error) {
      console.error('[ContentController.deleteCommonsKit] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete commons kit', error: error.message });
    }
  }

  // Commons Methods: Brands
  async getCommonsBrands(req, res) {
    try {
      const org_code = req.user?.org_code || req.headers['x-org-code'] || 'taiton';
      const [rows] = await pool.execute(
        'SELECT id, org_code, name, image_url, description, created_at, updated_at FROM tb_pdt_commons_brands WHERE LOWER(org_code) = LOWER(?) ORDER BY name ASC',
        [org_code]
      );
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error('[ContentController.getCommonsBrands] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch commons brands', error: error.message });
    }
  }

  async createCommonsBrand(req, res) {
    try {
      const org_code = req.user?.org_code || req.headers['x-org-code'] || 'taiton';
      const { name, image_url, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Brand name is required' });
      }
      const [result] = await pool.execute(
        'INSERT INTO tb_pdt_commons_brands (org_code, name, image_url, description) VALUES (?, ?, ?, ?)',
        [org_code, name.trim(), image_url || null, description || null]
      );
      return res.status(201).json({
        success: true,
        data: { id: result.insertId, org_code, name: name.trim(), image_url, description },
        message: 'Brand created successfully in Commons'
      });
    } catch (error) {
      console.error('[ContentController.createCommonsBrand] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create commons brand', error: error.message });
    }
  }

  async updateCommonsBrand(req, res) {
    try {
      const { id } = req.params;
      const { name, image_url, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Brand name is required' });
      }
      await pool.execute(
        'UPDATE tb_pdt_commons_brands SET name = ?, image_url = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name.trim(), image_url || null, description || null, id]
      );
      return res.status(200).json({ success: true, message: 'Commons brand updated successfully' });
    } catch (error) {
      console.error('[ContentController.updateCommonsBrand] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update commons brand', error: error.message });
    }
  }

  async deleteCommonsBrand(req, res) {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM tb_pdt_commons_brands WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Commons brand deleted successfully' });
    } catch (error) {
      console.error('[ContentController.deleteCommonsBrand] Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete commons brand', error: error.message });
    }
  }
}

const contentController = new ContentController();
contentController.evaluateApprovalRuleAndStatus = evaluateApprovalRuleAndStatus;

module.exports = contentController;
module.exports.evaluateApprovalRuleAndStatus = evaluateApprovalRuleAndStatus;
