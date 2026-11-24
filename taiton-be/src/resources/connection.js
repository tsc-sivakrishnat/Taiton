const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'u418448115_taiton_cpanel1',
  password: process.env.DB_PASSWORD || 'TechtroleSoftwares123',
  database: process.env.DB_NAME || 'u418448115_taiton_cpanel1',
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 0,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_general_ci", () => { });
});

const prodDbName = process.env.PROD_DB_NAME || 'u418448115_web_schema1';

const prodPool = mysql.createPool({
  host: process.env.PROD_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.PROD_DB_PORT ? parseInt(process.env.PROD_DB_PORT, 10) : (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306),
  user: process.env.PROD_DB_USER || 'u418448115_web_schema1',
  password: process.env.PROD_DB_PASSWORD || 'TechtroleSoftwares123',
  database: prodDbName,
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 0,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

prodPool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_general_ci", () => { });
});

let isSchemaEnsured = false;

async function ensureSchema() {
  if (isSchemaEnsured) return;
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_cpanel_release_batches (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        batch_uuid varchar(64) NOT NULL,
        org_code varchar(40) NOT NULL,
        release_version varchar(60) NOT NULL,
        status enum('PREPARING','SYNCING','COMMITTED','REVERTING','REVERTED','FAILED') NOT NULL DEFAULT 'PREPARING',
        total_items int(11) NOT NULL DEFAULT 0,
        synced_breakdown longtext DEFAULT NULL,
        created_by bigint(20) unsigned DEFAULT 0,
        created_by_name varchar(160) DEFAULT NULL,
        release_note varchar(500) DEFAULT NULL,
        backup_snapshot_path varchar(500) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        committed_at timestamp NULL DEFAULT NULL,
        reverted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_batch_uuid (batch_uuid),
        KEY ix_rel_org_status (org_code, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_cpanel_release_batch_items (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        batch_id bigint(20) unsigned NOT NULL,
        content_type varchar(60) NOT NULL,
        table_name varchar(80) NOT NULL,
        record_id bigint(20) unsigned NOT NULL,
        title varchar(255) NOT NULL,
        operation_type enum('CREATE','UPDATE','DELETE') NOT NULL DEFAULT 'CREATE',
        source_version int(11) NOT NULL DEFAULT 1,
        payload_json longtext DEFAULT NULL,
        status enum('pending','applied','reverted') NOT NULL DEFAULT 'pending',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_item_batch (batch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sync_revert_logs (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        batch_id bigint(20) unsigned NOT NULL,
        table_name varchar(80) NOT NULL,
        record_id bigint(20) unsigned NOT NULL,
        previous_state longtext DEFAULT NULL,
        previous_status varchar(40) DEFAULT NULL,
        previous_is_active tinyint(1) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_revert_batch (batch_id, table_name, record_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_feed (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        feed_type enum('blog','career','product','catalog','announcement','ui_element') NOT NULL DEFAULT 'announcement',
        ref_table varchar(80) NOT NULL DEFAULT 'tb_ui_element',
        ref_id bigint(20) unsigned NOT NULL DEFAULT 0,
        title varchar(255) NOT NULL,
        summary varchar(500) DEFAULT NULL,
        img varchar(500) DEFAULT NULL,
        published_at timestamp NULL DEFAULT NULL,
        status enum('draft','pending_approval','approved','live','archived','deleted') NOT NULL DEFAULT 'draft',
        content_version int(11) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_feed_org_status (org_code, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_blogs (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        highlighter varchar(120) DEFAULT NULL,
        title varchar(255) NOT NULL,
        description varchar(500) DEFAULT NULL,
        written_by varchar(160) DEFAULT NULL,
        status enum('draft','pending_approval','approved','live','archived') NOT NULL DEFAULT 'draft',
        content_version int(11) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_blog_content (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        blog_id bigint(20) unsigned NOT NULL,
        primary_image varchar(500) DEFAULT NULL,
        post_content longtext DEFAULT NULL,
        related_links longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
        related_posts longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
        content_version int(11) NOT NULL DEFAULT 1,
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_blog_content (blog_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_careers (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        title varchar(200) NOT NULL,
        department varchar(120) DEFAULT NULL,
        location varchar(160) DEFAULT NULL,
        employment_type varchar(60) DEFAULT NULL,
        description longtext DEFAULT NULL,
        requirements longtext DEFAULT NULL,
        apply_link varchar(500) DEFAULT NULL,
        status enum('draft','pending_approval','approved','live','archived') NOT NULL DEFAULT 'draft',
        content_version int(11) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_catalogs (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        name varchar(200) NOT NULL,
        category varchar(120) DEFAULT NULL,
        file_url varchar(500) NOT NULL,
        thumbnail_img varchar(500) DEFAULT NULL,
        status enum('draft','pending_approval','approved','live','archived') NOT NULL DEFAULT 'draft',
        content_version int(11) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_spaces (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL DEFAULT 'taiton',
        title varchar(255) NOT NULL,
        description text DEFAULT NULL,
        image_url varchar(500) NOT NULL,
        status enum('draft','pending_approval','approved','ready_to_live','live','rejected','archived','deleted') NOT NULL DEFAULT 'draft',
        view enum('view','hide') NOT NULL DEFAULT 'view',
        sort_order int(11) NOT NULL DEFAULT 0,
        content_version int(11) NOT NULL DEFAULT 1,
        created_by bigint(20) unsigned DEFAULT 0,
        created_by_name varchar(160) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_spaces_org_status (org_code, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_web_space_hotspots (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        space_id bigint(20) unsigned NOT NULL,
        product_id bigint(20) unsigned DEFAULT NULL,
        product_code varchar(80) DEFAULT NULL,
        x_pos decimal(6,2) NOT NULL DEFAULT 0.00,
        y_pos decimal(6,2) NOT NULL DEFAULT 0.00,
        label varchar(160) DEFAULT NULL,
        sort_order int(11) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_hotspot_space (space_id),
        KEY ix_hotspot_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_org_rules (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        route_id bigint(20) unsigned NOT NULL,
        maker_role_ids longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        check_role_ids longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        status enum('active','inactive') NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_org_approvals (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        table_name varchar(80) NOT NULL,
        type varchar(60) DEFAULT NULL,
        title varchar(255) DEFAULT NULL,
        record_id bigint(20) unsigned NOT NULL,
        maker bigint(20) unsigned NOT NULL DEFAULT 0,
        maker_name varchar(160) DEFAULT NULL,
        message text DEFAULT NULL,
        checker bigint(20) unsigned DEFAULT NULL,
        approval_status enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        actioned_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_org_notifications (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        sent_by bigint(20) unsigned NOT NULL DEFAULT 0,
        sent_to bigint(20) unsigned NOT NULL DEFAULT 0,
        message text NOT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_org_readrecepits (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        notification_id bigint(20) unsigned NOT NULL,
        read_by bigint(20) unsigned NOT NULL,
        read_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_password_resets (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        email varchar(190) NOT NULL,
        token varchar(255) NOT NULL,
        expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_pwd_resets_email (email),
        KEY ix_pwd_resets_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_board_roles (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        role varchar(60) NOT NULL,
        label varchar(120) NOT NULL,
        status enum('active','inactive') NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_org_role (org_code, role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [existingRoles] = await connection.query(`SELECT COUNT(*) as cnt FROM tb_board_roles WHERE org_code = 'taiton'`);
    if (existingRoles[0]?.cnt === 0) {
      await connection.query(`
        INSERT INTO tb_board_roles (org_code, role, label, status) VALUES
        ('taiton', 'organization_admin', 'Organization Admin', 'active'),
        ('taiton', 'super_admin', 'Super Admin', 'active'),
        ('taiton', 'manager', 'Manager', 'active'),
        ('taiton', 'super_employee', 'Super Employee', 'active'),
        ('taiton', 'employee', 'Employee', 'active'),
        ('taiton', 'viewer', 'Viewer', 'active')
      `);
    }

    try { await connection.query(`ALTER TABLE tb_board_roles ADD COLUMN description varchar(255) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_board_roles ADD COLUMN priority int(11) DEFAULT 1`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_org_approvals ADD COLUMN type varchar(60) DEFAULT NULL AFTER table_name`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_org_approvals ADD COLUMN title varchar(255) DEFAULT NULL AFTER record_id`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_org_approvals ADD COLUMN maker_name varchar(160) DEFAULT NULL AFTER maker`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_board_users MODIFY COLUMN status ENUM('draft','pending_approval','approved','active','deleted') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_categories MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_sub_categories MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_products MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_variants MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_blogs MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_careers MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_catalogs MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_spaces MODIFY COLUMN status ENUM('draft','pending_approval','approved','ready_to_live','live','inactive','rejected','archived','deleted') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_feed MODIFY COLUMN status ENUM('draft','pending_approval','approved','ready_to_live','live','inactive','archived','deleted') NOT NULL DEFAULT 'draft'`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_web_seo MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','ready_to_live','live','inactive','deleted','archived') NOT NULL DEFAULT 'draft'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_seo ADD COLUMN canonical_url varchar(500) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_seo ADD COLUMN og_title varchar(255) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_seo ADD COLUMN og_description text DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_seo ADD COLUMN schema_type varchar(100) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_seo ADD COLUMN view enum('view','hide') NOT NULL DEFAULT 'view'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_seo ADD COLUMN is_page_seo tinyint(1) NOT NULL DEFAULT 0`); } catch (e) { }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_pdt_categories (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        type enum('category','sub category') NOT NULL DEFAULT 'category',
        parent_id bigint(20) NOT NULL DEFAULT 0,
        category varchar(160) NOT NULL,
        description text DEFAULT NULL,
        img varchar(500) DEFAULT NULL,
        status enum('draft','pending_approval','approved','rejected','ready_to_live','live','deleted') NOT NULL DEFAULT 'draft',
        content_version int(11) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        view enum('view','hide') NOT NULL DEFAULT 'view',
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try { await connection.query(`ALTER TABLE tb_pdt_categories ADD COLUMN type enum('category','sub category') NOT NULL DEFAULT 'category'`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_categories ADD COLUMN parent_id bigint(20) NOT NULL DEFAULT 0`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_categories ADD COLUMN description text DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_categories ADD COLUMN view enum('view','hide') NOT NULL DEFAULT 'view'`); } catch (e) { }

    try {
      const [scRows] = await connection.query(`SELECT * FROM tb_pdt_sub_categories`);
      for (const sc of scRows) {
        const [exists] = await connection.query(`SELECT id FROM tb_pdt_categories WHERE category = ? AND parent_id = ?`, [sc.sub_category, sc.cat_id]);
        if (exists.length === 0) {
          await connection.query(
            `INSERT INTO tb_pdt_categories (org_code, type, parent_id, category, description, img, status, content_version, created_at, updated_at, view)
             VALUES (?, 'sub category', ?, ?, '', ?, ?, ?, ?, ?, ?)`,
            [sc.org_code, sc.cat_id, sc.sub_category, sc.img || null, sc.status || 'draft', sc.content_version || 1, sc.created_at, sc.updated_at, sc.view || 'view']
          );
        }
      }
    } catch (e) { }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_sync_releases (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL,
        release_version varchar(60) DEFAULT NULL,
        released_by bigint(20) unsigned DEFAULT 0,
        released_by_name varchar(160) DEFAULT NULL,
        synced_counts longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
        backup_snapshot_path varchar(500) DEFAULT NULL,
        status enum('completed','reverted','failed','success') NOT NULL DEFAULT 'completed',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try { await connection.query(`ALTER TABLE tb_sync_releases ADD COLUMN release_version varchar(60) DEFAULT NULL AFTER org_code`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_sync_releases ADD COLUMN released_by bigint(20) unsigned DEFAULT 0 AFTER release_version`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_sync_releases ADD COLUMN released_by_name varchar(160) DEFAULT NULL AFTER released_by`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_sync_releases ADD COLUMN synced_counts longtext DEFAULT NULL AFTER released_by_name`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_sync_releases ADD COLUMN backup_snapshot_path varchar(500) DEFAULT NULL AFTER synced_counts`); } catch (e) { }

    try {
      await connection.query(`UPDATE tb_board_users SET status = 'pending_approval' WHERE email = 'testusr2@taiton.com'`);
      const [uRows] = await connection.query(`SELECT id, full_name, email, org_code FROM tb_board_users WHERE email = 'testusr2@taiton.com'`);
      if (uRows.length > 0) {
        const usr = uRows[0];
        const [apprRows] = await connection.query(`SELECT id FROM tb_org_approvals WHERE table_name = 'tb_board_users' AND record_id = ?`, [usr.id]);
        if (apprRows.length === 0) {
          await connection.query(
            `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
             VALUES (?, 'tb_board_users', 'user', ?, ?, 0, 'Organization Admin', ?, 'pending')`,
            [usr.org_code, `${usr.full_name} (${usr.email})`, usr.id, `Created user ${usr.full_name} (${usr.email}) pending approval`]
          );
        }
      }
    } catch (e) { }

    try {
      await connection.query(`UPDATE tb_pdt_categories SET status = 'pending_approval' WHERE category = 'Fashion' AND (status = 'ready_to_live' OR status = 'live')`);
      const [cRows] = await connection.query(`SELECT id, category, org_code FROM tb_pdt_categories WHERE category = 'Fashion'`);
      if (cRows.length > 0) {
        const cat = cRows[0];
        const [apprRows] = await connection.query(`SELECT id FROM tb_org_approvals WHERE table_name = 'tb_pdt_categories' AND record_id = ?`, [cat.id]);
        if (apprRows.length === 0) {
          await connection.query(
            `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
             VALUES (?, 'tb_pdt_categories', 'category', ?, ?, 0, 'Raja (Super Employee)', ?, 'pending')`,
            [cat.org_code, cat.category, cat.id, `Submitted category "${cat.category}" for approval`]
          );
        }
      }
    } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN addl_features JSON DEFAULT NULL AFTER specs`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN acces TEXT DEFAULT NULL AFTER pdt_imgs`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN related_pdts TEXT DEFAULT NULL AFTER acces`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN brand varchar(120) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN default_colour varchar(100) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN colours JSON DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_product_info ADD COLUMN kits JSON DEFAULT NULL`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_pdt_products ADD COLUMN brand varchar(120) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_products ADD COLUMN default_colour varchar(100) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_products ADD COLUMN colours JSON DEFAULT NULL`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_pdt_variants ADD COLUMN org_code varchar(40) DEFAULT 'taiton' AFTER id`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_variants ADD COLUMN discount decimal(12,2) DEFAULT 0.00`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_variants ADD COLUMN discount_type varchar(20) DEFAULT 'percentage'`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_pdt_categories ADD COLUMN banner_img varchar(500) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_pdt_categories ADD COLUMN catalog_id bigint(20) unsigned DEFAULT NULL`); } catch (e) { }

    try { await connection.query(`ALTER TABLE tb_web_catalogs ADD COLUMN publish_year varchar(20) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_catalogs ADD COLUMN product_page_thumbnail varchar(500) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_catalogs ADD COLUMN page_name varchar(150) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_catalogs ADD COLUMN image_1 varchar(500) DEFAULT NULL`); } catch (e) { }
    try { await connection.query(`ALTER TABLE tb_web_catalogs ADD COLUMN image_2 varchar(500) DEFAULT NULL`); } catch (e) { }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_pdt_commons_colors (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL DEFAULT 'taiton',
        name varchar(100) NOT NULL,
        image_url varchar(500) DEFAULT NULL,
        hex_code varchar(30) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_pdt_commons_kits (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL DEFAULT 'taiton',
        name varchar(150) NOT NULL,
        image_url varchar(500) DEFAULT NULL,
        description text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_pdt_commons_brands (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        org_code varchar(40) NOT NULL DEFAULT 'taiton',
        name varchar(150) NOT NULL,
        image_url varchar(500) DEFAULT NULL,
        description text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      const [brandCount] = await connection.query(`SELECT COUNT(*) as cnt FROM tb_pdt_commons_brands`);
      if (brandCount[0].cnt === 0) {
        await connection.query(`
          INSERT INTO tb_pdt_commons_brands (org_code, name, description) VALUES
          ('taiton', 'Taiton Core', 'Core architectural hardware solutions'),
          ('taiton', 'Taiton Luxe', 'Luxury high-end interior systems'),
          ('taiton', 'Trillions', 'Innovative building and glass accessories')
        `);
      }
    } catch (e) { }

    try {
      await connection.query(`UPDATE tb_pdt_sub_categories SET status = 'pending_approval' WHERE sub_category = 'Shirts for Men' AND (status = 'ready_to_live' OR status = 'live')`);
      const [scRows] = await connection.query(`SELECT id, sub_category, cat_id FROM tb_pdt_sub_categories WHERE sub_category = 'Shirts for Men'`);
      if (scRows.length > 0) {
        const sc = scRows[0];
        const [apprRows] = await connection.query(`SELECT id FROM tb_org_approvals WHERE table_name = 'tb_pdt_sub_categories' AND record_id = ?`, [sc.id]);
        if (apprRows.length === 0) {
          await connection.query(
            `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
             VALUES ('taiton', 'tb_pdt_sub_categories', 'subcategory', ?, ?, 0, 'Organization Admin', ?, 'pending')`,
            [sc.sub_category, sc.id, `Submitted subcategory "${sc.sub_category}" for approval`]
          );
        }
      }
    } catch (e) { }

    try {
      // Sync DB table status for rejected or approved items based on tb_org_approvals
      await connection.query(`UPDATE tb_board_users u JOIN tb_org_approvals a ON a.table_name = 'tb_board_users' AND a.record_id = u.id SET u.status = 'active', u.isActive = 1 WHERE a.approval_status = 'approved'`);
      await connection.query(`UPDATE tb_board_users u JOIN tb_org_approvals a ON a.table_name = 'tb_board_users' AND a.record_id = u.id SET u.status = 'rejected', u.isActive = 0 WHERE a.approval_status = 'rejected'`);
      await connection.query(`UPDATE tb_board_users SET status = 'active', isActive = 1 WHERE status = 'approved'`);
      await connection.query(`UPDATE tb_pdt_variants v JOIN tb_org_approvals a ON a.table_name = 'tb_pdt_variants' AND a.record_id = v.id SET v.status = 'rejected' WHERE a.approval_status = 'rejected'`);
      await connection.query(`UPDATE tb_pdt_products p JOIN tb_org_approvals a ON a.table_name = 'tb_pdt_products' AND a.record_id = p.id SET p.status = 'rejected' WHERE a.approval_status = 'rejected'`);
      await connection.query(`UPDATE tb_pdt_categories c JOIN tb_org_approvals a ON a.table_name = 'tb_pdt_categories' AND a.record_id = c.id SET c.status = 'rejected' WHERE a.approval_status = 'rejected'`);
      await connection.query(`UPDATE tb_pdt_sub_categories sc JOIN tb_org_approvals a ON a.table_name = 'tb_pdt_sub_categories' AND a.record_id = sc.id SET sc.status = 'rejected' WHERE a.approval_status = 'rejected'`);
      await connection.query(`UPDATE tb_web_spaces s JOIN tb_org_approvals a ON a.table_name = 'tb_web_spaces' AND a.record_id = s.id SET s.status = 'rejected' WHERE a.approval_status = 'rejected'`);

      const tablesToSync = [
        { name: 'tb_board_users', type: 'user', titleCol: 'full_name' },
        { name: 'tb_pdt_categories', type: 'category', titleCol: 'category' },
        { name: 'tb_pdt_sub_categories', type: 'subcategory', titleCol: 'sub_category' },
        { name: 'tb_pdt_products', type: 'product', titleCol: 'product' },
        { name: 'tb_pdt_variants', type: 'variant', titleCol: 'name' },
        { name: 'tb_web_seo', type: 'seo_page', titleCol: 'title' },
        { name: 'tb_web_blogs', type: 'blog', titleCol: 'title' },
        { name: 'tb_web_careers', type: 'career', titleCol: 'title' },
        { name: 'tb_web_catalogs', type: 'catalog', titleCol: 'name' },
        { name: 'tb_web_spaces', type: 'explore_space', titleCol: 'title' },
      ];

      for (const t of tablesToSync) {
        try {
          const [pendingItems] = await connection.query(`SELECT * FROM ${t.name} WHERE status = 'pending_approval'`);
          for (const item of pendingItems) {
            const itemOrg = item.org_code;
            const itemTitle = item[t.titleCol] || item.title || `${t.type} #${item.id}`;
            const [apprRows] = await connection.query(
              `SELECT id FROM tb_org_approvals WHERE table_name = ? AND record_id = ?`,
              [t.name, item.id]
            );
            if (apprRows.length === 0) {
              await connection.query(
                `INSERT INTO tb_org_approvals (org_code, table_name, type, title, record_id, maker, maker_name, message, approval_status)
                 VALUES (?, ?, ?, ?, ?, 0, 'Organization Admin', ?, 'pending')`,
                [itemOrg, t.name, t.type, itemTitle, item.id, `Submitted ${t.type} "${itemTitle}" for approval`]
              );
            }
          }
        } catch (sErr) { }
      }
    } catch (e) { }

    try {
      // Ensure UI Layout tables
      await connection.query(`
        CREATE TABLE IF NOT EXISTS tb_ui_components (
          id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
          component_key varchar(80) NOT NULL,
          label varchar(120) NOT NULL,
          page_route_id bigint(20) unsigned NOT NULL,
          status enum('active','inactive') NOT NULL DEFAULT 'active',
          created_at timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (id),
          UNIQUE KEY uq_component_key (page_route_id, component_key),
          CONSTRAINT fk_comp_route FOREIGN KEY (page_route_id) REFERENCES tb_config_routes (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tb_ui_templates (
          id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
          component_id bigint(20) unsigned NOT NULL,
          template_key varchar(80) NOT NULL,
          label varchar(120) NOT NULL,
          schema_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(schema_json)),
          status enum('active','inactive') NOT NULL DEFAULT 'active',
          created_at timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (id),
          UNIQUE KEY uq_component_template (component_id, template_key),
          CONSTRAINT fk_tmpl_component FOREIGN KEY (component_id) REFERENCES tb_ui_components (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tb_ui_page_components (
          id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
          org_code varchar(40) NOT NULL,
          page_route_id bigint(20) unsigned NOT NULL,
          component_id bigint(20) unsigned NOT NULL,
          active_template_id bigint(20) unsigned NOT NULL,
          sort_order int(11) NOT NULL DEFAULT 0,
          status enum('draft','pending_approval','approved','live','inactive') NOT NULL DEFAULT 'draft',
          content_version int(11) NOT NULL DEFAULT 1,
          created_at timestamp NOT NULL DEFAULT current_timestamp(),
          updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (id),
          UNIQUE KEY uq_org_page_component (org_code, page_route_id, component_id),
          KEY ix_pc_org_status (org_code, status),
          KEY fk_pc_route (page_route_id),
          KEY fk_pc_comp (component_id),
          KEY fk_pc_template (active_template_id),
          CONSTRAINT fk_pc_comp FOREIGN KEY (component_id) REFERENCES tb_ui_components (id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_pc_org FOREIGN KEY (org_code) REFERENCES tb_board_organizations (org_code) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_pc_route FOREIGN KEY (page_route_id) REFERENCES tb_config_routes (id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_pc_template FOREIGN KEY (active_template_id) REFERENCES tb_ui_templates (id) ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tb_ui_component_content (
          id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
          org_code varchar(40) NOT NULL,
          page_component_id bigint(20) unsigned NOT NULL,
          template_id bigint(20) unsigned NOT NULL,
          content_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(content_json)),
          content_version int(11) NOT NULL DEFAULT 1,
          status enum('draft','pending_approval','approved','live','archived') NOT NULL DEFAULT 'draft',
          updated_by bigint(20) unsigned DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT current_timestamp(),
          updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (id),
          KEY ix_content_org_status (org_code, status),
          KEY ix_content_page_component (page_component_id),
          KEY fk_content_tmpl (template_id),
          CONSTRAINT fk_content_org FOREIGN KEY (org_code) REFERENCES tb_board_organizations (org_code) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_content_pc FOREIGN KEY (page_component_id) REFERENCES tb_ui_page_components (id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_content_tmpl FOREIGN KEY (template_id) REFERENCES tb_ui_templates (id) ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      // Ensure /app/ui-layouts in tb_config_routes
      const [uRoute] = await connection.query(`SELECT id FROM tb_config_routes WHERE route = '/app/ui-layouts'`);
      if (uRoute.length === 0) {
        await connection.query(`INSERT INTO tb_config_routes (type, page, route, status) VALUES ('cpanel', 'UI Layouts', '/app/ui-layouts', 'active')`);
      }

      // Ensure nav item 73 is labeled 'UI Layouts'
      await connection.query(`UPDATE tb_board_navs SET label = 'UI Layouts' WHERE id = 73`);
    } catch (uiErr) {
      console.warn('[Database] UI Layouts schema ensure warning:', uiErr.message);
    }

    isSchemaEnsured = true;
    console.log('[Database] Schema verification completed.');
  } catch (err) {
    console.error('[Database] Schema verification error:', err.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('[Database] MySQL connection established successfully.');
    if (!isSchemaEnsured) {
      await ensureSchema();
    }
    return true;
  } catch (error) {
    console.error('[Database] MySQL connection attempt failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  prodPool,
  prodDbName,
  testConnection,
};
