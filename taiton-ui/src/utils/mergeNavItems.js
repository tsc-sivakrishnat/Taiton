import { roleMatchesCsv } from './roleAccess.js';

export function filterApiNavItemsForRole(items, roleCode) {
  return Array.isArray(items) ? items : [];
}

/** Dedupe sidebar nav by route; notifications live in the header bell, not the sidebar. */
export function mergeNavItemsForRole(items) {
  const list = Array.isArray(items) ? [...items] : [];
  const byRoute = new Map();
  for (const item of list) {
    const route = String(item.route ?? '').trim();
    if (!route || route === '/app/notifications') continue;
    if (!byRoute.has(route)) byRoute.set(route, { ...item, route });
  }
  return [...byRoute.values()];
}

const BLOCKED_ORG_NAV_ROUTES = new Set([
  '/app/platform',
  '/app/customer-requests',
  '/app/admin/actor-registration',
]);

/** Drop platform/onboarding routes from org API nav (legacy DB seeds). */
export function filterOrgNavApiItems(items, roleCode) {
  const role = String(roleCode ?? '').trim();
  if (role === 'sys_admin' || role === 'super_admin') {
    return [];
  }
  return (Array.isArray(items) ? items : []).filter((item) => {
    const route = String(item.route ?? '').trim().toLowerCase();
    if (!route || BLOCKED_ORG_NAV_ROUTES.has(route)) return false;
    if (route.startsWith('/app/onboarding/')) return false;
    const label = String(item.label ?? '').trim().toLowerCase();
    if (label === 'platform' || label === 'customer requests') return false;
    return true;
  });
}

/** Static role nav first, then org DB items (first route wins). */
export function mergeStaticNavWithApi(staticRoleNav, apiItems) {
  if (!staticRoleNav) {
    return mergeNavItemsForRole(apiItems);
  }
  const combined = [
    ...(staticRoleNav.top ?? []),
    ...(staticRoleNav.bottom ?? []),
    ...(Array.isArray(apiItems) ? apiItems : []),
  ];
  return mergeNavItemsForRole(combined);
}
