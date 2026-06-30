import '../src/config/env.js';
import { pool } from '../src/config/db.js';

const tables = [
  {
    name: 'tb_taiton_categories',
    query: `
      CREATE TABLE IF NOT EXISTS tb_taiton_categories (
        id BIGINT NOT NULL AUTO_INCREMENT,
        org_id BIGINT NOT NULL,
        cat_id VARCHAR(64) NOT NULL,
        category_name VARCHAR(190) NOT NULL,
        seo_meta_title VARCHAR(255) DEFAULT NULL,
        seo_meta_description TEXT DEFAULT NULL,
        focus_keyword VARCHAR(255) DEFAULT NULL,
        secondary_keywords TEXT DEFAULT NULL,
        category_image VARCHAR(500) DEFAULT NULL,
        image_alt_text VARCHAR(255) DEFAULT NULL,
        related_products TEXT DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_taiton_cat (org_id, cat_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'tb_taiton_subcategories',
    query: `
      CREATE TABLE IF NOT EXISTS tb_taiton_subcategories (
        id BIGINT NOT NULL AUTO_INCREMENT,
        org_id BIGINT NOT NULL,
        sub_cat_id VARCHAR(64) NOT NULL,
        parent_cat_id VARCHAR(64) NOT NULL,
        sub_category_name VARCHAR(190) NOT NULL,
        url VARCHAR(255) DEFAULT NULL,
        seo_meta_title VARCHAR(255) DEFAULT NULL,
        seo_meta_description TEXT DEFAULT NULL,
        focus_keyword VARCHAR(255) DEFAULT NULL,
        secondary_keywords TEXT DEFAULT NULL,
        related_products TEXT DEFAULT NULL,
        image_alt_text VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_taiton_subcat (org_id, sub_cat_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'tb_taiton_products',
    query: `
      CREATE TABLE IF NOT EXISTS tb_taiton_products (
        id BIGINT NOT NULL AUTO_INCREMENT,
        org_id BIGINT NOT NULL,
        prd_id VARCHAR(64) NOT NULL,
        cat_id VARCHAR(64) NOT NULL,
        sub_cat_id VARCHAR(64) NOT NULL,
        product_name VARCHAR(190) NOT NULL,
        product_code VARCHAR(100) DEFAULT NULL,
        url VARCHAR(255) DEFAULT NULL,
        seo_meta_title VARCHAR(255) DEFAULT NULL,
        seo_meta_description TEXT DEFAULT NULL,
        focus_keyword VARCHAR(255) DEFAULT NULL,
        secondary_keywords TEXT DEFAULT NULL,
        product_description TEXT DEFAULT NULL,
        product_features JSON DEFAULT NULL,
        product_specifications JSON DEFAULT NULL,
        canonical_url VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_taiton_prd (org_id, prd_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'tb_taiton_seo_pages',
    query: `
      CREATE TABLE IF NOT EXISTS tb_taiton_seo_pages (
        id BIGINT NOT NULL AUTO_INCREMENT,
        org_id BIGINT NOT NULL,
        page_url VARCHAR(255) NOT NULL,
        seo_meta_title VARCHAR(255) DEFAULT NULL,
        seo_meta_description TEXT DEFAULT NULL,
        focus_keyword VARCHAR(255) DEFAULT NULL,
        secondary_keywords TEXT DEFAULT NULL,
        canonical_url VARCHAR(255) DEFAULT NULL,
        og_title VARCHAR(255) DEFAULT NULL,
        og_description TEXT DEFAULT NULL,
        og_image VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_taiton_seo (org_id, page_url)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'tb_taiton_blogs',
    query: `
      CREATE TABLE IF NOT EXISTS tb_taiton_blogs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        org_id BIGINT NOT NULL,
        blog_id VARCHAR(64) NOT NULL,
        blog_title VARCHAR(255) NOT NULL,
        url VARCHAR(255) DEFAULT NULL,
        url_slug VARCHAR(190) NOT NULL,
        h1_tag VARCHAR(255) DEFAULT NULL,
        seo_meta_title VARCHAR(255) DEFAULT NULL,
        seo_meta_description TEXT DEFAULT NULL,
        focus_keyword VARCHAR(255) DEFAULT NULL,
        secondary_keywords TEXT DEFAULT NULL,
        canonical_url VARCHAR(255) DEFAULT NULL,
        og_title VARCHAR(255) DEFAULT NULL,
        og_description TEXT DEFAULT NULL,
        og_image VARCHAR(500) DEFAULT NULL,
        schema_type VARCHAR(100) DEFAULT NULL,
        robots_tag VARCHAR(100) DEFAULT NULL,
        image_alt_text VARCHAR(255) DEFAULT NULL,
        blog_content LONGTEXT DEFAULT NULL,
        author_name VARCHAR(140) DEFAULT NULL,
        blog_category VARCHAR(100) DEFAULT NULL,
        reading_time VARCHAR(50) DEFAULT NULL,
        featured_image VARCHAR(500) DEFAULT NULL,
        publish_date DATETIME DEFAULT NULL,
        modified_date DATETIME DEFAULT NULL,
        faq_section JSON DEFAULT NULL,
        internal_linking_targets TEXT DEFAULT NULL,
        related_products TEXT DEFAULT NULL,
        redirect_url_301 VARCHAR(255) DEFAULT NULL,
        last_updated_date DATETIME DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_taiton_blog (org_id, blog_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  }
];

async function main() {
  console.log('Setting up Taiton custom tables...');
  for (const table of tables) {
    try {
      console.log(`Creating table: ${table.name}...`);
      await pool.query(table.query);
      console.log(`Table ${table.name} created or exists.`);
    } catch (e) {
      console.error(`Error creating table ${table.name}:`, e);
      process.exit(1);
    }
  }
  console.log('All tables verified.');
  process.exit(0);
}

main();
