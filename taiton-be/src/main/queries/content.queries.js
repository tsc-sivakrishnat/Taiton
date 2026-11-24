/**
 * Centralized SQL Queries for Web Content (Blogs, Careers, Catalogs).
 */

const CONTENT_QUERIES = {
  // Blogs
  GET_ALL_BLOGS: `
    SELECT b.id, b.org_code, b.highlighter, b.title, b.description, b.written_by, b.status, b.created_at, b.updated_at,
           c.primary_image, c.post_content
    FROM tb_web_blogs b
    LEFT JOIN tb_web_blog_content c ON b.id = c.blog_id
    WHERE (LOWER(b.org_code) = LOWER(?) OR ? IS NULL) AND b.status != 'archived'
    ORDER BY b.id DESC
  `,

  GET_BLOG_BY_ID: `
    SELECT b.*, c.primary_image, c.post_content, c.related_links, c.related_posts
    FROM tb_web_blogs b
    LEFT JOIN tb_web_blog_content c ON b.id = c.blog_id
    WHERE b.id = ? AND (LOWER(b.org_code) = LOWER(?) OR ? IS NULL)
  `,

  INSERT_BLOG: `
    INSERT INTO tb_web_blogs (org_code, highlighter, title, description, written_by, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `,

  INSERT_BLOG_CONTENT: `
    INSERT INTO tb_web_blog_content (blog_id, primary_image, post_content, related_links, related_posts)
    VALUES (?, ?, ?, ?, ?)
  `,

  DELETE_BLOG: `
    UPDATE tb_web_blogs
    SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  // Careers
  GET_ALL_CAREERS: `
    SELECT id, org_code, title, department, location, employment_type, description, requirements, apply_link, status, created_at, updated_at
    FROM tb_web_careers
    WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'archived'
    ORDER BY id DESC
  `,

  INSERT_CAREER: `
    INSERT INTO tb_web_careers (org_code, title, department, location, employment_type, description, requirements, apply_link, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  DELETE_CAREER: `
    UPDATE tb_web_careers
    SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  // Catalogs
  GET_ALL_CATALOGS: `
    SELECT id, org_code, name, category, file_url, thumbnail_img, publish_year, product_page_thumbnail, page_name, image_1, image_2, page_groups, status, created_at, updated_at
    FROM tb_web_catalogs
    WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'archived'
    ORDER BY id DESC
  `,

  INSERT_CATALOG: `
    INSERT INTO tb_web_catalogs (org_code, name, category, file_url, thumbnail_img, publish_year, product_page_thumbnail, page_name, image_1, image_2, page_groups, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  DELETE_CATALOG: `
    UPDATE tb_web_catalogs
    SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,
};

module.exports = CONTENT_QUERIES;
