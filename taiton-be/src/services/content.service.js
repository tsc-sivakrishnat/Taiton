import { pool } from '../config/db.js';
import { CONTENT_TYPES } from '../constants/permissions.js';
import { getPermissionGrant } from './permissions.service.js';
import { writeAudit } from './audit.service.js';
import {
  contentTypeToResource,
  findActiveApprovalRule,
  canApproveContentItem,
} from './approvalWorkflow.service.js';
import { createRoleNotification } from './notifications.service.js';
import { hashPassword } from '../utils/password.js';
import { rethrowAsClientError } from '../utils/mapDbError.js';
import { queries } from '../db/queries.js';

const CONTENT_TYPE_SET = new Set(['product', 'category', 'subcategory', 'seo', 'seo_page', 'blog', 'ui_element', 'career', 'variant']);
const STATUSES = new Set(['draft', 'pending_approval', 'live', 'rejected']);

const TYPE_LABELS = {
  product: 'Product',
  category: 'Category',
  subcategory: 'Sub Category',
  seo: 'SEO',
  seo_page: 'SEO Page',
  blog: 'Blog',
  ui_element: 'UI element',
  career: 'Career',
  variant: 'Variant',
  '/app/org/users': 'User registration',
  '/app/org/approval-rules': 'Approval rule configuration',
};

function permForType(contentType) {
  const map = CONTENT_TYPES[contentType];
  if (!map) return null;
  return map;
}

async function resolveCreateStatus({ organizationId, contentType, callerRole }) {
  const resource = contentTypeToResource(contentType);
  const isPlatformOperator = callerRole === 'sys_admin' || callerRole === 'super_admin';
  const orgRule = !isPlatformOperator ? await findActiveApprovalRule({
    organizationId,
    resource,
    makerRole: callerRole,
  }) : null;

  if (orgRule) {
    return { status: 'pending_approval', checkerRole: orgRule.checkerRole };
  }

  const perms = permForType(contentType);
  const grant = await getPermissionGrant(callerRole, perms.write, organizationId);
  const publishGrant = await getPermissionGrant(callerRole, perms.publish, organizationId);

  if (grant.accessLevel === 'direct' && publishGrant.allowed && publishGrant.accessLevel === 'direct') {
    return { status: 'live', checkerRole: null };
  }
  if (grant.accessLevel === 'direct' && publishGrant.accessLevel === 'approval_required') {
    return {
      status: 'pending_approval',
      checkerRole: publishGrant.approverRoleCode ?? null,
    };
  }
  return { status: 'draft', checkerRole: null };
}

export async function listContent({
  organizationId,
  roleCode,
  contentType,
  limit = 20,
  offset = 0,
  status,
}) {
  const perms = permForType(contentType);
  if (!perms) {
    const err = new Error('Invalid content type');
    err.status = 400;
    throw err;
  }
  const readGrant = await getPermissionGrant(roleCode, perms.write, organizationId);
  if (!readGrant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  const off = Math.max(0, Number(offset) || 0);
  let where = 'ci.org_id = :organizationId AND ci.content_type = :contentType';
  const params = { organizationId, contentType, limit: lim, offset: off };
  if (status && STATUSES.has(status)) {
    where += ' AND ci.status = :status';
    params.status = status;
  }
  const [rows] = await pool.query(
    `SELECT ci.id, ci.content_type AS contentType, ci.title, ci.summary, ci.payload_json AS payloadJson,
            ci.status, ci.created_by AS createdBy, u.role AS createdByRole,
            ci.submitted_at AS submittedAt, ci.approved_by AS approvedBy, ci.approved_at AS approvedAt,
            ci.rejection_note AS rejectionNote, ci.created_at AS createdAt, ci.updated_at AS updatedAt
     FROM tb_csd_content_items ci
     INNER JOIN tb_cpanel_users u ON u.id = ci.created_by
     WHERE ${where}
     ORDER BY ci.id DESC LIMIT :limit OFFSET :offset`,
    params,
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tb_csd_content_items ci WHERE ${where}`,
    params,
  );
  return {
    items: rows.map((r) => ({
      ...r,
      payload: r.payloadJson ? JSON.parse(r.payloadJson) : null,
    })),
    total: Number(countRow?.total ?? 0),
    limit: lim,
    offset: off,
  };
}

export async function createContent({
  organizationId,
  contentType,
  title,
  summary,
  payload,
  callerAuth,
}) {
  const perms = permForType(contentType);
  if (!CONTENT_TYPE_SET.has(contentType)) {
    const err = new Error('Invalid content type');
    err.status = 400;
    throw err;
  }
  const grant = await getPermissionGrant(callerAuth.role, perms.write, organizationId);
  if (!grant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const titleTrim = String(title ?? '').trim();
  const { status, checkerRole } = await resolveCreateStatus({
    organizationId,
    contentType,
    callerRole: callerAuth.role,
  });
  const submittedAt = status === 'pending_approval' ? new Date() : null;

  const [result] = await pool.query(
    `INSERT INTO tb_csd_content_items
      (org_id, content_type, title, summary, payload_json, status, created_by, submitted_at)
     VALUES (:organizationId, :contentType, :title, :summary, :payloadJson, :status, :createdBy, :submittedAt)`,
    {
      organizationId,
      contentType,
      title: titleTrim,
      summary: summary?.trim() || null,
      payloadJson: payload != null ? JSON.stringify(payload) : null,
      status,
      createdBy: callerAuth.userId,
      submittedAt,
    },
  );

  const typeLabel = TYPE_LABELS[contentType] ?? 'Item';

  if (status === 'pending_approval' && checkerRole) {
    await createRoleNotification({
      organizationId,
      rolesCsv: checkerRole,
      title: `${typeLabel} awaiting approval`,
      body: `"${titleTrim}" was submitted by ${callerAuth.role}. Open Approvals to review.`,
      severity: 'warning',
    });
  } else if (status === 'live') {
    await createRoleNotification({
      organizationId,
      userId: callerAuth.userId,
      title: `${typeLabel} published`,
      body: `"${titleTrim}" is now live.`,
      severity: 'success',
    });
    try {
      await syncContentItemToTaitonTable(organizationId, contentType, titleTrim, payload);
    } catch (e) {
      console.error('Failed to sync direct publish item to Taiton table:', e);
    }
  }

  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'content.create',
    resourceType: contentType,
    resourceId: result.insertId,
    detail: { status, title: titleTrim, checkerRole },
  });

  return {
    id: result.insertId,
    status,
    checkerRole,
    message:
      status === 'pending_approval'
        ? `Submitted for approval. ${checkerRole ?? 'Checker'} will be notified.`
        : status === 'live'
          ? 'Published live.'
          : 'Saved as draft.',
  };
}

export async function approveContent({
  organizationId,
  id,
  approve,
  rejectionNote,
  callerAuth,
}) {
  const [[item]] = await pool.query(
    `SELECT content_type AS contentType, status, title, created_by AS createdBy
     FROM tb_csd_content_items
     WHERE id = :id AND org_id = :organizationId`,
    { id, organizationId },
  );
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }
  const perms = permForType(item.contentType);
  const allowed = await canApproveContentItem({
    organizationId,
    contentType: item.contentType,
    createdByUserId: item.createdBy,
    callerRole: callerAuth.role,
    publishPermissionCode: perms?.publish ?? null,
    getPermissionGrant,
  });
  if (!allowed) {
    const err = new Error('You are not the checker for this submission');
    err.status = 403;
    throw err;
  }
  if (item.status !== 'pending_approval') {
    const err = new Error('Item is not pending approval');
    err.status = 400;
    throw err;
  }

  if (item.contentType === '/app/org/users' && approve) {
    try {
      const [[contentItem]] = await pool.query(
        `SELECT payload_json AS payloadJson FROM tb_csd_content_items WHERE id = :id`,
        { id }
      );
      const payload = JSON.parse(contentItem?.payloadJson || '{}');
      const emailNorm = String(payload.email ?? '').trim().toLowerCase();
      const name = String(payload.fullName ?? '').trim();
      const role = String(payload.role ?? '').trim();
      const mobileDigits = String(payload.mobile ?? '').replace(/\D/g, '').slice(0, 10);

      const [orgRows] = await pool.query(queries.orgCodeByOrganizationId, {
        organizationId,
      });
      const orgRow = orgRows?.[0];
      if (!orgRow?.code) {
        throw new Error('Organization not found');
      }

      const passwordHash = await hashPassword(mobileDigits);
      const [insertRes] = await pool.query(queries.userInsert, {
        orgCode: orgRow.code,
        email: emailNorm,
        passwordHash,
        fullName: name,
        mobile: mobileDigits,
        role,
      });

      await writeAudit({
        organizationId,
        actorUserId: item.createdBy,
        actorRole: 'system',
        action: 'user.register',
        resourceType: 'user',
        resourceId: insertRes.insertId,
        detail: { email: emailNorm, role, approvedBy: callerAuth.userId },
      });
    } catch (e) {
      rethrowAsClientError(e);
    }
  }

  const newStatus = approve ? 'live' : 'rejected';
  await pool.query(
    `UPDATE tb_csd_content_items SET status = :newStatus, approved_by = :approvedBy,
      approved_at = UTC_TIMESTAMP(), rejection_note = :rejectionNote
     WHERE id = :id AND org_id = :organizationId`,
    {
      id,
      organizationId,
      newStatus,
      approvedBy: callerAuth.userId,
      rejectionNote: approve ? null : rejectionNote || 'Rejected',
    },
  );

  if (approve) {
    try {
      const [[approvedItem]] = await pool.query(
        `SELECT content_type AS contentType, title, payload_json AS payloadJson FROM tb_csd_content_items WHERE id = :id`,
        { id }
      );
      if (approvedItem) {
        await syncContentItemToTaitonTable(
          organizationId,
          approvedItem.contentType,
          approvedItem.title,
          approvedItem.payloadJson ? JSON.parse(approvedItem.payloadJson) : {}
        );
      }
    } catch (e) {
      console.error('Failed to sync approved item to Taiton table:', e);
    }
  }

  const typeLabel = TYPE_LABELS[item.contentType] ?? 'Item';
  await createRoleNotification({
    organizationId,
    userId: item.createdBy,
    title: approve ? `${typeLabel} approved` : `${typeLabel} rejected`,
    body: approve
      ? `"${item.title}" was approved by ${callerAuth.role} and is now live.`
      : `"${item.title}" was rejected by ${callerAuth.role}.`,
    severity: approve ? 'success' : 'error',
  });

  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: approve ? 'content.approve' : 'content.reject',
    resourceType: item.contentType,
    resourceId: id,
  });

  return { id, status: newStatus };
}

export async function listPendingContent({ organizationId }) {
  const [rows] = await pool.query(
    `SELECT ci.id, ci.content_type AS contentType, ci.title, ci.summary, ci.payload_json AS payloadJson, ci.status, ci.created_by AS createdBy,
            u.role AS createdByRole
     FROM tb_csd_content_items ci
     LEFT JOIN tb_cpanel_users u ON u.id = ci.created_by
     WHERE ci.org_id = :organizationId AND ci.status = 'pending_approval'
     ORDER BY ci.created_at DESC`,
    { organizationId }
  );
  return { items: rows };
}

export async function syncContentItemToTaitonTable(orgId, contentType, title, payload) {
  if (!payload) return;
  const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  if (contentType === 'category') {
    await pool.query(
      `INSERT INTO tb_taiton_categories 
        (org_id, cat_id, category_name, seo_meta_title, seo_meta_description, focus_keyword, secondary_keywords, category_image, image_alt_text, related_products)
       VALUES (:orgId, :cat_id, :category_name, :seo_meta_title, :seo_meta_description, :focus_keyword, :secondary_keywords, :category_image, :image_alt_text, :related_products)
       ON DUPLICATE KEY UPDATE
        category_name = VALUES(category_name),
        seo_meta_title = VALUES(seo_meta_title),
        seo_meta_description = VALUES(seo_meta_description),
        focus_keyword = VALUES(focus_keyword),
        secondary_keywords = VALUES(secondary_keywords),
        category_image = VALUES(category_image),
        image_alt_text = VALUES(image_alt_text),
        related_products = VALUES(related_products)`,
      {
        orgId,
        cat_id: p.cat_id || '',
        category_name: title || p.category_name || '',
        seo_meta_title: p.seo_meta_title || null,
        seo_meta_description: p.seo_meta_description || null,
        focus_keyword: p.focus_keyword || null,
        secondary_keywords: p.secondary_keywords || null,
        category_image: p.category_image || null,
        image_alt_text: p.image_alt_text || null,
        related_products: p.related_products || null,
      }
    );
  } else if (contentType === 'subcategory') {
    await pool.query(
      `INSERT INTO tb_taiton_subcategories 
        (org_id, sub_cat_id, parent_cat_id, sub_category_name, url, seo_meta_title, seo_meta_description, focus_keyword, secondary_keywords, related_products, image_alt_text, subcategory_image)
       VALUES (:orgId, :sub_cat_id, :parent_cat_id, :sub_category_name, :url, :seo_meta_title, :seo_meta_description, :focus_keyword, :secondary_keywords, :related_products, :image_alt_text, :subcategory_image)
       ON DUPLICATE KEY UPDATE
        parent_cat_id = VALUES(parent_cat_id),
        sub_category_name = VALUES(sub_category_name),
        url = VALUES(url),
        seo_meta_title = VALUES(seo_meta_title),
        seo_meta_description = VALUES(seo_meta_description),
        focus_keyword = VALUES(focus_keyword),
        secondary_keywords = VALUES(secondary_keywords),
        related_products = VALUES(related_products),
        image_alt_text = VALUES(image_alt_text),
        subcategory_image = VALUES(subcategory_image)`,
      {
        orgId,
        sub_cat_id: p.sub_cat_id || '',
        parent_cat_id: p.parent_cat_id || '',
        sub_category_name: title || p.sub_category_name || '',
        url: p.url || null,
        seo_meta_title: p.seo_meta_title || null,
        seo_meta_description: p.seo_meta_description || null,
        focus_keyword: p.focus_keyword || null,
        secondary_keywords: p.secondary_keywords || null,
        related_products: p.related_products || null,
        image_alt_text: p.image_alt_text || null,
        subcategory_image: p.subcategory_image || null,
      }
    );
  } else if (contentType === 'product') {
    await pool.query(
      `INSERT INTO tb_taiton_products 
        (org_id, prd_id, cat_id, sub_cat_id, product_name, product_code, url, seo_meta_title, seo_meta_description, focus_keyword, secondary_keywords, product_description, product_features, product_specifications, canonical_url, product_image, has_variants, variants, has_kits, kits)
       VALUES (:orgId, :prd_id, :cat_id, :sub_cat_id, :product_name, :product_code, :url, :seo_meta_title, :seo_meta_description, :focus_keyword, :secondary_keywords, :product_description, :product_features, :product_specifications, :canonical_url, :product_image, :has_variants, :variants, :has_kits, :kits)
       ON DUPLICATE KEY UPDATE
        cat_id = VALUES(cat_id),
        sub_cat_id = VALUES(sub_cat_id),
        product_name = VALUES(product_name),
        product_code = VALUES(product_code),
        url = VALUES(url),
        seo_meta_title = VALUES(seo_meta_title),
        seo_meta_description = VALUES(seo_meta_description),
        focus_keyword = VALUES(focus_keyword),
        secondary_keywords = VALUES(secondary_keywords),
        product_description = VALUES(product_description),
        product_features = VALUES(product_features),
        product_specifications = VALUES(product_specifications),
        canonical_url = VALUES(canonical_url),
        product_image = VALUES(product_image),
        has_variants = VALUES(has_variants),
        variants = VALUES(variants),
        has_kits = VALUES(has_kits),
        kits = VALUES(kits)`,
      {
        orgId,
        prd_id: p.prd_id || '',
        cat_id: p.cat_id || '',
        sub_cat_id: p.sub_cat_id || '',
        product_name: title || p.productName || '',
        product_code: p.product_code || p.productCode || null,
        url: p.url || null,
        seo_meta_title: p.seo_meta_title || null,
        seo_meta_description: p.seo_meta_description || null,
        focus_keyword: p.focus_keyword || null,
        secondary_keywords: p.secondary_keywords || null,
        product_description: p.product_description || p.productDescription || null,
        product_features: p.product_features ? (typeof p.product_features === 'string' ? p.product_features : JSON.stringify(p.product_features)) : null,
        product_specifications: p.product_specifications ? (typeof p.product_specifications === 'string' ? p.product_specifications : JSON.stringify(p.product_specifications)) : null,
        canonical_url: p.canonical_url || null,
        product_image: p.product_image || null,
        has_variants: p.has_variants || 'no',
        variants: p.variants ? (typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants)) : null,
        has_kits: p.has_kits || 'no',
        kits: p.kits ? (typeof p.kits === 'string' ? p.kits : JSON.stringify(p.kits)) : null,
      }
    );
  } else if (contentType === 'seo' || contentType === 'seo_page') {
    // Auto-migrate tables
    const cols = [
      { name: 'page_name', type: 'varchar(255) DEFAULT NULL' },
      { name: 'url_slug', type: 'varchar(255) DEFAULT NULL' },
      { name: 'h1_tag', type: 'varchar(255) DEFAULT NULL' },
      { name: 'schema_type', type: 'varchar(255) DEFAULT NULL' },
      { name: 'robots_tag', type: 'varchar(255) DEFAULT NULL' },
      { name: 'image_alt_text', type: 'varchar(255) DEFAULT NULL' },
      { name: 'status', type: 'varchar(50) DEFAULT NULL' },
      { name: 'related_products', type: 'text DEFAULT NULL' }
    ];
    for (const col of cols) {
      try {
        await pool.query(`ALTER TABLE tb_taiton_seo_pages ADD COLUMN ${col.name} ${col.type}`);
      } catch (e) {}
    }

    await pool.query(
      `INSERT INTO tb_taiton_seo_pages 
        (org_id, page_url, seo_meta_title, seo_meta_description, focus_keyword, secondary_keywords, canonical_url, og_title, og_description, og_image, page_name, url_slug, h1_tag, schema_type, robots_tag, image_alt_text, status, related_products)
       VALUES (:orgId, :page_url, :seo_meta_title, :seo_meta_description, :focus_keyword, :secondary_keywords, :canonical_url, :og_title, :og_description, :og_image, :page_name, :url_slug, :h1_tag, :schema_type, :robots_tag, :image_alt_text, :status, :related_products)
       ON DUPLICATE KEY UPDATE
        seo_meta_title = VALUES(seo_meta_title),
        seo_meta_description = VALUES(seo_meta_description),
        focus_keyword = VALUES(focus_keyword),
        secondary_keywords = VALUES(secondary_keywords),
        canonical_url = VALUES(canonical_url),
        og_title = VALUES(og_title),
        og_description = VALUES(og_description),
        og_image = VALUES(og_image),
        page_name = VALUES(page_name),
        url_slug = VALUES(url_slug),
        h1_tag = VALUES(h1_tag),
        schema_type = VALUES(schema_type),
        robots_tag = VALUES(robots_tag),
        image_alt_text = VALUES(image_alt_text),
        status = VALUES(status),
        related_products = VALUES(related_products)`,
      {
        orgId,
        page_url: p.page_url || p.url || title || '',
        seo_meta_title: p.seo_meta_title || null,
        seo_meta_description: p.seo_meta_description || null,
        focus_keyword: p.focus_keyword || null,
        secondary_keywords: p.secondary_keywords || null,
        canonical_url: p.canonical_url || null,
        og_title: p.og_title || null,
        og_description: p.og_description || null,
        og_image: p.og_image || null,
        page_name: p.page_name || title || '',
        url_slug: p.url_slug || '',
        h1_tag: p.h1_tag || null,
        schema_type: p.schema_type || null,
        robots_tag: p.robots_tag || null,
        image_alt_text: p.image_alt_text || null,
        status: p.status || 'draft',
        related_products: p.related_products || null,
      }
    );
  } else if (contentType === 'variant') {
    // Auto-create/alter variants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tb_taiton_variants (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        org_id bigint(20) NOT NULL,
        variant_id varchar(64) NOT NULL,
        product_id varchar(64) NOT NULL,
        variant_name varchar(190) NOT NULL,
        variant_slug varchar(190) DEFAULT NULL,
        variant_code varchar(100) DEFAULT NULL,
        color_finish varchar(100) DEFAULT NULL,
        sku varchar(100) DEFAULT NULL,
        image_url varchar(500) DEFAULT NULL,
        image_alt_text varchar(255) DEFAULT NULL,
        variant_title varchar(255) DEFAULT NULL,
        variant_seo_title varchar(255) DEFAULT NULL,
        variant_seo_description text DEFAULT NULL,
        related_products text DEFAULT NULL,
        variant_order int(11) NOT NULL DEFAULT 0,
        canonical_url varchar(255) DEFAULT NULL,
        status varchar(50) DEFAULT 'draft',
        created_at timestamp NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_org_variant (org_id, variant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist on legacy tables
    const variantCols = [
      { name: 'variant_order', type: 'int(11) NOT NULL DEFAULT 0' },
      { name: 'canonical_url', type: 'varchar(255) DEFAULT NULL' },
      { name: 'status', type: 'varchar(50) DEFAULT \'draft\'' }
    ];
    for (const col of variantCols) {
      try {
        await pool.query(`ALTER TABLE tb_taiton_variants ADD COLUMN ${col.name} ${col.type}`);
      } catch (e) {}
    }

    await pool.query(
      `INSERT INTO tb_taiton_variants 
        (org_id, variant_id, product_id, variant_name, variant_slug, variant_code, color_finish, sku, image_url, image_alt_text, variant_title, variant_seo_title, variant_seo_description, related_products, variant_order, canonical_url, status)
       VALUES (:orgId, :variant_id, :product_id, :variant_name, :variant_slug, :variant_code, :color_finish, :sku, :image_url, :image_alt_text, :variant_title, :variant_seo_title, :variant_seo_description, :related_products, :variant_order, :canonical_url, :status)
       ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        variant_name = VALUES(variant_name),
        variant_slug = VALUES(variant_slug),
        variant_code = VALUES(variant_code),
        color_finish = VALUES(color_finish),
        sku = VALUES(sku),
        image_url = VALUES(image_url),
        image_alt_text = VALUES(image_alt_text),
        variant_title = VALUES(variant_title),
        variant_seo_title = VALUES(variant_seo_title),
        variant_seo_description = VALUES(variant_seo_description),
        related_products = VALUES(related_products),
        variant_order = VALUES(variant_order),
        canonical_url = VALUES(canonical_url),
        status = VALUES(status)`,
      {
        orgId,
        variant_id: p.variant_id || '',
        product_id: p.product_id || '',
        variant_name: title || p.variant_name || '',
        variant_slug: p.variant_slug || '',
        variant_code: p.variant_code || null,
        color_finish: p.color_finish || null,
        sku: p.sku || null,
        image_url: p.image_url || null,
        image_alt_text: p.image_alt_text || null,
        variant_title: p.variant_title || null,
        variant_seo_title: p.variant_seo_title || null,
        variant_seo_description: p.variant_seo_description || null,
        related_products: p.related_products || null,
        variant_order: parseInt(p.variant_order || 0, 10),
        canonical_url: p.canonical_url || null,
        status: p.status || 'draft',
      }
    );

    try {
      await updateProductVariantsFlag(orgId, p.product_id);
    } catch (e) {
      console.error('Failed to sync variant flags:', e);
    }
  } else if (contentType === 'blog') {
    await pool.query(
      `INSERT INTO tb_taiton_blogs 
        (org_id, blog_id, blog_title, url, url_slug, h1_tag, seo_meta_title, seo_meta_description, focus_keyword, secondary_keywords, canonical_url, og_title, og_description, og_image, schema_type, robots_tag, image_alt_text, blog_content, author_name, blog_category, reading_time, featured_image, publish_date, modified_date, faq_section, internal_linking_targets, related_products, redirect_url_301, last_updated_date, status)
       VALUES (:orgId, :blog_id, :blog_title, :url, :url_slug, :h1_tag, :seo_meta_title, :seo_meta_description, :focus_keyword, :secondary_keywords, :canonical_url, :og_title, :og_description, :og_image, :schema_type, :robots_tag, :image_alt_text, :blog_content, :author_name, :blog_category, :reading_time, :featured_image, :publish_date, :modified_date, :faq_section, :internal_linking_targets, :related_products, :redirect_url_301, :last_updated_date, :status)
       ON DUPLICATE KEY UPDATE
        blog_title = VALUES(blog_title),
        url = VALUES(url),
        url_slug = VALUES(url_slug),
        h1_tag = VALUES(h1_tag),
        seo_meta_title = VALUES(seo_meta_title),
        seo_meta_description = VALUES(seo_meta_description),
        focus_keyword = VALUES(focus_keyword),
        secondary_keywords = VALUES(secondary_keywords),
        canonical_url = VALUES(canonical_url),
        og_title = VALUES(og_title),
        og_description = VALUES(og_description),
        og_image = VALUES(og_image),
        schema_type = VALUES(schema_type),
        robots_tag = VALUES(robots_tag),
        image_alt_text = VALUES(image_alt_text),
        blog_content = VALUES(blog_content),
        author_name = VALUES(author_name),
        blog_category = VALUES(blog_category),
        reading_time = VALUES(reading_time),
        featured_image = VALUES(featured_image),
        publish_date = VALUES(publish_date),
        modified_date = VALUES(modified_date),
        faq_section = VALUES(faq_section),
        internal_linking_targets = VALUES(internal_linking_targets),
        related_products = VALUES(related_products),
        redirect_url_301 = VALUES(redirect_url_301),
        last_updated_date = VALUES(last_updated_date),
        status = VALUES(status)`,
      {
        orgId,
        blog_id: p.blog_id || '',
        blog_title: title || p.blog_title || '',
        url: p.url || null,
        url_slug: p.url_slug || '',
        h1_tag: p.h1_tag || null,
        seo_meta_title: p.seo_meta_title || null,
        seo_meta_description: p.seo_meta_description || null,
        focus_keyword: p.focus_keyword || null,
        secondary_keywords: p.secondary_keywords || null,
        canonical_url: p.canonical_url || null,
        og_title: p.og_title || null,
        og_description: p.og_description || null,
        og_image: p.og_image || null,
        schema_type: p.schema_type || null,
        robots_tag: p.robots_tag || null,
        image_alt_text: p.image_alt_text || null,
        blog_content: p.blog_content || null,
        author_name: p.author_name || null,
        blog_category: p.blog_category || null,
        reading_time: p.reading_time || null,
        featured_image: p.featured_image || null,
        publish_date: p.publish_date || null,
        modified_date: p.modified_date || null,
        faq_section: p.faq_section ? (typeof p.faq_section === 'string' ? p.faq_section : JSON.stringify(p.faq_section)) : null,
        internal_linking_targets: p.internal_linking_targets || null,
        related_products: p.related_products || null,
        redirect_url_301: p.redirect_url_301 || null,
        last_updated_date: p.last_updated_date || null,
        status: p.status || 'draft',
      }
    );
  }
}

export async function updateContent({
  organizationId,
  contentType,
  id,
  title,
  summary,
  payload,
  callerAuth,
}) {
  const perms = permForType(contentType);
  if (!CONTENT_TYPE_SET.has(contentType)) {
    const err = new Error('Invalid content type');
    err.status = 400;
    throw err;
  }
  const grant = await getPermissionGrant(callerAuth.role, perms.write, organizationId);
  if (!grant.allowed) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const [[item]] = await pool.query(
    `SELECT id, status, created_by AS createdBy FROM tb_csd_content_items WHERE id = :id AND org_id = :organizationId AND content_type = :contentType`,
    { id, organizationId, contentType }
  );
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }

  const titleTrim = String(title ?? '').trim();
  const { status, checkerRole } = await resolveCreateStatus({
    organizationId,
    contentType,
    callerRole: callerAuth.role,
  });
  const submittedAt = status === 'pending_approval' ? new Date() : null;

  await pool.query(
    `UPDATE tb_csd_content_items
     SET title = :title, summary = :summary, payload_json = :payloadJson, status = :status, submitted_at = :submittedAt
     WHERE id = :id AND org_id = :organizationId`,
    {
      id,
      organizationId,
      title: titleTrim,
      summary: summary?.trim() || null,
      payloadJson: payload != null ? JSON.stringify(payload) : null,
      status,
      submittedAt,
    }
  );

  const typeLabel = TYPE_LABELS[contentType] ?? 'Item';

  if (status === 'pending_approval' && checkerRole) {
    await createRoleNotification({
      organizationId,
      rolesCsv: checkerRole,
      title: `${typeLabel} awaiting approval`,
      body: `"${titleTrim}" was updated by ${callerAuth.role}. Open Approvals to review.`,
      severity: 'warning',
    });
  } else if (status === 'live') {
    await createRoleNotification({
      organizationId,
      userId: callerAuth.userId,
      title: `${typeLabel} published`,
      body: `"${titleTrim}" is now live.`,
      severity: 'success',
    });
    try {
      await syncContentItemToTaitonTable(organizationId, contentType, titleTrim, payload);
    } catch (e) {
      console.error('Failed to sync direct publish item to Taiton table:', e);
    }
  }

  await writeAudit({
    organizationId,
    actorUserId: callerAuth.userId,
    actorRole: callerAuth.role,
    action: 'content.update',
    resourceType: contentType,
    resourceId: id,
    detail: { status, title: titleTrim, checkerRole },
  });

  return {
    id,
    status,
    checkerRole,
    message:
      status === 'pending_approval'
        ? `Submitted for approval. ${checkerRole ?? 'Checker'} will be notified.`
        : status === 'live'
          ? 'Published live.'
          : 'Saved as draft.',
  };
}

export async function updateProductVariantsFlag(organizationId, prdId) {
  if (!prdId) return;

  // 1. Fetch all live/approved content items of type 'variant' with this prd_id
  const [rows] = await pool.query(
    `SELECT payload_json FROM tb_csd_content_items 
     WHERE org_id = :organizationId AND content_type = 'variant' AND status = 'live'`,
    { organizationId }
  );
  
  const variantsList = [];
  rows.forEach(r => {
    try {
      const payload = JSON.parse(r.payload_json);
      if (payload.product_id === prdId) {
        variantsList.push({
          variantId: payload.variant_id,
          variantName: payload.variant_name,
          variantSlug: payload.variant_slug || '',
          variantCode: payload.variant_code || '',
          color_finish: payload.color_finish || '',
          sku: payload.sku || '',
          image_url: payload.image_url || '',
          image_alt_text: payload.image_alt_text || '',
          variant_title: payload.variant_title || '',
          variant_seo_title: payload.variant_seo_title || '',
          variant_seo_description: payload.variant_seo_description || '',
          related_products: payload.related_products || '',
          variant_order: parseInt(payload.variant_order || 0, 10),
          canonical_url: payload.canonical_url || '',
        });
      }
    } catch (e) {}
  });

  const hasVariants = variantsList.length > 0 ? 'yes' : 'no';

  // 2. Update the parent product's content item in tb_csd_content_items
  const [[prdItem]] = await pool.query(
    `SELECT id, payload_json FROM tb_csd_content_items 
     WHERE org_id = :organizationId AND content_type = 'product' AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.prd_id')) = :prdId`,
    { organizationId, prdId }
  );

  if (prdItem) {
    try {
      const payload = JSON.parse(prdItem.payload_json);
      payload.has_variants = hasVariants;
      payload.variants = variantsList;
      await pool.query(
        `UPDATE tb_csd_content_items SET payload_json = :payloadJson WHERE id = :id`,
        { id: prdItem.id, payloadJson: JSON.stringify(payload) }
      );
    } catch (e) {
      console.error('Failed to parse/update product payload:', e);
    }
  }

  // 3. Update the synced tb_taiton_products table directly
  await pool.query(
    `UPDATE tb_taiton_products 
     SET has_variants = :hasVariants, variants = :variantsJson 
     WHERE org_id = :organizationId AND prd_id = :prdId`,
    {
      organizationId,
      prdId,
      hasVariants,
      variantsJson: variantsList.length > 0 ? JSON.stringify(variantsList) : null
    }
  );
}
