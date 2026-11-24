/**
 * Customer queries for Google Auth, Profile, Cart, Wishlist, and Recently Viewed
 * Operates on u418448115_web_schema
 */

module.exports = {
  // Customer Lookup & Creation
  getCustomerByEmail: `
    SELECT id, name, email, mobile, avatar, type, is_active, status, created_at
    FROM tb_web_customers
    WHERE email = ?
    LIMIT 1
  `,

  getCustomerById: `
    SELECT id, name, email, mobile, avatar, type, is_active, status, created_at
    FROM tb_web_customers
    WHERE id = ?
    LIMIT 1
  `,

  createCustomer: `
    INSERT INTO tb_web_customers (email, name, avatar, google_id, type, is_active, status, created_at)
    VALUES (?, ?, ?, ?, 'Regular', 1, 1, NOW())
  `,

  updateCustomerAvatarAndGoogleId: `
    UPDATE tb_web_customers
    SET avatar = COALESCE(?, avatar),
        google_id = COALESCE(?, google_id),
        updated_at = NOW()
    WHERE id = ?
  `,

  updateCustomerProfile: `
    UPDATE tb_web_customers
    SET name = COALESCE(?, name),
        mobile = COALESCE(?, mobile),
        updated_at = NOW()
    WHERE id = ?
  `,

  // Cart Queries
  getCartItems: `
    SELECT 
      c.id AS cart_id,
      c.customer_id,
      c.pdt_id,
      c.variant_id,
      c.qty,
      c.created_at,
      p.pdt_code AS product_code,
      p.product AS product_name,
      p.primary_img AS product_image,
      pi.price AS product_price,
      v.name AS variant_name,
      v.colour AS variant_colour,
      v.price AS variant_price,
      v.primary_img AS variant_image
    FROM tb_web_cart c
    LEFT JOIN tb_pdt_products p ON c.pdt_id = p.id
    LEFT JOIN tb_pdt_product_info pi ON p.id = pi.pdt_id
    LEFT JOIN tb_pdt_variants v ON c.variant_id = v.id
    WHERE c.customer_id = ?
    ORDER BY c.created_at DESC
  `,

  upsertCartItem: `
    INSERT INTO tb_web_cart (customer_id, pdt_id, variant_id, qty, created_at, updated_at)
    VALUES (?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
      qty = qty + VALUES(qty),
      updated_at = NOW()
  `,

  updateCartQty: `
    UPDATE tb_web_cart
    SET qty = ?, updated_at = NOW()
    WHERE id = ? AND customer_id = ?
  `,

  removeCartItem: `
    DELETE FROM tb_web_cart
    WHERE id = ? AND customer_id = ?
  `,

  clearCart: `
    DELETE FROM tb_web_cart
    WHERE customer_id = ?
  `,

  // Wishlist Queries
  getWishlistItems: `
    SELECT 
      w.id AS wishlist_id,
      w.customer_id,
      w.pdt_id,
      w.variant_id,
      w.created_at,
      p.pdt_code AS product_code,
      p.product AS product_name,
      p.primary_img AS product_image,
      pi.price AS product_price,
      v.name AS variant_name,
      v.colour AS variant_colour,
      v.primary_img AS variant_image
    FROM tb_web_wishlist w
    LEFT JOIN tb_pdt_products p ON w.pdt_id = p.id
    LEFT JOIN tb_pdt_product_info pi ON p.id = pi.pdt_id
    LEFT JOIN tb_pdt_variants v ON w.variant_id = v.id
    WHERE w.customer_id = ?
    ORDER BY w.created_at DESC
  `,

  addToWishlist: `
    INSERT IGNORE INTO tb_web_wishlist (customer_id, pdt_id, variant_id, created_at)
    VALUES (?, ?, ?, NOW())
  `,

  removeFromWishlist: `
    DELETE FROM tb_web_wishlist
    WHERE (id = ? OR pdt_id = ?) AND customer_id = ?
  `,

  // Recently Viewed Queries (Strictly Keep Last 10 items)
  getRecentlyViewed: `
    SELECT 
      rv.id AS rv_id,
      rv.customer_id,
      rv.pdt_id,
      rv.viewed_at,
      p.pdt_code AS product_code,
      p.product AS product_name,
      p.primary_img AS product_image,
      pi.price AS product_price
    FROM tb_web_recently_viewed rv
    LEFT JOIN tb_pdt_products p ON rv.pdt_id = p.id
    LEFT JOIN tb_pdt_product_info pi ON p.id = pi.pdt_id
    WHERE rv.customer_id = ?
    ORDER BY rv.viewed_at DESC
    LIMIT 10
  `,

  upsertRecentlyViewed: `
    INSERT INTO tb_web_recently_viewed (customer_id, pdt_id, viewed_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE viewed_at = NOW()
  `,

  // Trim to strictly last 10 viewed items
  trimRecentlyViewed: `
    DELETE FROM tb_web_recently_viewed
    WHERE customer_id = ?
      AND id NOT IN (
        SELECT id FROM (
          SELECT id FROM tb_web_recently_viewed
          WHERE customer_id = ?
          ORDER BY viewed_at DESC
          LIMIT 10
        ) AS keep_rows
      )
  `,

  clearRecentlyViewed: `
    DELETE FROM tb_web_recently_viewed
    WHERE customer_id = ?
  `,
};

