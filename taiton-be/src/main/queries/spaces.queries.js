/**
 * Centralized SQL Queries for Explore Spaces and Image Hotspots.
 */

const SPACES_QUERIES = {
  GET_ALL_SPACES: `
    SELECT s.id, s.org_code, s.title, s.description, s.image_url, s.status, s.view, s.sort_order,
           s.content_version, s.created_by, s.created_by_name, s.created_at, s.updated_at,
           (SELECT COUNT(*) FROM tb_web_space_hotspots h WHERE h.space_id = s.id) AS hotspot_count
    FROM tb_web_spaces s
    WHERE (LOWER(s.org_code) = LOWER(?) OR ? IS NULL) AND s.status != 'deleted'
    ORDER BY s.sort_order ASC, s.id DESC
  `,

  GET_SPACE_BY_ID: `
    SELECT s.*
    FROM tb_web_spaces s
    WHERE s.id = ? AND (LOWER(s.org_code) = LOWER(?) OR ? IS NULL) AND s.status != 'deleted'
  `,

  GET_HOTSPOTS_BY_SPACE_ID: `
    SELECT h.id, h.space_id, h.product_id, h.product_code, h.x_pos, h.y_pos, h.label, h.sort_order,
           h.created_at, h.updated_at,
           p.product AS product_name,
           p.primary_img AS product_img,
           p.pdt_code,
           p.status AS product_status,
           info.desc AS product_desc,
           info.features AS product_features,
           info.specs AS product_specifications,
           info.pdt_imgs AS other_images,
           info.variants AS product_variants
    FROM tb_web_space_hotspots h
    LEFT JOIN tb_pdt_products p ON (h.product_id = p.id OR (h.product_code IS NOT NULL AND p.pdt_code COLLATE utf8mb4_general_ci = h.product_code COLLATE utf8mb4_general_ci))
    LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id
    WHERE h.space_id = ?
    ORDER BY h.sort_order ASC, h.id ASC
  `,

  INSERT_SPACE: `
    INSERT INTO tb_web_spaces (org_code, title, description, image_url, status, view, sort_order, created_by, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_SPACE: `
    UPDATE tb_web_spaces
    SET title = ?, description = ?, image_url = ?, status = ?, view = ?, sort_order = ?, content_version = content_version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  UPDATE_SPACE_VIEW: `
    UPDATE tb_web_spaces
    SET view = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  UPDATE_SPACE_STATUS: `
    UPDATE tb_web_spaces
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  DELETE_SPACE: `
    UPDATE tb_web_spaces
    SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  DELETE_HOTSPOTS_FOR_SPACE: `
    DELETE FROM tb_web_space_hotspots WHERE space_id = ?
  `,

  INSERT_HOTSPOT: `
    INSERT INTO tb_web_space_hotspots (space_id, product_id, product_code, x_pos, y_pos, label, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  GET_PUBLIC_SPACES: `
    SELECT s.id, s.org_code, s.title, s.description, s.image_url, s.status, s.view, s.sort_order, s.created_at
    FROM tb_web_spaces s
    WHERE (LOWER(s.org_code) = LOWER(?) OR ? IS NULL)
      AND s.status IN ('live', 'ready_to_live', 'approved')
      AND s.view = 'view'
    ORDER BY s.sort_order ASC, s.id DESC
  `,
};

module.exports = SPACES_QUERIES;
