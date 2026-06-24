/** Permission codes — must match tb_cpanel_permissions.code */
export const PERMISSIONS = {
  PLATFORM_ORGS: 'platform.orgs.manage',
  PLATFORM_ROLES: 'platform.roles.manage',
  PLATFORM_NAV: 'platform.nav.manage',
  PLATFORM_USERS_ORG_ADMIN: 'platform.users.org_admin',
  ORG_CONFIG: 'org.config.manage',
  ORG_USERS: 'org.users.manage',
  ORG_APPROVAL_RULES: 'org.approval_rules.manage',
  ORG_AUDIT_VIEW: 'org.audit.view',
  PRODUCTS_READ: 'content.products.read',
  PRODUCTS_WRITE: 'content.products.write',
  PRODUCTS_PUBLISH: 'content.products.publish',
  SEO_WRITE: 'content.seo.write',
  SEO_PUBLISH: 'content.seo.publish',
  UI_WRITE: 'content.ui.write',
  UI_PUBLISH: 'content.ui.publish',
  CUSTOMER_REQUESTS_READ: 'customer_requests.read',
  CUSTOMER_REQUESTS_MANAGE: 'customer_requests.manage',
};

export const PLATFORM_ROLES = new Set(['sys_admin', 'super_admin']);

export const CONTENT_TYPES = {
  product: { write: PERMISSIONS.PRODUCTS_WRITE, publish: PERMISSIONS.PRODUCTS_PUBLISH },
  seo: { write: PERMISSIONS.SEO_WRITE, publish: PERMISSIONS.SEO_PUBLISH },
  ui_element: { write: PERMISSIONS.UI_WRITE, publish: PERMISSIONS.UI_PUBLISH },
};
