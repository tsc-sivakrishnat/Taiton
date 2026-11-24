/**
 * Centralized SQL Queries for Products, Product Info, & Variants.
 */

const PRODUCT_QUERIES = {
  GET_ALL_PRODUCTS: `
    SELECT p.id, p.org_code, p.parent_id, p.pdt_code, p.product, p.primary_img, p.status, p.created_at, p.updated_at,
           c.category, info.price, info.desc
    FROM tb_pdt_products p
    LEFT JOIN tb_pdt_categories c ON p.parent_id = c.id
    LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id
    WHERE (LOWER(p.org_code) = LOWER(?) OR ? IS NULL) AND p.status != 'deleted'
    ORDER BY p.id DESC
  `,

  GET_PRODUCT_BY_ID: `
    SELECT p.*, info.desc, info.price, info.features, info.specs, info.addl_features, info.pdt_imgs, info.acces, info.related_pdts, info.variants as info_variants
    FROM tb_pdt_products p
    LEFT JOIN tb_pdt_product_info info ON p.id = info.pdt_id
    WHERE p.id = ? AND (LOWER(p.org_code) = LOWER(?) OR ? IS NULL) AND p.status != 'deleted'
  `,

  INSERT_PRODUCT: `
    INSERT INTO tb_pdt_products (org_code, parent_id, pdt_code, product, primary_img, status)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, 'draft'))
  `,

  INSERT_PRODUCT_INFO: `
    INSERT INTO tb_pdt_product_info (pdt_id, \`desc\`, price, features, specs, addl_features, pdt_imgs, acces, related_pdts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_PRODUCT: `
    UPDATE tb_pdt_products
    SET parent_id = COALESCE(?, parent_id),
        product = COALESCE(?, product),
        primary_img = COALESCE(?, primary_img),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  UPDATE_PRODUCT_INFO: `
    UPDATE tb_pdt_product_info
    SET \`desc\` = COALESCE(?, \`desc\`),
        price = COALESCE(?, price),
        features = COALESCE(?, features),
        specs = COALESCE(?, specs),
        addl_features = COALESCE(?, addl_features),
        pdt_imgs = COALESCE(?, pdt_imgs),
        acces = COALESCE(?, acces),
        related_pdts = COALESCE(?, related_pdts)
    WHERE pdt_id = ?
  `,

  DELETE_PRODUCT: `
    UPDATE tb_pdt_products
    SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  // Variants
  GET_VARIANTS_BY_PDT_ID: `
    SELECT id, org_code, pdt_id, var_code, name, colour, price, sku, primary_img, imgs, status, created_at, updated_at
    FROM tb_pdt_variants
    WHERE pdt_id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'deleted'
    ORDER BY id DESC
  `,

  INSERT_VARIANT: `
    INSERT INTO tb_pdt_variants (org_code, pdt_id, var_code, name, colour, price, sku, primary_img, imgs, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'draft'))
  `,
};

module.exports = PRODUCT_QUERIES;
