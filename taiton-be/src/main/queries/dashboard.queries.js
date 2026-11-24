/**
 * Centralized SQL Queries for Dashboard Summary & Metrics.
 */

const DASHBOARD_QUERIES = {
  GET_USER_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_board_users WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status = 'active'
  `,
  GET_ROLES_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_board_roles WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,
  GET_PRODUCT_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_pdt_products WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'deleted' AND status != 'archived'
  `,
  GET_CATEGORY_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_pdt_categories WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'deleted' AND status != 'archived'
  `,
  GET_SUBCATEGORY_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_pdt_subcategories WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'deleted' AND status != 'archived'
  `,
  GET_VARIANT_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_pdt_variants WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'deleted' AND status != 'archived'
  `,
  GET_BLOG_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_web_blogs WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'archived'
  `,
  GET_LIVE_BLOG_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_web_blogs WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status IN ('live', 'ready_to_live', 'approved')
  `,
  GET_CATALOG_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_web_catalogs WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'archived'
  `,
  GET_CAREER_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_web_careers WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND status != 'archived'
  `,
  GET_APPLICATIONS_COUNT_BY_ORG: `
    SELECT COUNT(*) as count FROM tb_web_contact WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,
  GET_UNREAD_NOTIFICATION_COUNT: `
    SELECT COUNT(*) as count FROM tb_org_notifications n
    LEFT JOIN tb_org_readrecepits r ON n.id = r.notification_id AND r.read_by = ?
    WHERE (LOWER(n.org_code) = LOWER(?) OR ? IS NULL) AND (n.sent_to = ? OR n.sent_to = 0 OR n.sent_to IS NULL) AND r.id IS NULL
  `,
  GET_PENDING_APPROVAL_COUNT: `
    SELECT COUNT(*) as count FROM tb_org_approvals WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL) AND approval_status = 'pending'
  `,
  GET_TOTAL_ORGANIZATIONS_COUNT: `
    SELECT COUNT(*) as count FROM tb_board_organizations
  `,
  GET_TOTAL_MEMBERS_ALL_ORGS_COUNT: `
    SELECT COUNT(*) as count FROM tb_board_users WHERE status = 'active'
  `,
};

module.exports = DASHBOARD_QUERIES;
