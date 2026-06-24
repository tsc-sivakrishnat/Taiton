/**
 * Default sidebar navigation functions. Static navbar configurations have been
 * migrated to the database. All sidebars are now fully dynamic.
 */

export function getRoleNavigation(roleCode) {
  // Deprecated: sidebar items are now fully loaded dynamically from the database.
  return null;
}

/** Platform operators (sys_admin / super_admin) */
export function isPlatformOperatorRole(roleCode) {
  const role = String(roleCode ?? '').trim();
  return role === 'sys_admin' || role === 'super_admin';
}

/** Org roles that fetch/merge items from the database. Deprecated since all roles are dynamic. */
export function shouldMergeOrgNavApi(roleCode) {
  return false;
}
