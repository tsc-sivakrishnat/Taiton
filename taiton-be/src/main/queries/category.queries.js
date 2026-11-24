/**
 * Centralized SQL Queries for Product Categories & Sub-Categories.
 */

const CATEGORY_QUERIES = {
  GET_ALL_CATEGORIES: `
    SELECT id, org_code, category, img, status, content_version, created_at, updated_at
    FROM tb_pdt_categories
    WHERE org_code = ? AND status != 'deleted'
    ORDER BY id DESC
  `,

  GET_CATEGORY_BY_ID: `
    SELECT id, org_code, category, img, status, content_version, created_at, updated_at
    FROM tb_pdt_categories
    WHERE id = ? AND org_code = ? AND status != 'deleted'
  `,

  INSERT_CATEGORY: `
    INSERT INTO tb_pdt_categories (org_code, category, img, status)
    VALUES (?, ?, ?, COALESCE(?, 'draft'))
  `,

  UPDATE_CATEGORY: `
    UPDATE tb_pdt_categories
    SET category = COALESCE(?, category),
        img = COALESCE(?, img),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND org_code = ?
  `,

  DELETE_CATEGORY: `
    UPDATE tb_pdt_categories
    SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND org_code = ?
  `,

  GET_ALL_SUB_CATEGORIES: `
    SELECT sc.id, sc.parent_id AS cat_id, c.category as main_category, sc.category AS sub_category, sc.img, sc.status, sc.created_at, sc.updated_at
    FROM tb_pdt_categories sc
    LEFT JOIN tb_pdt_categories c ON sc.parent_id = c.id
    WHERE sc.org_code = ? AND sc.status != 'deleted' AND (sc.type = 'sub category' OR sc.parent_id != 0)
    ORDER BY sc.id DESC
  `,

  GET_SUB_CATEGORIES_BY_CAT_ID: `
    SELECT id, parent_id AS cat_id, category AS sub_category, img, status, created_at, updated_at
    FROM tb_pdt_categories
    WHERE parent_id = ? AND status != 'deleted'
    ORDER BY id DESC
  `,

  INSERT_SUB_CATEGORY: `
    INSERT INTO tb_pdt_categories (org_code, type, parent_id, category, img, status)
    VALUES (?, 'sub category', ?, ?, ?, COALESCE(?, 'draft'))
  `,

  UPDATE_SUB_CATEGORY: `
    UPDATE tb_pdt_categories
    SET category = COALESCE(?, category),
        img = COALESCE(?, img),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  DELETE_SUB_CATEGORY: `
    UPDATE tb_pdt_categories
    SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
};

module.exports = CATEGORY_QUERIES;
