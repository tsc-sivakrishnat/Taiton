const { pool } = require('../../resources/connection');
const SPACES_QUERIES = require('../queries/spaces.queries');
const { logAudit } = require('../utils/auditLogger');

function safeJsonParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

class SpacesService {
  /**
   * Get all explore spaces for an organization
   */
  async getSpaces(orgCode, { status, q, limit = 50, offset = 0 } = {}) {
    const cleanOrg = orgCode || null;
    let sql = `
      SELECT s.id, s.org_code, s.title, s.description, s.image_url, s.status, s.view, s.sort_order,
             s.content_version, s.created_by, s.created_by_name, s.created_at, s.updated_at,
             (SELECT COUNT(*) FROM tb_web_space_hotspots h WHERE h.space_id = s.id) AS hotspot_count
      FROM tb_web_spaces s
      WHERE (LOWER(s.org_code) = LOWER(?) OR ? IS NULL) AND s.status != 'deleted'
    `;
    const params = [cleanOrg, cleanOrg];

    if (status && status !== 'all' && status !== 'any') {
      sql += ` AND LOWER(s.status) = ?`;
      params.push(status.toLowerCase());
    }

    if (q) {
      sql += ` AND (LOWER(s.title) LIKE ? OR LOWER(s.description) LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY s.sort_order ASC, s.id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

    const [rows] = await pool.execute(sql, params);

    // Fetch hotspots for all retrieved spaces so frontend has complete data
    const spaceIds = rows.map((r) => r.id);
    let allHotspots = [];
    if (spaceIds.length > 0) {
      const placeholders = spaceIds.map(() => '?').join(',');
      const [hRows] = await pool.execute(
        `SELECT h.*, 
                p.product AS product_name, 
                p.primary_img AS product_img, 
                p.pdt_code,
                info.desc AS product_desc,
                info.features AS product_features,
                info.specs AS product_specifications,
                info.variants AS product_variants
         FROM tb_web_space_hotspots h
         LEFT JOIN tb_pdt_products p ON (h.product_id = p.id OR (h.product_code IS NOT NULL AND p.pdt_code = h.product_code))
         LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id
         WHERE h.space_id IN (${placeholders})
         ORDER BY h.sort_order ASC, h.id ASC`,
        spaceIds
      );
      allHotspots = hRows;
    }

    const hotspotsBySpace = {};
    for (const h of allHotspots) {
      if (!hotspotsBySpace[h.space_id]) {
        hotspotsBySpace[h.space_id] = [];
      }
      hotspotsBySpace[h.space_id].push({
        id: h.id,
        space_id: h.space_id,
        product_id: h.product_id,
        product_code: h.product_code || h.pdt_code || '',
        x: Number(h.x_pos),
        y: Number(h.y_pos),
        x_pos: Number(h.x_pos),
        y_pos: Number(h.y_pos),
        label: h.label || h.product_name || '',
        product: h.product_name ? {
          id: h.product_id,
          name: h.product_name,
          code: h.pdt_code || h.product_code,
          image: h.product_img,
          description: h.product_desc,
          features: safeJsonParse(h.product_features, null),
          specifications: safeJsonParse(h.product_specifications, null),
          variants: safeJsonParse(h.product_variants, []),
        } : null,
      });
    }

    return rows.map((s) => ({
      ...s,
      hotspots: hotspotsBySpace[s.id] || [],
    }));
  }

  /**
   * Get single explore space by ID with all hotspots and joined product details
   */
  async getSpaceById(id, orgCode) {
    const cleanOrg = orgCode || null;
    const [rows] = await pool.execute(SPACES_QUERIES.GET_SPACE_BY_ID, [id, cleanOrg, cleanOrg]);
    if (rows.length === 0) return null;

    const space = rows[0];
    const [hotspots] = await pool.execute(SPACES_QUERIES.GET_HOTSPOTS_BY_SPACE_ID, [id]);

    space.hotspots = hotspots.map((h) => ({
      id: h.id,
      space_id: h.space_id,
      product_id: h.product_id,
      product_code: h.product_code || h.pdt_code || '',
      x: Number(h.x_pos),
      y: Number(h.y_pos),
      x_pos: Number(h.x_pos),
      y_pos: Number(h.y_pos),
      label: h.label || h.product_name || '',
      product: h.product_name ? {
        id: h.product_id,
        name: h.product_name,
        code: h.pdt_code || h.product_code,
        image: h.product_img,
        description: h.product_desc,
        features: safeJsonParse(h.product_features, null),
        specifications: safeJsonParse(h.product_specifications, null),
        variants: safeJsonParse(h.product_variants, []),
      } : null,
    }));

    return space;
  }

  /**
   * Create an explore space with hotspots in a transaction
   */
  async createSpace(orgCode, data, user = {}) {
    const cleanOrg = orgCode || 'taiton';
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        title,
        name,
        description = '',
        image_url,
        img,
        status = 'draft',
        view = 'view',
        sort_order = 0,
        hotspots = [],
        pts = [],
      } = data;

      const spaceTitle = (title || name || '').trim();
      const spaceImage = (image_url || img || '').trim();
      const spaceDescription = (description || '').trim();

      const userId = user.id || 0;
      const userName = user.fullName || user.displayName || user.name || user.email || 'Admin';

      const [spaceRes] = await connection.execute(SPACES_QUERIES.INSERT_SPACE, [
        cleanOrg,
        spaceTitle,
        spaceDescription,
        spaceImage,
        status,
        view,
        Number(sort_order) || 0,
        userId,
        userName,
      ]);

      const spaceId = spaceRes.insertId;

      // Combine hotspots or pts
      const rawPoints = hotspots.length > 0 ? hotspots : pts;
      for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        const x = Number(p.x ?? p.x_pos ?? 0);
        const y = Number(p.y ?? p.y_pos ?? 0);
        let productId = p.product_id || p.productId || null;
        let productCode = p.product_code || p.c || p.productCode || null;

        // If productCode provided but not product_id, lookup in tb_pdt_products
        if (!productId && productCode) {
          const [pMatch] = await connection.query(
            `SELECT id FROM tb_pdt_products WHERE pdt_code = ? LIMIT 1`,
            [productCode]
          );
          if (pMatch.length > 0) {
            productId = pMatch[0].id;
          }
        } else if (productId && !productCode) {
          const [pMatch] = await connection.query(
            `SELECT pdt_code FROM tb_pdt_products WHERE id = ? LIMIT 1`,
            [productId]
          );
          if (pMatch.length > 0) {
            productCode = pMatch[0].pdt_code;
          }
        }

        const label = (p.label || p.name || productCode || `Hotspot #${i + 1}`).trim();

        await connection.execute(SPACES_QUERIES.INSERT_HOTSPOT, [
          spaceId,
          productId,
          productCode,
          x,
          y,
          label,
          i,
        ]);
      }

      await connection.commit();

      await logAudit({
        orgCode: cleanOrg,
        tableName: 'tb_web_spaces',
        recordId: spaceId,
        action: 'create',
        maker: userName,
        message: `Created Explore Space "${spaceTitle}" with ${rawPoints.length} hotspot(s)`,
        newVal: JSON.stringify({ spaceId, title: spaceTitle, status, hotspotsCount: rawPoints.length }),
        createdBy: userId,
      });

      return await this.getSpaceById(spaceId, cleanOrg);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update an explore space and its hotspots
   */
  async updateSpace(id, orgCode, data, user = {}) {
    const cleanOrg = orgCode || 'taiton';
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existing] = await connection.execute(SPACES_QUERIES.GET_SPACE_BY_ID, [id, cleanOrg, cleanOrg]);
      if (existing.length === 0) {
        throw new Error(`Explore Space #${id} not found`);
      }

      const current = existing[0];
      const title = (data.title || data.name || current.title).trim();
      const description = data.description !== undefined ? data.description : current.description;
      const imageUrl = (data.image_url || data.img || current.image_url).trim();
      const status = data.status || current.status;
      const view = data.view || current.view;
      const sortOrder = data.sort_order !== undefined ? Number(data.sort_order) : current.sort_order;

      await connection.execute(SPACES_QUERIES.UPDATE_SPACE, [
        title,
        description,
        imageUrl,
        status,
        view,
        sortOrder,
        id,
        cleanOrg,
        cleanOrg,
      ]);

      // If hotspots or pts are provided, replace hotspots
      const rawPoints = data.hotspots || data.pts;
      if (Array.isArray(rawPoints)) {
        await connection.execute(SPACES_QUERIES.DELETE_HOTSPOTS_FOR_SPACE, [id]);

        for (let i = 0; i < rawPoints.length; i++) {
          const p = rawPoints[i];
          const x = Number(p.x ?? p.x_pos ?? 0);
          const y = Number(p.y ?? p.y_pos ?? 0);
          let productId = p.product_id || p.productId || null;
          let productCode = p.product_code || p.c || p.productCode || null;

          if (!productId && productCode) {
            const [pMatch] = await connection.query(
              `SELECT id FROM tb_pdt_products WHERE pdt_code = ? LIMIT 1`,
              [productCode]
            );
            if (pMatch.length > 0) {
              productId = pMatch[0].id;
            }
          } else if (productId && !productCode) {
            const [pMatch] = await connection.query(
              `SELECT pdt_code FROM tb_pdt_products WHERE id = ? LIMIT 1`,
              [productId]
            );
            if (pMatch.length > 0) {
              productCode = pMatch[0].pdt_code;
            }
          }

          const label = (p.label || p.name || productCode || `Hotspot #${i + 1}`).trim();

          await connection.execute(SPACES_QUERIES.INSERT_HOTSPOT, [
            id,
            productId,
            productCode,
            x,
            y,
            label,
            i,
          ]);
        }
      }

      await connection.commit();

      const userName = user.fullName || user.displayName || user.name || user.email || 'Admin';
      await logAudit({
        orgCode: cleanOrg,
        tableName: 'tb_web_spaces',
        recordId: id,
        action: 'update',
        maker: userName,
        message: `Updated Explore Space #${id} ("${title}")`,
        oldVal: JSON.stringify({ title: current.title, status: current.status }),
        newVal: JSON.stringify({ title, status }),
        createdBy: user.id || 0,
      });

      return await this.getSpaceById(id, cleanOrg);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete / archive an explore space
   */
  async deleteSpace(id, orgCode, user = {}) {
    const cleanOrg = orgCode || null;
    const [rows] = await pool.execute(SPACES_QUERIES.GET_SPACE_BY_ID, [id, cleanOrg, cleanOrg]);
    if (rows.length === 0) {
      throw new Error(`Explore Space #${id} not found`);
    }

    const space = rows[0];
    await pool.execute(SPACES_QUERIES.DELETE_SPACE, [id, cleanOrg, cleanOrg]);

    const userName = user.fullName || user.displayName || user.name || user.email || 'Admin';
    await logAudit({
      orgCode: space.org_code,
      tableName: 'tb_web_spaces',
      recordId: id,
      action: 'delete',
      maker: userName,
      message: `Deleted Explore Space #${id} ("${space.title}")`,
      createdBy: user.id || 0,
    });

    return true;
  }

  /**
   * Toggle space view visibility (view / hide)
   */
  async toggleView(id, orgCode, view, user = {}) {
    const cleanOrg = orgCode || null;
    const nextView = view === 'hide' ? 'hide' : 'view';

    await pool.execute(SPACES_QUERIES.UPDATE_SPACE_VIEW, [nextView, id, cleanOrg, cleanOrg]);

    const userName = user.fullName || user.displayName || user.name || user.email || 'Admin';
    await logAudit({
      orgCode: cleanOrg,
      tableName: 'tb_web_spaces',
      recordId: id,
      action: 'view_toggle',
      maker: userName,
      message: `Changed visibility of Explore Space #${id} to "${nextView}"`,
      createdBy: user.id || 0,
    });

    return { id, view: nextView };
  }

  /**
   * Public spaces for website frontend
   */
  async getPublicSpaces(orgCode) {
    const cleanOrg = orgCode || null;
    const [spaces] = await pool.execute(SPACES_QUERIES.GET_PUBLIC_SPACES, [cleanOrg, cleanOrg]);

    for (const space of spaces) {
      const [hotspots] = await pool.execute(SPACES_QUERIES.GET_HOTSPOTS_BY_SPACE_ID, [space.id]);
      space.hotspots = hotspots.map((h) => ({
        id: h.id,
        product_id: h.product_id,
        product_code: h.product_code || h.pdt_code,
        x: Number(h.x_pos),
        y: Number(h.y_pos),
        label: h.label || h.product_name,
        product: h.product_name ? {
          id: h.product_id,
          name: h.product_name,
          code: h.pdt_code || h.product_code,
          image: h.product_img,
          description: h.product_desc,
          features: safeJsonParse(h.product_features, null),
          specifications: safeJsonParse(h.product_specifications, null),
          variants: safeJsonParse(h.product_variants, []),
        } : null,
      }));
    }

    return spaces;
  }
}

module.exports = new SpacesService();
